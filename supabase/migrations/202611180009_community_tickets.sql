create table public.ticket_affected (
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  house_id uuid not null references public.houses(id),
  user_id uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  primary key (ticket_id, house_id)
);

alter table public.ticket_affected enable row level security;

create policy ticket_affected_select on public.ticket_affected
for select to authenticated
using (house_id = public.my_house_id() or public.is_committee());

revoke all on table public.ticket_affected from public, anon, authenticated;
grant select on table public.ticket_affected to authenticated;

create function public.community_ticket_exists(p_ticket_id text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'FORBIDDEN';
  end if;
  return exists (
    select 1 from public.tickets t where t.id::text = p_ticket_id
  );
end;
$$;

revoke all on function public.community_ticket_exists(text) from public, anon;
grant execute on function public.community_ticket_exists(text) to authenticated;

create policy tickets_community_storage_select on storage.objects
for select to authenticated
using (
  bucket_id = 'tickets'
  and public.community_ticket_exists((storage.foldername(name))[1])
);

create function public.list_community_tickets()
returns table (
  id uuid,
  category public.ticket_category,
  title text,
  status public.ticket_status,
  created_at timestamptz,
  updated_at timestamptz,
  closed_at timestamptz,
  is_mine boolean,
  affected_count integer,
  i_am_affected boolean,
  report_photo_count integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_house_id uuid;
begin
  if v_user_id is null then
    raise exception 'FORBIDDEN';
  end if;
  v_house_id := public.my_house_id();

  return query
  select
    t.id,
    t.category,
    t.title,
    t.status,
    t.created_at,
    t.updated_at,
    t.closed_at,
    (t.reporter_id = v_user_id or (t.house_id is not null and t.house_id = v_house_id)),
    (select count(*)::integer from public.ticket_affected ta where ta.ticket_id = t.id),
    (v_house_id is not null and exists (
      select 1 from public.ticket_affected ta
      where ta.ticket_id = t.id and ta.house_id = v_house_id
    )),
    (select count(*)::integer from public.ticket_photos tp where tp.ticket_id = t.id and tp.kind = 'report')
  from public.tickets t
  order by case when t.status in ('pending', 'in_progress') then 0 else 1 end, t.created_at desc;
end;
$$;

create function public.get_community_ticket(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_house_id uuid;
  v_ticket public.tickets%rowtype;
  v_affected_count integer;
  v_i_am_affected boolean;
begin
  if v_user_id is null then
    raise exception 'FORBIDDEN';
  end if;

  select * into v_ticket from public.tickets where id = p_id;
  if not found then
    raise exception 'TICKET_NOT_FOUND';
  end if;

  v_house_id := public.my_house_id();
  select count(*)::integer into v_affected_count
  from public.ticket_affected ta where ta.ticket_id = p_id;
  v_i_am_affected := v_house_id is not null and exists (
    select 1 from public.ticket_affected ta
    where ta.ticket_id = p_id and ta.house_id = v_house_id
  );

  return jsonb_build_object(
    'id', v_ticket.id,
    'category', v_ticket.category,
    'title', v_ticket.title,
    'description', v_ticket.description,
    'status', v_ticket.status,
    'created_at', v_ticket.created_at,
    'updated_at', v_ticket.updated_at,
    'closed_at', v_ticket.closed_at,
    'is_mine', v_ticket.reporter_id = v_user_id or (v_ticket.house_id is not null and v_ticket.house_id = v_house_id),
    'affected_count', v_affected_count,
    'i_am_affected', v_i_am_affected,
    'photos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', tp.id,
        'path', tp.path,
        'kind', tp.kind,
        'created_at', tp.created_at
      ) order by tp.created_at)
      from public.ticket_photos tp where tp.ticket_id = p_id
    ), '[]'::jsonb),
    'timeline', coalesce((
      select jsonb_agg(jsonb_build_object(
        'to_status', te.to_status,
        'from_status', te.from_status,
        'created_at', te.created_at
      ) order by te.created_at)
      from public.ticket_events te
      where te.ticket_id = p_id and te.event_type in ('created', 'status')
    ), '[]'::jsonb),
    'affected_houses', case when public.is_committee() then coalesce((
      select jsonb_agg(h.house_no order by h.house_no)
      from public.ticket_affected ta
      join public.houses h on h.id = ta.house_id
      where ta.ticket_id = p_id
    ), '[]'::jsonb) else null end
  );
end;
$$;

create function public.toggle_ticket_affected(p_ticket_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_house_id uuid;
  v_ticket_house_id uuid;
  v_reporter_id uuid;
  v_status public.ticket_status;
  v_i_am_affected boolean;
  v_affected_count integer;
begin
  if v_user_id is null then
    raise exception 'FORBIDDEN';
  end if;
  v_house_id := public.my_house_id();
  if v_house_id is null then
    raise exception 'NO_HOUSE';
  end if;

  select t.house_id, t.reporter_id, t.status
  into v_ticket_house_id, v_reporter_id, v_status
  from public.tickets t where t.id = p_ticket_id;
  if not found then
    raise exception 'TICKET_NOT_FOUND';
  end if;

  if exists (
    select 1 from public.ticket_affected ta
    where ta.ticket_id = p_ticket_id and ta.house_id = v_house_id
  ) then
    delete from public.ticket_affected ta
    where ta.ticket_id = p_ticket_id and ta.house_id = v_house_id;
    v_i_am_affected := false;
  else
    if v_reporter_id = v_user_id or v_ticket_house_id = v_house_id then
      raise exception 'OWN_TICKET';
    end if;
    if v_status not in ('pending', 'in_progress') then
      raise exception 'TICKET_CLOSED';
    end if;
    insert into public.ticket_affected (ticket_id, house_id)
    values (p_ticket_id, v_house_id);
    v_i_am_affected := true;
  end if;

  select count(*)::integer into v_affected_count
  from public.ticket_affected ta where ta.ticket_id = p_ticket_id;
  return jsonb_build_object('affected_count', v_affected_count, 'i_am_affected', v_i_am_affected);
end;
$$;

revoke all on function public.list_community_tickets() from public, anon;
revoke all on function public.get_community_ticket(uuid) from public, anon;
revoke all on function public.toggle_ticket_affected(uuid) from public, anon;
grant execute on function public.list_community_tickets() to authenticated;
grant execute on function public.get_community_ticket(uuid) to authenticated;
grant execute on function public.toggle_ticket_affected(uuid) to authenticated;
