import { NextResponse } from "next/server";

import {
  getMissingSupabaseConfigMessage,
  getSupabaseServerClient,
  getSupabaseServerConfig,
} from "@/lib/supabase";

export async function GET() {
  const config = getSupabaseServerConfig();

  if (!config) {
    return NextResponse.json(
      {
        ok: false,
        supabaseConfigured: false,
        message: getMissingSupabaseConfigMessage(),
      },
      { status: 503 },
    );
  }

  const supabase = getSupabaseServerClient();

  if (!supabase) {
    return NextResponse.json(
      {
        ok: false,
        supabaseConfigured: false,
        message: getMissingSupabaseConfigMessage(),
      },
      { status: 503 },
    );
  }

  const { count, error } = await supabase
    .from("zones")
    .select("id", { count: "exact", head: true });

  if (error) {
    return NextResponse.json(
      {
        ok: false,
        supabaseConfigured: true,
        storageBucket: config.storageBucket,
        message: error.message,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    supabaseConfigured: true,
    storageBucket: config.storageBucket,
    zoneCount: count ?? 0,
  });
}
