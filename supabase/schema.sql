-- stemrc schema — run in the Supabase SQL editor.
-- Tables + RLS for the GLHS STEM Research Club portal.

-- ============================================================
-- PROFILES (one row per auth user)
-- ============================================================
create table public.profiles (
  id         uuid primary key references auth.users on delete cascade,
  name       text not null,
  role       text not null default 'student' check (role in ('student', 'admin')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Auto-create a profile when an auth user is created.
-- Name comes from user metadata if set, else the email prefix.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'role', 'student')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Admin check used by policies below.
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

create policy "members read profiles"
  on public.profiles for select to authenticated using (true);

create policy "admins update profiles"
  on public.profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ============================================================
-- ATTENDANCE
-- ============================================================
-- Daily codes: only admins can see or set them. Students never
-- read this table — check-in goes through log_attendance().
create table public.attendance_codes (
  date       date primary key,
  code       text not null,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

alter table public.attendance_codes enable row level security;

create policy "admins manage codes"
  on public.attendance_codes for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create table public.attendance_logs (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  date       date not null default current_date,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

alter table public.attendance_logs enable row level security;

create policy "read own logs, admins read all"
  on public.attendance_logs for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- No insert policy on purpose: inserts only happen through this
-- function, which validates today's code first.
create or replace function public.log_attendance(p_code text)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_code text;
begin
  select code into v_code from attendance_codes where date = current_date;
  if v_code is null then
    return json_build_object('ok', false, 'error', 'No attendance code is set for today.');
  end if;
  if upper(trim(p_code)) <> upper(v_code) then
    return json_build_object('ok', false, 'error', 'Incorrect code. Double-check the board, or ask an officer.');
  end if;
  if exists (select 1 from attendance_logs where user_id = auth.uid() and date = current_date) then
    return json_build_object('ok', false, 'error', 'You already checked in today.');
  end if;
  insert into attendance_logs (user_id) values (auth.uid());
  return json_build_object('ok', true);
end;
$$;

revoke all on function public.log_attendance(text) from public;
grant execute on function public.log_attendance(text) to authenticated;

-- ============================================================
-- MENTOR / VOLUNTEER SHIFTS
-- ============================================================
create table public.shifts (
  id         bigint generated always as identity primary key,
  title      text not null,
  date       date not null,
  start_time text not null,
  end_time   text not null,
  location   text,
  capacity   int  not null default 5 check (capacity > 0),
  created_at timestamptz not null default now()
);

alter table public.shifts enable row level security;

create policy "members read shifts"
  on public.shifts for select to authenticated using (true);

create policy "admins manage shifts"
  on public.shifts for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create table public.shift_signups (
  id         bigint generated always as identity primary key,
  shift_id   bigint not null references public.shifts (id) on delete cascade,
  user_id    uuid   not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (shift_id, user_id)
);

alter table public.shift_signups enable row level security;

create policy "members read signups"
  on public.shift_signups for select to authenticated using (true);

create policy "sign yourself up"
  on public.shift_signups for insert to authenticated
  with check (user_id = auth.uid());

create policy "cancel own signup, admins any"
  on public.shift_signups for delete to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- Enforce capacity at the database level.
create or replace function public.check_shift_capacity()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if (select count(*) from shift_signups where shift_id = new.shift_id)
     >= (select capacity from shifts where id = new.shift_id) then
    raise exception 'This shift is full.';
  end if;
  return new;
end;
$$;

create trigger enforce_shift_capacity
  before insert on public.shift_signups
  for each row execute function public.check_shift_capacity();

-- ============================================================
-- QUESTIONS (TICKETS)
-- ============================================================
create table public.tickets (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  subject    text not null,
  body       text not null,
  status     text not null default 'open' check (status in ('open', 'answered', 'closed')),
  created_at timestamptz not null default now()
);

alter table public.tickets enable row level security;

create policy "read own tickets, admins read all"
  on public.tickets for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy "file own tickets"
  on public.tickets for insert to authenticated
  with check (user_id = auth.uid());

create policy "update own tickets, admins any"
  on public.tickets for update to authenticated
  using (user_id = auth.uid() or public.is_admin());

create table public.ticket_replies (
  id         bigint generated always as identity primary key,
  ticket_id  bigint not null references public.tickets (id) on delete cascade,
  user_id    uuid   not null references public.profiles (id),
  body       text not null,
  created_at timestamptz not null default now()
);

alter table public.ticket_replies enable row level security;

create policy "read replies on visible tickets"
  on public.ticket_replies for select to authenticated
  using (
    public.is_admin()
    or exists (select 1 from tickets t where t.id = ticket_id and t.user_id = auth.uid())
  );

create policy "reply on own tickets, admins any"
  on public.ticket_replies for insert to authenticated
  with check (
    user_id = auth.uid()
    and (
      public.is_admin()
      or exists (select 1 from tickets t where t.id = ticket_id and t.user_id = auth.uid())
    )
  );

-- ============================================================
-- RESEARCH HUB DOCUMENTS
-- ============================================================
create table public.documents (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  doc_type     text not null,
  filename     text not null,
  storage_path text not null,
  status       text not null default 'pending' check (status in ('pending', 'approved', 'denied')),
  feedback     text,
  created_at   timestamptz not null default now()
);

alter table public.documents enable row level security;

create policy "read own docs, admins read all"
  on public.documents for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy "upload own docs"
  on public.documents for insert to authenticated
  with check (user_id = auth.uid());

create policy "admins review docs"
  on public.documents for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "delete own pending docs, admins any"
  on public.documents for delete to authenticated
  using ((user_id = auth.uid() and status = 'pending') or public.is_admin());

-- ============================================================
-- STORAGE: private "documents" bucket, 5 MB cap per file.
-- Files live under <user_id>/<filename>.
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents', 'documents', false, 5242880,
  array['application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'image/png', 'image/jpeg']
);

create policy "upload to own folder"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "read own files, admins read all"
  on storage.objects for select to authenticated
  using (bucket_id = 'documents' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

create policy "delete own files, admins any"
  on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

-- ============================================================
-- v2 additions (applied after initial schema)
-- ============================================================
-- profiles.email so rosters can show contact info;
-- documents.size_bytes so the UI can show file sizes.
