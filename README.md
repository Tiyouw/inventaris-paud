# Makerspace Facilities & Inventory Logbook

A Next.js application for recording, monitoring, and reporting PAUD Makerspace facilities and inventory across five learning zones:

- Mini Garden
- Art Gallery
- Biodiversity & Drama
- STEAM Lab
- Eco Upcycle

The app is intended to help teachers and school staff perform routine inventory checks through an Indonesian teacher-facing UI, track item condition changes, preserve deleted-item history through soft deletes, and eventually export readable inventory reports with item photos.

## Tech Stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- Planned data layer: Supabase PostgreSQL
- Planned file storage: Supabase Storage
- Planned deployment: Vercel

## Prerequisites

- Node.js 20 or newer
- pnpm

Install dependencies:

```bash
pnpm install
```

## Environment Setup

Create a local environment file from the example:

```bash
cp .env.example .env.local
```

Fill in the values in `.env.local` before enabling the Supabase-backed CRUD and photo upload flow.

- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are browser-safe values from Supabase project settings.
- `SUPABASE_SERVICE_ROLE_KEY` is server-only. Use it only from Next.js API routes for inventory mutations and Storage uploads.
- `SUPABASE_STORAGE_BUCKET` should match the bucket created by `supabase/schema.sql`; the default is `inventory-photos`.
- `SHARED_ACCESS_CODE` is the MVP shared gate secret and should stay server-side.

The static scaffold can still run without Supabase values, but the API/upload workflow requires them.

## Development

Start the local development server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Useful Commands

```bash
pnpm dev
pnpm build
pnpm start
pnpm lint
```

## Project Notes

The MVP should support a simple shared access model before full user accounts are introduced. Inventory records should be organized by Makerspace zone, with a Dashboard and Zona Makerspace tab structure that keeps zone navigation easy for teachers. The visual direction should use a SiKecilPintar-inspired friendly card layout while staying practical for inventory work. Condition changes should be logged instead of overwritten, and item deletion should use soft-delete behavior so historical reports remain reliable.

Supabase configuration is expected to cover:

- PostgreSQL tables for zones, items, and item condition logs.
- Storage bucket access for optimized WebP item photos.
- Future authentication or shared-access settings.

Current API route contract for the Supabase workflow:

- `GET /api/health` checks Supabase configuration, zone access, and Storage bucket name.
- `GET /api/items` lists active inventory items and condition logs.
- `POST /api/items` creates an item and writes the first condition log.
- `PUT /api/items/[id]` updates item metadata; condition changes also insert an `item_condition_logs` row.
- `DELETE /api/items/[id]` soft-deletes an item by setting `is_active = false` and `deleted_at`.
- `POST /api/upload` accepts optimized WebP photos and uploads them to Supabase Storage.
- `GET /api/reports` returns a printable HTML report for browser PDF export.
- `GET /api/reports?zoneId=mini-garden` returns a printable report for one Makerspace zone.

See `docs/PROJECT_PLAN.md` for the product plan, MVP scope, suggested schema, and acceptance criteria.

See `docs/DEPLOYMENT.md` for the Vercel + Supabase deployment checklist, required environment variables, and production smoke test.
