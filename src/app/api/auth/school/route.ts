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
