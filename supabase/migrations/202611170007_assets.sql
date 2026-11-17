create type public.asset_status as enum ('active', 'repair', 'retired');
create type public.maintenance_kind as enum ('pm', 'repair');

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 200),
  category text,
  location text,
  installed_on date,
  image_path text,
  status public.asset_status not null default 'active',
  pm_interval_days integer check (pm_interval_days is null or pm_interval_days between 1 and 3650),
  last_maintained_on date,
  next_due_date date,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.maintenance_logs (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  performed_on date not null,
  kind public.maintenance_kind not null,
  description text not null check (length(description) between 1 and 2000),
  contractor_id uuid references public.contractors(id),
  cost numeric(12,2) check (cost is null or cost >= 0),
  ledger_entry_id uuid unique references public.ledger_entries(id) on delete set null,
  ticket_id uuid references public.tickets(id) on delete set null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.tickets
  add column asset_id uuid references public.assets(id) on delete set null;

create index maintenance_logs_asset_performed_idx
  on public.maintenance_logs (asset_id, performed_on desc);
create index maintenance_logs_ticket_idx on public.maintenance_logs (ticket_id);

create function public.set_asset_schedule()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  if new.pm_interval_days is null then
    new.next_due_date := null;
  elsif new.next_due_date is null
    or (tg_op = 'UPDATE' and new.pm_interval_days is distinct from old.pm_interval_days) then
    new.next_due_date := coalesce(
      new.last_maintained_on,
      new.installed_on,
      (now() at time zone 'Asia/Bangkok')::date
    ) + new.pm_interval_days;
  end if;
  return new;
end;
$$;

create trigger assets_set_schedule
before insert or update on public.assets
for each row execute function public.set_asset_schedule();

alter table public.assets enable row level security;
alter table public.maintenance_logs enable row level security;

create policy assets_committee_select on public.assets for select to authenticated
using (public.is_committee());
create policy assets_committee_insert on public.assets for insert to authenticated
with check (public.is_committee());
create policy assets_committee_update on public.assets for update to authenticated
using (public.is_committee()) with check (public.is_committee());
create policy maintenance_logs_committee_select on public.maintenance_logs for select to authenticated
using (public.is_committee());

revoke all on table public.assets, public.maintenance_logs from public, anon, authenticated;
grant select, insert, update on public.assets to authenticated;
grant select on public.maintenance_logs to authenticated;

create function public.link_ticket_asset(p_ticket_id uuid, p_asset_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before uuid;
begin
  if not public.is_committee() then
    raise exception 'FORBIDDEN';
  end if;
  select asset_id into v_before
  from public.tickets
  where id = p_ticket_id
  for update;
  if not found then
    raise exception 'TICKET_NOT_FOUND';
  end if;
  if p_asset_id is not null and not exists (
    select 1 from public.assets where id = p_asset_id
  ) then
    raise exception 'ASSET_NOT_FOUND';
  end if;

  update public.tickets set asset_id = p_asset_id, updated_at = now()
  where id = p_ticket_id;
  insert into public.audit_logs (actor_id, action, entity, entity_id, details)
  values (
    auth.uid(),
    'link_ticket_asset',
    'ticket',
    p_ticket_id,
    jsonb_build_object('before_asset_id', v_before, 'after_asset_id', p_asset_id)
  );
end;
$$;

create function public.record_maintenance(
  p_asset_id uuid,
  p_performed_on date,
  p_kind public.maintenance_kind,
  p_description text,
  p_contractor_id uuid default null,
  p_cost numeric default null,
  p_record_expense boolean default false,
  p_ticket_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_asset public.assets%rowtype;
  v_description text := btrim(coalesce(p_description, ''));
  v_today date := (now() at time zone 'Asia/Bangkok')::date;
  v_last_maintained_on date;
  v_log_id uuid;
  v_ledger_id uuid;
begin
  if not public.is_committee() then
    raise exception 'FORBIDDEN';
  end if;
  select * into v_asset
  from public.assets
  where id = p_asset_id
  for update;
  if not found then
    raise exception 'ASSET_NOT_FOUND';
  end if;
  if v_asset.status = 'retired' then
    raise exception 'ASSET_RETIRED';
  end if;
  if p_performed_on is null or p_performed_on > v_today then
    raise exception 'INVALID_DATE';
  end if;
  if p_kind is null then
    raise exception 'INVALID_MAINTENANCE_KIND';
  end if;
  if length(v_description) = 0 or length(v_description) > 2000 then
    raise exception 'DESCRIPTION_REQUIRED';
  end if;
  if p_contractor_id is not null and not exists (
    select 1 from public.contractors where id = p_contractor_id and is_active
  ) then
    raise exception 'CONTRACTOR_NOT_FOUND';
  end if;
  if p_cost is not null and p_cost < 0 then
    raise exception 'INVALID_AMOUNT';
  end if;
  if p_record_expense and (p_cost is null or p_cost <= 0) then
    raise exception 'FEE_REQUIRED';
  end if;

  if p_record_expense then
    insert into public.ledger_entries (
      entry_type, category, amount, entry_date, description, created_by
    )
    values (
      'expense',
      'ค่าซ่อมบำรุง',
      p_cost,
      p_performed_on,
      'บำรุงรักษา: ' || v_asset.name,
      auth.uid()
    )
    returning id into v_ledger_id;
  end if;

  insert into public.maintenance_logs (
    asset_id, performed_on, kind, description, contractor_id, cost,
    ledger_entry_id, ticket_id, created_by
  )
  values (
    p_asset_id, p_performed_on, p_kind, v_description, p_contractor_id, p_cost,
    v_ledger_id, p_ticket_id, auth.uid()
  )
  returning id into v_log_id;

  if p_kind = 'pm' then
    v_last_maintained_on := greatest(coalesce(v_asset.last_maintained_on, p_performed_on), p_performed_on);
    update public.assets
    set last_maintained_on = v_last_maintained_on,
        next_due_date = case
          when pm_interval_days is null then null
          else v_last_maintained_on + pm_interval_days
        end
    where id = p_asset_id;
  end if;

  insert into public.audit_logs (actor_id, action, entity, entity_id, details)
  values (
    auth.uid(),
    'record_maintenance',
    'maintenance_log',
    v_log_id,
    jsonb_build_object('asset_id', p_asset_id, 'kind', p_kind, 'performed_on', p_performed_on, 'ticket_id', p_ticket_id)
  );
  if v_ledger_id is not null then
    insert into public.audit_logs (actor_id, action, entity, entity_id, details)
    values (
      auth.uid(),
      'create_ledger_entry',
      'ledger_entry',
      v_ledger_id,
      jsonb_build_object('entry_type', 'expense', 'category', 'ค่าซ่อมบำรุง', 'amount', p_cost, 'maintenance_log_id', v_log_id)
    );
  end if;
  return v_log_id;
end;
$$;

create function public.get_committee_dashboard()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Asia/Bangkok')::date;
  v_month_start date := date_trunc('month', now() at time zone 'Asia/Bangkok')::date;
  v_opening_balance numeric := 0;
  v_total_income numeric := 0;
  v_total_expense numeric := 0;
  v_month_income numeric := 0;
  v_month_expense numeric := 0;
  v_pm_overdue jsonb;
  v_pm_due_soon jsonb;
  v_paid integer := 0;
  v_pending_review integer := 0;
  v_unpaid integer := 0;
  v_pending_tickets integer := 0;
  v_in_progress_tickets integer := 0;
begin
  if not public.is_committee() then
    raise exception 'FORBIDDEN';
  end if;

  select coalesce(opening_balance, 0) into v_opening_balance
  from public.settings where id = 1;
  v_opening_balance := coalesce(v_opening_balance, 0);

  select
    coalesce(sum(amount) filter (where entry_type = 'income'), 0),
    coalesce(sum(amount) filter (where entry_type = 'expense'), 0),
    coalesce(sum(amount) filter (
      where entry_type = 'income' and entry_date >= v_month_start and entry_date < v_month_start + interval '1 month'
    ), 0),
    coalesce(sum(amount) filter (
      where entry_type = 'expense' and entry_date >= v_month_start and entry_date < v_month_start + interval '1 month'
    ), 0)
  into v_total_income, v_total_expense, v_month_income, v_month_expense
  from public.ledger_entries;

  select count(*) filter (where status = 'pending')::integer
  into v_pending_tickets
  from public.tickets;
  select count(*) filter (where status = 'in_progress')::integer
  into v_in_progress_tickets
  from public.tickets;

  select
    count(*) filter (where status = 'paid')::integer,
    count(*) filter (where status = 'pending_review')::integer,
    count(*) filter (where status = 'unpaid')::integer
  into v_paid, v_pending_review, v_unpaid
  from public.bills
  where period >= v_month_start and period < v_month_start + interval '1 month';

  select coalesce(
    jsonb_agg(jsonb_build_object('id', id, 'name', name, 'next_due_date', next_due_date) order by next_due_date),
    '[]'::jsonb
  ) into v_pm_overdue
  from public.assets
  where status <> 'retired' and next_due_date < v_today;
  select coalesce(
    jsonb_agg(jsonb_build_object('id', id, 'name', name, 'next_due_date', next_due_date) order by next_due_date),
    '[]'::jsonb
  ) into v_pm_due_soon
  from public.assets
  where status <> 'retired' and next_due_date between v_today and v_today + 14;

  return jsonb_build_object(
    'balance', v_opening_balance + v_total_income - v_total_expense,
    'month_income', v_month_income,
    'month_expense', v_month_expense,
    'pending_slips', (select count(*)::integer from public.slips where status = 'pending'),
    'open_tickets', v_pending_tickets + v_in_progress_tickets,
    'tickets_by_status', jsonb_build_object('pending', v_pending_tickets, 'in_progress', v_in_progress_tickets),
    'pm_overdue', v_pm_overdue,
    'pm_due_soon', v_pm_due_soon,
    'bills_this_month', jsonb_build_object('paid', v_paid, 'pending_review', v_pending_review, 'unpaid', v_unpaid)
  );
end;
$$;

revoke all on function public.link_ticket_asset(uuid, uuid) from public, anon;
revoke all on function public.record_maintenance(uuid, date, public.maintenance_kind, text, uuid, numeric, boolean, uuid) from public, anon;
revoke all on function public.get_committee_dashboard() from public, anon;
grant execute on function public.link_ticket_asset(uuid, uuid) to authenticated;
grant execute on function public.record_maintenance(uuid, date, public.maintenance_kind, text, uuid, numeric, boolean, uuid) to authenticated;
grant execute on function public.get_committee_dashboard() to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('assets', 'assets', false, 1048576, array['image/webp', 'image/jpeg'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy assets_storage_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'assets'
  and public.is_committee()
  and (storage.foldername(name))[1] = 'assets'
);
create policy assets_storage_select on storage.objects for select to authenticated
using (
  bucket_id = 'assets'
  and public.is_committee()
  and (storage.foldername(name))[1] = 'assets'
);
