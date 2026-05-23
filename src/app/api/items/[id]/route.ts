import { NextResponse } from "next/server";

import {
  softDeleteInventoryItem,
  SupabaseConfigurationError,
  updateInventoryItem,
} from "@/lib/inventory-store";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PUT(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const item = await updateInventoryItem(id, await request.json());

    return NextResponse.json({ item });
  } catch (error) {
    return handleInventoryError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    await softDeleteInventoryItem(id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleInventoryError(error);
  }
}

function handleInventoryError(error: unknown) {
  if (error instanceof SupabaseConfigurationError) {
    return NextResponse.json(
      {
        error: "SUPABASE_NOT_CONFIGURED",
        message: error.message,
      },
      { status: 503 },
    );
  }

  if (isUniqueAssetTagError(error)) {
    return NextResponse.json(
      {
        error: "DUPLICATE_ASSET_TAG",
        message: "Kode barang sudah digunakan. Pakai kode lain agar inventaris tetap unik.",
      },
      { status: 409 },
    );
  }

  if (isValidationError(error)) {
    return NextResponse.json(
      {
        error: "INVALID_INVENTORY_ITEM",
        message: error.message,
      },
      { status: 400 },
    );
  }

  return NextResponse.json(
    {
      error: "INVENTORY_REQUEST_FAILED",
      message:
        error instanceof Error ? error.message : "Inventory request failed.",
    },
    { status: 500 },
  );
}

function isUniqueAssetTagError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  );
}

function isValidationError(error: unknown): error is Error {
  return error instanceof Error && error.name === "InventoryValidationError";
}
