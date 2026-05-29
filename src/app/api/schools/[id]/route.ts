import { NextRequest, NextResponse } from "next/server";

import { getSupabaseServerClient } from "@/lib/supabase";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = getSupabaseServerClient();

  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase belum dikonfigurasi." },
      { status: 503 },
    );
  }

  const body = (await request.json()) as { name?: string; access_code?: string };
  const name = body.name?.trim();
  const accessCode = body.access_code?.trim();

  if (!name) {
    return NextResponse.json(
      { error: "Nama sekolah wajib diisi." },
      { status: 400 },
    );
  }

  if (!accessCode) {
    return NextResponse.json(
      { error: "Kode akses wajib diisi." },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("schools")
    .update({ name, access_code: accessCode })
    .eq("id", id)
    .select("id, name, access_code")
    .single();

  if (error) {
    return NextResponse.json(
      { error: error.message ?? "Gagal memperbarui sekolah." },
      { status: 500 },
    );
  }

  return NextResponse.json({ school: data });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = getSupabaseServerClient();

  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase belum dikonfigurasi." },
      { status: 503 },
    );
  }

  const { error } = await supabase.from("schools").delete().eq("id", id);

  if (error) {
    return NextResponse.json(
      { error: error.message ?? "Gagal menghapus sekolah." },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}
