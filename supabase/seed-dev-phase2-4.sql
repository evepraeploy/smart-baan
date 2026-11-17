insert into public.contractors (name, phone, trade)
select seed.name, seed.phone, seed.trade
from (values
  ('ร้านช่างไฟสมชาย', '0810000101', 'ไฟฟ้า'),
  ('ช่างประปาวิชัย', '0810000102', 'ประปา/ปั๊มน้ำ'),
  ('บริษัท ABC Security', '0810000103', 'กล้องวงจรปิด/ไม้กั้น')
) as seed(name, phone, trade)
where not exists (
  select 1 from public.contractors c where c.name = seed.name
);

insert into public.assets (name, category, location, installed_on, pm_interval_days)
select seed.name, seed.category, seed.location, seed.installed_on, seed.pm_interval_days
from (values
  ('ปั๊มน้ำ #1', 'ปั๊มน้ำ', 'ห้องปั๊มน้ำ', current_date - 180, 90),
  ('ไฟทาง 20 ต้น', 'ไฟส่องสว่าง', 'ถนนภายในหมู่บ้าน', current_date - 170, 180),
  ('ไม้กั้นทางเข้า', 'ไม้กั้น', 'ทางเข้าหมู่บ้าน', current_date - 50, 30),
  ('กล้องวงจรปิด 8 ตัว', 'กล้องวงจรปิด', 'ประตูทางเข้าและพื้นที่ส่วนกลาง', current_date - 100, 90)
) as seed(name, category, location, installed_on, pm_interval_days)
where not exists (
  select 1 from public.assets a where a.name = seed.name
);

insert into public.announcements (title, body, is_pinned, created_by)
select
  seed.title,
  seed.body,
  seed.is_pinned,
  (
    select p.id
    from public.profiles p
    join public.user_roles r on r.user_id = p.id
    where r.role = 'admin'
    order by p.created_at
    limit 1
  )
from (values
  ('ยินดีต้อนรับสู่ระบบหมู่บ้าน', 'ติดตามประกาศและแจ้งเรื่องที่ต้องการให้ช่วยดูแลได้ที่นี่', true),
  ('แจ้งซ่อมพื้นที่ส่วนกลาง', 'หากพบอุปกรณ์ชำรุด กรุณาแจ้งรายละเอียดและแนบรูปประกอบ', false)
) as seed(title, body, is_pinned)
where exists (
  select 1 from public.profiles p
  join public.user_roles r on r.user_id = p.id
  where r.role = 'admin'
)
and not exists (
  select 1 from public.announcements a where a.title = seed.title
);
