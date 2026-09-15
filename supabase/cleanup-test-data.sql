-- One-time cleanup of the test data created while verifying the migration
-- (one ticket + reply, one test document row, one shift + signup,
--  one attendance code + check-in — all created 2026-09-15 by the setup session).
-- The uploaded test PDF itself is removed via the Storage API, not SQL.
delete from public.ticket_replies;
delete from public.tickets;
delete from public.documents;
delete from public.shift_signups;
delete from public.shifts;
delete from public.attendance_logs;
delete from public.attendance_codes;
select 'clean' as status;
