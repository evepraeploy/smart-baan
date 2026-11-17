create type public.app_role as enum ('resident', 'committee', 'admin');
create type public.bill_status as enum ('unpaid', 'pending_review', 'paid', 'waived');
create type public.slip_status as enum ('pending', 'approved', 'rejected');
create type public.ledger_type as enum ('income', 'expense');

create table public.houses (
  id uuid primary key default gen_random_uuid(),
  house_no text unique not null,
  soi text,
  owner_name text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  phone text unique,
  login_identifier text unique not null,
  must_change_password boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.user_roles (
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.app_role not null,
  primary key (user_id, role)
);

create table public.house_members (
  house_id uuid not null references public.houses(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade unique,
  primary key (house_id, user_id)
);

create table public.settings (
  id integer primary key default 1 check (id = 1),
  village_name text not null default 'หมู่บ้านตัวอย่าง',
  monthly_fee numeric(10,2) not null default 500,
  bill_due_day integer not null default 5 check (bill_due_day between 1 and 28),
  bank_name text,
  bank_account_no text,
  bank_account_name text,
  opening_balance numeric(12,2) not null default 0,
  opening_balance_date date,
  hotlines jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table public.bills (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses(id),
  period date not null,
  amount numeric(10,2) not null,
  due_date date not null,
  status public.bill_status not null default 'unpaid',
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  unique (house_id, period)
);

create table public.slips (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses(id),
  uploaded_by uuid not null references public.profiles(id),
  amount numeric(10,2) not null check (amount > 0),
  transferred_at timestamptz not null,
  file_path text not null,
  file_size integer,
  status public.slip_status not null default 'pending',
  reject_reason text,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.slip_bills (
  slip_id uuid not null references public.slips(id) on delete cascade,
  bill_id uuid not null references public.bills(id),
  primary key (slip_id, bill_id)
);

create table public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  entry_type public.ledger_type not null,
  category text not null,
  amount numeric(12,2) not null check (amount > 0),
  entry_date date not null,
  description text,
  house_id uuid references public.houses(id),
  slip_id uuid unique references public.slips(id),
  attachment_path text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id),
  action text not null,
  entity text not null,
  entity_id uuid,
  details jsonb,
  created_at timestamptz not null default now()
);

create index bills_house_period_idx on public.bills (house_id, period desc);
create index slips_status_created_idx on public.slips (status, created_at desc);
create index slips_house_created_idx on public.slips (house_id, created_at desc);
create index ledger_entry_date_idx on public.ledger_entries (entry_date desc);

create function public.has_role(p_role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select p.is_active and exists (
      select 1 from public.user_roles ur where ur.user_id = p.id and ur.role = p_role
    )
    from public.profiles p
    where p.id = auth.uid()
  ), false);
$$;

create function public.is_committee()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role('committee') or public.has_role('admin');
$$;

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role('admin');
$$;

create function public.my_house_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select hm.house_id
  from public.house_members hm
  join public.profiles p on p.id = hm.user_id
  where hm.user_id = auth.uid()
    and p.is_active
  limit 1;
$$;

create function public.generate_monthly_bills(
  p_period date default date_trunc('month', now() at time zone 'Asia/Bangkok')::date
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period date := date_trunc('month', p_period)::date;
  v_fee numeric(10,2);
  v_due_day integer;
  v_inserted integer;
begin
  if auth.uid() is not null and not public.is_committee() then
    raise exception 'FORBIDDEN';
  end if;

  select monthly_fee, bill_due_day
  into v_fee, v_due_day
  from public.settings
  where id = 1;

  if not found then
    raise exception 'SETTINGS_NOT_FOUND';
  end if;

  insert into public.bills (house_id, period, amount, due_date)
  select h.id,
         v_period,
         v_fee,
         (v_period + interval '1 month')::date + (v_due_day - 1)
  from public.houses h
  where h.is_active
  on conflict (house_id, period) do nothing;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

create function public.submit_slip(
  p_bill_ids uuid[],
  p_amount numeric,
  p_transferred_at timestamptz,
  p_file_path text,
  p_file_size integer
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_house_id uuid := public.my_house_id();
  v_slip_id uuid;
  v_bill_count integer;
begin
  if v_user_id is null then
    raise exception 'FORBIDDEN';
  end if;
  if v_house_id is null then
    raise exception 'NO_HOUSE';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'INVALID_AMOUNT';
  end if;
  if p_transferred_at is null or p_bill_ids is null or cardinality(p_bill_ids) = 0 then
    raise exception 'INVALID_BILL_SELECTION';
  end if;
  if p_file_path is null or left(p_file_path, length(v_house_id::text) + 1) <> v_house_id::text || '/' then
    raise exception 'INVALID_FILE_PATH';
  end if;

  perform 1
  from public.bills b
  where b.id = any(p_bill_ids)
    and b.house_id = v_house_id
    and b.status = 'unpaid'
  for update;

  select count(*) into v_bill_count
  from public.bills b
  where b.id = any(p_bill_ids)
    and b.house_id = v_house_id
    and b.status = 'unpaid';

  if v_bill_count <> cardinality(p_bill_ids) then
    raise exception 'BILL_NOT_PAYABLE';
  end if;

  insert into public.slips (house_id, uploaded_by, amount, transferred_at, file_path, file_size)
  values (v_house_id, v_user_id, p_amount, p_transferred_at, p_file_path, p_file_size)
  returning id into v_slip_id;

  insert into public.slip_bills (slip_id, bill_id)
  select v_slip_id, b.id
  from public.bills b
  where b.id = any(p_bill_ids);

  update public.bills
  set status = 'pending_review'
  where id = any(p_bill_ids);

  insert into public.audit_logs (actor_id, action, entity, entity_id, details)
  values (v_user_id, 'submit_slip', 'slip', v_slip_id, jsonb_build_object('amount', p_amount, 'bill_ids', p_bill_ids));

  return v_slip_id;
end;
$$;

create function public.approve_slip(p_slip_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slip public.slips%rowtype;
begin
  if not public.is_committee() then
    raise exception 'FORBIDDEN';
  end if;

  select * into v_slip
  from public.slips
  where id = p_slip_id
  for update;

  if not found or v_slip.status <> 'pending' then
    raise exception 'SLIP_NOT_PENDING';
  end if;

  update public.slips
  set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_slip_id;

  update public.bills b
  set status = 'paid', paid_at = now()
  from public.slip_bills sb
  where sb.slip_id = p_slip_id and sb.bill_id = b.id;

  insert into public.ledger_entries (entry_type, category, amount, entry_date, description, house_id, slip_id, created_by)
  values (
    'income',
    'ค่าส่วนกลาง',
    v_slip.amount,
    (v_slip.transferred_at at time zone 'Asia/Bangkok')::date,
    'รับชำระค่าส่วนกลาง',
    v_slip.house_id,
    v_slip.id,
    auth.uid()
  );

  insert into public.audit_logs (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'approve_slip', 'slip', p_slip_id, jsonb_build_object('house_id', v_slip.house_id, 'amount', v_slip.amount));
end;
$$;

create function public.reject_slip(p_slip_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slip public.slips%rowtype;
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  if not public.is_committee() then
    raise exception 'FORBIDDEN';
  end if;
  if length(v_reason) < 3 then
    raise exception 'REASON_REQUIRED';
  end if;

  select * into v_slip
  from public.slips
  where id = p_slip_id
  for update;

  if not found or v_slip.status <> 'pending' then
    raise exception 'SLIP_NOT_PENDING';
  end if;

  update public.slips
  set status = 'rejected', reject_reason = v_reason, reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_slip_id;

  update public.bills b
  set status = 'unpaid', paid_at = null
  from public.slip_bills sb
  where sb.slip_id = p_slip_id and sb.bill_id = b.id;

  insert into public.audit_logs (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'reject_slip', 'slip', p_slip_id, jsonb_build_object('reason', v_reason));
end;
$$;

create function public.list_pending_slips()
returns table (
  id uuid,
  house_id uuid,
  uploaded_by uuid,
  amount numeric,
  transferred_at timestamptz,
  file_path text,
  file_size integer,
  status public.slip_status,
  reject_reason text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz,
  house_no text,
  periods date[],
  duplicate_count integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_committee() then
    raise exception 'FORBIDDEN';
  end if;

  return query
  select s.id,
         s.house_id,
         s.uploaded_by,
         s.amount,
         s.transferred_at,
         s.file_path,
         s.file_size,
         s.status,
         s.reject_reason,
         s.reviewed_by,
         s.reviewed_at,
         s.created_at,
         h.house_no,
         coalesce(array_agg(distinct b.period order by b.period) filter (where b.period is not null), '{}'::date[]),
         (
           select count(*)::integer
           from public.slips other
           where other.id <> s.id
             and other.status <> 'rejected'
             and other.amount = s.amount
             and abs(extract(epoch from (other.transferred_at - s.transferred_at))) <= 120
         )
  from public.slips s
  join public.houses h on h.id = s.house_id
  left join public.slip_bills sb on sb.slip_id = s.id
  left join public.bills b on b.id = sb.bill_id
  where s.status = 'pending'
  group by s.id, h.house_no
  order by s.created_at;
end;
$$;

create function public.mark_password_changed()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'FORBIDDEN';
  end if;
  update public.profiles set must_change_password = false where id = auth.uid();
end;
$$;

create function public.resolve_login_email(p_phone text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select u.email
  from auth.users u
  join public.profiles p on p.id = u.id
  where regexp_replace(coalesce(p.phone, ''), '[^0-9]', '', 'g') =
        regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g')
    and p.is_active
  limit 1;
$$;

revoke all on function public.has_role(public.app_role) from public, anon;
revoke all on function public.is_committee() from public, anon;
revoke all on function public.is_admin() from public, anon;
revoke all on function public.my_house_id() from public, anon;
revoke all on function public.generate_monthly_bills(date) from public, anon;
revoke all on function public.submit_slip(uuid[], numeric, timestamptz, text, integer) from public, anon;
revoke all on function public.approve_slip(uuid) from public, anon;
revoke all on function public.reject_slip(uuid, text) from public, anon;
revoke all on function public.list_pending_slips() from public, anon;
revoke all on function public.mark_password_changed() from public, anon;
revoke all on function public.resolve_login_email(text) from public;

grant execute on function public.has_role(public.app_role) to authenticated;
grant execute on function public.is_committee() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.my_house_id() to authenticated;
grant execute on function public.generate_monthly_bills(date) to authenticated;
grant execute on function public.submit_slip(uuid[], numeric, timestamptz, text, integer) to authenticated;
grant execute on function public.approve_slip(uuid) to authenticated;
grant execute on function public.reject_slip(uuid, text) to authenticated;
grant execute on function public.list_pending_slips() to authenticated;
grant execute on function public.mark_password_changed() to authenticated;
grant execute on function public.resolve_login_email(text) to authenticated, anon;

alter table public.houses enable row level security;
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.house_members enable row level security;
alter table public.settings enable row level security;
alter table public.bills enable row level security;
alter table public.slips enable row level security;
alter table public.slip_bills enable row level security;
alter table public.ledger_entries enable row level security;
alter table public.audit_logs enable row level security;

create policy houses_select on public.houses for select to authenticated
using (id = public.my_house_id() or public.is_committee());
create policy profiles_select on public.profiles for select to authenticated
using (id = auth.uid() or public.is_committee());
create policy user_roles_select on public.user_roles for select to authenticated
using (user_id = auth.uid() or public.is_admin());
create policy house_members_select on public.house_members for select to authenticated
using (user_id = auth.uid() or public.is_committee());
create policy settings_select on public.settings for select to authenticated
using (auth.uid() is not null);
create policy settings_update_admin on public.settings for update to authenticated
using (public.is_admin()) with check (public.is_admin());
create policy bills_select on public.bills for select to authenticated
using (house_id = public.my_house_id() or public.is_committee());
create policy slips_select on public.slips for select to authenticated
using (house_id = public.my_house_id() or public.is_committee());
create policy slip_bills_select on public.slip_bills for select to authenticated
using (
  exists (
    select 1 from public.bills b
    where b.id = bill_id and (b.house_id = public.my_house_id() or public.is_committee())
  )
);
create policy ledger_entries_select on public.ledger_entries for select to authenticated
using (public.is_committee());
create policy audit_logs_select on public.audit_logs for select to authenticated
using (public.is_committee());

grant usage on schema public to authenticated, anon;
grant select on public.houses, public.profiles, public.user_roles, public.house_members,
  public.settings, public.bills, public.slips, public.slip_bills, public.ledger_entries, public.audit_logs
to authenticated;
grant update on public.settings to authenticated;
