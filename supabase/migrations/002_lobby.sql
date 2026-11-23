create table if not exists public.mesa_lobby_clock (
 id integer primary key check (id=1), revision bigint not null default 0
);
insert into public.mesa_lobby_clock values(1,0) on conflict do nothing;
alter table public.mesa_lobby_clock enable row level security;
revoke all on public.mesa_lobby_clock from public, anon, authenticated;
grant select on public.mesa_lobby_clock to authenticated;
drop policy if exists mesa_clock_read on public.mesa_lobby_clock;
create policy mesa_clock_read on public.mesa_lobby_clock for select to authenticated using(true);
do $$ begin
 if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='mesa_lobby_clock') then
 alter publication supabase_realtime add table public.mesa_lobby_clock;
 end if;
end $$;
