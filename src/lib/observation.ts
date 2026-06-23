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
// Scores are indexed positionally matching OBSERVATION_INDICATORS:
//   score_1 = OBSERVATION_INDICATORS[0], score_2 = INDICATORS[1], ...
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
  /** YYYY-MM-DD string — maps to SQL column session_date (date, no time component) */
  sessionDate: string; createdAt: string; records: ObservationRecord[];
};

// ─── Shared auth helpers (server-side) ────────────────────────────────────────
import { cookies } from 'next/headers';

export async function getSchoolCodeFromCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  const val = cookieStore.get('school_session')?.value ?? null;
  return val && OBSERVATION_SCHOOLS.some((s) => s.code === val) ? val : null;
}

// ─── HTML escaping ────────────────────────────────────────────────────────────
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

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
