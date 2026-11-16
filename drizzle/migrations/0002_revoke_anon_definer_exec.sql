revoke execute on function public.has_role(uuid, public.app_role) from anon, public;
revoke execute on function public.is_premium(uuid) from anon, public;
revoke execute on function public.handle_new_user() from anon, authenticated, public;
grant execute on function public.has_role(uuid, public.app_role), public.is_premium(uuid) to authenticated;