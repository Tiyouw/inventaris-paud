import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createObservationSession, listObservationSessions } from '@/lib/observation-store';
import { OBSERVATION_SCHOOLS, type SchoolCode, type ObservationThemeId, type ChildScores } from '@/lib/observation';

async function getSchoolCode(): Promise<string | null> {
  const cookieStore = await cookies();
  const val = cookieStore.get('school_session')?.value ?? null;
  return val && OBSERVATION_SCHOOLS.some((s) => s.code === val) ? val : null;
}

export async function GET() {
  const schoolCode = await getSchoolCode();
  if (!schoolCode) return NextResponse.json({ error: 'Sesi sekolah tidak ditemukan.' }, { status: 401 });
  try {
    return NextResponse.json({ sessions: await listObservationSessions(schoolCode) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const schoolCode = await getSchoolCode();
  if (!schoolCode) return NextResponse.json({ error: 'Sesi sekolah tidak ditemukan.' }, { status: 401 });
  try {
    const body = await request.json() as { themeId: ObservationThemeId; sessionDate: string; children: { name: string; scores: ChildScores }[] };
    const session = await createObservationSession({ schoolCode: schoolCode as SchoolCode, ...body });
    return NextResponse.json({ session }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 400 });
  }
}
