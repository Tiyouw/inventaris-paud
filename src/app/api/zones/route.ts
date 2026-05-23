import { NextResponse } from "next/server";

import {
  createInventoryZone,
  InventoryValidationError,
  SupabaseConfigurationError,
} from "@/lib/inventory-store";

export async function POST(request: Request) {
  try {
    const zone = await createInventoryZone(await request.json());
    return NextResponse.json({ zone }, { status: 201 });
  } catch (error) {
    return handleZoneError(error);
  }
}

function handleZoneError(error: unknown) {
  if (error instanceof SupabaseConfigurationError) {
    return NextResponse.json(
      {
        error: "SUPABASE_NOT_CONFIGURED",
        message: error.message,
      },
      { status: 503 },
    );
  }

  if (error instanceof InventoryValidationError) {
    return NextResponse.json(
      {
        error: "INVALID_INVENTORY_ZONE",
        message: error.message,
      },
      { status: 400 },
    );
  }

  if (isUniqueSlugError(error)) {
    return NextResponse.json(
      {
        error: "DUPLICATE_ZONE",
        message: "Nama zona sudah digunakan. Pakai nama zona lain.",
      },
      { status: 409 },
    );
  }

  return NextResponse.json(
    {
      error: "ZONE_REQUEST_FAILED",
      message: error instanceof Error ? error.message : "Permintaan zona gagal.",
    },
    { status: 500 },
  );
}

function isUniqueSlugError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  );
}
