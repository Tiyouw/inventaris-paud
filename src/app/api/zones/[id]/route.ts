import { NextResponse } from "next/server";

import {
  deleteInventoryZone,
  InventoryValidationError,
  SupabaseConfigurationError,
  updateInventoryZone,
} from "@/lib/inventory-store";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PUT(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const zone = await updateInventoryZone(id, await request.json());

    return NextResponse.json({ zone });
  } catch (error) {
    return handleZoneError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    await deleteInventoryZone(id);

    return NextResponse.json({ ok: true });
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

  if (isRestrictDeleteError(error)) {
    return NextResponse.json(
      {
        error: "ZONE_HAS_ITEMS",
        message:
          "Zona masih memiliki riwayat barang, jadi belum bisa dihapus dari database.",
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

function isRestrictDeleteError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23503"
  );
}
