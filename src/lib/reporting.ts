import {
  CONDITION_TYPES,
  INVENTORY_ZONES,
  ITEM_TYPES,
  getConditionById,
  getItemTypeById,
  getZoneById,
  isLowStock,
  needsAttention,
} from "./inventory";
import type {
  ConditionTypeId,
  InventoryItem,
  InventoryStatus,
  InventoryZoneId,
  ItemTypeId,
} from "./inventory";

export type InventoryReportFlag = "low-stock" | "needs-attention" | "missing-photo";

export type InventoryReportRow = {
  itemId: string;
  assetTag: string;
  name: string;
  zoneId: InventoryZoneId;
  zoneName: string;
  typeId: ItemTypeId;
  typeName: string;
  conditionId: ConditionTypeId;
  conditionName: string;
  status: InventoryStatus;
  quantity: number;
  minimumQuantity: number;
  location: string;
  owner: string;
  lastCheckedAt: string;
  notes: string;
  photoUrl?: string;
  flags: InventoryReportFlag[];
};

export type InventoryReportCount = {
  id: string;
  name: string;
  count: number;
  units: number;
};

export type InventoryReportSummary = {
  totalItems: number;
  totalUnits: number;
  activeItems: number;
  inactiveItems: number;
  lowStockItems: number;
  needsAttentionItems: number;
  itemsWithPhotos: number;
  byZone: InventoryReportCount[];
  byType: InventoryReportCount[];
  byCondition: InventoryReportCount[];
  byStatus: InventoryReportCount[];
};

export type InventoryPhotoAppendixEntry = {
  appendixNumber: number;
  itemId: string;
  assetTag: string;
  itemName: string;
  zoneName: string;
  location: string;
  photoUrl: string;
  caption: string;
};

export type InventoryReport = {
  title: string;
  generatedAt: string;
  rows: InventoryReportRow[];
  summary: InventoryReportSummary;
  photoAppendix: InventoryPhotoAppendixEntry[];
};

export type InventoryReportOptions = {
  title?: string;
  generatedAt?: string;
  includeInactive?: boolean;
};

const STATUS_LABELS: Record<InventoryStatus, string> = {
  available: "Available",
  "checked-out": "Checked Out",
  reserved: "Reserved",
  missing: "Missing",
};

export function createInventoryReport(
  items: InventoryItem[],
  options: InventoryReportOptions = {},
): InventoryReport {
  const reportItems = filterReportItems(items, options.includeInactive ?? false);

  return {
    title: options.title ?? "Inventory Report",
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    rows: createInventoryReportRows(reportItems),
    summary: summarizeInventoryForReport(reportItems),
    photoAppendix: createPhotoAppendixData(reportItems),
  };
}

export function createInventoryReportRows(
  items: InventoryItem[],
): InventoryReportRow[] {
  return items.map((item) => {
    const zone = getZoneById(item.zoneId);
    const type = getItemTypeById(item.typeId);
    const condition = getConditionById(item.conditionId);

    return {
      itemId: item.id,
      assetTag: item.assetTag,
      name: item.name,
      zoneId: item.zoneId,
      zoneName: zone.name,
      typeId: item.typeId,
      typeName: type.name,
      conditionId: item.conditionId,
      conditionName: condition.name,
      status: item.status,
      quantity: item.quantity,
      minimumQuantity: item.minimumQuantity,
      location: item.location,
      owner: item.owner,
      lastCheckedAt: item.lastCheckedAt,
      notes: item.notes ?? "",
      photoUrl: item.photoUrl,
      flags: getReportFlags(item),
    };
  });
}

export function summarizeInventoryForReport(
  items: InventoryItem[],
): InventoryReportSummary {
  return {
    totalItems: items.length,
    totalUnits: sumUnits(items),
    activeItems: items.filter((item) => item.isActive).length,
    inactiveItems: items.filter((item) => !item.isActive).length,
    lowStockItems: items.filter(isLowStock).length,
    needsAttentionItems: items.filter(needsAttention).length,
    itemsWithPhotos: items.filter((item) => Boolean(item.photoUrl)).length,
    byZone: countByCatalog(items, INVENTORY_ZONES, "zoneId"),
    byType: countByCatalog(items, ITEM_TYPES, "typeId"),
    byCondition: countByCatalog(items, CONDITION_TYPES, "conditionId"),
    byStatus: countByStatus(items),
  };
}

export function createPhotoAppendixData(
  items: InventoryItem[],
): InventoryPhotoAppendixEntry[] {
  return items
    .filter((item) => Boolean(item.photoUrl))
    .map((item, index) => {
      const zone = getZoneById(item.zoneId);

      return {
        appendixNumber: index + 1,
        itemId: item.id,
        assetTag: item.assetTag,
        itemName: item.name,
        zoneName: zone.name,
        location: item.location,
        photoUrl: item.photoUrl ?? "",
        caption: `${item.assetTag} - ${item.name} (${zone.name})`,
      };
    });
}

export function getReportFlags(item: InventoryItem): InventoryReportFlag[] {
  const flags: InventoryReportFlag[] = [];

  if (isLowStock(item)) {
    flags.push("low-stock");
  }

  if (needsAttention(item)) {
    flags.push("needs-attention");
  }

  if (!item.photoUrl) {
    flags.push("missing-photo");
  }

  return flags;
}

function filterReportItems(
  items: InventoryItem[],
  includeInactive: boolean,
): InventoryItem[] {
  return includeInactive ? [...items] : items.filter((item) => item.isActive);
}

function countByStatus(items: InventoryItem[]): InventoryReportCount[] {
  return Object.entries(STATUS_LABELS).map(([id, name]) => {
    const status = id as InventoryStatus;
    const matchingItems = items.filter((item) => item.status === status);

    return {
      id,
      name,
      count: matchingItems.length,
      units: sumUnits(matchingItems),
    };
  });
}

function countByCatalog<
  TCatalog extends ReadonlyArray<{ id: string; name: string }>,
  TKey extends keyof InventoryItem,
>(
  items: InventoryItem[],
  catalog: TCatalog,
  key: TKey,
): InventoryReportCount[] {
  return catalog.map((entry) => {
    const matchingItems = items.filter((item) => item[key] === entry.id);

    return {
      id: entry.id,
      name: entry.name,
      count: matchingItems.length,
      units: sumUnits(matchingItems),
    };
  });
}

function sumUnits(items: InventoryItem[]): number {
  return items.reduce((total, item) => total + item.quantity, 0);
}
