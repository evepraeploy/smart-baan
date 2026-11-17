create function public.create_ledger_entry(
  p_entry_type public.ledger_type,
  p_category text,
  p_amount numeric,
  p_entry_date date,
  p_description text default null,
  p_attachment_path text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_entry public.ledger_entries%rowtype;
  v_category text := btrim(coalesce(p_category, ''));
begin
  if not public.is_committee() then
    raise exception 'FORBIDDEN';
  end if;
  if p_entry_type is null then
    raise exception 'INVALID_ENTRY_TYPE';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'INVALID_AMOUNT';
  end if;
  if length(v_category) = 0 or length(v_category) > 100 then
    raise exception 'CATEGORY_REQUIRED';
  end if;
  if p_entry_date is null then
    raise exception 'DATE_REQUIRED';
  end if;
  if p_attachment_path is not null and left(p_attachment_path, 7) <> 'ledger/' then
    raise exception 'INVALID_FILE_PATH';
  end if;

  insert into public.ledger_entries (
    entry_type, category, amount, entry_date, description, attachment_path, created_by
  )
  values (
    p_entry_type, v_category, p_amount, p_entry_date,
    nullif(btrim(coalesce(p_description, '')), ''), p_attachment_path, auth.uid()
  )
  returning * into v_entry;
  v_id := v_entry.id;

  insert into public.audit_logs (actor_id, action, entity, entity_id, details)
  values (
    auth.uid(),
    'create_ledger_entry',
    'ledger_entry',
    v_id,
    jsonb_build_object('entry_type', v_entry.entry_type, 'category', v_entry.category, 'amount', v_entry.amount)
  );

  return v_id;
end;
$$;

create function public.update_ledger_entry(
  p_id uuid,
  p_entry_type public.ledger_type,
  p_category text,
  p_amount numeric,
  p_entry_date date,
  p_description text default null,
  p_attachment_path text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before public.ledger_entries%rowtype;
  v_after public.ledger_entries%rowtype;
  v_category text := btrim(coalesce(p_category, ''));
begin
  if not public.is_committee() then
    raise exception 'FORBIDDEN';
  end if;

  select * into v_before
  from public.ledger_entries
  where id = p_id
  for update;
  if not found then
    raise exception 'LEDGER_NOT_FOUND';
  end if;
  if v_before.slip_id is not null then
    raise exception 'LEDGER_LOCKED';
  end if;
  if p_entry_type is null then
    raise exception 'INVALID_ENTRY_TYPE';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'INVALID_AMOUNT';
  end if;
  if length(v_category) = 0 or length(v_category) > 100 then
    raise exception 'CATEGORY_REQUIRED';
  end if;
  if p_entry_date is null then
    raise exception 'DATE_REQUIRED';
  end if;
  if p_attachment_path is not null and left(p_attachment_path, 7) <> 'ledger/' then
    raise exception 'INVALID_FILE_PATH';
  end if;

  update public.ledger_entries
  set entry_type = p_entry_type,
      category = v_category,
      amount = p_amount,
      entry_date = p_entry_date,
      description = nullif(btrim(coalesce(p_description, '')), ''),
      attachment_path = p_attachment_path,
      updated_at = now()
  where id = p_id
  returning * into v_after;

  insert into public.audit_logs (actor_id, action, entity, entity_id, details)
  values (
    auth.uid(),
    'update_ledger_entry',
    'ledger_entry',
    p_id,
    jsonb_build_object('before', to_jsonb(v_before), 'after', to_jsonb(v_after))
  );
end;
$$;

create function public.delete_ledger_entry(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry public.ledger_entries%rowtype;
begin
  if not public.is_committee() then
    raise exception 'FORBIDDEN';
  end if;

  select * into v_entry
  from public.ledger_entries
  where id = p_id
  for update;
  if not found then
    raise exception 'LEDGER_NOT_FOUND';
  end if;
  if v_entry.slip_id is not null then
    raise exception 'LEDGER_LOCKED';
  end if;

  delete from public.ledger_entries where id = p_id;

  insert into public.audit_logs (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'delete_ledger_entry', 'ledger_entry', p_id, to_jsonb(v_entry));
end;
$$;

create function public.get_finance_report(p_year integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_opening_balance numeric := 0;
  v_opening_balance_date date;
  v_total_income numeric := 0;
  v_total_expense numeric := 0;
  v_year_income numeric := 0;
  v_year_expense numeric := 0;
  v_months jsonb;
  v_categories jsonb;
begin
  if auth.uid() is null then
    raise exception 'FORBIDDEN';
  end if;

  select coalesce(s.opening_balance, 0), s.opening_balance_date
  into v_opening_balance, v_opening_balance_date
  from public.settings s
  where s.id = 1;
  v_opening_balance := coalesce(v_opening_balance, 0);

  select
    coalesce(sum(le.amount) filter (where le.entry_type = 'income'), 0),
    coalesce(sum(le.amount) filter (where le.entry_type = 'expense'), 0),
    coalesce(sum(le.amount) filter (where le.entry_type = 'income' and extract(year from le.entry_date) = p_year), 0),
    coalesce(sum(le.amount) filter (where le.entry_type = 'expense' and extract(year from le.entry_date) = p_year), 0)
  into v_total_income, v_total_expense, v_year_income, v_year_expense
  from public.ledger_entries le;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'month', to_char(make_date(p_year, months.month_no, 1), 'YYYY-MM-DD'),
        'income', coalesce(month_totals.income, 0),
        'expense', coalesce(month_totals.expense, 0)
      )
      order by months.month_no
    ),
    '[]'::jsonb
  )
  into v_months
  from generate_series(1, 12) as months(month_no)
  left join (
    select
      extract(month from le.entry_date)::integer as month_no,
      sum(le.amount) filter (where le.entry_type = 'income') as income,
      sum(le.amount) filter (where le.entry_type = 'expense') as expense
    from public.ledger_entries le
    where extract(year from le.entry_date) = p_year
    group by extract(month from le.entry_date)
  ) as month_totals using (month_no);

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'entry_type', category_totals.entry_type,
        'category', category_totals.category,
        'amount', category_totals.amount
      )
      order by category_totals.entry_type, category_totals.amount desc
    ),
    '[]'::jsonb
  )
  into v_categories
  from (
    select le.entry_type, le.category, sum(le.amount) as amount
    from public.ledger_entries le
    where extract(year from le.entry_date) = p_year
    group by le.entry_type, le.category
  ) as category_totals;

  return jsonb_build_object(
    'opening_balance', v_opening_balance,
    'opening_balance_date', v_opening_balance_date,
    'total_income', v_total_income,
    'total_expense', v_total_expense,
    'balance', v_opening_balance + v_total_income - v_total_expense,
    'year_income', v_year_income,
    'year_expense', v_year_expense,
    'months', v_months,
    'categories', v_categories
  );
end;
$$;

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(title) between 1 and 200),
  body text not null check (length(body) <= 5000),
  image_path text,
  is_pinned boolean not null default false,
  expires_at timestamptz,
  created_by uuid not null references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index announcements_pinned_created_idx
  on public.announcements (is_pinned desc, created_at desc);

create table public.announcement_reads (
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  read_at timestamptz not null default now(),
  primary key (announcement_id, user_id)
);

create function public.audit_announcement_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_action text;
  v_id uuid;
  v_title text;
begin
  if tg_op = 'DELETE' then
    v_action := 'delete_announcement';
    v_id := old.id;
    v_title := old.title;
  elsif tg_op = 'UPDATE' then
    new.updated_at := now();
    v_action := 'update_announcement';
    v_id := new.id;
    v_title := new.title;
  else
    v_action := 'create_announcement';
    v_id := new.id;
    v_title := new.title;
  end if;

  insert into public.audit_logs (actor_id, action, entity, entity_id, details)
  values (auth.uid(), v_action, 'announcement', v_id, jsonb_build_object('title', v_title));

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger announcements_audit
before insert or update or delete on public.announcements
for each row execute function public.audit_announcement_changes();

alter table public.announcements enable row level security;
alter table public.announcement_reads enable row level security;

create policy announcements_select on public.announcements for select to authenticated
using (public.is_committee() or expires_at is null or expires_at > now());
create policy announcements_insert on public.announcements for insert to authenticated
with check (public.is_committee() and created_by = auth.uid());
create policy announcements_update on public.announcements for update to authenticated
using (public.is_committee()) with check (public.is_committee());
create policy announcements_delete on public.announcements for delete to authenticated
using (public.is_committee());
create policy announcement_reads_select on public.announcement_reads for select to authenticated
using (user_id = auth.uid());
create policy announcement_reads_insert on public.announcement_reads for insert to authenticated
with check (user_id = auth.uid());

grant select, insert, update, delete on public.announcements to authenticated;
grant select, insert on public.announcement_reads to authenticated;

revoke all on function public.create_ledger_entry(public.ledger_type, text, numeric, date, text, text) from public, anon;
revoke all on function public.update_ledger_entry(uuid, public.ledger_type, text, numeric, date, text, text) from public, anon;
revoke all on function public.delete_ledger_entry(uuid) from public, anon;
revoke all on function public.get_finance_report(integer) from public, anon;
grant execute on function public.create_ledger_entry(public.ledger_type, text, numeric, date, text, text) to authenticated;
grant execute on function public.update_ledger_entry(uuid, public.ledger_type, text, numeric, date, text, text) to authenticated;
grant execute on function public.delete_ledger_entry(uuid) to authenticated;
grant execute on function public.get_finance_report(integer) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 1048576, array['image/webp', 'image/jpeg'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy receipts_storage_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'receipts'
  and public.is_committee()
  and (storage.foldername(name))[1] = 'ledger'
);

create policy receipts_storage_select on storage.objects
for select to authenticated
using (
  bucket_id = 'receipts'
  and public.is_committee()
  and (storage.foldername(name))[1] = 'ledger'
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('announcements', 'announcements', false, 1048576, array['image/webp', 'image/jpeg'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy announcements_storage_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'announcements'
  and public.is_committee()
  and (storage.foldername(name))[1] = 'announcements'
);

create policy announcements_storage_select on storage.objects
for select to authenticated
using (bucket_id = 'announcements');

create policy announcements_storage_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'announcements'
  and public.is_committee()
  and (storage.foldername(name))[1] = 'announcements'
);
