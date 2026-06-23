import { NextResponse } from 'next/server';
import { createObservationSession, listObservationSessions } from '@/lib/observation-store';
import { getSchoolCodeFromCookie, type SchoolCode, type ObservationThemeId, type ChildScores } from '@/lib/observation';

export async function GET() {
  const schoolCode = await getSchoolCodeFromCookie();
  if (!schoolCode) {
    return NextResponse.json({ error: 'Sesi sekolah tidak ditemukan.' }, { status: 401 });
  }
  try {
    return NextResponse.json({ sessions: await listObservationSessions(schoolCode) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Gagal memuat sesi observasi.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const schoolCode = await getSchoolCodeFromCookie();
  if (!schoolCode) {
    return NextResponse.json({ error: 'Sesi sekolah tidak ditemukan.' }, { status: 401 });
  }
  try {
    const body = await request.json() as { themeId: ObservationThemeId; sessionDate: string; children: { name: string; scores: ChildScores }[] };
    const session = await createObservationSession({ schoolCode: schoolCode as SchoolCode, ...body });
    return NextResponse.json({ session }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Gagal menyimpan sesi observasi.';
    // Database errors (connection, constraint) = 500; validation errors = 400
    const status =
      e instanceof Error && (e.message.includes('indikator') || e.message.includes('Skor'))
        ? 400
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
