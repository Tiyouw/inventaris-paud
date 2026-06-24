import { NextResponse } from 'next/server';
import { getObservationSession, deleteObservationSession, updateObservationSession } from '@/lib/observation-store';
import { getSchoolCodeFromCookie } from '@/lib/observation-server';

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

export async function DELETE(_req: Request, context: RouteContext) {
  try {
    const schoolCode = await getSchoolCodeFromCookie();
    if (!schoolCode) {
      return NextResponse.json(
        { error: "Tidak ada sesi sekolah. Silakan login ulang." },
        { status: 401 },
      );
    }

    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ error: "ID sesi tidak valid" }, { status: 400 });
    }

    await deleteObservationSession(id, schoolCode);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting observation session:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Gagal menghapus sesi observasi",
      },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const schoolCode = await getSchoolCodeFromCookie();
    if (!schoolCode) {
      return NextResponse.json(
        { error: "Tidak ada sesi sekolah. Silakan login ulang." },
        { status: 401 },
      );
    }

    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ error: "ID sesi tidak valid" }, { status: 400 });
    }

    const input = await request.json();
    const session = await updateObservationSession(id, {
      ...input,
      schoolCode,
    });

    return NextResponse.json({ session });
  } catch (error) {
    console.error("Error updating observation session:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Gagal memperbarui sesi observasi",
      },
      { status: 500 },
    );
  }
}
