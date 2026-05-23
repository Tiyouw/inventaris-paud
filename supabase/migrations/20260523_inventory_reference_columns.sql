-- Align existing Supabase projects with the PAUD inventory reference table.
-- Run this once after the original schema has already been applied.

alter table public.items
  add column if not exists acquisition_date date not null default current_date,
  add column if not exists source_id text not null default 'bop-paud';

alter table public.items
  alter column condition_id set default 'baik',
  alter column minimum_quantity set default 0;

alter table public.items
  drop constraint if exists items_condition_id_check,
  drop constraint if exists items_source_id_check;

alter table public.item_condition_logs
  drop constraint if exists item_condition_logs_previous_condition_id_check,
  drop constraint if exists item_condition_logs_new_condition_id_check;

update public.items
set condition_id = case condition_id
  when 'good' then 'baik'
  when 'needs-repair' then 'perlu-perbaikan'
  when 'damaged' then 'rusak-berat'
  when 'missing' then 'tidak-layak-pakai'
  else condition_id
end;

update public.item_condition_logs
set
  previous_condition_id = case previous_condition_id
    when 'good' then 'baik'
    when 'needs-repair' then 'perlu-perbaikan'
    when 'damaged' then 'rusak-berat'
    when 'missing' then 'tidak-layak-pakai'
    else previous_condition_id
  end,
  new_condition_id = case new_condition_id
    when 'good' then 'baik'
    when 'needs-repair' then 'perlu-perbaikan'
    when 'damaged' then 'rusak-berat'
    when 'missing' then 'tidak-layak-pakai'
    else new_condition_id
  end;

alter table public.items
  add constraint items_condition_id_check check (
    condition_id in (
      'baik',
      'layak-pakai',
      'rusak-ringan',
      'rusak-berat',
      'perlu-perbaikan',
      'tidak-layak-pakai'
    )
  ),
  add constraint items_source_id_check check (
    source_id in (
      'bos',
      'bop-paud',
      'hibah',
      'donasi',
      'pembelian-sekolah',
      'bantuan-pemerintah',
      'csr',
      'swadaya-orang-tua'
    )
  );

alter table public.item_condition_logs
  add constraint item_condition_logs_previous_condition_id_check check (
    previous_condition_id is null
    or previous_condition_id in (
      'baik',
      'layak-pakai',
      'rusak-ringan',
      'rusak-berat',
      'perlu-perbaikan',
      'tidak-layak-pakai'
    )
  ),
  add constraint item_condition_logs_new_condition_id_check check (
    new_condition_id in (
      'baik',
      'layak-pakai',
      'rusak-ringan',
      'rusak-berat',
      'perlu-perbaikan',
      'tidak-layak-pakai'
    )
  );

create index if not exists items_source_id_idx on public.items (source_id);
create index if not exists items_acquisition_date_idx on public.items (acquisition_date desc);
