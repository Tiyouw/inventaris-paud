import { NextRequest, NextResponse } from "next/server";

import { getSupabaseServerClient } from "@/lib/supabase";

const HARDCODED_SCHOOLS = [
  { id: "school-1", name: "TK Dewi Masyithoh 69 Keting", access_code: "69" },
  { id: "school-2", name: "TK Dewi Masyithoh 59 Jombang", access_code: "59" },
  { id: "school-3", name: "TK DARUTTAQWA Jombang", access_code: "01" },
  { id: "school-4", name: "TK Dewi Masyithoh 15 Keting", access_code: "15" },
  { id: "school-5", name: "TK Dharma Wanita 02 Padomasan", access_code: "02" },
];

const ADMIN_ENTRY = { id: "admin", name: "Admin" };

export async function GET(request: NextRequest) {
  const includeCodes = request.nextUrl.searchParams.get("include_codes") === "true";
  const supabase = getSupabaseServerClient();

  if (!supabase) {
    const schools = HARDCODED_SCHOOLS.map((s) =>
      includeCodes ? s : { id: s.id, name: s.name },
    );
    return NextResponse.json({ schools: [...schools, ADMIN_ENTRY] });
  }

  const selectFields = includeCodes ? "id, name, access_code" : "id, name";
  const { data, error } = await supabase
    .from("schools")
    .select(selectFields)
    .order("name");

  if (error) {
    const schools = HARDCODED_SCHOOLS.map((s) =>
      includeCodes ? s : { id: s.id, name: s.name },
    );
    return NextResponse.json({ schools: [...schools, ADMIN_ENTRY] });
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
