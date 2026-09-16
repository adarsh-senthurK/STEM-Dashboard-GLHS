-- v3 hardening (applied 2026-09-16)

-- 1) Public signup is enabled, so the profile trigger must never trust a
--    role passed in signup metadata. New accounts are always students;
--    admins are promoted by an existing admin.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name, role, email)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'name'), ''), split_part(new.email, '@', 1)),
    'student',
    new.email
  );
  return new;
end;
$$;

-- 2) Let students delete their own questions (replies cascade via FK),
--    and admins delete any.
create policy "delete own tickets, admins any"
  on public.tickets for delete to authenticated
  using (user_id = auth.uid() or public.is_admin());
