import { NextResponse } from "next/server";

import { getSupabaseServerClient } from "@/lib/supabase";

const HARDCODED_SCHOOLS = [
  { id: "school-1", name: "TK Dewi Masyithoh 69 Keting" },
  { id: "school-2", name: "TK Dewi Masyithoh 59 Jombang" },
  { id: "school-3", name: "TK DARUTTAQWA Jombang" },
  { id: "school-4", name: "TK Dewi Masyithoh 15 Keting" },
  { id: "school-5", name: "TK Dharma Wanita 02 Padomasan" },
];

const ADMIN_ENTRY = { id: "admin", name: "Admin" };

export async function GET() {
  const supabase = getSupabaseServerClient();

  if (!supabase) {
    return NextResponse.json({ schools: [...HARDCODED_SCHOOLS, ADMIN_ENTRY] });
  }

  const { data, error } = await supabase
    .from("schools")
    .select("id, name")
    .order("name");

  if (error) {
    return NextResponse.json({ schools: [...HARDCODED_SCHOOLS, ADMIN_ENTRY] });
  }

  return NextResponse.json({ schools: [...(data ?? HARDCODED_SCHOOLS), ADMIN_ENTRY] });
}

export async function POST(request: Request) {
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
    .insert({ name, access_code: accessCode })
    .select("id, name")
    .single();

  if (error) {
    return NextResponse.json(
      { error: error.message ?? "Gagal menambahkan sekolah." },
      { status: 500 },
    );
  }

  return NextResponse.json({ school: data }, { status: 201 });
}
