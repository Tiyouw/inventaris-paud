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
import { getSupabaseServerClient } from "@/lib/supabase";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const zoneId = url.searchParams.get("zoneId") as InventoryZoneId | null;
  const schoolId = url.searchParams.get("school_id") ?? undefined;

  try {
    const payload = await listInventory(schoolId);
    const items = filterItems(payload.items, zoneId);
    const schoolName = schoolId ? await getSchoolName(schoolId) : undefined;
    const report = createInventoryReport(items, {
      title: createReportTitle(zoneId, payload.zones, schoolName),
      zones: payload.zones,
      schoolName,
      isSingleZone: Boolean(zoneId),
    });

    return createHtmlResponse(createInventoryReportHtml(report));
  } catch (error) {
    if (error instanceof SupabaseConfigurationError) {
      const items = filterItems(INVENTORY_ITEMS, zoneId);
      const report = createInventoryReport(items, {
        title: createReportTitle(zoneId, INVENTORY_ZONES),
        zones: INVENTORY_ZONES,
        isSingleZone: Boolean(zoneId),
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

async function getSchoolName(schoolId: string): Promise<string | undefined> {
  const supabase = getSupabaseServerClient();

  if (!supabase) {
    return undefined;
  }

  const { data } = await supabase
    .from("schools")
    .select("name")
    .eq("id", schoolId)
    .maybeSingle();

  return data?.name ?? undefined;
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
  schoolName?: string,
): string {
  const zone = zoneId ? zones.find((entry) => entry.id === zoneId) : null;
  const schoolPrefix = schoolName ? `${schoolName} - ` : "";

  return zoneId
    ? `${schoolPrefix}Laporan Inventaris Zona ${zone?.name ?? zoneId}`
    : `${schoolPrefix}Laporan Inventaris Makerspace`;
}

function createHtmlResponse(html: string): Response {
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
