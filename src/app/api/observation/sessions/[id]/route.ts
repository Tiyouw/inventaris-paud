import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getObservationSession } from '@/lib/observation-store';
import { OBSERVATION_SCHOOLS, type SchoolCode } from '@/lib/observation';

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function getSchoolCode(): Promise<string | null> {
  const cookieStore = await cookies();
  const val = cookieStore.get('school_session')?.value ?? null;
  return val && OBSERVATION_SCHOOLS.some((s) => s.code === val) ? val : null;
}

export async function GET(_req: Request, context: RouteContext) {
  const schoolCode = await getSchoolCode();
  if (!schoolCode) return NextResponse.json({ error: 'Sesi tidak ditemukan.' }, { status: 401 });
  const { id } = await context.params;
  const session = await getObservationSession(id, schoolCode).catch(() => null);
  if (!session) return NextResponse.json({ error: 'Sesi tidak ditemukan.' }, { status: 404 });
  return NextResponse.json({ session });
}
