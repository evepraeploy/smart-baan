// @vitest-environment node
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'

const db = new PGlite()
const residentOne = '10000000-0000-4000-8000-000000000001'
const residentTwo = '10000000-0000-4000-8000-000000000002'
const committee = '10000000-0000-4000-8000-000000000003'
const admin = '10000000-0000-4000-8000-000000000004'
const houseOne = '20000000-0000-4000-8000-000000000001'
const houseTwo = '20000000-0000-4000-8000-000000000002'
let rolesAvailable = true
let billsAvailable = false
let approvedLedgerId = ''

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
  await runMigration('supabase/migrations/202611170004_password_reset_requests.sql')
  await runMigration('supabase/migrations/202611170005_finance_announcements.sql')
  await runMigration('supabase/migrations/202611170006_tickets.sql')
  await runMigration('supabase/migrations/202611170007_assets.sql')

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
      ('${committee}', 'u-committee@village.internal'),
      ('${admin}', 'u-admin@village.internal');
    insert into public.profiles (id, display_name, login_identifier) values
      ('${residentOne}', 'ลูกบ้าน 1', '99/1'),
      ('${residentTwo}', 'ลูกบ้าน 2', '99/2'),
      ('${committee}', 'กรรมการ', 'committee'),
      ('${admin}', 'ผู้ดูแลระบบ', 'admin');
    insert into public.user_roles (user_id, role) values
      ('${residentOne}', 'resident'),
      ('${residentTwo}', 'resident'),
      ('${committee}', 'committee'),
      ('${admin}', 'admin');
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

afterEach(async () => {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false)`)
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
    const approvedLedger = await db.query<{ id: string }>(`select id from public.ledger_entries where slip_id = '${slipId}'`)
    approvedLedgerId = approvedLedger.rows[0].id
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

  it('ไม่เปิดเผยว่ามีบัญชีหรือไม่เมื่อค้นหาบ้านเลขที่ที่ไม่มีอยู่', async () => {
    await db.query(`select public.request_password_reset('บ้านที่ไม่มีในระบบ')`)
    const result = await db.query<{ count: number }>(`select count(*)::int as count from public.password_reset_requests`)
    expect(Number(result.rows[0].count)).toBe(0)
  })

  it('สร้างคำขอเปิดเพียงรายการเดียวต่อผู้ใช้', async () => {
    await db.query(`select public.request_password_reset('99/1')`)
    await db.query(`select public.request_password_reset('99/1')`)
    const result = await db.query<{ count: number }>(
      `select count(*)::int as count from public.password_reset_requests where user_id = '${residentOne}' and status = 'open'`,
    )
    expect(Number(result.rows[0].count)).toBe(1)
  })

  it('ค้นหาบัญชีด้วยเบอร์โทรศัพท์ที่มีเครื่องหมายคั่นได้', async () => {
    await db.query(`update public.profiles set phone = '0810000002' where id = '${residentTwo}'`)
    await db.query(`select public.request_password_reset('081-000-0002')`)
    const result = await db.query<{ count: number }>(
      `select count(*)::int as count from public.password_reset_requests where user_id = '${residentTwo}' and status = 'open'`,
    )
    expect(Number(result.rows[0].count)).toBe(1)
  })

  it('ปฏิเสธตัวระบุที่ว่างเปล่า', async () => {
    await expect(db.query(`select public.request_password_reset('   ')`)).rejects.toThrow('IDENTIFIER_REQUIRED')
  })

  it('ลูกบ้านและกรรมการไม่มีสิทธิ์ดูหรือปิดคำขอ', async () => {
    for (const userId of [residentOne, committee]) {
      await db.exec(`select set_config('request.jwt.claim.sub', '${userId}', false)`)
      await expect(db.query(`select * from public.list_password_reset_requests()`)).rejects.toThrow('FORBIDDEN')
      await expect(db.query(
        `select public.close_password_reset_request('30000000-0000-4000-8000-000000000003', 'dismissed')`,
      )).rejects.toThrow('FORBIDDEN')
    }
  })

  it('ผู้ดูแลดูและปิดคำขอได้ พร้อมบันทึก audit และเปิดคำขอใหม่ได้ภายหลัง', async () => {
    await db.exec(`select set_config('request.jwt.claim.sub', '${admin}', false)`)
    const listed = await db.query<{
      id: string
      user_id: string
      house_no: string | null
    }>(`select * from public.list_password_reset_requests()`)
    expect(listed.rows).toHaveLength(2)
    const residentRequest = listed.rows.find((request) => request.user_id === residentOne)
    expect(residentRequest?.house_no).toBe('99/1')
    expect(residentRequest).toBeDefined()

    await db.query(
      `select public.close_password_reset_request('${residentRequest!.id}', 'resolved')`,
    )
    const closed = await db.query<{ status: string; resolved_by: string }>(
      `select status, resolved_by from public.password_reset_requests where id = '${residentRequest!.id}'`,
    )
    expect(closed.rows[0]).toMatchObject({ status: 'resolved', resolved_by: admin })
    const audit = await db.query<{ count: number }>(
      `select count(*)::int as count from public.audit_logs where action = 'close_password_reset_request' and entity_id = '${residentRequest!.id}'`,
    )
    expect(Number(audit.rows[0].count)).toBe(1)

    await expect(db.query(
      `select public.close_password_reset_request('${residentRequest!.id}', 'resolved')`,
    )).rejects.toThrow('REQUEST_NOT_OPEN')
    await expect(db.query(
      `select public.close_password_reset_request('${listed.rows.find((request) => request.user_id === residentTwo)!.id}', 'open')`,
    )).rejects.toThrow('INVALID_STATUS')

    await db.query(`select public.request_password_reset('99/1')`)
    const newRequest = await db.query<{ count: number }>(
      `select count(*)::int as count from public.password_reset_requests where user_id = '${residentOne}' and status = 'open'`,
    )
    expect(Number(newRequest.rows[0].count)).toBe(1)
  })

  it('anon ส่งคำขอได้แต่ดูคำขอไม่ได้', async () => {
    if (!rolesAvailable) return
    await db.exec('set role anon')
    await db.query(`select public.request_password_reset('99/2')`)
    await expect(db.query(`select * from public.list_password_reset_requests()`)).rejects.toThrow()
    await db.exec('reset role')
  })

  it('กรรมการสร้าง แก้ไข และลบรายการบัญชี พร้อมบันทึก audit log', async () => {
    await db.exec(`select set_config('request.jwt.claim.sub', '${committee}', false)`)
    const created = await db.query<{ id: string }>(
      `select public.create_ledger_entry('expense', 'ค่าซ่อมบำรุง', 1200, '2026-11-15', 'ซ่อมปั๊มน้ำ') as id`,
    )
    const entryId = created.rows[0].id
    await db.query(
      `select public.update_ledger_entry('${entryId}', 'expense', 'ค่าไฟส่วนกลาง', 1250, '2026-11-16', 'ค่าไฟเดือนนี้')`,
    )
    const updated = await db.query<{ category: string; amount: number | string; created_by: string }>(
      `select category, amount, created_by from public.ledger_entries where id = '${entryId}'`,
    )
    expect({ ...updated.rows[0], amount: Number(updated.rows[0].amount) }).toMatchObject({
      category: 'ค่าไฟส่วนกลาง',
      amount: 1250,
      created_by: committee,
    })
    await db.query(`select public.delete_ledger_entry('${entryId}')`)
    const audit = await db.query<{ action: string; count: number }>(
      `select action, count(*)::int as count from public.audit_logs where entity_id = '${entryId}' group by action`,
    )
    expect(audit.rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ action: 'create_ledger_entry', count: 1 }),
      expect.objectContaining({ action: 'update_ledger_entry', count: 1 }),
      expect.objectContaining({ action: 'delete_ledger_entry', count: 1 }),
    ]))
  })

  it('resident เพิ่มรายการบัญชีไม่ได้ และจำนวนเงินต้องมากกว่าศูนย์', async () => {
    await db.exec(`select set_config('request.jwt.claim.sub', '${residentOne}', false)`)
    await expect(db.query(
      `select public.create_ledger_entry('expense', 'ค่าน้ำ', 100, '2026-11-01')`,
    )).rejects.toThrow('FORBIDDEN')
    await db.exec(`select set_config('request.jwt.claim.sub', '${committee}', false)`)
    await expect(db.query(
      `select public.create_ledger_entry('expense', 'ค่าน้ำ', 0, '2026-11-01')`,
    )).rejects.toThrow('INVALID_AMOUNT')
  })

  it('รายการรายรับที่มาจากสลิปแก้ไขหรือลบไม่ได้', async () => {
    expect(approvedLedgerId).not.toBe('')
    await db.exec(`select set_config('request.jwt.claim.sub', '${committee}', false)`)
    await expect(db.query(
      `select public.update_ledger_entry('${approvedLedgerId}', 'income', 'ค่าส่วนกลาง', 500, '2026-11-10')`,
    )).rejects.toThrow('LEDGER_LOCKED')
    await expect(db.query(
      `select public.delete_ledger_entry('${approvedLedgerId}')`,
    )).rejects.toThrow('LEDGER_LOCKED')
  })

  it('จำกัดไฟล์แนบรายการบัญชีให้อยู่ในโฟลเดอร์ ledger', async () => {
    await db.exec(`select set_config('request.jwt.claim.sub', '${committee}', false)`)
    await expect(db.query(
      `select public.create_ledger_entry('expense', 'ค่าน้ำ', 100, '2026-11-01', null, 'other/receipt.webp')`,
    )).rejects.toThrow('INVALID_FILE_PATH')
  })

  it('รายงานการเงินแสดงยอดรวมทั้งหมู่บ้านโดยไม่มีข้อมูลบ้านรายหลัง', async () => {
    await db.query(`update public.settings set opening_balance = 1000, opening_balance_date = '2026-01-01' where id = 1`)
    await db.exec(`select set_config('request.jwt.claim.sub', '${committee}', false)`)
    await db.query(`select public.create_ledger_entry('income', 'รายรับอื่น ๆ', 200, '2026-10-15')`)
    await db.query(`select public.create_ledger_entry('expense', 'ค่าน้ำ', 50, '2026-10-20')`)

    await db.exec(`select set_config('request.jwt.claim.sub', '${residentOne}', false)`)
    const result = await db.query<{ get_finance_report: Record<string, unknown> }>(
      `select public.get_finance_report(2026)`,
    )
    const report = result.rows[0].get_finance_report as {
      opening_balance: number
      balance: number
      total_income: number
      total_expense: number
      year_income: number
      year_expense: number
      months: { month: string; income: number; expense: number }[]
    }
    expect(report).toMatchObject({
      opening_balance: 1000,
      balance: 1650,
      total_income: 700,
      total_expense: 50,
      year_income: 700,
      year_expense: 50,
    })
    expect(report.months).toHaveLength(12)
    expect(report.months.find((month) => month.month === '2026-10-01')).toMatchObject({ income: 200, expense: 50 })
    expect(JSON.stringify(report).toLowerCase()).not.toContain('"house')

    await db.exec(`select set_config('request.jwt.claim.sub', '', false)`)
    await expect(db.query(`select public.get_finance_report(2026)`)).rejects.toThrow('FORBIDDEN')
  })

  it('resident เขียน ledger_entries โดยตรงไม่ได้', async () => {
    if (!rolesAvailable) return
    await db.exec(`
      set role authenticated;
      select set_config('request.jwt.claim.sub', '${residentOne}', false);
    `)
    await expect(db.query(
      `insert into public.ledger_entries (entry_type, category, amount, entry_date) values ('expense', 'ค่าน้ำ', 50, '2026-11-01')`,
    )).rejects.toThrow()
    await db.exec('reset role')
  })

  it('ประกาศใช้สิทธิ์ตามบทบาท วันหมดอายุ และบันทึกการอ่านเฉพาะของตน', async () => {
    if (!rolesAvailable) return
    await db.exec(`
      set role authenticated;
      select set_config('request.jwt.claim.sub', '${residentOne}', false);
    `)
    await expect(db.query(
      `insert into public.announcements (title, body) values ('ประกาศจากลูกบ้าน', 'เนื้อหา')`,
    )).rejects.toThrow()

    await db.exec(`select set_config('request.jwt.claim.sub', '${committee}', false)`)
    const expired = await db.query<{ id: string }>(
      `insert into public.announcements (title, body, expires_at) values ('ประกาศหมดอายุ', 'ข้อความเก่า', now() - interval '1 day') returning id`,
    )
    const active = await db.query<{ id: string }>(
      `insert into public.announcements (title, body) values ('ประกาศล่าสุด', 'ข้อความใหม่') returning id`,
    )
    const createAudit = await db.query<{ count: number }>(
      `select count(*)::int as count from public.audit_logs where action = 'create_announcement' and entity_id in ('${expired.rows[0].id}', '${active.rows[0].id}')`,
    )
    expect(Number(createAudit.rows[0].count)).toBe(2)

    await db.exec(`select set_config('request.jwt.claim.sub', '${residentOne}', false)`)
    const residentExpired = await db.query<{ count: number }>(
      `select count(*)::int as count from public.announcements where id = '${expired.rows[0].id}'`,
    )
    expect(Number(residentExpired.rows[0].count)).toBe(0)
    await db.query(
      `insert into public.announcement_reads (announcement_id) values ('${active.rows[0].id}')`,
    )
    await expect(db.query(
      `insert into public.announcement_reads (announcement_id, user_id) values ('${active.rows[0].id}', '${residentTwo}')`,
    )).rejects.toThrow()

    await db.exec(`select set_config('request.jwt.claim.sub', '${committee}', false)`)
    const committeeExpired = await db.query<{ count: number }>(
      `select count(*)::int as count from public.announcements where id = '${expired.rows[0].id}'`,
    )
    expect(Number(committeeExpired.rows[0].count)).toBe(1)
    await db.query(`update public.announcements set title = 'ประกาศที่แก้ไข' where id = '${active.rows[0].id}'`)
    await db.query(`delete from public.announcements where id = '${active.rows[0].id}'`)
    const writeAudit = await db.query<{ action: string; count: number }>(
      `select action, count(*)::int as count from public.audit_logs where entity_id = '${active.rows[0].id}' group by action`,
    )
    expect(writeAudit.rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ action: 'create_announcement', count: 1 }),
      expect.objectContaining({ action: 'update_announcement', count: 1 }),
      expect.objectContaining({ action: 'delete_announcement', count: 1 }),
    ]))
  })

  it('ลูกบ้านแจ้งเรื่องพร้อมรูปได้ไม่เกินสามรูป และรูปต้องอยู่ใต้พาธของเรื่อง', async () => {
    await db.exec(`select set_config('request.jwt.claim.sub', '${residentOne}', false)`)
    const created = await db.query<{ id: string }>(
      `select public.create_ticket('plumbing', 'ท่อน้ำรั่ว', 'น้ำรั่วบริเวณหน้าบ้าน') as id`,
    )
    const ticketId = created.rows[0].id
    const ticket = await db.query<{ house_id: string; reporter_id: string }>(
      `select house_id, reporter_id from public.tickets where id = '${ticketId}'`,
    )
    expect(ticket.rows[0]).toEqual({ house_id: houseOne, reporter_id: residentOne })
    await db.query(
      `select public.add_ticket_photos('${ticketId}', 'report', array['${ticketId}/one.webp', '${ticketId}/two.webp', '${ticketId}/three.webp'])`,
    )
    const photoRows = await db.query<{ path: string; kind: string }>(
      `select path, kind from public.ticket_photos where ticket_id = '${ticketId}' order by path`,
    )
    expect(photoRows.rows).toHaveLength(3)
    expect(new Set(photoRows.rows.map((photo) => photo.path)).size).toBe(3)
    expect(photoRows.rows.map((photo) => photo.path)).toEqual([
      `${ticketId}/one.webp`,
      `${ticketId}/three.webp`,
      `${ticketId}/two.webp`,
    ])
    expect(photoRows.rows.every((photo) => photo.kind === 'report')).toBe(true)
    await expect(db.query(
      `select public.add_ticket_photos('${ticketId}', 'report', array['${ticketId}/four.webp'])`,
    )).rejects.toThrow('TOO_MANY_PHOTOS')
    await expect(db.query(
      `select public.add_ticket_photos('${ticketId}', 'report', array['other/invalid.webp'])`,
    )).rejects.toThrow('INVALID_FILE_PATH')
  })

  it('ลูกบ้านอีกบ้านไม่เห็นเรื่อง รูป หรือ timeline และเปลี่ยนสถานะไม่ได้', async () => {
    if (!rolesAvailable) return
    await db.exec(`select set_config('request.jwt.claim.sub', '${residentOne}', false)`)
    const created = await db.query<{ id: string }>(
      `select public.create_ticket('electric', 'ไฟหน้าบ้านดับ', 'หลอดไฟดับ') as id`,
    )
    const ticketId = created.rows[0].id
    await db.query(
      `select public.add_ticket_photos('${ticketId}', 'report', array['${ticketId}/lamp.webp'])`,
    )
    await db.exec(`
      set role authenticated;
      select set_config('request.jwt.claim.sub', '${residentTwo}', false);
    `)
    for (const table of ['tickets', 'ticket_photos', 'ticket_events']) {
      const result = await db.query<{ count: number }>(
        `select count(*)::int as count from public.${table} where ${table === 'tickets' ? 'id' : 'ticket_id'} = '${ticketId}'`,
      )
      expect(Number(result.rows[0].count)).toBe(0)
    }
    await expect(db.query(
      `select public.add_ticket_comment('${ticketId}', 'ข้อความ')`,
    )).rejects.toThrow('FORBIDDEN')
    await expect(db.query(
      `select public.update_ticket_status('${ticketId}', 'in_progress')`,
    )).rejects.toThrow('FORBIDDEN')
    await db.exec('reset role')
  })

  it('กรรมการเปลี่ยนสถานะได้ตามลำดับและต้องระบุเหตุผลเมื่อไม่รับเรื่อง', async () => {
    await db.exec(`select set_config('request.jwt.claim.sub', '${residentOne}', false)`)
    const created = await db.query<{ id: string }>(
      `select public.create_ticket('road', 'ฝาท่อชำรุด', 'ฝาท่อบริเวณทางเข้าแตก') as id`,
    )
    const ticketId = created.rows[0].id
    await db.exec(`select set_config('request.jwt.claim.sub', '${committee}', false)`)
    await expect(db.query(
      `select public.update_ticket_status('${ticketId}', 'done')`,
    )).rejects.toThrow('INVALID_TRANSITION')
    await expect(db.query(
      `select public.update_ticket_status('${ticketId}', 'rejected')`,
    )).rejects.toThrow('REASON_REQUIRED')
    await db.query(`select public.update_ticket_status('${ticketId}', 'in_progress')`)
    await db.query(`select public.update_ticket_status('${ticketId}', 'rejected', 'ไม่ใช่พื้นที่ส่วนกลาง')`)
    const closed = await db.query<{ status: string; closed_at: string | null }>(
      `select status, closed_at from public.tickets where id = '${ticketId}'`,
    )
    expect(closed.rows[0].status).toBe('rejected')
    expect(closed.rows[0].closed_at).not.toBeNull()
  })

  it('มอบหมายงาน ปิดงาน และบันทึกค่าจ้างเป็นรายจ่ายเพียงครั้งเดียว', async () => {
    await db.exec(`select set_config('request.jwt.claim.sub', '${residentOne}', false)`)
    const created = await db.query<{ id: string }>(
      `select public.create_ticket('plumbing', 'ปั๊มน้ำชำรุดทดสอบ', 'ปั๊มน้ำส่งเสียงดัง') as id`,
    )
    const ticketId = created.rows[0].id
    await db.exec(`
      set role authenticated;
      select set_config('request.jwt.claim.sub', '${committee}', false);
    `)
    const contractor = await db.query<{ id: string }>(
      `insert into public.contractors (name, phone, trade) values ('ช่างทดสอบ', '0810000000', 'ประปา') returning id`,
    )
    await db.query(
      `select public.assign_ticket('${ticketId}', '${committee}', '${contractor.rows[0].id}', '2026-11-20 03:00:00+00', 1500)`,
    )
    await db.query(`select public.update_ticket_status('${ticketId}', 'in_progress')`)
    await db.query(`select public.update_ticket_status('${ticketId}', 'done', 'ซ่อมเรียบร้อย', true)`)
    const job = await db.query<{ fee: string; ledger_entry_id: string }>(
      `select fee, ledger_entry_id from public.ticket_jobs where ticket_id = '${ticketId}'`,
    )
    expect(Number(job.rows[0].fee)).toBe(1500)
    expect(job.rows[0].ledger_entry_id).toBeTruthy()
    const ledger = await db.query<{ entry_type: string; category: string; amount: string; description: string }>(
      `select entry_type, category, amount, description from public.ledger_entries where id = '${job.rows[0].ledger_entry_id}'`,
    )
    expect(ledger.rows[0]).toMatchObject({
      entry_type: 'expense',
      category: 'ค่าซ่อมบำรุง',
      amount: '1500.00',
      description: 'งานซ่อม: ปั๊มน้ำชำรุดทดสอบ',
    })
    await expect(db.query(
      `select public.update_ticket_status('${ticketId}', 'done', null, true)`,
    )).rejects.toThrow('INVALID_TRANSITION')
    await expect(db.query(
      `select public.assign_ticket('${ticketId}', null, null, null, null)`,
    )).rejects.toThrow('TICKET_CLOSED')
    const events = await db.query<{ event_type: string; comment: string | null }>(
      `select event_type, comment from public.ticket_events where ticket_id = '${ticketId}'`,
    )
    expect(events.rows.map((event) => event.event_type)).toEqual(expect.arrayContaining(['created', 'assigned', 'status', 'expense']))
    expect(events.rows.map((event) => event.comment ?? '').join(' ')).not.toContain('1500')
    const audit = await db.query<{ count: number }>(
      `select count(*)::int as count from public.audit_logs where entity_id = '${ticketId}'`,
    )
    expect(Number(audit.rows[0].count)).toBeGreaterThanOrEqual(4)
    if (rolesAvailable) {
      await db.exec(`
        set role authenticated;
        select set_config('request.jwt.claim.sub', '${residentTwo}', false);
      `)
      const jobRows = await db.query<{ count: number }>(
        `select count(*)::int as count from public.ticket_jobs where ticket_id = '${ticketId}'`,
      )
      const contractorRows = await db.query<{ count: number }>(
        `select count(*)::int as count from public.contractors`,
      )
      expect(Number(jobRows.rows[0].count)).toBe(0)
      expect(Number(contractorRows.rows[0].count)).toBe(0)
      await db.exec('reset role')
    }
  })

  it('คำนวณรอบ PM จากวันติดตั้งและวันที่บำรุงรักษาล่าสุด', async () => {
    if (!rolesAvailable) return
    await db.exec(`
      set role authenticated;
      select set_config('request.jwt.claim.sub', '${committee}', false);
    `)
    const inserted = await db.query<{ id: string; next_due_date: string }>(
    `insert into public.assets (name, installed_on, pm_interval_days)
       values ('อุปกรณ์ทดสอบ PM', '2026-01-01', 90)
       returning id, next_due_date::text as next_due_date`,
    )
    const assetId = inserted.rows[0].id
    expect(inserted.rows[0].next_due_date).toBe('2026-04-01')
    await db.query(
      `select public.record_maintenance('${assetId}', '2026-03-15', 'pm', 'บำรุงรักษาตามรอบ')`,
    )
    let schedule = await db.query<{ last_maintained_on: string; next_due_date: string }>(
      `select last_maintained_on::text as last_maintained_on, next_due_date::text as next_due_date from public.assets where id = '${assetId}'`,
    )
    expect(schedule.rows[0]).toEqual({ last_maintained_on: '2026-03-15', next_due_date: '2026-06-13' })
    await db.query(
      `select public.record_maintenance('${assetId}', '2026-02-01', 'pm', 'บันทึกรายการย้อนหลัง')`,
    )
    schedule = await db.query(
      `select last_maintained_on::text as last_maintained_on, next_due_date::text as next_due_date from public.assets where id = '${assetId}'`,
    )
    expect(schedule.rows[0]).toEqual({ last_maintained_on: '2026-03-15', next_due_date: '2026-06-13' })
    await db.exec('reset role')
  })

  it('บันทึกค่าบำรุงรักษาเป็นรายจ่ายและตรวจวันที่กับยอดเงิน', async () => {
    await db.exec(`select set_config('request.jwt.claim.sub', '${committee}', false)`)
    const inserted = await db.query<{ id: string }>(
      `insert into public.assets (name, pm_interval_days) values ('อุปกรณ์ค่าใช้จ่ายทดสอบ', 90) returning id`,
    )
    const assetId = inserted.rows[0].id
    const logged = await db.query<{ record_maintenance: string }>(
      `select public.record_maintenance('${assetId}', '2026-03-15', 'repair', 'ซ่อมอุปกรณ์', null, 800, true)`,
    )
    const ledger = await db.query<{ entry_type: string; category: string; amount: string; entry_date: string; description: string }>(
      `select entry_type, category, amount, entry_date::text as entry_date, description
       from public.ledger_entries where description = 'บำรุงรักษา: อุปกรณ์ค่าใช้จ่ายทดสอบ'`,
    )
    expect(ledger.rows).toEqual([{
      entry_type: 'expense',
      category: 'ค่าซ่อมบำรุง',
      amount: '800.00',
      entry_date: '2026-03-15',
      description: 'บำรุงรักษา: อุปกรณ์ค่าใช้จ่ายทดสอบ',
    }])
    const maintenance = await db.query<{ ledger_entry_id: string; cost: string }>(
      `select ledger_entry_id, cost from public.maintenance_logs where id = '${logged.rows[0].record_maintenance}'`,
    )
    expect(maintenance.rows[0]).toEqual({ ledger_entry_id: expect.any(String), cost: '800.00' })
    const expenseAudit = await db.query<{ count: number }>(
      `select count(*)::int as count from public.audit_logs where action = 'create_ledger_entry' and entity_id = '${maintenance.rows[0].ledger_entry_id}'`,
    )
    expect(Number(expenseAudit.rows[0].count)).toBe(1)
    await expect(db.query(
      `select public.record_maintenance('${assetId}', '2026-03-15', 'repair', 'ไม่มีค่าใช้จ่าย', null, null, true)`,
    )).rejects.toThrow('FEE_REQUIRED')
    await expect(db.query(
      `select public.record_maintenance('${assetId}', (now() at time zone 'Asia/Bangkok')::date + 1, 'pm', 'วันที่ในอนาคต')`,
    )).rejects.toThrow('INVALID_DATE')
    const maintenanceAudit = await db.query<{ count: number }>(
      `select count(*)::int as count from public.audit_logs
       where action = 'record_maintenance' and entity_id = '${logged.rows[0].record_maintenance}'`,
    )
    expect(Number(maintenanceAudit.rows[0].count)).toBe(1)
  })

  it('ไม่บันทึกการบำรุงรักษาให้อุปกรณ์ที่เลิกใช้แล้ว', async () => {
    await db.exec(`select set_config('request.jwt.claim.sub', '${committee}', false)`)
    const inserted = await db.query<{ id: string }>(
      `insert into public.assets (name, status) values ('อุปกรณ์เลิกใช้ทดสอบ', 'retired') returning id`,
    )
    await expect(db.query(
      `select public.record_maintenance('${inserted.rows[0].id}', '2026-03-15', 'repair', 'ไม่ควรบันทึก')`,
    )).rejects.toThrow('ASSET_RETIRED')
  })

  it('แสดงรายการ PM ที่เลยกำหนดและใกล้ถึงกำหนดบน Dashboard กรรมการเท่านั้น', async () => {
    await db.exec(`
      set role authenticated;
      select set_config('request.jwt.claim.sub', '${committee}', false);
    `)
    await db.query(`
      insert into public.assets (name, next_due_date, pm_interval_days) values
        ('PM ทดสอบเลยกำหนด', current_date - 1, 90),
        ('PM ทดสอบใกล้ถึง', current_date + 7, 90)
    `)
    const result = await db.query<{ get_committee_dashboard: Record<string, unknown> }>(
      `select public.get_committee_dashboard()`,
    )
    const dashboard = result.rows[0].get_committee_dashboard as {
      balance: number
      pm_overdue: { name: string; next_due_date: string }[]
      pm_due_soon: { name: string; next_due_date: string }[]
      bills_this_month: { paid: number; pending_review: number; unpaid: number }
    }
    expect(dashboard.balance).toEqual(expect.any(Number))
    expect(dashboard.pm_overdue.map((asset) => asset.name)).toContain('PM ทดสอบเลยกำหนด')
    expect(dashboard.pm_due_soon.map((asset) => asset.name)).toContain('PM ทดสอบใกล้ถึง')
    expect(dashboard.bills_this_month).toEqual(expect.objectContaining({ paid: expect.any(Number), pending_review: expect.any(Number), unpaid: expect.any(Number) }))
    await db.exec(`
      select set_config('request.jwt.claim.sub', '${residentOne}', false);
    `)
    await expect(db.query(`select public.get_committee_dashboard()`)).rejects.toThrow('FORBIDDEN')
    const assets = await db.query<{ count: number }>(`select count(*)::int as count from public.assets`)
    const logs = await db.query<{ count: number }>(`select count(*)::int as count from public.maintenance_logs`)
    expect(Number(assets.rows[0].count)).toBe(0)
    expect(Number(logs.rows[0].count)).toBe(0)
    await db.exec('reset role')
  })

  it('ลูกบ้านเรียก RPC เชื่อมอุปกรณ์หรือบันทึกการบำรุงรักษาไม่ได้', async () => {
    if (!rolesAvailable) return
    await db.exec(`
      set role authenticated;
      select set_config('request.jwt.claim.sub', '${residentOne}', false);
    `)
    await expect(db.query(
      `select public.record_maintenance(gen_random_uuid(), current_date, 'pm', 'ทดสอบ')`,
    )).rejects.toThrow('FORBIDDEN')
    await expect(db.query(
      `select public.link_ticket_asset(gen_random_uuid(), null)`,
    )).rejects.toThrow('FORBIDDEN')
    await expect(db.query(`select public.get_committee_dashboard()`)).rejects.toThrow('FORBIDDEN')
    await db.exec('reset role')
  })

  it('กรรมการเชื่อมและยกเลิกการเชื่อมอุปกรณ์กับเรื่องแจ้งซ่อมได้', async () => {
    await db.exec(`select set_config('request.jwt.claim.sub', '${committee}', false)`)
    const asset = await db.query<{ id: string }>(
      `insert into public.assets (name) values ('อุปกรณ์เชื่อมเรื่องทดสอบ') returning id`,
    )
    await db.exec(`select set_config('request.jwt.claim.sub', '${residentOne}', false)`)
    const ticket = await db.query<{ id: string }>(
      `select public.create_ticket('other', 'เรื่องเชื่อมอุปกรณ์', 'รายละเอียดเรื่อง') as id`,
    )
    await db.exec(`
      set role authenticated;
      select set_config('request.jwt.claim.sub', '${committee}', false);
    `)
    await db.query(`select public.link_ticket_asset('${ticket.rows[0].id}', '${asset.rows[0].id}')`)
    let linked = await db.query<{ asset_id: string }>(
      `select asset_id from public.tickets where id = '${ticket.rows[0].id}'`,
    )
    expect(linked.rows[0].asset_id).toBe(asset.rows[0].id)
    await db.query(`select public.link_ticket_asset('${ticket.rows[0].id}', null)`)
    linked = await db.query(
      `select asset_id from public.tickets where id = '${ticket.rows[0].id}'`,
    )
    expect(linked.rows[0].asset_id).toBeNull()
    const audits = await db.query<{ count: number }>(
      `select count(*)::int as count from public.audit_logs
       where action = 'link_ticket_asset' and entity_id = '${ticket.rows[0].id}'`,
    )
    expect(Number(audits.rows[0].count)).toBe(2)
    await db.exec('reset role')
  })

  it('แจ้งเมื่อ PGlite ไม่รองรับการสร้าง role สำหรับทดสอบ RLS', () => {
    expect(billsAvailable).toBe(true)
    if (!rolesAvailable) console.warn('PGlite ไม่รองรับ CREATE ROLE — ทดสอบ RPC แล้ว แต่ทดสอบ RLS ผ่าน SET ROLE ไม่ได้')
  })
})
