import { NextResponse } from "next/server";

import { CONDITION_LOGS, INVENTORY_ITEMS, INVENTORY_ZONES } from "@/lib/inventory";
import {
  createInventoryItem,
  listInventory,
  SupabaseConfigurationError,
} from "@/lib/inventory-store";

export async function GET() {
  try {
    const payload = await listInventory();
    return NextResponse.json(payload);
  } catch (error) {
    return handleInventoryError(error);
  }
}

export async function POST(request: Request) {
  try {
    const item = await createInventoryItem(await request.json());
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    return handleInventoryError(error);
  }
}

function handleInventoryError(error: unknown) {
  if (error instanceof SupabaseConfigurationError) {
    return NextResponse.json(
      {
        items: INVENTORY_ITEMS,
        conditionLogs: CONDITION_LOGS,
        zones: INVENTORY_ZONES,
        source: "seed",
        message: `${error.message} Menggunakan data contoh lokal.`,
      },
      { status: 200 },
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
        error instanceof Error ? error.message : "Permintaan inventaris gagal.",
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
