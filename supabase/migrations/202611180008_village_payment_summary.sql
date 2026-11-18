create function public.get_village_payment_summary(p_period date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period date := date_trunc('month', p_period)::date;
  v_total integer;
  v_paid integer;
  v_pending_review integer;
  v_my_status text;
begin
  if auth.uid() is null then
    raise exception 'FORBIDDEN';
  end if;

  select count(*)::integer
  into v_total
  from public.houses h
  where h.is_active;

  select
    count(*) filter (where b.status in ('paid', 'waived'))::integer,
    count(*) filter (where b.status = 'pending_review')::integer
  into v_paid, v_pending_review
  from public.houses h
  left join public.bills b on b.house_id = h.id and b.period = v_period
  where h.is_active;

  select case
    when b.status in ('paid', 'waived') then 'paid'
    when b.status = 'pending_review' then 'pending_review'
    else 'unpaid'
  end
  into v_my_status
  from public.houses h
  left join public.bills b on b.house_id = h.id and b.period = v_period
  where h.id = public.my_house_id()
    and h.is_active;

  return jsonb_build_object(
    'total', v_total,
    'paid', v_paid,
    'pending_review', v_pending_review,
    'unpaid', v_total - v_paid - v_pending_review,
    'my_status', v_my_status
  );
end;
$$;

revoke all on function public.get_village_payment_summary(date) from public, anon;
grant execute on function public.get_village_payment_summary(date) to authenticated;
