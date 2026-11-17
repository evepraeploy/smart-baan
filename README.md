# smart-baan

ระบบบริหารจัดการงานกรรมการหมู่บ้าน (Smart Village Web App) สำหรับหมู่บ้านขนาด 40 หลังคาเรือน ใช้งานบนมือถือเป็นหลัก ติดตั้งเป็น PWA ได้ และออกแบบให้มีค่าใช้จ่าย 0 บาท/เดือนด้วย Free Tier ทั้งหมด

ลูกบ้านอัปโหลดสลิปค่าส่วนกลางเองได้ กรรมการตรวจและอนุมัติหรือปฏิเสธได้ในที่เดียว จึงไม่ต้องรับสลิปผ่าน LINE หรือกระดาษอีกต่อไป

> หน้าจอและข้อความทั้งหมดเป็นภาษาไทย วันที่แสดงแบบ พ.ศ. และสกุลเงินเป็นบาท

## สถานะ

**Phase 1 — MVP: Login + ส่งสลิป + ตรวจสลิป** เขียนโค้ดครบแล้ว และผ่าน E2E บนสภาพแวดล้อม dev แล้ว ตอนนี้กำลังทดสอบบนมือถือจริงและเตรียมนำขึ้น production ดูรายละเอียดได้ที่ [`PROGRESS.md`](PROGRESS.md)

| เฟส | ขอบเขต | สถานะ |
|---|---|---|
| 1 | Login, สร้างบิลรายเดือน, ส่งสลิป, ตรวจสลิป, ประวัติการชำระ | กำลังทดสอบ |
| 2 | บัญชีรายรับ-รายจ่าย, Dashboard, รายงาน, ประกาศ | ยังไม่เริ่ม |
| 3 | Helpdesk / แจ้งซ่อม | ยังไม่เริ่ม |
| 4 | ทรัพย์สินส่วนกลางและรอบบำรุงรักษา (PM) | ยังไม่เริ่ม |
| 5 | Hardening และส่งมอบ | ยังไม่เริ่ม |

เมนูของเฟสที่ยังไม่พัฒนาจะแสดงเป็นหน้า "เร็ว ๆ นี้"

## ฟีเจอร์ใน Phase 1

- **เข้าสู่ระบบ** ด้วยบ้านเลขที่หรือเบอร์โทรพร้อมรหัสผ่าน ระบบบังคับให้เปลี่ยนรหัสผ่านในการเข้าใช้ครั้งแรก และเปิด Google Login ได้ด้วยตัวแปร env
- **บทบาทผู้ใช้ 3 แบบ:** ลูกบ้าน (`resident`), กรรมการ (`committee`) และผู้ดูแลระบบ (`admin`)
- **บิลรายเดือน** สร้างอัตโนมัติทุกวันที่ 25 ด้วย `pg_cron` หรือกดสร้างเองได้ โดยระบบกันบิลซ้ำ
- **ส่งสลิป** ระบบบีบอัดรูปบนเบราว์เซอร์ให้เหลือไม่เกิน 200 KB รองรับไฟล์ HEIC แสดงตัวอย่างก่อนส่ง และลองส่งใหม่ได้
- **ตรวจสลิป** กรรมการอนุมัติหรือปฏิเสธพร้อมระบุเหตุผลได้ การทำงานอยู่ใน transaction และกันการอนุมัติซ้ำ
- **ประวัติการชำระ** ของบ้านตนเอง
- **งานผู้ดูแลระบบ** ได้แก่ จัดการบ้านและผู้ใช้ ตั้งค่าหมู่บ้าน และแถบโทรด่วนถึงกรรมการหรือ รปภ.
- **ความปลอดภัย** เปิด Row Level Security ทุกตาราง ใช้ Storage bucket แบบ private ร่วมกับ Signed URL และเก็บ audit log การอนุมัติ

## Tech Stack

| ส่วน | เทคโนโลยี |
|---|---|
| Frontend | React 19, TypeScript, Vite 6, Tailwind CSS v4, React Router 7, TanStack Query, PWA (`vite-plugin-pwa`) |
| Backend | Supabase (Postgres + RLS, Auth, Storage, Edge Functions, `pg_cron`) |
| Hosting | Cloudflare Pages |
| CI / Ops | GitHub Actions (CI, keep-alive รายวัน, สำรองข้อมูล `pg_dump` รายเดือน) |
| Testing | Vitest, Testing Library, PGlite (ทดสอบ migration/RPC โดยไม่ใช้ Docker) |

## เริ่มต้นใช้งาน

ต้องมี Node.js 22, npm 11 และโปรเจกต์ Supabase

```bash
npm ci
cp .env.example .env.local   # แล้วกรอกค่าตามตารางด้านล่าง
npm run dev
```

| ตัวแปร | คำอธิบาย |
|---|---|
| `VITE_SUPABASE_URL` | URL ของโปรเจกต์ Supabase |
| `VITE_SUPABASE_ANON_KEY` | anon/publishable key สำหรับเว็บ |
| `VITE_ENABLE_GOOGLE_LOGIN` | ตั้งเป็น `true` เพื่อแสดงปุ่ม Google หลังตั้งค่า OAuth provider แล้ว |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | ใช้กับสคริปต์ฝั่ง server เท่านั้น **ห้ามใส่ service role key ในตัวแปร `VITE_*`** |

ถ้ายังไม่ได้ตั้งค่า URL หรือ anon key แอปจะแสดงหน้า "ยังไม่ได้ตั้งค่าระบบ"

### ตั้งค่า Supabase

```bash
npx supabase link --project-ref <project-ref>
npx supabase db push                           # migration ใน supabase/migrations/
npx supabase functions deploy admin-users
```

จากนั้นรัน `supabase/seed.sql` หนึ่งครั้งเพื่อสร้าง settings และบ้านตัวอย่าง 40 หลัง แล้วสร้างบัญชีผู้ใช้จากไฟล์ CSV ด้วยคำสั่งนี้

```bash
node --env-file=.env.local scripts/provision-users.mjs scripts/users.example.csv
```

รหัสผ่านที่สร้างขึ้นจะถูกบันทึกไว้ใน `scripts/provisioned-users.csv` ไฟล์นี้ถูก gitignore ไว้แล้ว และต้องเก็บไว้อย่างปลอดภัย

ถ้าโปรเจกต์ไม่อนุญาตให้ migration เปิดส่วนขยาย `pg_cron` เอง ให้เปิด `pg_cron` ใน Supabase Dashboard ก่อนรัน migration สุดท้าย

## คำสั่ง

| คำสั่ง | หน้าที่ |
|---|---|
| `npm run dev` | เปิด Vite dev server |
| `npm run lint` | ตรวจโค้ดด้วย ESLint |
| `npm run typecheck` | ตรวจ TypeScript แบบ strict |
| `npm test` | รัน unit test |
| `npm run test:db` | ทดสอบ migration และ RPC บน PGlite |
| `npm run build` | ตรวจ TypeScript แล้ว build ไฟล์ production ลงใน `dist/` |
| `node --env-file=.env.local scripts/e2e-dev.mjs` | รัน E2E กับโปรเจกต์ dev |

## Deploy

**Cloudflare Pages** ใช้ build command `npm run build` และ output directory `dist` ตั้งตัวแปร `VITE_*` ทั้งสามตัวใน Build environment variables ส่วน `public/_redirects` ทำ SPA fallback ให้แล้ว

**GitHub Actions secrets** ที่ต้องตั้ง:

- `SUPABASE_URL`, `SUPABASE_ANON_KEY` สำหรับ workflow keep-alive
- `SUPABASE_DB_URL`, `BACKUP_PASSPHRASE` สำหรับ workflow สำรองฐานข้อมูล (เข้ารหัสด้วย GPG)

## โครงสร้างโปรเจกต์

```
src/
  components/   คอมโพเนนต์ UI และ layout (AppShell, BottomNav, QuickCallBar ฯลฯ)
  features/     auth, payments, review, admin
  lib/          Supabase client, ข้อความภาษาไทย, จัดรูปแบบวันที่/เงิน, บีบอัดรูป
  pages/        หน้าทั่วไป (Home, ComingSoon, NotFound ฯลฯ)
  styles/       Design tokens (Tailwind v4)
supabase/
  migrations/   schema, RLS, storage policy, pg_cron
  functions/    Edge Function admin-users
  seed.sql      ข้อมูลตั้งต้น 40 หลัง
scripts/        provision ผู้ใช้, E2E, สร้างไอคอน PWA
tests/          unit/ และ db/ (PGlite)
```

## เอกสารที่เกี่ยวข้อง

- [`Plan.md`](Plan.md) อธิบายเป้าหมาย ขอบเขต ฟีเจอร์ และ Acceptance Criteria
- [`DESIGN.md`](DESIGN.md) อธิบาย Design System และ Tailwind tokens
- [`PROGRESS.md`](PROGRESS.md) ใช้ติดตามความคืบหน้ารายเฟส
- [`AGENTS.md`](AGENTS.md) เป็นคู่มือสำหรับผู้พัฒนา
