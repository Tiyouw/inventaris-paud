# Deployment Checklist

Use this checklist for the first Vercel + Supabase deployment.

## 1. Supabase

- Run `supabase/schema.sql` in the Supabase SQL editor.
- Confirm the `zones` table contains 5 rows.
- Confirm the `inventory-photos` Storage bucket exists.
- Confirm the bucket is public-readable.
- Keep Storage writes routed through the Next.js API. Do not add anonymous write policies.

## 2. Vercel Environment Variables

Add these variables in Vercel Project Settings -> Environment Variables:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_STORAGE_BUCKET=inventory-photos
NEXT_PUBLIC_APP_NAME=Makerspace Facilities & Inventory Logbook
NEXT_PUBLIC_SCHOOL_NAME
```

Do not expose `SUPABASE_SERVICE_ROLE_KEY` in client code, screenshots, commits, or public docs.

The shared access/login variables from `.env.example` are intentionally not used yet. Add them only after the client approves the access-code flow.

## 3. Deploy

Recommended Vercel settings:

- Framework Preset: Next.js
- Install Command: `pnpm install`
- Build Command: `pnpm build`
- Output Directory: leave empty/default
- Node.js Version: 20.x or newer

After deployment, open:

```text
https://your-vercel-domain/api/health
```

Expected response:

```json
{
  "ok": true,
  "supabaseConfigured": true,
  "storageBucket": "inventory-photos",
  "zoneCount": 5
}
```

## 4. Production Smoke Test

In the deployed app:

- Open Dashboard and confirm it loads without sample-data warnings.
- Open Zona Makerspace and confirm all 5 zone cards appear.
- Add one test item with a unique kode barang.
- Edit the item condition and confirm Riwayat Kondisi updates.
- Upload a JPG or PNG photo and confirm it is compressed and stored as WebP.
- Click `Cetak / PDF` and save the printable report from the browser.
- Soft-delete the test item and confirm it disappears from active tables.

## 5. Rollback Notes

If deployment fails because Supabase is not configured, the app can still render, but CRUD and upload flows will not be production-ready. Fix Vercel environment variables first, then redeploy.
