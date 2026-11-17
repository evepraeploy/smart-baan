create type public.ticket_status as enum ('pending', 'in_progress', 'done', 'rejected');
create type public.ticket_category as enum ('electric', 'plumbing', 'road', 'cleaning', 'security', 'other');

create table public.contractors (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 200),
  phone text,
  trade text,
  note text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  house_id uuid references public.houses(id),
  reporter_id uuid not null references public.profiles(id),
  category public.ticket_category not null,
  title text not null check (length(title) between 1 and 200),
  description text not null check (length(description) <= 5000),
  status public.ticket_status not null default 'pending',
  assignee_id uuid references public.profiles(id),
  contractor_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz
);

create table public.ticket_jobs (
  ticket_id uuid primary key references public.tickets(id) on delete cascade,
  contractor_id uuid references public.contractors(id),
  appointment_at timestamptz,
  fee numeric(12,2) check (fee is null or fee >= 0),
  ledger_entry_id uuid unique references public.ledger_entries(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.ticket_photos (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  path text not null unique,
  kind text not null check (kind in ('report', 'after')),
  uploaded_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.ticket_events (
  id bigint generated always as identity primary key,
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  actor_id uuid references public.profiles(id),
  event_type text not null check (event_type in ('created', 'status', 'assigned', 'comment', 'photo', 'expense')),
  from_status public.ticket_status,
  to_status public.ticket_status,
  comment text,
  created_at timestamptz not null default now()
);

create index tickets_status_created_idx on public.tickets (status, created_at desc);
create index tickets_house_created_idx on public.tickets (house_id, created_at desc);
create index ticket_photos_ticket_created_idx on public.ticket_photos (ticket_id, created_at);
create index ticket_events_ticket_created_idx on public.ticket_events (ticket_id, created_at);

alter table public.contractors enable row level security;
alter table public.tickets enable row level security;
alter table public.ticket_jobs enable row level security;
alter table public.ticket_photos enable row level security;
alter table public.ticket_events enable row level security;

create policy contractors_committee_select on public.contractors for select to authenticated
using (public.is_committee());
create policy contractors_committee_insert on public.contractors for insert to authenticated
with check (public.is_committee());
create policy contractors_committee_update on public.contractors for update to authenticated
using (public.is_committee()) with check (public.is_committee());

create policy tickets_select on public.tickets for select to authenticated
using (
  public.is_committee()
  or reporter_id = auth.uid()
  or (house_id is not null and house_id = public.my_house_id())
);
create policy ticket_jobs_committee_select on public.ticket_jobs for select to authenticated
using (public.is_committee());
create policy ticket_photos_select on public.ticket_photos for select to authenticated
using (
  exists (
    select 1 from public.tickets t
    where t.id = ticket_photos.ticket_id
      and (
        public.is_committee()
        or t.reporter_id = auth.uid()
        or (t.house_id is not null and t.house_id = public.my_house_id())
      )
  )
);
create policy ticket_events_select on public.ticket_events for select to authenticated
using (
  exists (
    select 1 from public.tickets t
    where t.id = ticket_events.ticket_id
      and (
        public.is_committee()
        or t.reporter_id = auth.uid()
        or (t.house_id is not null and t.house_id = public.my_house_id())
      )
  )
);

revoke all on table public.contractors, public.tickets, public.ticket_jobs, public.ticket_photos, public.ticket_events
from public, anon, authenticated;
grant select, insert, update on public.contractors to authenticated;
grant select on public.tickets, public.ticket_jobs, public.ticket_photos, public.ticket_events to authenticated;

create function public.create_ticket(
  p_category public.ticket_category,
  p_title text,
  p_description text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_house_id uuid := public.my_house_id();
  v_ticket_id uuid;
  v_title text := btrim(coalesce(p_title, ''));
  v_description text := btrim(coalesce(p_description, ''));
begin
  if v_user_id is null or not exists (
    select 1 from public.profiles p where p.id = v_user_id and p.is_active
  ) then
    raise exception 'FORBIDDEN';
  end if;
  if p_category is null then
    raise exception 'INVALID_CATEGORY';
  end if;
  if length(v_title) = 0 or length(v_title) > 200 then
    raise exception 'TITLE_REQUIRED';
  end if;
  if length(v_description) = 0 or length(v_description) > 5000 then
    raise exception 'DESCRIPTION_REQUIRED';
  end if;

  insert into public.tickets (house_id, reporter_id, category, title, description)
  values (v_house_id, v_user_id, p_category, v_title, v_description)
  returning id into v_ticket_id;

  insert into public.ticket_events (ticket_id, actor_id, event_type, to_status, comment)
  values (v_ticket_id, v_user_id, 'created', 'pending', 'แจ้งเรื่องแล้ว');
  insert into public.audit_logs (actor_id, action, entity, entity_id, details)
  values (v_user_id, 'create_ticket', 'ticket', v_ticket_id, jsonb_build_object('category', p_category, 'title', v_title));

  return v_ticket_id;
end;
$$;

create function public.add_ticket_photos(
  p_ticket_id uuid,
  p_kind text,
  p_paths text[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ticket public.tickets%rowtype;
  v_path text;
  v_report_count integer;
begin
  select * into v_ticket
  from public.tickets
  where id = p_ticket_id
  for update;
  if not found then
    raise exception 'TICKET_NOT_FOUND';
  end if;
  if p_kind is null or p_kind not in ('report', 'after') then
    raise exception 'INVALID_PHOTO_KIND';
  end if;
  if p_paths is null or cardinality(p_paths) = 0 then
    raise exception 'INVALID_FILE_PATH';
  end if;

  if p_kind = 'report' then
    if v_ticket.reporter_id <> auth.uid() or v_ticket.status <> 'pending' then
      raise exception 'FORBIDDEN';
    end if;
  elsif not public.is_committee() then
    raise exception 'FORBIDDEN';
  end if;

  foreach v_path in array p_paths loop
    if v_path is null or left(v_path, length(p_ticket_id::text) + 1) <> p_ticket_id::text || '/' then
      raise exception 'INVALID_FILE_PATH';
    end if;
  end loop;
  if p_kind = 'report' then
    select count(*) into v_report_count
    from public.ticket_photos
    where ticket_id = p_ticket_id and kind = 'report';
    if v_report_count + cardinality(p_paths) > 3 then
      raise exception 'TOO_MANY_PHOTOS';
    end if;
  end if;

  insert into public.ticket_photos (ticket_id, path, kind, uploaded_by)
  select p_ticket_id, paths.path, p_kind, auth.uid()
  from unnest(p_paths) as paths(path);

  insert into public.ticket_events (ticket_id, actor_id, event_type, comment)
  values (p_ticket_id, auth.uid(), 'photo', case when p_kind = 'report' then 'แนบรูปประกอบเรื่อง' else 'แนบรูปหลังซ่อม' end);
  insert into public.audit_logs (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'add_ticket_photos', 'ticket', p_ticket_id, jsonb_build_object('kind', p_kind, 'count', cardinality(p_paths)));
end;
$$;

create function public.update_ticket_status(
  p_ticket_id uuid,
  p_status public.ticket_status,
  p_comment text default null,
  p_record_expense boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ticket public.tickets%rowtype;
  v_job public.ticket_jobs%rowtype;
  v_comment text := nullif(btrim(coalesce(p_comment, '')), '');
  v_ledger_id uuid;
begin
  if not public.is_committee() then
    raise exception 'FORBIDDEN';
  end if;

  select * into v_ticket from public.tickets where id = p_ticket_id for update;
  if not found then
    raise exception 'TICKET_NOT_FOUND';
  end if;
  if p_status is null or not (
    (v_ticket.status = 'pending' and p_status in ('in_progress', 'rejected'))
    or (v_ticket.status = 'in_progress' and p_status in ('done', 'rejected'))
  ) then
    raise exception 'INVALID_TRANSITION';
  end if;
  if p_status = 'rejected' and length(coalesce(v_comment, '')) < 3 then
    raise exception 'REASON_REQUIRED';
  end if;

  if p_status = 'done' and p_record_expense then
    select * into v_job from public.ticket_jobs where ticket_id = p_ticket_id for update;
    if not found or v_job.fee is null or v_job.fee <= 0 then
      raise exception 'FEE_REQUIRED';
    end if;
    if v_job.ledger_entry_id is not null then
      raise exception 'EXPENSE_ALREADY_RECORDED';
    end if;

    insert into public.ledger_entries (entry_type, category, amount, entry_date, description, house_id, created_by)
    values (
      'expense',
      'ค่าซ่อมบำรุง',
      v_job.fee,
      (now() at time zone 'Asia/Bangkok')::date,
      'งานซ่อม: ' || v_ticket.title,
      v_ticket.house_id,
      auth.uid()
    )
    returning id into v_ledger_id;
    update public.ticket_jobs set ledger_entry_id = v_ledger_id, updated_at = now()
    where ticket_id = p_ticket_id;

    insert into public.ticket_events (ticket_id, actor_id, event_type, comment)
    values (p_ticket_id, auth.uid(), 'expense', 'บันทึกค่าใช้จ่ายแล้ว');
  end if;

  update public.tickets
  set status = p_status,
      updated_at = now(),
      closed_at = case when p_status in ('done', 'rejected') then now() else null end
  where id = p_ticket_id;

  insert into public.ticket_events (ticket_id, actor_id, event_type, from_status, to_status, comment)
  values (p_ticket_id, auth.uid(), 'status', v_ticket.status, p_status, v_comment);
  insert into public.audit_logs (actor_id, action, entity, entity_id, details)
  values (
    auth.uid(),
    'update_ticket_status',
    'ticket',
    p_ticket_id,
    jsonb_build_object('from_status', v_ticket.status, 'to_status', p_status, 'record_expense', p_record_expense)
  );
  if v_ledger_id is not null then
    insert into public.audit_logs (actor_id, action, entity, entity_id, details)
    values (auth.uid(), 'create_ledger_entry', 'ledger_entry', v_ledger_id,
      jsonb_build_object('entry_type', 'expense', 'category', 'ค่าซ่อมบำรุง', 'amount', v_job.fee, 'ticket_id', p_ticket_id));
  end if;
end;
$$;

create function public.assign_ticket(
  p_ticket_id uuid,
  p_assignee_id uuid,
  p_contractor_id uuid,
  p_appointment_at timestamptz,
  p_fee numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ticket public.tickets%rowtype;
  v_job public.ticket_jobs%rowtype;
  v_contractor public.contractors%rowtype;
  v_contractor_name text;
begin
  if not public.is_committee() then
    raise exception 'FORBIDDEN';
  end if;

  select * into v_ticket from public.tickets where id = p_ticket_id for update;
  if not found then
    raise exception 'TICKET_NOT_FOUND';
  end if;
  if v_ticket.status in ('done', 'rejected') then
    raise exception 'TICKET_CLOSED';
  end if;
  if p_assignee_id is not null and not exists (
    select 1
    from public.profiles p
    join public.user_roles ur on ur.user_id = p.id
    where p.id = p_assignee_id
      and p.is_active
      and ur.role in ('committee', 'admin')
  ) then
    raise exception 'INVALID_ASSIGNEE';
  end if;
  if p_contractor_id is not null then
    select * into v_contractor from public.contractors
    where id = p_contractor_id and is_active;
    if not found then
      raise exception 'CONTRACTOR_NOT_FOUND';
    end if;
    v_contractor_name := v_contractor.name;
  end if;
  if p_fee is not null and p_fee < 0 then
    raise exception 'INVALID_AMOUNT';
  end if;

  select * into v_job from public.ticket_jobs where ticket_id = p_ticket_id for update;
  if found and v_job.ledger_entry_id is not null and p_fee is distinct from v_job.fee then
    raise exception 'EXPENSE_ALREADY_RECORDED';
  end if;

  insert into public.ticket_jobs (ticket_id, contractor_id, appointment_at, fee, updated_at)
  values (p_ticket_id, p_contractor_id, p_appointment_at, p_fee, now())
  on conflict (ticket_id) do update
    set contractor_id = excluded.contractor_id,
        appointment_at = excluded.appointment_at,
        fee = excluded.fee,
        updated_at = now();
  update public.tickets
  set assignee_id = p_assignee_id,
      contractor_name = v_contractor_name,
      updated_at = now()
  where id = p_ticket_id;

  insert into public.ticket_events (ticket_id, actor_id, event_type, comment)
  values (p_ticket_id, auth.uid(), 'assigned', 'มอบหมายงานแล้ว');
  insert into public.audit_logs (actor_id, action, entity, entity_id, details)
  values (
    auth.uid(),
    'assign_ticket',
    'ticket',
    p_ticket_id,
    jsonb_build_object('assignee_id', p_assignee_id, 'contractor_id', p_contractor_id, 'appointment_at', p_appointment_at)
  );
end;
$$;

create function public.add_ticket_comment(p_ticket_id uuid, p_comment text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_comment text := btrim(coalesce(p_comment, ''));
begin
  if auth.uid() is null or not exists (
    select 1 from public.tickets t
    where t.id = p_ticket_id
      and (
        public.is_committee()
        or t.reporter_id = auth.uid()
        or (t.house_id is not null and t.house_id = public.my_house_id())
      )
  ) then
    raise exception 'FORBIDDEN';
  end if;
  if length(v_comment) = 0 or length(v_comment) > 1000 then
    raise exception 'COMMENT_REQUIRED';
  end if;

  insert into public.ticket_events (ticket_id, actor_id, event_type, comment)
  values (p_ticket_id, auth.uid(), 'comment', v_comment);
  insert into public.audit_logs (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'add_ticket_comment', 'ticket', p_ticket_id, jsonb_build_object('comment', v_comment));
end;
$$;

create function public.list_committee_members()
returns table(id uuid, display_name text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_committee() then
    raise exception 'FORBIDDEN';
  end if;
  return query
  select distinct p.id, p.display_name
  from public.profiles p
  join public.user_roles ur on ur.user_id = p.id
  where p.is_active and ur.role in ('committee', 'admin')
  order by p.display_name;
end;
$$;

revoke all on function public.create_ticket(public.ticket_category, text, text) from public, anon;
revoke all on function public.add_ticket_photos(uuid, text, text[]) from public, anon;
revoke all on function public.update_ticket_status(uuid, public.ticket_status, text, boolean) from public, anon;
revoke all on function public.assign_ticket(uuid, uuid, uuid, timestamptz, numeric) from public, anon;
revoke all on function public.add_ticket_comment(uuid, text) from public, anon;
revoke all on function public.list_committee_members() from public, anon;
grant execute on function public.create_ticket(public.ticket_category, text, text) to authenticated;
grant execute on function public.add_ticket_photos(uuid, text, text[]) to authenticated;
grant execute on function public.update_ticket_status(uuid, public.ticket_status, text, boolean) to authenticated;
grant execute on function public.assign_ticket(uuid, uuid, uuid, timestamptz, numeric) to authenticated;
grant execute on function public.add_ticket_comment(uuid, text) to authenticated;
grant execute on function public.list_committee_members() to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tickets', 'tickets', false, 1048576, array['image/webp', 'image/jpeg'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy tickets_storage_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'tickets'
  and exists (
    select 1 from public.tickets t
    where t.id::text = (storage.foldername(name))[1]
      and (t.reporter_id = auth.uid() or public.is_committee())
  )
);
create policy tickets_storage_select on storage.objects for select to authenticated
using (
  bucket_id = 'tickets'
  and exists (
    select 1 from public.tickets t
    where t.id::text = (storage.foldername(name))[1]
      and (
        public.is_committee()
        or t.reporter_id = auth.uid()
        or (t.house_id is not null and t.house_id = public.my_house_id())
      )
  )
);
