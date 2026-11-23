alter table mesa_private.records drop constraint if exists records_kind_check;
alter table mesa_private.records add constraint records_kind_check
  check (kind in ('users','sessions','rooms','hands','events','tours','reports','cashier'));
