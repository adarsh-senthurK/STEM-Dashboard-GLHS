-- v4 audit fixes (applied 2026-09-16)

-- 1) Students cannot forge review state on upload: inserts must be pending,
--    feedback-free, and point at the uploader's own storage folder.
alter policy "upload own docs" on public.documents
  with check (
    user_id = auth.uid()
    and status = 'pending'
    and feedback is null
    and split_part(storage_path, '/', 1) = auth.uid()::text
  );

-- 2) Students can only edit their own tickets while still open
--    (admins unrestricted, e.g. marking answered).
alter policy "update own tickets, admins any" on public.tickets
  using (public.is_admin() or (user_id = auth.uid() and status = 'open'))
  with check (public.is_admin() or user_id = auth.uid());

-- 3) Member emails are PII: only admins may read them.
--    Column-level grants hide profiles.email from ordinary members;
--    admins fetch the full roster through a definer RPC.
revoke select on table public.profiles from authenticated, anon;
grant select (id, name, role, created_at) on public.profiles to authenticated;

create or replace function public.admin_list_profiles()
returns table (id uuid, name text, role text, email text)
language sql stable security definer set search_path = public
as $$
  select p.id, p.name, p.role, p.email
  from profiles p
  where public.is_admin()
  order by p.name;
$$;
revoke all on function public.admin_list_profiles() from public;
grant execute on function public.admin_list_profiles() to authenticated;

-- 4) Attendance hardening: club-local (Eastern) meeting dates and a
--    5-guess daily limit so codes can't be brute-forced remotely.
create table public.attendance_attempts (
  user_id uuid not null references public.profiles (id) on delete cascade,
  date    date not null,
  fails   int  not null default 0,
  primary key (user_id, date)
);
alter table public.attendance_attempts enable row level security;
-- no policies: only the definer function below touches it.

create or replace function public.log_attendance(p_code text)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_code  text;
  v_today date := (now() at time zone 'America/New_York')::date;
  v_fails int;
begin
  select fails into v_fails
    from attendance_attempts
    where user_id = auth.uid() and date = v_today;
  if coalesce(v_fails, 0) >= 5 then
    return json_build_object('ok', false, 'error', 'Too many attempts today. Ask an officer to check you in.');
  end if;

  select code into v_code from attendance_codes where date = v_today;
  if v_code is null then
    return json_build_object('ok', false, 'error', 'No attendance code is set for today.');
  end if;

  if upper(trim(p_code)) <> upper(v_code) then
    insert into attendance_attempts (user_id, date, fails)
    values (auth.uid(), v_today, 1)
    on conflict (user_id, date) do update set fails = attendance_attempts.fails + 1;
    return json_build_object('ok', false, 'error', 'Incorrect code. Double-check the board, or ask an officer.');
  end if;

  if exists (select 1 from attendance_logs where user_id = auth.uid() and date = v_today) then
    return json_build_object('ok', false, 'error', 'You already checked in today.');
  end if;

  insert into attendance_logs (user_id, date) values (auth.uid(), v_today);
  return json_build_object('ok', true);
end;
$$;

-- 5) Close the shift-capacity race: lock the shift row before counting.
create or replace function public.check_shift_capacity()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  perform 1 from shifts where id = new.shift_id for update;
  if (select count(*) from shift_signups where shift_id = new.shift_id)
     >= (select capacity from shifts where id = new.shift_id) then
    raise exception 'This shift is full.';
  end if;
  return new;
end;
$$;

-- 6) Sanity check: list current admins (expect only the club's officers).
select email, role from public.profiles where role = 'admin';
