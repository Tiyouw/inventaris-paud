-- Makerspace Inventory MVP schema for Supabase PostgreSQL.
-- Run this file in the Supabase SQL editor for a new project/database.

create extension if not exists pgcrypto;

create table if not exists public.zones (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint zones_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid not null references public.zones(id) on update cascade on delete restrict,
  asset_tag text,
  name text not null,
  type_id text not null default 'equipment',
  category text,
  condition_id text not null default 'good',
  status text not null default 'available',
  quantity integer not null default 1,
  minimum_quantity integer not null default 1,
  unit text,
  location_detail text,
  owner text not null default 'PAUD Makerspace',
  primary_photo_url text,
  notes text,
  last_checked_at timestamptz,
  is_active boolean not null default true,
  deleted_at timestamptz,
  deleted_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint items_asset_tag_unique unique (asset_tag),
  constraint items_type_id_check check (
    type_id in ('equipment', 'tool', 'consumable', 'learning-kit', 'display')
  ),
  constraint items_condition_id_check check (
    condition_id in ('good', 'needs-repair', 'damaged', 'missing')
  ),
  constraint items_status_check check (
    status in ('available', 'checked-out', 'reserved', 'missing')
  ),
  constraint items_quantity_non_negative check (quantity >= 0),
  constraint items_minimum_quantity_non_negative check (minimum_quantity >= 0),
  constraint items_soft_delete_consistency check (
    (is_active = true and deleted_at is null)
    or
    (is_active = false)
  )
);

create table if not exists public.item_condition_logs (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items(id) on update cascade on delete restrict,
  previous_condition_id text,
  new_condition_id text not null,
  notes text,
  photo_url text,
  checked_by text,
  changed_by text,
  checked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint item_condition_logs_previous_condition_id_check check (
    previous_condition_id is null
    or previous_condition_id in ('good', 'needs-repair', 'damaged', 'missing')
  ),
  constraint item_condition_logs_new_condition_id_check check (
    new_condition_id in ('good', 'needs-repair', 'damaged', 'missing')
  )
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_zones_updated_at on public.zones;
create trigger set_zones_updated_at
before update on public.zones
for each row
execute function public.set_updated_at();

drop trigger if exists set_items_updated_at on public.items;
create trigger set_items_updated_at
before update on public.items
for each row
execute function public.set_updated_at();

create index if not exists zones_slug_idx on public.zones (slug);

create index if not exists items_zone_id_idx on public.items (zone_id);
create index if not exists items_active_zone_idx on public.items (zone_id, is_active);
create index if not exists items_condition_id_idx on public.items (condition_id);
create index if not exists items_status_idx on public.items (status);
create index if not exists items_type_id_idx on public.items (type_id);
create index if not exists items_updated_at_idx on public.items (updated_at desc);
create index if not exists items_deleted_at_idx on public.items (deleted_at) where deleted_at is not null;
create index if not exists items_active_name_idx on public.items (lower(name)) where is_active = true;

create index if not exists item_condition_logs_item_id_idx on public.item_condition_logs (item_id);
create index if not exists item_condition_logs_checked_at_idx on public.item_condition_logs (checked_at desc);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'inventory-photos',
  'inventory-photos',
  true,
  5242880,
  array['image/webp']
)
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Inventory photos are publicly readable" on storage.objects;
create policy "Inventory photos are publicly readable"
on storage.objects
for select
using (bucket_id = 'inventory-photos');

insert into public.zones (name, slug, description)
values
  (
    'Mini Garden',
    'mini-garden',
    'Gardening tools, plant care materials, and outdoor exploration supplies.'
  ),
  (
    'Art Gallery',
    'art-gallery',
    'Visual art tools, display materials, and creative classroom supplies.'
  ),
  (
    'Biodiversity & Drama',
    'biodiversity-drama',
    'Nature observation materials, costumes, props, and storytelling kits.'
  ),
  (
    'STEAM Lab',
    'steam-lab',
    'Experiment kits, construction tools, measuring devices, and lab materials.'
  ),
  (
    'Eco Upcycle',
    'eco-upcycle',
    'Reusable materials, recycling tools, and upcycling project equipment.'
  )
on conflict (slug) do update
set
  name = excluded.name,
  description = excluded.description;

-- Optional item seed guidance:
-- Insert demo items only after zones exist, selecting zone_id by zones.slug.
-- Keep asset_tag unique and use these catalog IDs:
-- type_id: equipment, tool, consumable, learning-kit, display
-- condition_id: good, needs-repair, damaged, missing
-- status: available, checked-out, reserved, missing
-- Insert matching item_condition_logs rows after their items exist.
