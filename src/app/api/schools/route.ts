import { NextResponse } from "next/server";

import { getSupabaseServerClient } from "@/lib/supabase";

const HARDCODED_SCHOOLS = [
  { id: "school-1", name: "TK Dewi Masyithoh 69 Keting" },
  { id: "school-2", name: "TK Dewi Masyithoh 59 Jombang" },
  { id: "school-3", name: "TK DARUTTAQWA Jombang" },
  { id: "school-4", name: "TK Dewi Masyithoh 15 Keting" },
  { id: "school-5", name: "TK Dharma Wanita 02 Padomasan" },
];

export async function GET() {
  const supabase = getSupabaseServerClient();

  if (!supabase) {
    return NextResponse.json({ schools: HARDCODED_SCHOOLS });
  }

  const { data, error } = await supabase
    .from("schools")
    .select("id, name")
    .order("name");

  if (error) {
    return NextResponse.json({ schools: HARDCODED_SCHOOLS });
  }

  return NextResponse.json({ schools: data ?? HARDCODED_SCHOOLS });
}
