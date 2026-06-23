# Design Spec: Form Observasi Eksperimen

**Date:** 2026-06-23  
**Status:** Approved  
**Feature:** Modul Form Observasi Perkembangan Anak — VFT & STEAM EduGreen

---

## 1. Overview

This feature adds a child development observation module to the existing Inventaris PAUD app. Teachers log into one of 5 schools using the existing shared-access-code flow, then use the Observation module to score each child across 12 development indicators during science/STEAM experiment activities. The system calculates averages automatically, stores results in Supabase, and generates a printable PDF class summary with the school's official stamp and teacher signature image automatically embedded.

**Primary users:** PAUD teachers at 5 partner schools  
**Key constraint:** One school cannot read another school's observation data.

---

## 2. Schools & Access Codes

| School Name | Code | TTD File |
|---|---|---|
| TK Daruttaqwa Jombang | 01 | `/TandaTangan/TTD Daruttaqwa 01.png` |
| TK Dewi Masyithoh 15 Keting | 15 | `/TandaTangan/TTD Masyitoh 15.png` |
| TK Dewi Masyithoh 59 Jombang | 59 | `/TandaTangan/TTD Masyitoh 59.png` |
| TK Dewi Masyithoh 69 Keting | 69 | `/TandaTangan/TTD Masyitoh 69.png` |
| TK Dharma Wanita 02 Padomasan | 02 | `/TandaTangan/TTD Padomasan 02.png` |

The app already has a `/select-school` page and school session stored in browser. The observation module reads the active school from that existing session.

---

## 3. Observation Themes

5 fixed experiment themes (stored as constants, not DB-configurable in MVP):

```
1. Eksperimen Sawi Berubah Warna
2. Eksperimen Jagung Menari
3. Eksperimen Uji Asam Basa
4. Eksperimen Fotosintesis
5. Eksperimen Pengamatan Serangga dan Serbuk Sari Bunga
```

---

## 4. 12 Observation Indicators

Fixed set, identical for all themes:

| No | Indicator |
|---|---|
| 1 | Anak memperhatikan video Experiment Natural Science dengan fokus |
| 2 | Anak menunjukkan rasa ingin tahu melalui pertanyaan atau tanggapan |
| 3 | Anak mampu mengamati perubahan yang terjadi dalam eksperimen |
| 4 | Anak mampu membuat prediksi sederhana sebelum eksperimen |
| 5 | Anak mampu mengikuti langkah-langkah eksperimen sesuai arahan |
| 6 | Anak mampu menggunakan alat dan bahan eksperimen sederhana dengan aman |
| 7 | Anak mampu menjelaskan hasil eksperimen secara sederhana |
| 8 | Anak mampu menghitung/mengelompokkan/membandingkan bahan dalam eksperimen |
| 9 | Anak mampu menceritakan kembali proses kegiatan yang dilakukan |
| 10 | Anak menunjukkan kreativitas dalam menyelesaikan kegiatan eksperimen |
| 11 | Anak mampu menghubungkan eksperimen dengan fenomena alam sekitar |
| 12 | Anak menunjukkan sikap aktif, percaya diri, dan bekerja sama selama kegiatan |

---

## 5. Scoring & Category Rules

- Each indicator: score 1–4 (integer)
- `total_score` = sum of all 12 scores (max 48)
- `average_score` = total_score / 12 (rounded to 2 decimal places)
- Category determined by average:

| Range | Category |
|---|---|
| 3.26 – 4.00 | BSB (Berkembang Sangat Baik) |
| 2.51 – 3.25 | BSH (Berkembang Sesuai Harapan) |
| 1.76 – 2.50 | MB (Mulai Berkembang) |
| 1.00 – 1.75 | BB (Belum Berkembang) |

---

## 6. User Flow (3 Steps)

### Step 1: Setup Sesi
- Select experiment theme (dropdown)
- Select date (date picker, defaults to today)
- Input child names manually (dynamic list, min 1, max 40)
- Validate: at least 1 child name, theme selected

### Step 2: Isi Skor per Anak
- Tab navigation across children (by name)
- Per child: show 12 indicators with score buttons 1/2/3/4
- Color coding: 1=red(BB), 2=amber(MB), 3=green(BSH), 4=purple(BSB)
- Live average display in top-right of child card
- Mark each child tab as ✓ complete when all 12 scores filled
- Navigation: Previous / Next child buttons
- Validation: all 12 indicators must be scored before saving

### Step 3: Rekap & Cetak
- Summary: total children, distribution by category (BSB/BSH/MB/BB)
- Class average table: name · total_score · average · category badge
- "Save to Supabase" happens on entering Step 3 (one-time save)
- Print preview with TTD image auto-embedded from `/public/TandaTangan/`
- Buttons: "Sesi Baru" | "🖨️ Cetak / Unduh PDF"

---

## 7. Navigation Integration

### Dashboard (existing `page.tsx`)
- Add a new feature card section between metric grid and zone progress section
- Card has: 🔬 icon, title, description, 5 theme pills, "Mulai Observasi →" button
- Clicking card navigates to Observasi tab Step 1

### Nav Bar (existing bottom nav)
- Extend `AppTab` type from `"dashboard" | "zones"` to `"dashboard" | "zones" | "observasi"`
- Add 3rd tab button "Observasi" with orange "BARU" badge
- Tab active: green pill; navigates to `ObservasiView` component

### ObservasiView (new component in `page.tsx`)
- Session list: shows all sessions for current school
- Each session card: theme · date · child count · category distribution · class average
- Actions per card: "Lihat Detail" | "🖨️ Cetak PDF"
- "+ Sesi Baru" button opens Step 1 wizard

---

## 8. Data Architecture

### New Supabase Tables

```sql
-- Observation sessions (one per class activity)
observation_sessions (
  id uuid primary key default gen_random_uuid(),
  school_code text not null,                    -- '01','02','15','59','69'
  theme_id text not null,                       -- slug of the 5 themes
  session_date date not null,
  created_at timestamptz not null default now()
);

-- Per-child observation records
observation_records (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references observation_sessions(id) on delete cascade,
  child_name text not null,
  score_1 smallint not null check (score_1 between 1 and 4),
  score_2 smallint not null check (score_2 between 1 and 4),
  -- ... score_3 through score_12 same pattern
  score_12 smallint not null check (score_12 between 1 and 4),
  total_score smallint not null,               -- computed: sum of 12 scores
  average_score numeric(4,2) not null,         -- computed: total/12
  category text not null,                      -- 'BSB'|'BSH'|'MB'|'BB'
  created_at timestamptz not null default now()
);
```

### Data Isolation
- No RLS in MVP (no Supabase Auth)
- API routes filter by `school_code` from server-side session
- The school session is read from a signed HTTP-only cookie set at login

### API Routes (new)
| Route | Method | Purpose |
|---|---|---|
| `GET /api/observation/sessions` | GET | List all sessions for current school |
| `POST /api/observation/sessions` | POST | Create session + all child records atomically |
| `GET /api/observation/sessions/[id]` | GET | Fetch one session + its records |
| `GET /api/observation/report?sessionId=...` | GET | HTML report for browser PDF print |

---

## 9. PDF / Print Report

Uses the same browser `window.print()` pattern as existing `/api/reports`.

Report content:
- Header: school name, theme, date
- Class summary table: name · total · average · category
- Category legend (BB/MB/BSH/BSB ranges)
- TTD section: "Mengetahui, Guru Pendamping," + `<img>` from `/TandaTangan/{code}.png` + "Nama: ___"

The TTD image mapping:
```
school_code -> TTD file
'01' -> 'TTD Daruttaqwa 01.png'
'15' -> 'TTD Masyitoh 15.png'
'59' -> 'TTD Masyitoh 59.png'
'69' -> 'TTD Masyitoh 69.png'
'02' -> 'TTD Padomasan 02.png'
```

---

## 10. School Session (Auth)

The existing `select-school` flow stores school identity in the browser. For the observation feature API routes to enforce isolation, the school code must also be available server-side.

**MVP approach:** Add a signed HTTP-only cookie (`school_session`) when the user enters the correct access code. The cookie value = school code (e.g., `"01"`). API routes read this cookie; requests without a valid cookie return 401.

The school access code validation and cookie-setting logic belongs in a new `/api/auth/school` POST route that the existing `select-school` page calls.

---

## 11. New Files

| File | Role |
|---|---|
| `src/lib/observation.ts` | Types, constants (themes, indicators, categories), pure calculation functions |
| `src/lib/observation-store.ts` | Supabase CRUD for observation_sessions + observation_records |
| `src/app/api/observation/sessions/route.ts` | GET list + POST create |
| `src/app/api/observation/sessions/[id]/route.ts` | GET single session |
| `src/app/api/observation/report/route.ts` | HTML report for PDF |
| `src/app/api/auth/school/route.ts` | POST: validate code → set cookie |
| `supabase/migrations/20260623_observation_tables.sql` | New tables migration |

## 12. Modified Files

| File | Change |
|---|---|
| `src/app/page.tsx` | Add `"observasi"` tab, ObservasiView component, dashboard card |
| `src/app/select-school/page.tsx` | Call `/api/auth/school` to set cookie on login |
| `src/lib/api-client.ts` | Add observation API client functions |

---

## 13. Assumptions & Constraints

- No multi-indicator partial saves: the entire session (all children, all scores) is saved atomically on Step 3
- No edit of saved sessions in MVP (view + print only)
- TTD images already in `/public/TandaTangan/` — no upload needed
- Observation data is never shown cross-school (filtered by cookie)
- Session data persists in browser state between Step 1→2→3 (not in Supabase until Step 3)
- Teacher name field in PDF is blank with a printed line for handwriting (confirmed: pending client confirmation for some schools)
