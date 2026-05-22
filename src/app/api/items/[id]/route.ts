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

  return NextResponse.json(
    {
      error: "INVENTORY_REQUEST_FAILED",
      message:
        error instanceof Error ? error.message : "Inventory request failed.",
    },
    { status: 500 },
  );
}
