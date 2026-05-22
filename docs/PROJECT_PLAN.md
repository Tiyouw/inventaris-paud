# Project Plan: Makerspace Facilities & Inventory Logbook

## 1. Overview

The Makerspace Facilities & Inventory Logbook is a web application for recording, monitoring, and reporting the condition of learning equipment across five PAUD Makerspace zones.

The app should be simple enough for teachers to use during routine classroom checks, with an Indonesian teacher-facing UI that feels familiar and approachable while still preserving reliable inventory history for reporting and maintenance decisions. The first version should favor operational ease, low maintenance, and compatibility with free-tier infrastructure.

Target platform:

- Frontend deployment: Vercel
- Database: Supabase PostgreSQL
- File storage: Supabase Storage
- Primary users: PAUD teachers and school staff responsible for Makerspace inventory

## 2. Product Goals

- Provide a clear visual dashboard for selecting a Makerspace zone.
- Let teachers add, update, search, and review inventory items per zone.
- Track condition changes over time instead of overwriting old condition data.
- Preserve deleted item history through soft delete behavior.
- Export inventory reports to PDF, including item photos where useful.
- Compress uploaded photos to WebP before storage to reduce Supabase Storage usage.
- Keep the MVP lightweight enough to build and operate on free or low-cost tooling.

The app should feel like a practical inspection companion, not a complex enterprise asset management system.

## 3. Users & Access Control

### Initial Access Model

The MVP will use one shared account for all teachers. This keeps the first release easy to operate and avoids unnecessary multi-user administration.

### Authentication Requirement

The first authentication layer should be simple:

- A shared password, access code, or basic login page.
- The login gate should protect the application from casual public access.
- It does not need full user registration, account recovery, or role management in the MVP.

### Future Auth Upgrade Path

The database and application architecture should leave room for future identity features:

- Teacher-specific accounts.
- Admin role for restoring deleted items or managing settings.
- Read-only viewer role for reporting.
- Change attribution using a future `changed_by` or `user_id` field.

## 4. Core User Flow

1. Teacher opens the application.
2. Teacher enters the shared password or access code.
3. Teacher lands on the zone dashboard.
4. Teacher selects one of the five Makerspace zones.
5. App opens the selected zone inventory page.
6. Teacher reviews existing items, filters by condition, or searches by name.
7. Teacher adds a new item or updates an existing item.
8. If an item's condition changes, the app records a condition history entry.
9. Teacher may export a PDF report for the zone or the full Makerspace inventory.

## 5. Dashboard & Zone UX

The interface should use a simple Dashboard and Zona Makerspace tab structure. The Dashboard gives teachers the main overview, while Zona Makerspace focuses on the five zone choices and their inventory status.

The Zona Makerspace tab should present five visual cards:

- Mini Garden
- Art Gallery
- Biodiversity & Drama
- STEAM Lab
- Eco Upcycle

Each card should show:

- Zone name.
- Representative icon or image.
- Total active items.
- Number of items needing attention.
- Last updated date.
- Monthly inspection progress, when available.

The zone selection can borrow the clarity of a quiz selection screen: one clear choice per card, large click target, and immediate navigation. The style should use a SiKecilPintar-inspired friendly card layout, with warm approachable visuals, while remaining calm, readable, and work-focused.

Recommended light behavioral design:

- Show zone completion indicators such as "18 of 25 items checked this month."
- Show maintenance attention badges such as "3 items need repair."
- Use helpful empty states when a zone has no items yet.
- Provide positive save feedback after adding or updating an item.
- Avoid leaderboards, teacher rankings, punitive streaks, or excessive badge systems.

## 6. Inventory Item Management

Each zone page should contain an inventory table and item form.

### Inventory Table

The table should support:

- Search by item name.
- Filter by condition.
- Filter by category, if categories are added.
- Sort by item name, condition, last updated date, and quantity.
- Quick access to edit, update condition, view photo, and soft delete.

### Recommended Item Fields

- Item name.
- Zone.
- Category.
- Quantity.
- Unit.
- Condition.
- Location detail.
- Primary photo.
- Notes.
- Active status.
- Created date.
- Last updated date.

### Recommended Condition Values

- Good.
- Needs Repair.
- Damaged.
- Missing.

### Item Lifecycle

- New items are created as active.
- Editing item metadata updates the item record.
- Changing item condition also creates a condition history record.
- Deleting an item marks it inactive instead of removing it permanently.
- Inactive items are hidden from the normal inventory table but can be shown in an archive view later.

## 7. Condition History

The system must preserve a log whenever an item's condition changes. This prevents the latest condition from destroying previous inspection history.

Each condition log should capture:

- Item reference.
- Previous condition.
- New condition.
- Optional note.
- Optional photo reference.
- Timestamp.
- Future-ready actor field such as `changed_by`.

Example:

> STEAM Microscope changed from Good to Needs Repair on 2026-05-22.

Condition history should be viewable from an item detail panel or item history section.

## 8. Soft Delete Policy

Deleting an item must not permanently remove the database row.

Soft delete behavior:

- Set `is_active` to `false`.
- Set `deleted_at` to the deletion timestamp.
- Optionally store `deleted_reason`.
- Hide deleted items from default inventory views.
- Keep condition logs connected to the item.

This protects report history and allows future restoration if an item was deleted by mistake.

## 9. PDF Reporting

PDF export is required.

### Required Report Types

- Zone inventory report for one selected zone.
- Full Makerspace inventory report across all zones.
- Condition report for items marked Needs Repair, Damaged, or Missing.

### Recommended PDF Layout

Each PDF should include:

- School or project name.
- Report title.
- Generated date.
- Report scope.
- Zone summary.
- Inventory table.
- Condition labels.
- Notes.
- Optional photo appendix.

### Photo Appendix

Item photos should be included dynamically where useful, but large photos should not be forced into the main table.

Recommended layout:

- Main report section: compact inventory table.
- Appendix section: photo grid with item name, zone, item code or ID, and condition.

This keeps the PDF readable and helps teachers verify physical items in the field.

## 10. Image Upload & WebP Optimization

Uploaded photos must be optimized before storage to protect the Supabase Storage free tier.

### Recommended MVP Upload Flow

1. Teacher selects an image in the browser.
2. Browser resizes the image.
3. Browser converts or compresses the image to WebP.
4. Optimized image is uploaded to Supabase Storage.
5. The public URL or storage path is saved in the item record.

Recommended constraints:

- Format: WebP.
- Maximum width: 1200 px.
- Quality: 0.65 to 0.8.
- Target file size: preferably below 200 KB per image.
- Storage organization: group files by zone and item ID when possible.

### Future Server-Side Option

If browser compression becomes inconsistent, add a Vercel API route or serverless function to standardize image processing before upload.

## 11. Technical Stack

Recommended stack:

- Next.js for the web application.
- Vercel for hosting.
- Supabase PostgreSQL for structured data.
- Supabase Storage for item photos.
- Supabase Auth later, if teacher-specific accounts are needed.
- React Hook Form for forms.
- Zod for validation.
- TanStack Table for inventory tables.
- Tailwind CSS or shadcn/ui for UI consistency.
- PDFMake, jsPDF, or server-rendered PDF generation for reports.
- Browser-based image compression library or Canvas API for WebP conversion.

Free-tier-friendly additions to explore:

- CSV import/export.
- QR code generation for item labels.
- IndexedDB for limited offline draft support.
- Supabase Row Level Security when multi-user access is added.

## 12. Suggested Database Model

The exact schema can evolve during implementation, but the MVP should include these core entities.

```sql
zones (
  id uuid primary key,
  name text not null,
  slug text not null unique,
  description text,
  created_at timestamptz not null default now()
);

items (
  id uuid primary key,
  zone_id uuid not null references zones(id),
  name text not null,
  category text,
  quantity integer not null default 1,
  unit text,
  condition text not null,
  location_detail text,
  primary_photo_url text,
  notes text,
  is_active boolean not null default true,
  deleted_at timestamptz,
  deleted_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

item_condition_logs (
  id uuid primary key,
  item_id uuid not null references items(id),
  previous_condition text,
  new_condition text not null,
  notes text,
  photo_url text,
  changed_by text,
  created_at timestamptz not null default now()
);
```

Optional future tables:

- `item_photos` for multiple photos per item.
- `reports` for storing generated report metadata.
- `app_settings` for school name, report header text, and shared configuration.
- `users` or Supabase Auth-linked profiles for multi-user access.

## 13. MVP Scope

The MVP should include:

- Simple shared login or access code.
- Dashboard with five zone cards.
- Zone-specific inventory page.
- Add, edit, search, filter, and soft delete inventory items.
- Upload one optimized WebP photo per item.
- Condition history logs.
- PDF export for one zone.
- PDF export for all zones.
- Clear empty states and save feedback.

The MVP should not include:

- Full multi-user account management.
- Advanced analytics.
- Complex permission roles.
- Automated maintenance reminders.
- Offline-first sync.
- Public leaderboards or competitive scoring.

## 14. Future Enhancements

Potential post-MVP improvements:

- Teacher-specific accounts.
- Admin archive view and item restore.
- QR code labels for physical item tagging.
- CSV import and export.
- Monthly inspection workflow.
- Maintenance schedule and due-date reminders.
- Multiple photos per item.
- Report archive.
- Offline draft mode for poor connectivity.
- Row Level Security policies for stronger Supabase protection.

## 15. Acceptance Criteria

- The app has a dashboard with exactly five Makerspace zone cards.
- Each zone card opens a zone-specific inventory view.
- Teachers can add and edit inventory items.
- Teachers can upload item photos that are compressed to WebP before storage.
- Teachers can update an item condition.
- Every condition change creates a condition history entry.
- Deleting an item performs a soft delete and does not remove condition history.
- Default inventory views hide soft-deleted items.
- PDF export works for a selected zone.
- PDF export works for the full Makerspace inventory.
- PDF reports include item photos in a readable appendix when photos are available.
- The system is compatible with Vercel and Supabase.
- The MVP can operate with a shared account or simple access code.

## 16. Assumptions

- The first implementation is a new app or early-stage app without existing production constraints.
- English is the documentation language.
- Teachers need a fast and forgiving workflow more than complex administrative controls.
- Supabase Storage usage must be minimized because the free tier has limited capacity.
- One primary photo per item is enough for the MVP.
- Full account-based authentication can be added after the shared-access workflow is validated.
- Behavioral design should support completion and clarity, not competition.
