import { createClient } from '@supabase/supabase-js'
import { createReadStream } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { createInterface } from 'node:readline'
import { resolve } from 'node:path'
import { writeFile } from 'node:fs/promises'

const url = process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceRoleKey) {
  console.error('กรุณาตั้งค่า SUPABASE_URL และ SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

function parseCsvLine(line) {
  const values = []
  let value = ''
  let quoted = false
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    if (char === '"' && line[index + 1] === '"' && quoted) {
      value += '"'
      index += 1
    } else if (char === '"') quoted = !quoted
    else if (char === ',' && !quoted) {
      values.push(value)
      value = ''
    } else value += char
  }
  values.push(value)
  return values
}

function identifierToEmail(identifier) {
  const slug = identifier.trim().toLowerCase().replaceAll('/', '-').replace(/[^a-z0-9-]/g, '')
  return `u-${slug}@village.internal`
}

const inputPath = resolve(process.argv[2] ?? 'scripts/users.example.csv')
const lines = createInterface({ input: createReadStream(inputPath), crlfDelay: Infinity })
const rows = []
for await (const line of lines) {
  if (line.trim()) rows.push(parseCsvLine(line))
}
if (rows.length < 2) throw new Error('ไม่พบข้อมูลผู้ใช้ในไฟล์ CSV')
const [headers, ...records] = rows
const client = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
const results = [['identifier', 'display_name', 'role', 'house_no', 'password', 'result']]

for (const values of records) {
  const record = Object.fromEntries(headers.map((header, index) => [header.trim(), (values[index] ?? '').trim()]))
  const password = record.password || randomBytes(8).toString('base64url').slice(0, 10)
  const { data: authData, error: authError } = await client.auth.admin.createUser({
    email: identifierToEmail(record.identifier),
    password,
    email_confirm: true,
  })
  if (authError || !authData.user) {
    results.push([record.identifier, record.display_name, record.role, record.house_no, password, 'สร้างบัญชีไม่สำเร็จ'])
    continue
  }

  let houseId
  if (record.house_no) {
    const { data: house, error: houseError } = await client.from('houses').select('id').eq('house_no', record.house_no).maybeSingle()
    if (houseError || !house) {
      await client.auth.admin.deleteUser(authData.user.id)
      results.push([record.identifier, record.display_name, record.role, record.house_no, password, 'ไม่พบบ้านเลขที่'])
      continue
    }
    houseId = house.id
  }

  const { error: profileError } = await client.from('profiles').insert({
    id: authData.user.id,
    display_name: record.display_name,
    phone: record.phone || null,
    login_identifier: record.identifier,
  })
  const { error: roleError } = await client.from('user_roles').insert({ user_id: authData.user.id, role: record.role })
  const membership = houseId
    ? await client.from('house_members').insert({ user_id: authData.user.id, house_id: houseId })
    : { error: null }
  if (profileError || roleError || membership.error) {
    await client.auth.admin.deleteUser(authData.user.id)
    results.push([record.identifier, record.display_name, record.role, record.house_no, password, 'บันทึกข้อมูลไม่สำเร็จ'])
    continue
  }
  results.push([record.identifier, record.display_name, record.role, record.house_no, password, 'สำเร็จ'])
}

const output = results.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n')
await writeFile(resolve('scripts/provisioned-users.csv'), `\uFEFF${output}\n`, 'utf8')
console.log(`บันทึกผลการสร้างบัญชี ${results.length - 1} รายการไว้ที่ scripts/provisioned-users.csv`)
