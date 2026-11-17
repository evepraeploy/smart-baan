# ระบบหมู่บ้าน — คู่มือสำหรับผู้พัฒนา

## ข้อกำหนด

- Node.js 22 และ npm 11
- โปรเจกต์ Supabase สำหรับฐานข้อมูล, Auth, Storage และ Edge Functions
- ไม่ต้องใช้ Docker เพื่อพัฒนา UI หรือรันทดสอบ PGlite

## ตั้งค่าระบบ

1. ติดตั้งแพ็กเกจด้วย `npm ci`
2. คัดลอก `.env.example` เป็น `.env.local` แล้วตั้งค่า:
   - `VITE_SUPABASE_URL` — URL โปรเจกต์ Supabase
   - `VITE_SUPABASE_ANON_KEY` — anon/publishable key สำหรับเว็บ
   - `VITE_ENABLE_GOOGLE_LOGIN` — `true` เพื่อเปิดปุ่ม Google หลังตั้งค่า OAuth provider ใน Supabase
   - `SUPABASE_URL` และ `SUPABASE_SERVICE_ROLE_KEY` — ใช้เฉพาะสคริปต์ provision ผู้ใช้ ห้ามใส่คีย์ service role ในตัวแปร `VITE_*`
3. เริ่มระบบด้วย `npm run dev`

หากยังไม่มี URL หรือ anon key ระบบจะแสดงหน้า “ยังไม่ได้ตั้งค่าระบบ” แทนการสร้าง Supabase client ที่ใช้ไม่ได้

## คำสั่ง

- `npm run dev` — Vite dev server
- `npm run lint` — ESLint
- `npm run typecheck` — ตรวจ TypeScript แบบ strict
- `npm test` — ทดสอบหน่วย
- `npm run test:db` — ทดสอบ migration/RPC บน PGlite
- `npm run build` — ตรวจ TypeScript และสร้างไฟล์ production ที่ `dist/`
- Provision/E2E บน dev: `node --env-file=.env.local scripts/provision-users.mjs scripts/users.example.csv` และ `node --env-file=.env.local scripts/e2e-dev.mjs`

## ตั้งค่า Supabase

1. ติดตั้ง Supabase CLI แล้วเชื่อมโปรเจกต์: `npx supabase link --project-ref <project-ref>`
2. ใช้ migration ใน `supabase/migrations/` กับโปรเจกต์: `npx supabase db push`
3. deploy Edge Function: `npx supabase functions deploy admin-users`
4. รัน `supabase/seed.sql` หนึ่งครั้งใน SQL Editor ของ Supabase หรือผ่าน `psql` เพื่อสร้าง settings และ 40 บ้านตัวอย่าง
5. สร้างบัญชีผู้ใช้จากไฟล์ CSV ตัวอย่าง: `node scripts/provision-users.mjs scripts/users.example.csv`
   ตั้ง `SUPABASE_URL` และ `SUPABASE_SERVICE_ROLE_KEY` ใน environment ก่อนรัน ผลลัพธ์และรหัสผ่านจะถูกเขียนไว้ใน `scripts/provisioned-users.csv` ซึ่งถูก gitignore และควรเก็บอย่างปลอดภัย

Migration ของ `pg_cron` อาจต้องใช้สิทธิ์ระดับโปรเจกต์ที่เปิด extension ได้ หากโปรเจกต์ไม่อนุญาต ให้เปิดส่วนขยาย `pg_cron` ใน Supabase ก่อนนำ migration สุดท้ายไปใช้

## Cloudflare Pages

- Build command: `npm run build`
- Output directory: `dist`
- ตั้ง `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` และ `VITE_ENABLE_GOOGLE_LOGIN` ใน Build environment variables
- `public/_redirects` จัดการ SPA fallback สำหรับเส้นทางย่อย

## GitHub Actions secrets

- `SUPABASE_URL` — URL โปรเจกต์สำหรับ workflow keep-alive
- `SUPABASE_ANON_KEY` — anon/publishable key สำหรับ workflow keep-alive
- `SUPABASE_DB_URL` — connection string สำหรับ workflow สำรองฐานข้อมูล
- `BACKUP_PASSPHRASE` — passphrase สำหรับเข้ารหัสไฟล์สำรองด้วย GPG

## ขอบเขตข้อมูลและสิทธิ์

หน้าจอและข้อความของผู้ใช้เป็นภาษาไทย บทบาทมีเพียงลูกบ้าน (`resident`), กรรมการ (`committee`) และผู้ดูแลระบบ (`admin`) เท่านั้น ข้อมูลที่อยู่นอก Phase 1 จะแสดงเป็น “เร็ว ๆ นี้” จนกว่าจะพัฒนาในเฟสถัดไป
