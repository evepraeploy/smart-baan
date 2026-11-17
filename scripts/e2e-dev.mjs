import { randomBytes, randomUUID } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const expectedProjectUrl = 'https://rycthgqxhwhcveneyccz.supabase.co'
const projectUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const anonKey = process.env.VITE_SUPABASE_ANON_KEY
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (projectUrl !== expectedProjectUrl) throw new Error('Refusing to run: target is not baan-dev.')
if (!anonKey?.startsWith('sb_publishable_') || !serviceRoleKey) {
  throw new Error('Missing the baan-dev publishable or service-role environment variable.')
}

const secrets = [anonKey, serviceRoleKey]
const results = []

function parseCsvLine(line) {
  const values = []
  let value = ''
  let quoted = false
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    if (char === '"' && line[index + 1] === '"' && quoted) {
      value += '"'
      index += 1
    } else if (char === '"') {
      quoted = !quoted
    } else if (char === ',' && !quoted) {
      values.push(value)
      value = ''
    } else {
      value += char
    }
  }
  values.push(value)
  return values
}

function quoteCsv(value) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`
}

function safeMessage(error) {
  let message = error instanceof Error ? error.message : String(error)
  for (const secret of secrets) {
    if (secret) message = message.replaceAll(secret, '[redacted]')
  }
  return message.replace(/\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]*/g, '[redacted]').slice(0, 220)
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function check(name, run) {
  try {
    const detail = await run()
    results.push({ name, passed: true })
    console.log(`PASS | ${name}${detail ? ` — ${detail}` : ''}`)
  } catch (error) {
    results.push({ name, passed: false })
    console.log(`FAIL | ${name} — ${safeMessage(error)}`)
  }
}

async function unwrap(result, label) {
  if (result.error) throw new Error(`${label}: ${safeMessage(result.error)}`)
  return result.data
}

function denied(error) {
  return Boolean(error) && (
    error.code === '42501'
    || /permission denied|row-level security|not allowed|denied/i.test(error.message ?? '')
  )
}

function identifierToEmail(identifier) {
  const slug = identifier.trim().toLowerCase().replaceAll('/', '-').replace(/[^a-z0-9-]/g, '')
  return `u-${slug}@village.internal`
}

function currentPeriod() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date())
  return `${parts.find((part) => part.type === 'year')?.value}-${parts.find((part) => part.type === 'month')?.value}-01`
}

function addMonth(period) {
  const [year, month] = period.slice(0, 10).split('-').map(Number)
  return new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10)
}

function storagePath(houseId) {
  const month = currentPeriod().slice(0, 7)
  return `${houseId}/${month}/${randomUUID()}.jpg`
}

function errorHas(error, code) {
  return Boolean(error) && String(error.message ?? '').includes(code)
}

const usersFile = resolve('scripts/provisioned-users.csv')
const csvText = (await readFile(usersFile, 'utf8')).replace(/^\uFEFF/, '').trimEnd()
const [headers, ...records] = csvText.split(/\r?\n/).map(parseCsvLine)
const column = Object.fromEntries(headers.map((name, index) => [name, index]))
const users = new Map(records.map((row) => [row[column.identifier], Object.fromEntries(headers.map((name, index) => [name, row[index] ?? '']))]))
const requiredIdentifiers = ['99/1', '99/2', '99/5', 'committee02', 'admin01']
for (const identifier of requiredIdentifiers) {
  const user = users.get(identifier)
  if (!user || user.result !== 'สำเร็จ' || !user.password) {
    throw new Error(`Provisioned account is missing or unsuccessful: ${identifier}.`)
  }
  secrets.push(user.password)
}

const csvHeader = headers.map(quoteCsv).join(',')
async function updateProvisionedPassword(identifier, password) {
  const user = users.get(identifier)
  assert(user, `Missing provisioned account: ${identifier}.`)
  user.password = password
  const body = [
    csvHeader,
    ...[...users.values()].map((record) => headers.map((name) => quoteCsv(record[name])).join(',')),
  ].join('\n')
  await writeFile(usersFile, `\uFEFF${body}\n`, 'utf8')
}

const authOptions = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
const service = createClient(projectUrl, serviceRoleKey, authOptions)
const clients = {}

async function signIn(identifier) {
  const user = users.get(identifier)
  const client = createClient(projectUrl, anonKey, authOptions)
  const { data, error } = await client.auth.signInWithPassword({
    email: identifierToEmail(identifier),
    password: user.password,
  })
  if (error || !data.user) throw new Error(`Login failed for ${identifier}: ${safeMessage(error ?? 'no user')}`)
  if (data.session?.access_token) secrets.push(data.session.access_token)
  return client
}

async function profileFor(identifier) {
  return unwrap(
    await service.from('profiles').select('id,must_change_password').eq('login_identifier', identifier).single(),
    `profile ${identifier}`,
  )
}

async function houseIdFor(houseNo) {
  const row = await unwrap(
    await service.from('houses').select('id').eq('house_no', houseNo).single(),
    `house ${houseNo}`,
  )
  return row.id
}

async function unpaidBills(houseId) {
  return unwrap(
    await service.from('bills').select('id,house_id,period,amount,due_date,status')
      .eq('house_id', houseId)
      .eq('status', 'unpaid')
      .order('period', { ascending: true }),
    'unpaid bills',
  )
}

async function latestBillPeriod() {
  const row = await unwrap(
    await service.from('bills').select('period').order('period', { ascending: false }).limit(1).maybeSingle(),
    'latest bill period',
  )
  return row?.period ?? currentPeriod()
}

async function generateNextMonth(committeeClient) {
  const period = addMonth(await latestBillPeriod())
  await unwrap(
    await committeeClient.rpc('generate_monthly_bills', { p_period: period }),
    'generate_monthly_bills',
  )
}

async function ensureUnpaidCount(houseId, count, committeeClient) {
  let bills = await unpaidBills(houseId)
  for (let attempt = 0; bills.length < count && attempt < 36; attempt += 1) {
    await generateNextMonth(committeeClient)
    bills = await unpaidBills(houseId)
  }
  assert(bills.length >= count, 'Could not find enough unpaid bills for the test.')
  return bills
}

async function exactRowCount(table, columnName, value) {
  const { count, error } = await service.from(table).select('id', { count: 'exact', head: true }).eq(columnName, value)
  if (error) throw new Error(`${table} count: ${safeMessage(error)}`)
  return count ?? 0
}

const jpeg = Buffer.from(
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAF//8QAFhEBAQEAAAAAAAAAAAAAAAAAAgAD/9oACAEBAAEFAo//xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAEDAQE/AT//xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAEDAgE/AT//2Q==',
  'base64',
)
const dateNow = () => new Date().toISOString()

const preflightProfiles = new Map()
for (const identifier of requiredIdentifiers) preflightProfiles.set(identifier, await profileFor(identifier))
const houseOne = await houseIdFor('99/1')
const houseTwo = await houseIdFor('99/2')

let browserBill
let approvalBill
let concurrentBill
let rejectBill
let residentOneSlipId
let concurrentSlipId
let rejectSlipId
let residentOnePath
let residentTwoPath
let residentOne
let residentTwo
let residentFive
let committee
let admin

await check('login 99/1 by house-number email', async () => {
  residentOne = await signIn('99/1')
})

await check('login 99/1 by phone via resolve_login_email', async () => {
  const client = createClient(projectUrl, anonKey, authOptions)
  const email = await unwrap(
    await client.rpc('resolve_login_email', { p_phone: '0810000001' }),
    'resolve_login_email',
  )
  assert(email === identifierToEmail('99/1'), 'Phone lookup returned the wrong account.')
  const { data, error } = await client.auth.signInWithPassword({ email, password: users.get('99/1').password })
  assert(!error && data.user, 'Phone-based login failed.')
  if (data.session?.access_token) secrets.push(data.session.access_token)
})

await check('wrong password is rejected', async () => {
  const client = createClient(projectUrl, anonKey, authOptions)
  const { error } = await client.auth.signInWithPassword({
    email: identifierToEmail('99/1'),
    password: 'Incorrect-e2e-password',
  })
  assert(error, 'Wrong password unexpectedly signed in.')
})

await check('login 99/2', async () => { residentTwo = await signIn('99/2') })
await check('login 99/5 committee', async () => { residentFive = await signIn('99/5') })
await check('login committee02', async () => { committee = await signIn('committee02') })
await check('login admin01', async () => { admin = await signIn('admin01') })

await check('select unpaid bills dynamically for rerunnable tests', async () => {
  const oneBills = await ensureUnpaidCount(houseOne, 3, committee)
  const twoBills = await ensureUnpaidCount(houseTwo, 1, committee)
  browserBill = oneBills.find((bill) => bill.period === currentPeriod()) ?? oneBills[0]
  const apiBills = oneBills.filter((bill) => bill.id !== browserBill.id)
  assert(apiBills.length >= 2, 'Could not reserve separate bills for API approval tests.')
  approvalBill = apiBills[0]
  concurrentBill = apiBills[1]
  rejectBill = twoBills[0]
})

await check('RLS confines 99/1 bills, houses, and slips to house 99/1', async () => {
  const [bills, houses, slips] = await Promise.all([
    residentOne.from('bills').select('house_id'),
    residentOne.from('houses').select('id'),
    residentOne.from('slips').select('house_id'),
  ])
  for (const result of [bills, houses, slips]) assert(!result.error, safeMessage(result.error))
  assert((bills.data ?? []).every((row) => row.house_id === houseOne), 'Bills included another house.')
  assert((houses.data ?? []).every((row) => row.id === houseOne), 'Houses included another house.')
  assert((slips.data ?? []).every((row) => row.house_id === houseOne), 'Slips included another house.')
})

await check('RLS hides 99/2 bills from 99/1', async () => {
  const { data, error } = await residentOne.from('bills').select('id').eq('house_id', houseTwo)
  assert(!error, safeMessage(error))
  assert((data ?? []).length === 0, '99/1 could read 99/2 bills.')
})

await check('RLS limits profiles to the signed-in resident', async () => {
  const { data, error } = await residentOne.from('profiles').select('id')
  assert(!error, safeMessage(error))
  assert(data?.length === 1 && data[0].id === preflightProfiles.get('99/1').id, 'Profiles included another user.')
})

await check('RLS hides ledger entries and audit logs from 99/1', async () => {
  const [ledger, audit] = await Promise.all([
    residentOne.from('ledger_entries').select('id'),
    residentOne.from('audit_logs').select('id'),
  ])
  assert(!ledger.error && !audit.error, safeMessage(ledger.error ?? audit.error))
  assert((ledger.data ?? []).length === 0 && (audit.data ?? []).length === 0, 'Resident read committee-only records.')
})

await check('resident update of bills is denied or a no-op', async () => {
  const before = await unwrap(
    await service.from('bills').select('status').eq('id', browserBill.id).single(),
    'bill before direct update',
  )
  const attempt = await residentOne.from('bills').update({ status: 'paid' }).eq('id', browserBill.id).select('id')
  assert((attempt.error && denied(attempt.error)) || (!attempt.error && !(attempt.data ?? []).length), 'Direct bill update was not denied.')
  const after = await unwrap(
    await service.from('bills').select('status').eq('id', browserBill.id).single(),
    'bill after direct update',
  )
  assert(after.status === before.status && after.status === 'unpaid', 'Direct update changed the bill.')
})

const directSlipId = randomUUID()
await check('resident direct insert into slips is denied and creates nothing', async () => {
  const attempt = await residentOne.from('slips').insert({
    id: directSlipId,
    house_id: houseOne,
    uploaded_by: preflightProfiles.get('99/1').id,
    amount: 1,
    transferred_at: dateNow(),
    file_path: `${houseOne}/direct/${randomUUID()}.jpg`,
    file_size: jpeg.length,
  }).select('id')
  assert((attempt.error && denied(attempt.error)) || (!attempt.error && !(attempt.data ?? []).length), 'Direct slip insert was not denied.')
  const exists = await service.from('slips').select('id').eq('id', directSlipId).maybeSingle()
  assert(!exists.error && !exists.data, 'Direct slip insert persisted.')
})

const directLedgerId = randomUUID()
await check('resident direct insert into ledger_entries is denied and creates nothing', async () => {
  const attempt = await residentOne.from('ledger_entries').insert({
    id: directLedgerId,
    entry_type: 'income',
    category: 'ทดสอบ',
    amount: 1,
    entry_date: currentPeriod(),
    created_by: preflightProfiles.get('99/1').id,
  }).select('id')
  assert((attempt.error && denied(attempt.error)) || (!attempt.error && !(attempt.data ?? []).length), 'Direct ledger insert was not denied.')
  const exists = await service.from('ledger_entries').select('id').eq('id', directLedgerId).maybeSingle()
  assert(!exists.error && !exists.data, 'Direct ledger insert persisted.')
})

await check('anon cannot call generate_monthly_bills', async () => {
  const anon = createClient(projectUrl, anonKey, authOptions)
  const { error } = await anon.rpc('generate_monthly_bills', { p_period: browserBill.period })
  assert(error, 'Anonymous bill generation unexpectedly succeeded.')
})

await check('anon sees no bills', async () => {
  const anon = createClient(projectUrl, anonKey, authOptions)
  const { data, error } = await anon.from('bills').select('id')
  assert(!error, safeMessage(error))
  assert((data ?? []).length === 0, 'Anonymous query returned bills.')
})

residentOnePath = storagePath(houseOne)
await check('99/1 uploads a JPEG into its own storage folder', async () => {
  const { data, error } = await residentOne.storage.from('slips').upload(residentOnePath, jpeg, {
    contentType: 'image/jpeg',
    upsert: false,
  })
  assert(!error && data?.path === residentOnePath, `Own-house upload failed: ${safeMessage(error)}`)
})

await check('99/1 cannot upload into the 99/2 storage folder', async () => {
  const wrongPath = storagePath(houseTwo)
  const { data, error } = await residentOne.storage.from('slips').upload(wrongPath, jpeg, {
    contentType: 'image/jpeg',
    upsert: false,
  })
  assert(error && (denied(error) || error.statusCode === '403' || error.status === 403) && !data, 'Cross-house storage upload was not denied.')
})

await check('99/2 cannot create a signed URL for 99/1 storage', async () => {
  const { data, error } = await residentTwo.storage.from('slips').createSignedUrl(residentOnePath, 60)
  assert(error || !data?.signedUrl, '99/2 could sign 99/1 storage.')
})

await check('committee02 can create a signed URL for 99/1 storage', async () => {
  const { data, error } = await committee.storage.from('slips').createSignedUrl(residentOnePath, 60)
  assert(!error && Boolean(data?.signedUrl), `Committee signing failed: ${safeMessage(error)}`)
})

await check('bucket rejects a text/plain upload', async () => {
  const path = `${houseOne}/${currentPeriod().slice(0, 7)}/${randomUUID()}.txt`
  const { data, error } = await residentOne.storage.from('slips').upload(path, Buffer.from('not an image'), {
    contentType: 'text/plain',
    upsert: false,
  })
  assert(error || !data, 'Bucket unexpectedly accepted a non-image MIME type.')
})

await check('submit_slip rejects another house folder path', async () => {
  const { error } = await residentOne.rpc('submit_slip', {
    p_bill_ids: [approvalBill.id],
    p_amount: Number(approvalBill.amount),
    p_transferred_at: dateNow(),
    p_file_path: `${houseTwo}/${currentPeriod().slice(0, 7)}/${randomUUID()}.jpg`,
    p_file_size: jpeg.length,
  })
  assert(errorHas(error, 'INVALID_FILE_PATH'), `Expected INVALID_FILE_PATH; received ${safeMessage(error)}`)
})

await check('99/1 submits an unpaid bill and its uploaded path', async () => {
  const { data, error } = await residentOne.rpc('submit_slip', {
    p_bill_ids: [approvalBill.id],
    p_amount: Number(approvalBill.amount),
    p_transferred_at: dateNow(),
    p_file_path: residentOnePath,
    p_file_size: jpeg.length,
  })
  assert(!error && typeof data === 'string', `Slip submission failed: ${safeMessage(error)}`)
  residentOneSlipId = data
})

await check('submitted bill moves to pending_review', async () => {
  const row = await unwrap(
    await service.from('bills').select('status').eq('id', approvalBill.id).single(),
    'submitted bill',
  )
  assert(row.status === 'pending_review', 'Submitted bill is not pending_review.')
})

await check('submitting the same bill again returns BILL_NOT_PAYABLE', async () => {
  const { error } = await residentOne.rpc('submit_slip', {
    p_bill_ids: [approvalBill.id],
    p_amount: Number(approvalBill.amount),
    p_transferred_at: dateNow(),
    p_file_path: residentOnePath,
    p_file_size: jpeg.length,
  })
  assert(errorHas(error, 'BILL_NOT_PAYABLE'), `Expected BILL_NOT_PAYABLE; received ${safeMessage(error)}`)
})

await check('99/1 cannot approve its own slip', async () => {
  const { error } = await residentOne.rpc('approve_slip', { p_slip_id: residentOneSlipId })
  assert(errorHas(error, 'FORBIDDEN'), `Expected FORBIDDEN; received ${safeMessage(error)}`)
})

await check('committee02 pending list contains the submitted slip', async () => {
  const rows = await unwrap(await committee.rpc('list_pending_slips'), 'list_pending_slips')
  assert(rows.some((row) => row.id === residentOneSlipId), 'Pending slip was not listed for committee.')
})

await check('committee approval marks bill paid and creates one ledger row', async () => {
  const { error } = await committee.rpc('approve_slip', { p_slip_id: residentOneSlipId })
  assert(!error, `Approval failed: ${safeMessage(error)}`)
  const bill = await unwrap(
    await service.from('bills').select('status').eq('id', approvalBill.id).single(),
    'approved bill',
  )
  assert(bill.status === 'paid', 'Approved bill is not paid.')
  assert(await exactRowCount('ledger_entries', 'slip_id', residentOneSlipId) === 1, 'Expected exactly one income row.')
})

await check('second approval returns SLIP_NOT_PENDING and does not duplicate ledger', async () => {
  const { error } = await committee.rpc('approve_slip', { p_slip_id: residentOneSlipId })
  assert(errorHas(error, 'SLIP_NOT_PENDING'), `Expected SLIP_NOT_PENDING; received ${safeMessage(error)}`)
  assert(await exactRowCount('ledger_entries', 'slip_id', residentOneSlipId) === 1, 'Second approval duplicated ledger.')
})

await check('concurrent approvals produce one paid result and one ledger row', async () => {
  const submitted = await residentOne.rpc('submit_slip', {
    p_bill_ids: [concurrentBill.id],
    p_amount: Number(concurrentBill.amount),
    p_transferred_at: dateNow(),
    p_file_path: residentOnePath,
    p_file_size: jpeg.length,
  })
  assert(!submitted.error && typeof submitted.data === 'string', `Concurrent-test slip failed: ${safeMessage(submitted.error)}`)
  concurrentSlipId = submitted.data
  const responses = await Promise.all([
    residentFive.rpc('approve_slip', { p_slip_id: concurrentSlipId }),
    committee.rpc('approve_slip', { p_slip_id: concurrentSlipId }),
  ])
  const successes = responses.filter((response) => !response.error)
  const failures = responses.filter((response) => response.error)
  assert(successes.length === 1 && failures.length === 1, 'Expected exactly one concurrent approval to succeed.')
  assert(errorHas(failures[0].error, 'SLIP_NOT_PENDING'), `Unexpected concurrent error: ${safeMessage(failures[0].error)}`)
  assert(await exactRowCount('ledger_entries', 'slip_id', concurrentSlipId) === 1, 'Concurrent approvals did not produce exactly one ledger row.')
})

residentTwoPath = storagePath(houseTwo)
await check('99/2 uploads a JPEG into its own storage folder', async () => {
  const { data, error } = await residentTwo.storage.from('slips').upload(residentTwoPath, jpeg, {
    contentType: 'image/jpeg',
    upsert: false,
  })
  assert(!error && data?.path === residentTwoPath, `99/2 upload failed: ${safeMessage(error)}`)
})

await check('99/2 submits an unpaid bill', async () => {
  const { data, error } = await residentTwo.rpc('submit_slip', {
    p_bill_ids: [rejectBill.id],
    p_amount: Number(rejectBill.amount),
    p_transferred_at: dateNow(),
    p_file_path: residentTwoPath,
    p_file_size: jpeg.length,
  })
  assert(!error && typeof data === 'string', `99/2 submission failed: ${safeMessage(error)}`)
  rejectSlipId = data
})

await check('reject_slip requires a reason', async () => {
  const { error } = await committee.rpc('reject_slip', { p_slip_id: rejectSlipId, p_reason: '' })
  assert(errorHas(error, 'REASON_REQUIRED'), `Expected REASON_REQUIRED; received ${safeMessage(error)}`)
})

await check('committee rejection returns the bill to unpaid and resident can read reason', async () => {
  const reason = 'ยอดเงินไม่ตรงกับบิล'
  const { error } = await committee.rpc('reject_slip', { p_slip_id: rejectSlipId, p_reason: reason })
  assert(!error, `Rejection failed: ${safeMessage(error)}`)
  const [slip, bill, residentView] = await Promise.all([
    service.from('slips').select('status,reject_reason').eq('id', rejectSlipId).single(),
    service.from('bills').select('status').eq('id', rejectBill.id).single(),
    residentTwo.from('slips').select('reject_reason').eq('id', rejectSlipId).single(),
  ])
  assert(!slip.error && !bill.error && !residentView.error, safeMessage(slip.error ?? bill.error ?? residentView.error))
  assert(slip.data.status === 'rejected' && slip.data.reject_reason === reason, 'Rejected slip data is incorrect.')
  assert(bill.data.status === 'unpaid', 'Rejected bill did not return to unpaid.')
  assert(residentView.data.reject_reason === reason, 'Resident could not read rejection reason.')
})

async function callAdmin(client, body) {
  const { data, error } = await client.auth.getSession()
  if (error || !data.session?.access_token) throw new Error(`Missing signed-in session: ${safeMessage(error ?? 'no session')}`)
  secrets.push(data.session.access_token)
  return fetch(`${projectUrl}/functions/v1/admin-users`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      authorization: `Bearer ${data.session.access_token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

const userTwoId = preflightProfiles.get('99/2').id
await check('admin-users denies resident 99/1 with 403', async () => {
  const response = await callAdmin(residentOne, { action: 'reset_password', user_id: userTwoId, password: 'x' })
  assert(response.status === 403, `Expected HTTP 403, received ${response.status}.`)
})

await check('admin-users denies committee02 with 403', async () => {
  const response = await callAdmin(committee, { action: 'reset_password', user_id: userTwoId, password: 'x' })
  assert(response.status === 403, `Expected HTTP 403, received ${response.status}.`)
})

const resetPassword = randomBytes(18).toString('base64url')
secrets.push(resetPassword)
await check('admin01 resets 99/2 password and saves it privately', async () => {
  const response = await callAdmin(admin, { action: 'reset_password', user_id: userTwoId, password: resetPassword })
  assert(response.status === 200, `Expected HTTP 200, received ${response.status}.`)
  const body = await response.json()
  assert(body.success === true, 'Password reset did not report success.')
  await updateProvisionedPassword('99/2', resetPassword)
})

await check('reset password sets must_change_password for 99/2', async () => {
  const profile = await profileFor('99/2')
  assert(profile.must_change_password === true, 'Profile does not require a password change.')
})

const failures = results.filter((result) => !result.passed)
console.log(`\nE2E result: ${results.length - failures.length}/${results.length} passed; ${failures.length} failed.`)
if (failures.length) process.exitCode = 1
