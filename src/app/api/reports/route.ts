import { NextResponse } from "next/server";

import {
  INVENTORY_ITEMS,
  getZoneById,
  type InventoryItem,
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
      title: createReportTitle(zoneId),
    });

    return createHtmlResponse(createInventoryReportHtml(report));
  } catch (error) {
    if (error instanceof SupabaseConfigurationError) {
      const items = filterItems(INVENTORY_ITEMS, zoneId);
      const report = createInventoryReport(items, {
        title: createReportTitle(zoneId),
      });

      return createHtmlResponse(createInventoryReportHtml(report));
    }

    return NextResponse.json(
      {
        error: "REPORT_FAILED",
        message:
          error instanceof Error ? error.message : "Report generation failed.",
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

function createReportTitle(zoneId: InventoryZoneId | null): string {
  return zoneId
    ? `Laporan Inventaris Zona ${getZoneById(zoneId).name}`
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
