// @vitest-environment node
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'

const db = new PGlite()
const residentOne = '10000000-0000-4000-8000-000000000001'
const residentTwo = '10000000-0000-4000-8000-000000000002'
const committee = '10000000-0000-4000-8000-000000000003'
const houseOne = '20000000-0000-4000-8000-000000000001'
const houseTwo = '20000000-0000-4000-8000-000000000002'
let rolesAvailable = true
let billsAvailable = false

async function runMigration(path: string) {
  let sql = await readFile(resolve(process.cwd(), path), 'utf8')
  if (!rolesAvailable) {
    sql = sql
      .replace(/revoke all on function ([^\n]+) from public, anon;/g, 'revoke all on function $1 from public;')
      .replace(/grant[\s\S]*?\bto authenticated(?:,\s*anon)?;/g, '')
      .replace(/\s+to authenticated(?=\s*(?:using|with check))/g, '')
  }
  await db.exec(sql)
}

beforeAll(async () => {
  for (const role of ['anon', 'authenticated', 'service_role']) {
    try {
      await db.exec(`create role ${role}`)
    } catch {
      rolesAvailable = false
    }
  }
  await db.exec(`
    create schema auth;
    create table auth.users (id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    create schema storage;
    create table storage.buckets (
      id text primary key, name text not null, public boolean not null default false,
      file_size_limit bigint, allowed_mime_types text[]
    );
    create table storage.objects (
      id uuid primary key default gen_random_uuid(), bucket_id text, name text
    );
    create function storage.foldername(p_name text) returns text[]
    language sql immutable as $$
      select string_to_array(regexp_replace(p_name, '/[^/]*$', ''), '/')
    $$;
  `)
  if (rolesAvailable) await db.exec('grant select, insert on storage.objects to authenticated')
  await runMigration('supabase/migrations/202611170001_initial_schema.sql')
  await runMigration('supabase/migrations/202611170002_storage.sql')

  await db.exec(`
    insert into public.settings (id, village_name, monthly_fee, bill_due_day)
    values (1, 'หมู่บ้านทดสอบ', 500, 5);
    insert into public.houses (id, house_no) values
      ('${houseOne}', '99/1'), ('${houseTwo}', '99/2');
    insert into public.houses (house_no)
    select '99/' || house_number from generate_series(3, 40) as houses(house_number);
    insert into auth.users (id, email) values
      ('${residentOne}', 'u-99-1@village.internal'),
      ('${residentTwo}', 'u-99-2@village.internal'),
      ('${committee}', 'u-committee@village.internal');
    insert into public.profiles (id, display_name, login_identifier) values
      ('${residentOne}', 'ลูกบ้าน 1', '99/1'),
      ('${residentTwo}', 'ลูกบ้าน 2', '99/2'),
      ('${committee}', 'กรรมการ', 'committee');
    insert into public.user_roles (user_id, role) values
      ('${residentOne}', 'resident'),
      ('${residentTwo}', 'resident'),
      ('${committee}', 'committee');
    insert into public.house_members (house_id, user_id) values
      ('${houseOne}', '${residentOne}'),
      ('${houseTwo}', '${residentTwo}');
  `)
  const generated = await db.query<{ count: number }>(
    `select public.generate_monthly_bills('2026-11-01') as count`,
  )
  expect(Number(generated.rows[0].count)).toBe(40)
  const repeated = await db.query<{ count: number }>(
    `select public.generate_monthly_bills('2026-11-01') as count`,
  )
  expect(Number(repeated.rows[0].count)).toBe(0)
  await db.query(`select public.generate_monthly_bills('2026-12-01')`)
  billsAvailable = true
})

afterAll(async () => {
  await db.close()
})

describe.sequential('การทำงานของ migration และ RPC ใน PostgreSQL', () => {
  it('สร้างบิล 40 หลังครั้งเดียว และรันซ้ำไม่สร้างบิลเพิ่ม', async () => {
    const result = await db.query<{ count: number }>(`select count(*)::int as count from public.bills where period = '2026-11-01'`)
    expect(Number(result.rows[0].count)).toBe(40)
  })

  it('ปฏิเสธบิลของบ้านอื่นและพาธไฟล์ที่ไม่ตรงกับบ้าน', async () => {
    const ownBill = await db.query<{ id: string }>(`select id from public.bills where house_id = '${houseOne}' and period = '2026-11-01'`)
    const otherBill = await db.query<{ id: string }>(`select id from public.bills where house_id = '${houseTwo}' and period = '2026-11-01'`)
    await db.exec(`select set_config('request.jwt.claim.sub', '${residentOne}', false)`)
    await expect(db.query(`select public.submit_slip(array['${otherBill.rows[0].id}']::uuid[], 500, now(), '${houseOne}/2026-11/file.webp', 1000)`)).rejects.toThrow('BILL_NOT_PAYABLE')
    await expect(db.query(`select public.submit_slip(array['${ownBill.rows[0].id}']::uuid[], 500, now(), '${houseTwo}/2026-11/file.webp', 1000)`)).rejects.toThrow('INVALID_FILE_PATH')
    await db.exec(`select set_config('request.jwt.claim.sub', '', false)`)
  })

  it('อนุมัติสลิปครั้งเดียว บิลเป็น paid และรายรับไม่ซ้ำ', async () => {
    const bill = await db.query<{ id: string }>(`select id from public.bills where house_id = '${houseOne}' and period = '2026-11-01'`)
    await db.exec(`select set_config('request.jwt.claim.sub', '${residentOne}', false)`)
    const submitted = await db.query<{ submit_slip: string }>(
      `select public.submit_slip(array['${bill.rows[0].id}']::uuid[], 500, '2026-11-10T03:00:00Z', '${houseOne}/2026-11/slip.webp', 1000)`,
    )
    const slipId = submitted.rows[0].submit_slip
    await db.exec(`select set_config('request.jwt.claim.sub', '${committee}', false)`)
    await db.query(`select public.approve_slip('${slipId}')`)
    const billStatus = await db.query<{ status: string }>(`select status from public.bills where id = '${bill.rows[0].id}'`)
    expect(billStatus.rows[0].status).toBe('paid')
    const firstLedger = await db.query<{ count: number }>(`select count(*)::int as count from public.ledger_entries where slip_id = '${slipId}'`)
    expect(Number(firstLedger.rows[0].count)).toBe(1)
    await expect(db.query(`select public.approve_slip('${slipId}')`)).rejects.toThrow('SLIP_NOT_PENDING')
    const secondLedger = await db.query<{ count: number }>(`select count(*)::int as count from public.ledger_entries where slip_id = '${slipId}'`)
    expect(Number(secondLedger.rows[0].count)).toBe(1)
    const audit = await db.query<{ count: number }>(`select count(*)::int as count from public.audit_logs where action = 'approve_slip' and entity_id = '${slipId}'`)
    expect(Number(audit.rows[0].count)).toBe(1)
    await db.exec(`select set_config('request.jwt.claim.sub', '', false)`)
  })

  it('reject ต้องมีเหตุผลและคืนบิลเป็น unpaid', async () => {
    const bill = await db.query<{ id: string }>(`select id from public.bills where house_id = '${houseOne}' and period = '2026-12-01'`)
    await db.exec(`select set_config('request.jwt.claim.sub', '${residentOne}', false)`)
    const submitted = await db.query<{ submit_slip: string }>(
      `select public.submit_slip(array['${bill.rows[0].id}']::uuid[], 500, now(), '${houseOne}/2026-12/slip.webp', 1000)`,
    )
    const slipId = submitted.rows[0].submit_slip
    await db.exec(`select set_config('request.jwt.claim.sub', '${committee}', false)`)
    await expect(db.query(`select public.reject_slip('${slipId}', '  ')`)).rejects.toThrow('REASON_REQUIRED')
    await db.query(`select public.reject_slip('${slipId}', 'ยอดเงินไม่ตรง')`)
    const result = await db.query<{ status: string; reject_reason: string }>(`select status, reject_reason from public.slips where id = '${slipId}'`)
    const billResult = await db.query<{ status: string }>(`select status from public.bills where id = '${bill.rows[0].id}'`)
    expect(result.rows[0]).toMatchObject({ status: 'rejected', reject_reason: 'ยอดเงินไม่ตรง' })
    expect(billResult.rows[0].status).toBe('unpaid')
    await db.exec(`select set_config('request.jwt.claim.sub', '', false)`)
  })

  it('resident ไม่สามารถอนุมัติสลิปได้', async () => {
    await db.exec(`select set_config('request.jwt.claim.sub', '${residentOne}', false)`)
    await expect(db.query(`select public.approve_slip('30000000-0000-4000-8000-000000000001')`)).rejects.toThrow('FORBIDDEN')
    await db.exec(`select set_config('request.jwt.claim.sub', '', false)`)
  })

  it('anon เรียก generate_monthly_bills ไม่ได้', async () => {
    if (!rolesAvailable) return
    await db.exec('set role anon')
    await expect(db.query(`select public.generate_monthly_bills('2027-01-01')`)).rejects.toThrow()
    await db.exec('reset role')
  })

  it('RLS จำกัดบิลและสลิปของ resident ให้อยู่ในบ้านของตน', async () => {
    if (!rolesAvailable) return
    await db.exec(`
      insert into public.slips (id, house_id, uploaded_by, amount, transferred_at, file_path)
      values ('30000000-0000-4000-8000-000000000002', '${houseTwo}', '${residentTwo}', 500, now(), '${houseTwo}/2026-11/other.webp');
      set role authenticated;
      select set_config('request.jwt.claim.sub', '${residentOne}', false);
    `)
    const bills = await db.query<{ count: number }>(`select count(*)::int as count from public.bills where house_id = '${houseTwo}'`)
    const slips = await db.query<{ count: number }>(`select count(*)::int as count from public.slips where house_id = '${houseTwo}'`)
    await db.exec('reset role')
    expect(Number(bills.rows[0].count)).toBe(0)
    expect(Number(slips.rows[0].count)).toBe(0)
  })

  it('resident ไม่มีสิทธิ์แก้สถานะบิลหรือสลิปผ่าน API โดยตรง', async () => {
    if (!rolesAvailable) return
    await db.exec(`
      set role authenticated;
      select set_config('request.jwt.claim.sub', '${residentOne}', false);
    `)
    await expect(db.query(`update public.bills set status = 'paid' where house_id = '${houseOne}'`)).rejects.toThrow()
    await expect(db.query(`update public.slips set status = 'approved' where house_id = '${houseOne}'`)).rejects.toThrow()
    await db.exec('reset role')
  })

  it('แจ้งเมื่อ PGlite ไม่รองรับการสร้าง role สำหรับทดสอบ RLS', () => {
    expect(billsAvailable).toBe(true)
    if (!rolesAvailable) console.warn('PGlite ไม่รองรับ CREATE ROLE — ทดสอบ RPC แล้ว แต่ทดสอบ RLS ผ่าน SET ROLE ไม่ได้')
  })
})
