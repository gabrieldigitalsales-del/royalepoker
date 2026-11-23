create schema if not exists mesa_private;
revoke all on schema mesa_private from public, anon, authenticated;
create table if not exists mesa_private.records (
  kind text not null check(kind in ('users','sessions','rooms','hands','events','tours','reports')),
  id text not null,
  body jsonb not null check (jsonb_typeof(body)='object'),
  primary key(kind,id)
);
alter table mesa_private.records enable row level security;
revoke all on mesa_private.records from public, anon, authenticated;
