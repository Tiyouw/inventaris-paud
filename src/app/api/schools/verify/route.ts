import { NextResponse } from "next/server";

import { getSupabaseServerClient } from "@/lib/supabase";

const HARDCODED_SCHOOLS = [
  { id: "school-1", name: "TK Dewi Masyithoh 69 Keting", accessCode: "69" },
  { id: "school-2", name: "TK Dewi Masyithoh 59 Jombang", accessCode: "59" },
  { id: "school-3", name: "TK DARUTTAQWA Jombang", accessCode: "01" },
  { id: "school-4", name: "TK Dewi Masyithoh 15 Keting", accessCode: "15" },
  { id: "school-5", name: "TK Dharma Wanita 02 Padomasan", accessCode: "02" },
];

export async function POST(request: Request) {
  const body = (await request.json()) as { schoolId?: string; accessCode?: string };
  const { schoolId, accessCode } = body;

  if (!schoolId || !accessCode) {
    return NextResponse.json(
      { valid: false, message: "Kode akses salah" },
      { status: 400 },
    );
  }

  // Admin access shortcut
  if (schoolId === "admin" && accessCode === "admin") {
    return NextResponse.json({
      valid: true,
      school: { id: "admin", name: "Admin" },
    });
  }

  const supabase = getSupabaseServerClient();

  if (!supabase) {
    const school = HARDCODED_SCHOOLS.find(
      (s) => s.id === schoolId && s.accessCode === accessCode,
    );

    if (school) {
      return NextResponse.json({
        valid: true,
        school: { id: school.id, name: school.name },
      });
    }

    return NextResponse.json(
      { valid: false, message: "Kode akses salah" },
      { status: 401 },
    );
  }

  const { data, error } = await supabase
    .from("schools")
    .select("id, name")
    .eq("id", schoolId)
    .eq("access_code", accessCode)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json(
      { valid: false, message: "Kode akses salah" },
      { status: 401 },
    );
  }

  return NextResponse.json({
    valid: true,
    school: { id: data.id, name: data.name },
  });
}
