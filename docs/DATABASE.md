# Database Setup

This project uses Supabase PostgreSQL for the Makerspace Inventory MVP.

## Apply the Schema

1. Open your Supabase project.
2. Go to **SQL Editor**.
3. Open `supabase/schema.sql` from this repository.
4. Copy the full SQL into a new query.
5. Click **Run**.

The script creates:

- `zones` for the five PAUD Makerspace areas.
- `items` for active and soft-deleted inventory records.
- `item_condition_logs` for condition history.
- A Supabase Storage bucket named `inventory-photos`.
- A public read policy for item photos stored in that bucket.
- An `updated_at` trigger used by mutable tables.
- Indexes for zone views, search, filtering, sorting, soft deletes, and history lookups.
- Seed rows for Mini Garden, Art Gallery, Biodiversity & Drama, STEAM Lab, and Eco Upcycle.

## Environment Variables

Copy `.env.example` to `.env.local` and fill these Supabase values before using the CRUD/API/upload workflow:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET=inventory-photos`

`SUPABASE_SERVICE_ROLE_KEY` must only be used in server-side code, such as Next.js API routes. It should never be imported by browser/client components.

## Storage Policy Notes

The schema creates the `inventory-photos` bucket as public-readable so reports and item cards can render saved item photos from their public URL.

Writes are intentionally expected to go through server-side API routes that use `SUPABASE_SERVICE_ROLE_KEY`. Do not add anonymous insert/update/delete Storage policies unless the app is changed to support direct browser uploads with a stricter authentication model.

Recommended object path format:

```text
{zone-slug}/{item-id}/{timestamp-or-random-id}.webp
```

Uploaded images should already be compressed to WebP by the browser before the API uploads them.

## Planned API Routes

The Supabase-backed workflow should use these routes:

| Route | Method | Purpose |
| --- | --- | --- |
| `/api/zones` | `GET` | List Makerspace zones. |
| `/api/items` | `GET` | List active items, optionally filtered by zone, search, condition, status, or type. |
| `/api/items` | `POST` | Create an item and optionally create an initial condition log. |
| `/api/items/[id]` | `PATCH` | Update item metadata; condition changes should also append a condition log. |
| `/api/items/[id]` | `DELETE` | Soft-delete an item by setting `is_active = false`, `deleted_at`, and optional `deleted_reason`. |
| `/api/items/[id]/photos` | `POST` | Upload one optimized WebP photo and update `items.primary_photo_url`. |
| `/api/items/[id]/condition-logs` | `GET` | Read condition history for one item. |

## Optional Item Seed Guidance

The schema seeds zones only. For demo inventory data, insert optional item rows after the zone seed by selecting `zone_id` from `zones.slug`. Keep seed `asset_tag` values unique and use the same catalog IDs as the app:

- `type_id`: `equipment`, `tool`, `consumable`, `learning-kit`, `display`
- `condition_id`: `good`, `needs-repair`, `damaged`, `missing`
- `status`: `available`, `checked-out`, `reserved`, `missing`

Condition history seed rows should be inserted into `item_condition_logs` after their matching item rows exist.

## Notes

- Item deletion should be a soft delete: set `is_active = false`, set `deleted_at = now()`, and optionally set `deleted_reason`.
- The app's current catalog IDs are stored as text values: `type_id`, `condition_id`, `status`, and `zones.slug`.
- Re-running the script is safe for the zone seed rows because they use `on conflict (slug)`.
- Re-running the Storage bucket setup is safe because it uses `on conflict (id)`.
