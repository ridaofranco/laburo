-- staff_app_0013b_grant_attendance_select
-- La vista public.staff_app_attendance es security_invoker: el productor
-- (authenticated) necesita SELECT sobre la tabla base; la RLS
-- (attendance_member_read = is_org_member) filtra las filas. La escritura sigue
-- siendo solo por las funciones definer check_in/out del staff.
grant select on staff_app.attendance to authenticated;
