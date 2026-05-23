import { NextResponse } from "next/server";

import {
  INVENTORY_ITEMS,
  INVENTORY_ZONES,
  type InventoryItem,
  type InventoryZone,
  type InventoryZoneId,
} from "@/lib/inventory";
import {
  SupabaseConfigurationError,
  listInventory,
} from "@/lib/inventory-store";
import {
  createInventoryReport,
  createInventoryReportHtml,
} from "@/lib/reporting";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const zoneId = url.searchParams.get("zoneId") as InventoryZoneId | null;

  try {
    const payload = await listInventory();
    const items = filterItems(payload.items, zoneId);
    const report = createInventoryReport(items, {
      title: createReportTitle(zoneId, payload.zones),
      zones: payload.zones,
    });

    return createHtmlResponse(createInventoryReportHtml(report));
  } catch (error) {
    if (error instanceof SupabaseConfigurationError) {
      const items = filterItems(INVENTORY_ITEMS, zoneId);
      const report = createInventoryReport(items, {
        title: createReportTitle(zoneId, INVENTORY_ZONES),
        zones: INVENTORY_ZONES,
      });

      return createHtmlResponse(createInventoryReportHtml(report));
    }

    return NextResponse.json(
      {
        error: "REPORT_FAILED",
        message:
          error instanceof Error ? error.message : "Pembuatan laporan gagal.",
      },
      { status: 500 },
    );
  }
}

function filterItems(
  items: InventoryItem[],
  zoneId: InventoryZoneId | null,
) {
  const activeItems = items.filter((item) => item.isActive);

  return zoneId
    ? activeItems.filter((item) => item.zoneId === zoneId)
    : activeItems;
}

function createReportTitle(
  zoneId: InventoryZoneId | null,
  zones: InventoryZone[],
): string {
  const zone = zoneId ? zones.find((entry) => entry.id === zoneId) : null;

  return zoneId
    ? `Laporan Inventaris Zona ${zone?.name ?? zoneId}`
    : "Laporan Inventaris Makerspace";
}

function createHtmlResponse(html: string): Response {
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
