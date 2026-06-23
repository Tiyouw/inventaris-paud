import { NextResponse } from 'next/server';
import { getObservationSession } from '@/lib/observation-store';
import { getSchoolCodeFromCookie } from '@/lib/observation';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_req: Request, context: RouteContext) {
  const schoolCode = await getSchoolCodeFromCookie();
  if (!schoolCode) {
    return NextResponse.json({ error: 'Sesi sekolah tidak ditemukan.' }, { status: 401 });
  }
  const { id } = await context.params;
  const session = await getObservationSession(id, schoolCode);
  if (!session) {
    return NextResponse.json({ error: 'Sesi observasi tidak ditemukan.' }, { status: 404 });
  }
  return NextResponse.json({ session });
}
