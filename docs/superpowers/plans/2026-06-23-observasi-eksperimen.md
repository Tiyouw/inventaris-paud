# Form Observasi Eksperimen — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a child-development observation module (Form Observasi Eksperimen) to the Inventaris PAUD app — including a 3-step wizard UI, Supabase persistence, per-school data isolation via HTTP-only cookie, and browser-printable PDF with auto-embedded school TTD image.

**Architecture:** New types/constants in `src/lib/observation.ts`, new Supabase store in `src/lib/observation-store.ts`, 4 new API routes under `/api/observation/` and `/api/auth/school`, two new UI components (ObservasiView wizard + dashboard card) added to the existing single-file `src/app/page.tsx` following the established pattern of that file. Dashboard gets a new feature card; bottom nav gets a 3rd tab.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, Supabase JS v2, existing patterns from `src/lib/inventory-store.ts` and `src/app/page.tsx`.

**Design Spec:** `docs/superpowers/specs/2026-06-23-observasi-eksperimen-design.md`

---

## Task 1: Database Migration & TypeScript Types

**Files:**
- Create: `supabase/migrations/20260623_observation_tables.sql`
- Create: `src/lib/observation.ts`

- [ ] **Step 1.1:** Create `supabase/migrations/20260623_observation_tables.sql`:

```sql
create table if not exists public.observation_sessions (
  id uuid primary key default gen_random_uuid(),
  school_code text not null,
  theme_id text not null,
  session_date date not null,
  created_at timestamptz not null default now(),
  constraint observation_sessions_school_code_check check (
    school_code in ('01', '02', '15', '59', '69')
  ),
  constraint observation_sessions_theme_id_check check (
    theme_id in (
      'sawi-berubah-warna','jagung-menari','uji-asam-basa',
      'fotosintesis','serangga-serbuk-sari'
    )
  )
);

create table if not exists public.observation_records (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.observation_sessions(id) on delete cascade,
  child_name text not null,
  score_1 smallint not null check (score_1 between 1 and 4),
  score_2 smallint not null check (score_2 between 1 and 4),
  score_3 smallint not null check (score_3 between 1 and 4),
  score_4 smallint not null check (score_4 between 1 and 4),
  score_5 smallint not null check (score_5 between 1 and 4),
  score_6 smallint not null check (score_6 between 1 and 4),
  score_7 smallint not null check (score_7 between 1 and 4),
  score_8 smallint not null check (score_8 between 1 and 4),
  score_9 smallint not null check (score_9 between 1 and 4),
  score_10 smallint not null check (score_10 between 1 and 4),
  score_11 smallint not null check (score_11 between 1 and 4),
  score_12 smallint not null check (score_12 between 1 and 4),
  total_score smallint not null check (total_score between 12 and 48),
  average_score numeric(4,2) not null,
  category text not null check (category in ('BSB', 'BSH', 'MB', 'BB')),
  created_at timestamptz not null default now()
);

create index if not exists obs_sessions_school_idx on public.observation_sessions (school_code);
create index if not exists obs_sessions_date_idx on public.observation_sessions (session_date desc);
create index if not exists obs_records_session_idx on public.observation_records (session_id);
```

- [ ] **Step 1.2:** Run the migration SQL in Supabase SQL Editor (paste and execute manually)

- [ ] **Step 1.3:** Create `src/lib/observation.ts`:

```typescript
// ─── Themes ───────────────────────────────────────────────────────────────────
export const OBSERVATION_THEMES = [
  { id: 'sawi-berubah-warna', name: 'Eksperimen Sawi Berubah Warna', emoji: '🥬' },
  { id: 'jagung-menari', name: 'Eksperimen Jagung Menari', emoji: '🌽' },
  { id: 'uji-asam-basa', name: 'Eksperimen Uji Asam Basa', emoji: '🧪' },
  { id: 'fotosintesis', name: 'Eksperimen Fotosintesis', emoji: '🌿' },
  { id: 'serangga-serbuk-sari', name: 'Eksperimen Pengamatan Serangga dan Serbuk Sari Bunga', emoji: '🦋' },
] as const;
export type ObservationThemeId = (typeof OBSERVATION_THEMES)[number]['id'];

// ─── Indicators ───────────────────────────────────────────────────────────────
export const OBSERVATION_INDICATORS = [
  'Anak memperhatikan video Experiment Natural Science dengan fokus',
  'Anak menunjukkan rasa ingin tahu melalui pertanyaan atau tanggapan',
  'Anak mampu mengamati perubahan yang terjadi dalam eksperimen',
  'Anak mampu membuat prediksi sederhana sebelum eksperimen',
  'Anak mampu mengikuti langkah-langkah eksperimen sesuai arahan',
  'Anak mampu menggunakan alat dan bahan eksperimen sederhana dengan aman',
  'Anak mampu menjelaskan hasil eksperimen secara sederhana',
  'Anak mampu menghitung/mengelompokkan/membandingkan bahan dalam eksperimen',
  'Anak mampu menceritakan kembali proses kegiatan yang dilakukan',
  'Anak menunjukkan kreativitas dalam menyelesaikan kegiatan eksperimen',
  'Anak mampu menghubungkan eksperimen dengan fenomena alam sekitar',
  'Anak menunjukkan sikap aktif, percaya diri, dan bekerja sama selama kegiatan',
] as const;
export const INDICATOR_COUNT = OBSERVATION_INDICATORS.length; // 12

// ─── Categories ───────────────────────────────────────────────────────────────
export type ObservationCategory = 'BSB' | 'BSH' | 'MB' | 'BB';
export function getCategory(avg: number): ObservationCategory {
  if (avg >= 3.26) return 'BSB';
  if (avg >= 2.51) return 'BSH';
  if (avg >= 1.76) return 'MB';
  return 'BB';
}
export const CATEGORY_LABELS: Record<ObservationCategory, string> = {
  BSB: 'Berkembang Sangat Baik',
  BSH: 'Berkembang Sesuai Harapan',
  MB: 'Mulai Berkembang',
  BB: 'Belum Berkembang',
};
export const CATEGORY_RANGES: Record<ObservationCategory, string> = {
  BSB: '3,26–4,00', BSH: '2,51–3,25', MB: '1,76–2,50', BB: '1,00–1,75',
};

// ─── Schools ──────────────────────────────────────────────────────────────────
export const OBSERVATION_SCHOOLS = [
  { code: '01', name: 'TK Daruttaqwa Jombang',         ttdFile: 'TTD Daruttaqwa 01.png' },
  { code: '15', name: 'TK Dewi Masyithoh 15 Keting',   ttdFile: 'TTD Masyitoh 15.png' },
  { code: '59', name: 'TK Dewi Masyithoh 59 Jombang',  ttdFile: 'TTD Masyitoh 59.png' },
  { code: '69', name: 'TK Dewi Masyithoh 69 Keting',   ttdFile: 'TTD Masyitoh 69.png' },
  { code: '02', name: 'TK Dharma Wanita 02 Padomasan',  ttdFile: 'TTD Padomasan 02.png' },
] as const;
export type SchoolCode = (typeof OBSERVATION_SCHOOLS)[number]['code'];
export function getSchoolByCode(code: string) {
  return OBSERVATION_SCHOOLS.find((s) => s.code === code) ?? null;
}
export function getTtdUrl(code: string): string {
  const school = getSchoolByCode(code);
  return school ? `/TandaTangan/${school.ttdFile}` : '';
}

// ─── Score types ──────────────────────────────────────────────────────────────
export type ChildScores = [
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
]; // 12 values, 1–4; 0 = unset

export function calculateTotalScore(scores: ChildScores): number {
  return scores.reduce((sum, s) => sum + s, 0);
}
export function calculateAverageScore(scores: ChildScores): number {
  return Math.round((calculateTotalScore(scores) / INDICATOR_COUNT) * 100) / 100;
}
export function areAllScoresFilled(scores: ChildScores): boolean {
  return scores.every((s) => s >= 1 && s <= 4);
}

// ─── Domain types ─────────────────────────────────────────────────────────────
export type ObservationRecord = {
  id: string; sessionId: string; childName: string;
  scores: ChildScores; totalScore: number;
  averageScore: number; category: ObservationCategory;
};
export type ObservationSession = {
  id: string; schoolCode: SchoolCode; themeId: ObservationThemeId;
  sessionDate: string; createdAt: string; records: ObservationRecord[];
};

// ─── Wizard state (client-only) ───────────────────────────────────────────────
export type WizardChild = { name: string; scores: ChildScores };
export type WizardState = {
  themeId: ObservationThemeId | ''; sessionDate: string; children: WizardChild[];
};
export function createEmptyChild(name: string): WizardChild {
  return { name, scores: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] };
}
export function createEmptyWizard(): WizardState {
  return {
    themeId: '',
    sessionDate: new Date().toISOString().slice(0, 10),
    children: [createEmptyChild('')],
  };
}
```

- [ ] **Step 1.4:** Commit

```bash
git add supabase/migrations/20260623_observation_tables.sql src/lib/observation.ts
git commit -m "feat(observasi): add DB migration and TypeScript types/constants"
```

---

## Task 2: Supabase Store & API Routes

**Files:**
- Create: `src/lib/observation-store.ts`
- Create: `src/app/api/observation/sessions/route.ts`
- Create: `src/app/api/observation/sessions/[id]/route.ts`
- Create: `src/app/api/observation/report/route.ts`

- [ ] **Step 2.1:** Create `src/lib/observation-store.ts`:

```typescript
import { getSupabaseServerClient } from './supabase';
import {
  type ObservationCategory, type ObservationRecord, type ObservationSession,
  type ObservationThemeId, type SchoolCode, type ChildScores,
  INDICATOR_COUNT, getCategory,
} from './observation';

type DbSessionRow = {
  id: string; school_code: string; theme_id: string;
  session_date: string; created_at: string;
};
type DbRecordRow = {
  id: string; session_id: string; child_name: string;
  score_1: number; score_2: number; score_3: number; score_4: number;
  score_5: number; score_6: number; score_7: number; score_8: number;
  score_9: number; score_10: number; score_11: number; score_12: number;
  total_score: number; average_score: number; category: string; created_at: string;
};

function mapRecord(row: DbRecordRow): ObservationRecord {
  return {
    id: row.id, sessionId: row.session_id, childName: row.child_name,
    scores: [
      row.score_1, row.score_2, row.score_3, row.score_4,
      row.score_5, row.score_6, row.score_7, row.score_8,
      row.score_9, row.score_10, row.score_11, row.score_12,
    ] as ChildScores,
    totalScore: row.total_score,
    averageScore: Number(row.average_score),
    category: row.category as ObservationCategory,
  };
}
function mapSession(row: DbSessionRow, records: ObservationRecord[]): ObservationSession {
  return {
    id: row.id, schoolCode: row.school_code as SchoolCode,
    themeId: row.theme_id as ObservationThemeId,
    sessionDate: row.session_date, createdAt: row.created_at, records,
  };
}
function requireClient() {
  const client = getSupabaseServerClient();
  if (!client) throw new Error('Supabase belum dikonfigurasi.');
  return client;
}

export async function listObservationSessions(schoolCode: string): Promise<ObservationSession[]> {
  const supabase = requireClient();
  const { data: sessions, error: sessErr } = await supabase
    .from('observation_sessions').select('*')
    .eq('school_code', schoolCode).order('session_date', { ascending: false });
  if (sessErr) throw sessErr;
  if (!sessions || sessions.length === 0) return [];

  const sessionIds = (sessions as DbSessionRow[]).map((s) => s.id);
  const { data: records, error: recErr } = await supabase
    .from('observation_records').select('*')
    .in('session_id', sessionIds).order('created_at', { ascending: true });
  if (recErr) throw recErr;

  const recordsBySession = new Map<string, ObservationRecord[]>();
  for (const row of (records ?? []) as DbRecordRow[]) {
    const mapped = mapRecord(row);
    if (!recordsBySession.has(mapped.sessionId)) recordsBySession.set(mapped.sessionId, []);
    recordsBySession.get(mapped.sessionId)!.push(mapped);
  }
  return (sessions as DbSessionRow[]).map((s) => mapSession(s, recordsBySession.get(s.id) ?? []));
}

export async function getObservationSession(id: string, schoolCode: string): Promise<ObservationSession | null> {
  const supabase = requireClient();
  const { data: session, error } = await supabase
    .from('observation_sessions').select('*')
    .eq('id', id).eq('school_code', schoolCode).single();
  if (error) return null;
  const { data: records, error: recErr } = await supabase
    .from('observation_records').select('*').eq('session_id', id).order('created_at', { ascending: true });
  if (recErr) throw recErr;
  return mapSession(session as DbSessionRow, ((records ?? []) as DbRecordRow[]).map(mapRecord));
}

export type CreateObservationInput = {
  schoolCode: SchoolCode; themeId: ObservationThemeId;
  sessionDate: string; children: { name: string; scores: ChildScores }[];
};

export async function createObservationSession(input: CreateObservationInput): Promise<ObservationSession> {
  const supabase = requireClient();
  for (const child of input.children) {
    if (child.scores.length !== INDICATOR_COUNT) throw new Error(`Semua ${INDICATOR_COUNT} indikator harus diisi untuk ${child.name}.`);
    if (child.scores.some((s) => s < 1 || s > 4)) throw new Error(`Skor harus 1–4 untuk ${child.name}.`);
  }
  const { data: session, error: sessErr } = await supabase
    .from('observation_sessions')
    .insert({ school_code: input.schoolCode, theme_id: input.themeId, session_date: input.sessionDate })
    .select('*').single();
  if (sessErr) throw sessErr;

  const recordsToInsert = input.children.map((child) => {
    const totalScore = child.scores.reduce((sum, s) => sum + s, 0);
    const averageScore = Math.round((totalScore / INDICATOR_COUNT) * 100) / 100;
    return {
      session_id: (session as DbSessionRow).id,
      child_name: child.name.trim(),
      score_1: child.scores[0], score_2: child.scores[1], score_3: child.scores[2], score_4: child.scores[3],
      score_5: child.scores[4], score_6: child.scores[5], score_7: child.scores[6], score_8: child.scores[7],
      score_9: child.scores[8], score_10: child.scores[9], score_11: child.scores[10], score_12: child.scores[11],
      total_score: totalScore, average_score: averageScore, category: getCategory(averageScore),
    };
  });

  const { data: records, error: recErr } = await supabase
    .from('observation_records').insert(recordsToInsert).select('*');
  if (recErr) {
    await supabase.from('observation_sessions').delete().eq('id', (session as DbSessionRow).id);
    throw recErr;
  }
  return mapSession(session as DbSessionRow, ((records ?? []) as DbRecordRow[]).map(mapRecord));
}
```

- [ ] **Step 2.2:** Create `src/app/api/observation/sessions/route.ts`:

```typescript
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createObservationSession, listObservationSessions } from '@/lib/observation-store';
import { OBSERVATION_SCHOOLS, type SchoolCode, type ObservationThemeId, type ChildScores } from '@/lib/observation';

function getSchoolCode(): string | null {
  const val = cookies().get('school_session')?.value ?? null;
  return val && OBSERVATION_SCHOOLS.some((s) => s.code === val) ? val : null;
}

export async function GET() {
  const schoolCode = getSchoolCode();
  if (!schoolCode) return NextResponse.json({ error: 'Sesi sekolah tidak ditemukan.' }, { status: 401 });
  try {
    return NextResponse.json({ sessions: await listObservationSessions(schoolCode) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const schoolCode = getSchoolCode();
  if (!schoolCode) return NextResponse.json({ error: 'Sesi sekolah tidak ditemukan.' }, { status: 401 });
  try {
    const body = await request.json() as { themeId: ObservationThemeId; sessionDate: string; children: { name: string; scores: ChildScores }[] };
    const session = await createObservationSession({ schoolCode: schoolCode as SchoolCode, ...body });
    return NextResponse.json({ session }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 400 });
  }
}
```

- [ ] **Step 2.3:** Create `src/app/api/observation/sessions/[id]/route.ts`:

```typescript
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getObservationSession } from '@/lib/observation-store';
import { OBSERVATION_SCHOOLS, type SchoolCode } from '@/lib/observation';

function getSchoolCode(): string | null {
  const val = cookies().get('school_session')?.value ?? null;
  return val && OBSERVATION_SCHOOLS.some((s) => s.code === val) ? val : null;
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const schoolCode = getSchoolCode();
  if (!schoolCode) return NextResponse.json({ error: 'Sesi tidak ditemukan.' }, { status: 401 });
  const session = await getObservationSession(params.id, schoolCode).catch(() => null);
  if (!session) return NextResponse.json({ error: 'Sesi tidak ditemukan.' }, { status: 404 });
  return NextResponse.json({ session });
}
```

- [ ] **Step 2.4:** Create `src/app/api/observation/report/route.ts`:

```typescript
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getObservationSession } from '@/lib/observation-store';
import {
  OBSERVATION_SCHOOLS, OBSERVATION_THEMES, CATEGORY_RANGES, CATEGORY_LABELS,
  getSchoolByCode, getTtdUrl, type SchoolCode,
} from '@/lib/observation';

function getSchoolCode(): string | null {
  const val = cookies().get('school_session')?.value ?? null;
  return val && OBSERVATION_SCHOOLS.some((s) => s.code === val) ? val : null;
}

export async function GET(request: Request) {
  const schoolCode = getSchoolCode();
  if (!schoolCode) return new NextResponse('Unauthorized', { status: 401 });
  const sessionId = new URL(request.url).searchParams.get('sessionId');
  if (!sessionId) return new NextResponse('sessionId required', { status: 400 });
  const session = await getObservationSession(sessionId, schoolCode).catch(() => null);
  if (!session) return new NextResponse('Not found', { status: 404 });

  const school = getSchoolByCode(schoolCode);
  const theme = OBSERVATION_THEMES.find((t) => t.id === session.themeId);
  const ttdUrl = getTtdUrl(schoolCode);
  const dateStr = new Date(session.sessionDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  const classAvg = session.records.length > 0
    ? (session.records.reduce((s, r) => s + r.averageScore, 0) / session.records.length).toFixed(2) : '0.00';

  const rows = session.records.map((r, i) => `
    <tr><td>${i+1}</td><td>${r.childName}</td><td>${r.totalScore}/48</td>
    <td>${r.averageScore.toFixed(2)}</td><td><strong>${r.category}</strong> — ${CATEGORY_LABELS[r.category]}</td></tr>
  `).join('');

  const html = `<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"/>
<title>Rekap Observasi – ${school?.name ?? schoolCode}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,sans-serif;font-size:12px;padding:24px;color:#0f172a}
h1{font-size:15px;text-align:center;margin-bottom:4px}
.sub{text-align:center;font-size:12px;color:#475569;margin-bottom:16px}
.meta{display:flex;gap:24px;background:#f7fbf6;padding:10px 14px;border-radius:8px;margin-bottom:16px}
.meta label{font-size:10px;color:#64748b;display:block;font-weight:bold;text-transform:uppercase}
.meta span{font-weight:bold}
table{width:100%;border-collapse:collapse;margin-bottom:16px}
th{background:#2f7d68;color:#fff;padding:8px 10px;text-align:left;font-size:11px}
td{padding:8px 10px;border-bottom:1px solid #dbe9de;font-size:11px}
tr:nth-child(even) td{background:#f7fbf6}
.legend{font-size:10px;color:#475569;margin-bottom:20px}
.ttd{margin-top:40px;text-align:right}
.ttd p{margin-bottom:4px;font-size:11px}
.ttd img{max-width:160px;max-height:80px;margin:8px 0;display:block;margin-left:auto}
.name-line{border-top:1px solid #0f172a;padding-top:4px;min-width:200px;display:inline-block;font-size:11px}
@media print{body{padding:12px}@page{size:A4;margin:16mm}}
</style></head><body>
<h1>FORM OBSERVASI PERKEMBANGAN ANAK</h1>
<p class="sub">VFT Experiment Natural Science &amp; Eksperimen STEAM EduGreen</p>
<div class="meta">
  <div><label>Sekolah</label><span>${school?.name ?? schoolCode}</span></div>
  <div><label>Tema</label><span>${theme?.name ?? session.themeId}</span></div>
  <div><label>Tanggal</label><span>${dateStr}</span></div>
  <div><label>Rata-rata Kelas</label><span>${classAvg}</span></div>
</div>
<table>
  <thead><tr><th>No</th><th>Nama Anak</th><th>Total</th><th>Rata-rata</th><th>Kategori</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
<p class="legend"><strong>Keterangan:</strong>
BSB (${CATEGORY_RANGES.BSB})=${CATEGORY_LABELS.BSB} | BSH (${CATEGORY_RANGES.BSH})=${CATEGORY_LABELS.BSH} |
MB (${CATEGORY_RANGES.MB})=${CATEGORY_LABELS.MB} | BB (${CATEGORY_RANGES.BB})=${CATEGORY_LABELS.BB}</p>
<div class="ttd">
  <p>Mengetahui,</p><p>Guru Pendamping,</p>
  ${ttdUrl ? `<img src="${ttdUrl}" alt="Tanda tangan" />` : '<div style="height:80px"></div>'}
  <div><span class="name-line">Nama:&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span></div>
</div>
<script>window.addEventListener('load',()=>window.print());</script>
</body></html>`;

  return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
```

- [ ] **Step 2.5:** Commit

```bash
git add src/lib/observation-store.ts src/app/api/observation/
git commit -m "feat(observasi): add Supabase store and API routes"
```

---

## Task 3: School Auth Cookie

**Files:**
- Create: `src/app/api/auth/school/route.ts`
- Modify: `src/app/select-school/page.tsx`
- Modify: `.env.example`

- [ ] **Step 3.1:** Create `src/app/api/auth/school/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { OBSERVATION_SCHOOLS, type SchoolCode } from '@/lib/observation';

function getAccessCode(code: SchoolCode): string {
  return (process.env[`SCHOOL_CODE_${code}`] as string | undefined) ?? code;
}

export async function POST(request: Request) {
  const { schoolCode, accessCode } = await request.json() as { schoolCode: string; accessCode: string };
  const valid = OBSERVATION_SCHOOLS.map((s) => s.code);
  if (!valid.includes(schoolCode as SchoolCode)) {
    return NextResponse.json({ error: 'Kode sekolah tidak valid.' }, { status: 400 });
  }
  if (accessCode !== getAccessCode(schoolCode as SchoolCode)) {
    return NextResponse.json({ error: 'Kode akses salah.' }, { status: 401 });
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set('school_session', schoolCode, {
    httpOnly: true, sameSite: 'lax', path: '/',
    maxAge: 60 * 60 * 24 * 7,
    secure: process.env.NODE_ENV === 'production',
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete('school_session');
  return response;
}
```

- [ ] **Step 3.2:** In `src/app/select-school/page.tsx`, find the `handleSubmit` (or equivalent) handler where a successful access code triggers navigation to `/`. After the success check and before `router.push('/')`, add:

```typescript
// Fire-and-forget: set the school_session cookie server-side
const selectedSchoolCode = /* the code variable from your existing logic */;
void fetch('/api/auth/school', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ schoolCode: selectedSchoolCode, accessCode: enteredCode }),
});
// Also store in sessionStorage for client-side reads
sessionStorage.setItem('school_code', selectedSchoolCode);
```

Look at the existing code of `select-school/page.tsx` to find the exact variable names.

- [ ] **Step 3.3:** Append to `.env.example`:

```
# Per-school access codes for observation feature API.
# In production, set to strong passwords in Vercel env vars.
SCHOOL_CODE_01=
SCHOOL_CODE_02=
SCHOOL_CODE_15=
SCHOOL_CODE_59=
SCHOOL_CODE_69=
```

- [ ] **Step 3.4:** Commit

```bash
git add src/app/api/auth/school/route.ts src/app/select-school/page.tsx .env.example
git commit -m "feat(observasi): add school session cookie auth"
```

---

## Task 4: Dashboard Card + Nav Tab Extension

**File:**
- Modify: `src/app/page.tsx`

- [ ] **Step 4.1:** Add import at top of `src/app/page.tsx` (with other lib imports):

```typescript
import {
  OBSERVATION_THEMES,
  OBSERVATION_INDICATORS,
  CATEGORY_LABELS,
  createEmptyWizard,
  createEmptyChild,
  getCategory,
  areAllScoresFilled,
  calculateAverageScore,
  type WizardState,
  type ObservationSession,
  type ChildScores,
  type ObservationThemeId,
} from "@/lib/observation";
import {
  fetchObservationSessions,
  saveObservationSession,
  openObservationReport,
} from "@/lib/api-client";
```

- [ ] **Step 4.2:** Add to `src/lib/api-client.ts` at the bottom:

```typescript
import type { ObservationSession, ObservationThemeId, ChildScores } from './observation';

export async function fetchObservationSessions(): Promise<ObservationSession[]> {
  const res = await fetch('/api/observation/sessions', { cache: 'no-store' });
  if (!res.ok) throw new Error('Gagal memuat sesi observasi.');
  return ((await res.json()) as { sessions: ObservationSession[] }).sessions;
}

export async function saveObservationSession(input: {
  themeId: ObservationThemeId;
  sessionDate: string;
  children: { name: string; scores: ChildScores }[];
}): Promise<ObservationSession> {
  const res = await fetch('/api/observation/sessions', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error('Gagal menyimpan sesi observasi.');
  return ((await res.json()) as { session: ObservationSession }).session;
}

export function openObservationReport(sessionId: string): void {
  window.open(`/api/observation/report?sessionId=${sessionId}`, '_blank', 'noopener,noreferrer');
}
```

- [ ] **Step 4.3:** In `src/app/page.tsx`, change:

```typescript
type AppTab = "dashboard" | "zones";
```
to:
```typescript
type AppTab = "dashboard" | "zones" | "observasi";
```

- [ ] **Step 4.4:** Update the `TabButton` component to accept an optional `badge` prop and render an orange badge:

```typescript
function TabButton({
  active, label, onClick, badge,
}: { active: boolean; label: string; onClick: () => void; badge?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative min-h-11 flex-1 rounded-full text-sm font-black transition ${
        active ? "bg-[#2f7d68] text-white" : "text-slate-600 hover:bg-[#f7fbf6]"
      }`}
    >
      {label}
      {badge ? (
        <span className="absolute right-2 top-1.5 rounded-full bg-orange-500 px-1.5 py-0.5 text-[8px] font-black text-white leading-none">
          {badge}
        </span>
      ) : null}
    </button>
  );
}
```

- [ ] **Step 4.5:** In `Home`'s return, add the 3rd tab button after the "Zona" button:

```tsx
<TabButton
  active={activeTab === "observasi"}
  label="Observasi"
  onClick={() => setActiveTab("observasi")}
  badge="BARU"
/>
```

- [ ] **Step 4.6:** Add `schoolCode` state to `Home`:

```typescript
const [schoolCode] = useState<string>(() =>
  typeof window !== 'undefined' ? sessionStorage.getItem('school_code') ?? '' : ''
);
```

- [ ] **Step 4.7:** Add `onStartObservasi` handler to `Home`:

```typescript
function openObservasi() { setActiveTab('observasi'); }
```

- [ ] **Step 4.8:** In `Home`'s render, change the tab rendering from:

```tsx
{activeTab === "dashboard" ? <DashboardView .../> : <ZonesView .../>}
```
to:
```tsx
{activeTab === "dashboard" ? (
  <DashboardView ... onStartObservasi={openObservasi} />
) : activeTab === "zones" ? (
  <ZonesView .../>
) : (
  <ObservasiView schoolCode={schoolCode} />
)}
```

- [ ] **Step 4.9:** Add `ObservasiDashboardCard` component:

```typescript
function ObservasiDashboardCard({ onStartObservasi }: { onStartObservasi: () => void }) {
  return (
    <div
      onClick={onStartObservasi}
      className="relative cursor-pointer overflow-hidden rounded-3xl border border-[#c5e8d0] p-5 shadow-[var(--shadow-card)] transition hover:-translate-y-1 hover:shadow-lg"
      style={{ background: 'linear-gradient(135deg, #edf7f4 0%, #f1f0ff 100%)' }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="mb-2 text-3xl">🔬</div>
          <h2 className="text-lg font-black text-slate-950">Form Observasi Eksperimen</h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
            Isi penilaian perkembangan anak untuk kegiatan VFT &amp; STEAM EduGreen.
            Skor dihitung otomatis dan rekap kelas bisa langsung dicetak.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {OBSERVATION_THEMES.map((t) => (
              <span key={t.id} className="rounded-full border border-[#dbe9de] bg-white px-3 py-1 text-xs font-bold text-[#2f7d68]">
                {t.emoji} {t.name.replace('Eksperimen ', '')}
              </span>
            ))}
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-[#f1f0ff] px-3 py-1 text-xs font-black text-[#514ba5]">5 Tema</span>
      </div>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onStartObservasi(); }}
        className="mt-4 rounded-full bg-[#2f7d68] px-5 py-2.5 text-sm font-black text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#276c59] active:translate-y-0"
      >
        Mulai Observasi →
      </button>
    </div>
  );
}
```

- [ ] **Step 4.10:** In `DashboardView`, add `onStartObservasi` to props and insert `<ObservasiDashboardCard>` between the metric grid and zone progress section.

- [ ] **Step 4.11:** Commit

```bash
git add src/app/page.tsx src/lib/api-client.ts
git commit -m "feat(observasi): add dashboard card and Observasi nav tab"
```

---

## Task 5: ObservasiView Wizard UI

**File:**
- Modify: `src/app/page.tsx` (add ObservasiView + ObsStepIndicator components)

- [ ] **Step 5.1:** Add `ObsStepIndicator` helper component to `page.tsx`:

```typescript
function ObsStepIndicator({ current }: { current: 1 | 2 | 3 }) {
  const steps = ['Setup Sesi', 'Isi Skor', 'Rekap & Cetak'];
  return (
    <div className="flex items-center">
      {steps.map((label, i) => {
        const num = i + 1;
        const done = current > num;
        const active = current === num;
        return (
          <React.Fragment key={i}>
            <div className="flex flex-col items-center">
              <div className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-black ${
                done ? 'border-[#2f7d68] bg-[#2f7d68] text-white'
                : active ? 'border-[#2f7d68] bg-[#edf7f1] text-[#2f7d68]'
                : 'border-slate-200 bg-white text-slate-400'
              }`}>{done ? '✓' : num}</div>
              <p className={`mt-1 text-[10px] font-bold ${active || done ? 'text-[#2f7d68]' : 'text-slate-400'}`}>{label}</p>
            </div>
            {i < 2 && <div className={`mb-5 h-0.5 flex-1 mx-1 ${done ? 'bg-[#2f7d68]' : 'bg-slate-200'}`} />}
          </React.Fragment>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 5.2:** Add `ObservasiView` component to `page.tsx`. This component manages the 3-step wizard with its own local state. See the full component code in the design spec or mockup — the implementation follows this structure:

```typescript
type ObservasiStep = 'list' | 'step1' | 'step2' | 'step3';

function ObservasiView({ schoolCode }: { schoolCode: string }) {
  const [step, setStep] = useState<ObservasiStep>('list');
  const [wizard, setWizard] = useState(createEmptyWizard());
  const [activeChildIndex, setActiveChildIndex] = useState(0);
  const [sessions, setSessions] = useState<ObservationSession[]>([]);
  const [savedSession, setSavedSession] = useState<ObservationSession | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchObservationSessions().then(setSessions).catch(() => setSessions([])).finally(() => setIsLoading(false));
  }, []);

  // Step 1: Theme + date + child name input
  // Step 2: Per-child score entry with 12 indicator buttons
  // Step 3: Rekap table + print button

  // [Full implementation follows the patterns shown in the mockup and design spec]
  // Key logic:
  // - goToStep2(): validate themeId set + at least 1 non-empty child name
  // - goToStep3(): validate areAllScoresFilled for every child, then call saveObservationSession()
  // - setChildScore(childIdx, indicatorIdx, score): update wizard.children[childIdx].scores[indicatorIdx]
  // - openObservationReport(savedSession.id): open /api/observation/report in new tab
}
```

Implement the full JSX for each `ObservasiStep` variant, matching the mockup exactly. The JSX patterns follow the existing Tailwind classes in `page.tsx` (`rounded-3xl`, `border-[#dbe9de]`, `bg-[#2f7d68]`, `font-black`, etc.).

- [ ] **Step 5.3:** Verify TypeScript build: `pnpm build 2>&1 | head -60`. Expected: 0 errors.

- [ ] **Step 5.4:** Commit

```bash
git add src/app/page.tsx
git commit -m "feat(observasi): add 3-step wizard UI ObservasiView"
```

---

## Task 6: End-to-End Verification

- [ ] **Step 6.1:** `pnpm dev` — confirm dev server starts without errors

- [ ] **Step 6.2:** Log in at `/select-school` with school code `01`

- [ ] **Step 6.3:** Verify dashboard shows 🔬 Observasi feature card between metrics and zone progress

- [ ] **Step 6.4:** Verify bottom nav has 3 tabs: Dasbor · Zona · Observasi (with "BARU" badge)

- [ ] **Step 6.5:** Click card → verify opens Step 1, nav tab "Observasi" becomes active

- [ ] **Step 6.6:** Fill Step 1 (select theme, date, add 2 names) → click "Lanjut Isi Skor →"

- [ ] **Step 6.7:** Score all 12 indicators for both children → verify live average updates

- [ ] **Step 6.8:** Click "Simpan & Lihat Rekap →" on last child → verify rekap table appears

- [ ] **Step 6.9:** Click "🖨️ Cetak / Unduh PDF" → verify print dialog opens with school name + TTD image

- [ ] **Step 6.10:** Click "Observasi" tab → verify saved session in session list

- [ ] **Step 6.11:** Log in as school `02` → verify session from school `01` is NOT visible

- [ ] **Step 6.12:** Final commit

```bash
git add .
git commit -m "feat(observasi): complete end-to-end verification"
```

---

## File Map

```
NEW FILES:
  supabase/migrations/20260623_observation_tables.sql
  src/lib/observation.ts
  src/lib/observation-store.ts
  src/app/api/observation/sessions/route.ts
  src/app/api/observation/sessions/[id]/route.ts
  src/app/api/observation/report/route.ts
  src/app/api/auth/school/route.ts

MODIFIED FILES:
  src/app/page.tsx               (AppTab + 3rd nav + ObservasiDashboardCard + ObservasiView)
  src/app/select-school/page.tsx (call /api/auth/school + sessionStorage.setItem)
  src/lib/api-client.ts          (fetchObservationSessions, saveObservationSession, openObservationReport)
  .env.example                   (SCHOOL_CODE_XX env vars)
```
