delete from public.attendance_logs;
delete from public.attendance_attempts;
select (select count(*) from public.profiles) as profiles_kept, (select count(*) from public.attendance_logs) as logs, (select count(*) from public.documents) as documents, (select count(*) from public.tickets) as tickets;
