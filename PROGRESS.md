# PROGRESS.md — ติดตามความคืบหน้า Smart Village Web App

> อ้างอิง: `Plan.md` (v0.3), `DESIGN.md` (v1.0), `AGENTS.md` (คำสั่ง/การตั้งค่า)
> อัปเดตล่าสุด: 2026-11-17

**สัญลักษณ์:** `[x]` เสร็จและผ่านการตรวจในเครื่องแล้ว (lint/typecheck/test/PGlite/code review) — ยังต้องทดสอบกับ Supabase จริงตามรายการด้านล่าง · `[~]` เขียนโค้ดแล้ว ยังไม่ได้ตรวจ/ทดสอบ · `[ ]` ยังไม่เริ่ม · `[!]` ติดปัญหา

---

## สถานะปัจจุบัน

| รายการ | สถานะ |
|---|---|
| **เฟสปัจจุบัน** | **เตรียม UAT รวม Phase 1-4** (โค้ด Phase 2-4 เสร็จในเครื่อง — รอ apply migration 0005-0007 บน `baan-dev`) |
| ความคืบหน้า Phase 1 | โค้ดครบ ผ่านการตรวจในเครื่อง ผ่าน E2E กับ `baan-dev`, deploy ขึ้น Cloudflare Pages (ชี้ไปที่ `baan-dev`), ตั้ง GitHub secrets และทดสอบบนมือถือจริงแล้ว (สลิป 2 ธนาคาร) — **เหลือ UAT กับลูกบ้าน (บน `baan-dev`), ตั้งค่า prod หลัง UAT และ Pilot** |
| Supabase | `baan-dev`: ใช้ migration 4 ชุด (รวม `password_reset_requests`) + seed (40 หลัง) + สร้างบิล พ.ย. 2569 (40 ใบ) + deploy `admin-users` แล้ว + บัญชีทดสอบ 5 บัญชี (`99/1`, `99/2`, `99/5`, `committee02`, `admin01` — รหัสผ่านรีเซ็ตใหม่ 2026-11-17 อยู่ใน `scripts/provisioned-users.csv` ที่ถูก gitignore; บัญชีที่ถูกบังคับเปลี่ยนรหัสอาจถูกเปลี่ยนไปแล้วระหว่างทดสอบ เช่น `admin01`) · มีข้อมูลทดสอบ (บิลเดือนถัดไป, สลิป, รูปใน Storage) ค้างอยู่ · `baan-prod`: ยังว่าง (ผู้ใช้เลือกยังไม่ตั้งค่า) |
| เป้าหมายถัดไป | UAT กับลูกบ้านบน `baan-dev` → ตั้งค่า `baan-prod` ด้วยข้อมูลจริง (หลัง UAT) → Pilot 5-10 หลังในรอบ 25-5 |

### สภาพแวดล้อม

| รายการ | ค่า / สถานะ |
|---|---|
| Supabase dev | `baan-dev` — project ref `rycthgqxhwhcveneyccz` |
| Supabase prod | `baan-prod` — project ref `dlthaconmayzysiqanzr` |
| Supabase MCP | `supabase-dev` (baan-dev) และ `supabase-prod` (baan-prod) เชื่อมต่อได้แล้ว |
| Docker Desktop | `[!]` ไม่ได้เปิด — ใช้ `supabase start` แบบ local ไม่ได้ (ทดสอบ SQL ด้วย PGlite แทน) |
| Frontend hosting | Cloudflare Pages — deploy สำเร็จ, env ชี้ไปที่ `baan-dev` (build ครั้งแรกล้มเพราะ `package-lock.json` สร้างบน Windows ไม่มี native binary ของ Linux — สร้าง lockfile ใหม่แล้ว) |
| Git | GitHub repo `evepraeploy/smart-baan` — push แล้ว (branch `main`, Cloudflare build อัตโนมัติเมื่อ push) |
| Dev server (local) | `http://127.0.0.1:5173` (เชื่อม `baan-dev` ผ่าน `.env.local`) |

---

## Phase 0 — เตรียมงานและออกแบบ

- [ ] 1. ยืนยันข้อมูลกับกรรมการ: ค่าส่วนกลาง/เดือน (ตอนนี้ใช้ 500 บาทเป็นค่าสมมติ), เลขบัญชี/QR, รายชื่อ 40 หลัง + เบอร์โทร, รายชื่อกรรมการ/ผู้ดูแล, รายชื่อช่างภายนอก, ยอดเงินยกมา
- [x] 2. สร้างบัญชี/โปรเจกต์ Supabase Free (`baan-dev`, `baan-prod`) — *ยังต้องยืนยันขีดจำกัด Free Tier ล่าสุดในหน้า Pricing*
- [~] 3. เอกสารออกแบบ
  - [x] `Plan.md` (เป้าหมาย, ขอบเขต, Feature, เมนู, AC, ขั้นตอน)
  - [x] `DESIGN.md` (Design System + Tailwind v4 tokens)
  - [x] Schema/RLS/Storage policy — อยู่ใน `supabase/migrations/` (ทดสอบด้วย PGlite แล้ว ยกเว้น Storage policy และ pg_cron)
  - [x] Folder structure — ตามโครงโปรเจกต์ปัจจุบัน
  - [ ] Architecture diagram / ER diagram แยกเป็นเอกสาร
- [~] 4. Wireframe/Mockup — Stitch สร้าง Design System แล้ว ยังไม่มี Mockup รายหน้า
- [x] 5. มาตรฐานภาษาไทย — `src/lib/messages.th.ts`, `src/lib/errors.ts`, `src/lib/format.ts` (มี unit test)

## Phase 1 — MVP: Login + ส่งสลิป + ตรวจสลิป ← **เฟสปัจจุบัน**

| # | งาน | สถานะ | ไฟล์หลัก |
|---|---|:-:|---|
| 1 | ตั้งค่าโปรเจกต์ Vite + React + TS + Tailwind v4 + PWA, Design Tokens, คอมโพเนนต์พื้นฐาน | `[x]` | `package.json`, `vite.config.ts`, `src/styles/theme.css`, `src/components/**` |
| 2 | Migration: ตาราง + RLS + Storage bucket `slips` (private) | `[x]` | `supabase/migrations/202611170001_initial_schema.sql`, `…0002_storage.sql` |
| 3 | Auth: Login บ้านเลขที่/เบอร์โทร + รหัสผ่าน, บังคับเปลี่ยนรหัส, Google (เปิดด้วย env), Edge Function จัดการผู้ใช้ | `[x]` | `src/features/auth/**`, `src/lib/auth-identifier.ts`, `supabase/functions/admin-users/` |
| 4 | Import บ้าน 40 หลัง + บัญชีผู้ใช้ | `[x]` | `supabase/seed.sql`, `scripts/provision-users.mjs`, `scripts/users.example.csv` |
| 5 | สร้างบิลรายเดือน (`pg_cron` วันที่ 25 + ปุ่ม manual, กันบิลซ้ำ) | `[x]` | `…0003_pg_cron.sql`, RPC `generate_monthly_bills` |
| 6 | หน้าส่งสลิป + บีบอัดรูป ≤ 200 KB + Preview + retry | `[x]` | `src/features/payments/UploadSlipPage.tsx`, `src/lib/image.ts` |
| 7 | หน้าตรวจสลิป + RPC `approve_slip` / `reject_slip` (transaction, กันอนุมัติซ้ำ) | `[x]` | `src/features/review/**` |
| 8 | หน้าประวัติการชำระของลูกบ้าน | `[x]` | `src/features/payments/PaymentHistoryPage.tsx` |
| 9 | GitHub Actions: CI, keep-alive รายวัน, backup `pg_dump` รายเดือน | `[x]` | `.github/workflows/*.yml` |
| 10 | ทดสอบตาม AC 5.1-5.3, 5.9 + ทดสอบ RLS ด้วย API ตรง | `[~]` | `scripts/e2e-dev.mjs` (API 39/39 ผ่าน), browser flow ผ่าน, มือถือจริงผ่าน URL Cloudflare ผ่าน (สลิป 2 ธนาคาร) — เหลือสลิปอีก 3 ธนาคาร (เป้า 5), HEIC, Slow 3G ซึ่งจะเก็บระหว่าง UAT |
| 11 | UAT กับลูกบ้านบน `baan-dev` | `[ ]` | — |
| 12 | ตั้งค่า `baan-prod` (หลัง UAT) + Pilot ลูกบ้าน 5-10 หลังในรอบ 25-5 | `[ ]` | — |

**งานเพิ่มเติมที่ทำใน Phase 1:** หน้าจัดการบ้าน/ผู้ใช้ (`/admin/houses`), หน้าตั้งค่าหมู่บ้าน (`/admin/settings`), แถบโทรด่วน (`QuickCallBar`), หน้า "เร็ว ๆ นี้" สำหรับเมนูของเฟสถัดไป, เปลี่ยนรหัสผ่านด้วยตัวเอง (ต้องกรอกรหัสปัจจุบัน, เมนู "โปรไฟล์" ใน sidebar ทุกบทบาท), หน้า "ลืมรหัสผ่าน" (`/forgot-password`) + หน้าคำขอรีเซ็ตรหัสผ่านสำหรับ admin (`/admin/password-requests`, migration `…0004_password_reset_requests.sql`)

### งานที่ต้องทำให้ Phase 1 เสร็จ

- [x] `npm install` และสร้าง `package-lock.json`
- [x] ตรวจวันเผยแพร่ของ dependency (ทุกตัวเผยแพร่ก่อน 2026-11-10)
- [x] `npm run lint` (0 error, 4 warning), `npm run typecheck`, `npm test` (15/15), `npm run test:db` (9/9), `npm run build` ผ่านทั้งหมด
- [x] สร้างไอคอน PWA และ build สำเร็จ (precache 34 ไฟล์)
- [x] เปิด dev server ตรวจหน้า "ยังไม่ได้ตั้งค่าระบบ" และหน้า Login (headless browser, ไม่มี console error)
- [x] Code review ทั้งหมด (RLS, RPC, Storage policy, Edge Function, หน้าส่งสลิป) — แก้บั๊กหน้าค้าง (spinner) เมื่อบัญชีไม่ผูกบ้าน
- [x] เชื่อม `baan-dev`: migration (`initial_schema`, `storage`, `pg_cron`) → seed → deploy `admin-users` (ผ่าน Supabase MCP)
- [x] Provision ผู้ใช้ทดสอบ 5 บัญชี
- [x] ปิด "Allow new users to sign up" ใน Supabase Auth ทั้ง dev และ prod
- [x] ทดสอบ end-to-end กับ `baan-dev` ตาม AC 5.2-5.3: API 39/39 PASS (RLS, Storage, อนุมัติซ้ำ/พร้อมกัน, ปฏิเสธ, Edge Function) + browser flow มือถือ 390px (รูป 4.39 MB → 181 KB, ไม่มี console error) — แก้บั๊กหน้าเปลี่ยนรหัสผ่านวนกลับซ้ำ
- [~] ทดสอบบนมือถือจริงผ่าน URL Cloudflare — ผ่านกับสลิป 2 ธนาคาร · เหลือ: สลิปอีก 3 ธนาคาร, HEIC (iPhone), Slow 3G ≤ 15 วินาที — เก็บระหว่าง UAT
- [x] ช่องวันที่-เวลาโอนแสดงข้อความ พ.ศ. กำกับใต้ช่อง (เช่น "ตรงกับ 25 พ.ย. 2569 14:30 น.") เพราะ `datetime-local` แสดงตาม locale เครื่อง (AC 5.9)
- [x] สร้าง GitHub repo + push, เชื่อม Cloudflare Pages
- [x] เปลี่ยนรหัสผ่านด้วยตัวเอง + ลืมรหัสผ่าน/คำขอรีเซ็ต — unit 16 tests, PGlite 16 tests, apply migration บน `baan-dev`, ทดสอบ anon (ส่งคำขอได้, ดูรายการไม่ได้) และผู้ใช้ทดสอบฝั่ง admin บนเว็บแล้ว
- [x] ตั้ง GitHub Actions secrets 4 ตัว (ชี้ไปที่ `baan-dev`) · CI ผ่านทุก commit ตั้งแต่แก้ lockfile
- [ ] รัน keep-alive และ backup ด้วยมือ (Run workflow) ครั้งแรกเพื่อยืนยันว่า secrets ถูกต้อง
- [ ] หลัง UAT: Deploy `baan-prod` (migration 4 ชุด + `admin-users` + ข้อมูลจริง), เปลี่ยน GitHub secrets และ env ของ Cloudflare ให้ชี้ไปที่ prod แล้ว Pilot

## Phase 2 — การเงินและประกาศ

> Phase 2-4 เขียนโค้ดครบและผ่านการตรวจในเครื่องแล้ว (typecheck, lint, unit 23 tests, PGlite 33 tests, build, code review) — จะทดสอบรวมกันใน UAT รอบเดียวกับ Phase 1 · **ยังไม่ได้ apply migration 0005-0007 + `seed-dev-phase2-4.sql` บน `baan-dev`** (MCP `apply_migration` ถูกปฏิเสธ — รอผู้ใช้รันใน SQL Editor)

- [x] 1. Ledger รายรับ-รายจ่าย + แนบรูปบิล (bucket `receipts`) + หมวดหมู่ + Export CSV รายเดือน (`/finance`, RPC `create/update/delete_ledger_entry`, รายการจากสลิปแก้ไขไม่ได้) — `…0005_finance_announcements.sql`
- [x] 2. Dashboard กรรมการ (RPC `get_committee_dashboard`) + ตารางสถานะ 40 × 12 (`/admin/payment-status`)
- [x] 3. รายงานการเงินภาพรวมสำหรับลูกบ้าน + Export CSV (`/reports`, RPC `get_finance_report` ไม่มีข้อมูลรายบ้าน)
- [x] 4. ระบบประกาศ (`/announcements`: ปักหมุด, วันหมดอายุ, รูป, badge ยังไม่อ่านในเมนู) + แถบโทรด่วน *(แถบโทรด่วนยังไม่ได้ทดสอบบนเครื่องจริง)*
- [ ] 5. ทดสอบตาม AC 5.4, 5.7 บน `baan-dev` (UAT)

## Phase 3 — Helpdesk / แจ้งซ่อม

- [x] 1. Migration `tickets`, `ticket_jobs` (ค่าจ้าง/ช่าง — กรรมการเท่านั้น), `ticket_photos`, `ticket_events`, `contractors` + RLS + bucket `tickets` — `…0006_tickets.sql`
- [x] 2. ฟอร์มแจ้งเรื่อง (`/repairs/new`, รูปสูงสุด 3 รูป), หน้า "เรื่องของฉัน" (`/repairs`, `/repairs/:id` + timeline + ความเห็น)
- [x] 3. Tracking Board สำหรับกรรมการ (`/maintenance`, `/maintenance/:id`: มอบหมายกรรมการ/ช่าง, วันนัด, ค่าจ้าง, รูปหลังซ่อม, ปิดงานพร้อม "บันทึกเป็นรายจ่าย")
- [x] 4. หน้ารายชื่อช่างภายนอก (`/admin/contractors`)
- [ ] 5. ทดสอบตาม AC 5.5 บน `baan-dev` (UAT)

## Phase 4 — ทรัพย์สินส่วนกลางและ PM

- [x] 1. Migration `assets`, `maintenance_logs` + RLS + bucket `assets` + `tickets.asset_id` — `…0007_assets.sql`
- [x] 2. ทะเบียนอุปกรณ์ + ประวัติซ่อม/บำรุงรักษา (`/assets`, `/assets/:id`, RPC `record_maintenance` บันทึกเป็นรายจ่ายได้) + เชื่อมงานซ่อมกับอุปกรณ์
- [x] 3. `next_due_date` อัตโนมัติ (trigger + `record_maintenance`) + รายการ PM เลยกำหนด/ภายใน 14 วันบน Dashboard
- [ ] 4. ทดสอบตาม AC 5.6 บน `baan-dev` (UAT)

## Phase 5 — Hardening และส่งมอบ

- [ ] 1. Lighthouse / PWA บน Android + iOS / 360px / ตรวจภาษาไทยครบทุกหน้า (AC 5.8, 5.9)
- [ ] 2. Usability test กับลูกบ้านสูงวัย
- [ ] 3. ทดลอง restore backup
- [ ] 4. คู่มือลูกบ้าน + คู่มือกรรมการ
- [ ] 5. รอบตรวจโควต้า + แผน archive รูป

---

## ปัญหา / สิ่งที่รอ

| # | เรื่อง | ผลกระทบ | ต้องการจาก |
|---|---|---|---|
| 1 | Docker Desktop ไม่ได้เปิด | ทดสอบ Supabase แบบ local ไม่ได้ | ผู้ใช้: เปิด Docker (ถ้าต้องการทดสอบ local) |
| 2 | Security Advisor เตือน SECURITY DEFINER function (11 ตัวเดิม + 3 ตัวของคำขอรีเซ็ตรหัสผ่าน) | ตั้งใจออกแบบไว้ (ทุกฟังก์ชันตรวจสิทธิ์ภายใน; `resolve_login_email` และ `request_password_reset` เปิดให้ anon — ตัวหลังไม่บอกว่ามีบัญชีหรือไม่ และมีคำขอค้างได้ 1 รายการต่อผู้ใช้) | — (รับทราบ) |
| 3 | ข้อมูลจริงของหมู่บ้าน (Phase 0 ข้อ 1) | ใช้ข้อมูลตัวอย่างไปก่อน, `baan-prod` ยังไม่ตั้งค่า | กรรมการหมู่บ้าน |
| 4 | Migration บน Supabase ถูก apply ผ่าน MCP จึงมี version เป็น timestamp (เช่น `20261117062733`) ไม่ตรงกับชื่อไฟล์ใน repo (`202611170001…`) | หากใช้ `supabase db push` ภายหลัง CLI จะเห็นว่า migration ไม่ตรงกัน | ใช้ MCP ต่อไป หรือ `supabase migration repair` ก่อนใช้ CLI |
| 5 | ไฟล์ JS ใหญ่ (`heic2any` ~1.3 MB, bundle หลัก ~540 KB) และ dependency deprecated (`eslint@9.16.0`, `glob@11.1.0`) | ไม่ทำให้ build ล้ม — ควรปรับใน Phase 5 | — |

## บันทึกการเปลี่ยนแปลง

| วันที่ | รายการ |
|---|---|
| 2026-11-17 | สร้าง `Plan.md` v0.1 → v0.3 (ภาษาไทยเท่านั้น, 3 Role, แถบโทรด่วน) |
| 2026-11-17 | สร้าง `DESIGN.md` v1.0 จาก Google Stitch (รวม 2 ไฟล์ + แก้ค่าที่ผิด) |
| 2026-11-17 | สร้างโปรเจกต์ Supabase `baan-dev` และ `baan-prod` |
| 2026-11-17 | เขียนโค้ด Phase 1 ครบตามขอบเขต |
| 2026-11-17 | `baan-dev`: apply migration + seed + deploy Edge Function `admin-users` |
| 2026-11-17 | `baan-dev`: สร้างบัญชีทดสอบ 5 บัญชี, E2E API 39/39 PASS, browser flow ผ่าน, แก้บั๊กหน้าเปลี่ยนรหัสผ่าน |
| 2026-11-17 | Phase 1 ผ่านการตรวจในเครื่อง: lint, typecheck, unit 15 tests, PGlite 9 tests, build, code review |
| 2026-11-17 | เชื่อม Supabase MCP (`supabase-dev`, `supabase-prod`), push ขึ้น GitHub, แก้ Cloudflare build ล้ม (สร้าง `package-lock.json` ใหม่ให้มี native binary ทุก platform), deploy Cloudflare Pages สำเร็จ |
| 2026-11-17 | รีเซ็ตรหัสผ่านบัญชีทดสอบ 5 บัญชีบน `baan-dev` (ไฟล์ `provisioned-users.csv` เดิมหาย) |
| 2026-11-17 | เพิ่มเปลี่ยนรหัสผ่านด้วยตัวเอง + หน้าลืมรหัสผ่าน + หน้าคำขอรีเซ็ตสำหรับ admin, apply migration `password_reset_requests` บน `baan-dev` |
| 2026-11-17 | เพิ่มข้อความวันที่ พ.ศ. ใต้ช่องวันและเวลาที่โอนในหน้าส่งสลิป |
| 2026-11-17 | ตั้ง GitHub secrets, ทดสอบบนมือถือจริง (สลิป 2 ธนาคาร), ทดสอบคำขอรีเซ็ตรหัสผ่านฝั่ง admin — ตัดสินใจเลื่อนการตั้งค่า `baan-prod` ไปหลัง UAT กับลูกบ้าน |
| 2026-11-17 | เขียนโค้ด Phase 2 (การเงิน, ตารางสถานะ, รายงาน, ประกาศ), Phase 3 (แจ้งซ่อม, บอร์ดงานซ่อม, ช่างภายนอก), Phase 4 (ทะเบียนอุปกรณ์, PM, Dashboard กรรมการ) + migration 0005-0007 + `seed-dev-phase2-4.sql` — ตัดสินใจ UAT ทุกฟีเจอร์พร้อมกัน |
