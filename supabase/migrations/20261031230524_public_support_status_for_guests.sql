-- Anonymous visitors can read only the support availability flag.
drop policy if exists "Public can view support online status" on public.support_status;
create policy "Public can view support online status" on public.support_status for select to anon using (true);
grant select on public.support_status to anon;
