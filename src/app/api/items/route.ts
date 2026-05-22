import { NextResponse } from "next/server";

import { CONDITION_LOGS, INVENTORY_ITEMS } from "@/lib/inventory";
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
        source: "seed",
        message: `${error.message} Using local seed data instead.`,
      },
      { status: 200 },
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
