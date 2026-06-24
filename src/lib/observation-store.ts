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
  let query = supabase.from('observation_sessions').select('*').order('session_date', { ascending: false });

  if (schoolCode !== 'admin') {
    query = query.eq('school_code', schoolCode);
  }

  const { data: sessions, error: sessErr } = await query;
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

export async function deleteObservationSession(id: string, schoolCode: string): Promise<void> {
  const supabase = requireClient();
  const { error } = await supabase
    .from('observation_sessions')
    .delete()
    .eq('id', id)
    .eq('school_code', schoolCode);

  if (error) {
    throw error;
  }
}

export async function updateObservationSession(
  id: string,
  input: CreateObservationInput
): Promise<ObservationSession> {
  const supabase = requireClient();
  for (const child of input.children) {
    if (child.scores.length !== INDICATOR_COUNT) throw new Error(`Semua ${INDICATOR_COUNT} indikator harus diisi untuk ${child.name}.`);
    if (child.scores.some((s) => s < 1 || s > 4)) throw new Error(`Skor harus 1–4 untuk ${child.name}.`);
  }

  const { data: session, error: sessErr } = await supabase
    .from('observation_sessions')
    .update({ theme_id: input.themeId, session_date: input.sessionDate })
    .eq('id', id)
    .eq('school_code', input.schoolCode)
    .select('*').single();
  if (sessErr) throw sessErr;
  if (!session) throw new Error("Sesi observasi tidak ditemukan");

  const { error: delErr } = await supabase
    .from('observation_records')
    .delete()
    .eq('session_id', id);
  if (delErr) throw delErr;

  const recordsToInsert = input.children.map((child) => {
    const totalScore = child.scores.reduce((sum, s) => sum + s, 0);
    const averageScore = Math.round((totalScore / INDICATOR_COUNT) * 100) / 100;
    return {
      session_id: id,
      child_name: child.name.trim(),
      score_1: child.scores[0], score_2: child.scores[1], score_3: child.scores[2], score_4: child.scores[3],
      score_5: child.scores[4], score_6: child.scores[5], score_7: child.scores[6], score_8: child.scores[7],
      score_9: child.scores[8], score_10: child.scores[9], score_11: child.scores[10], score_12: child.scores[11],
      total_score: totalScore, average_score: averageScore, category: getCategory(averageScore),
    };
  });

  const { data: records, error: recErr } = await supabase
    .from('observation_records')
    .insert(recordsToInsert)
    .select('*');
  if (recErr) throw recErr;

  return mapSession(session as DbSessionRow, ((records ?? []) as DbRecordRow[]).map(mapRecord));
}
