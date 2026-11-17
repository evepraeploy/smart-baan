insert into public.settings (
  id, village_name, monthly_fee, bill_due_day, bank_name,
  bank_account_no, bank_account_name, opening_balance, hotlines
)
values (
  1, 'หมู่บ้านตัวอย่าง', 500, 5, 'ธนาคารตัวอย่าง',
  '000-0-00000-0', 'นิติบุคคลหมู่บ้านตัวอย่าง', 0,
  '[{"name":"ป้อม รปภ.","phone":"02-000-0000"},{"name":"ประธานกรรมการ","phone":"081-000-0000"}]'::jsonb
)
on conflict (id) do nothing;

insert into public.houses (house_no)
select '99/' || house_number
from generate_series(1, 40) as houses(house_number)
on conflict (house_no) do nothing;
