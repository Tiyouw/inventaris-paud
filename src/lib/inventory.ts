export const INVENTORY_ZONES = [
  {
    id: "mini-garden",
    name: "Mini Garden",
    description: "Gardening tools, plant care materials, and outdoor exploration supplies.",
  },
  {
    id: "art-gallery",
    name: "Art Gallery",
    description: "Visual art tools, display materials, and creative classroom supplies.",
  },
  {
    id: "biodiversity-drama",
    name: "Biodiversity & Drama",
    description: "Nature observation materials, costumes, props, and storytelling kits.",
  },
  {
    id: "steam-lab",
    name: "STEAM Lab",
    description: "Experiment kits, construction tools, measuring devices, and lab materials.",
  },
  {
    id: "eco-upcycle",
    name: "Eco Upcycle",
    description: "Reusable materials, recycling tools, and upcycling project equipment.",
  },
] as const;

export const ITEM_TYPES = [
  {
    id: "equipment",
    name: "Equipment",
    restockable: false,
  },
  {
    id: "tool",
    name: "Tool",
    restockable: false,
  },
  {
    id: "consumable",
    name: "Consumable",
    restockable: true,
  },
  {
    id: "learning-kit",
    name: "Learning Kit",
    restockable: false,
  },
  {
    id: "display",
    name: "Display",
    restockable: true,
  },
] as const;

export const CONDITION_TYPES = [
  {
    id: "good",
    name: "Good",
    severity: 0,
    serviceable: true,
  },
  {
    id: "needs-repair",
    name: "Needs Repair",
    severity: 2,
    serviceable: false,
  },
  {
    id: "damaged",
    name: "Damaged",
    severity: 3,
    serviceable: false,
  },
  {
    id: "missing",
    name: "Missing",
    severity: 4,
    serviceable: false,
  },
] as const;

export type InventoryZone = (typeof INVENTORY_ZONES)[number];
export type InventoryZoneId = InventoryZone["id"];

export type ItemType = (typeof ITEM_TYPES)[number];
export type ItemTypeId = ItemType["id"];

export type ConditionType = (typeof CONDITION_TYPES)[number];
export type ConditionTypeId = ConditionType["id"];

export type InventoryStatus = "available" | "checked-out" | "reserved" | "missing";

export type InventoryItem = {
  id: string;
  assetTag: string;
  name: string;
  zoneId: InventoryZoneId;
  typeId: ItemTypeId;
  conditionId: ConditionTypeId;
  status: InventoryStatus;
  quantity: number;
  minimumQuantity: number;
  location: string;
  owner: string;
  lastCheckedAt: string;
  notes?: string;
  photoUrl?: string;
  isActive: boolean;
};

export type ConditionLog = {
  id: string;
  itemId: InventoryItem["id"];
  conditionId: ConditionTypeId;
  checkedAt: string;
  checkedBy: string;
  note: string;
};

export type InventoryCount = {
  id: string;
  name: string;
  count: number;
};

export type InventorySummary = {
  totalItems: number;
  totalUnits: number;
  availableUnits: number;
  checkedOutUnits: number;
  reservedUnits: number;
  missingUnits: number;
  lowStockItems: number;
  needsAttentionItems: number;
  serviceableItems: number;
  byZone: InventoryCount[];
  byType: InventoryCount[];
  byCondition: InventoryCount[];
};

export type DashboardStats = {
  totalAssets: number;
  totalUnits: number;
  availableRate: number;
  lowStockCount: number;
  repairQueueCount: number;
  missingCount: number;
  recentlyCheckedCount: number;
};

export const INVENTORY_ITEMS: InventoryItem[] = [
  {
    id: "item-planter-kit-01",
    assetTag: "MG-001",
    name: "Child-Safe Planter Kit",
    zoneId: "mini-garden",
    typeId: "learning-kit",
    conditionId: "good",
    status: "available",
    quantity: 8,
    minimumQuantity: 6,
    location: "Mini Garden Shelf A",
    owner: "PAUD Makerspace",
    lastCheckedAt: "2026-05-20",
    notes: "Includes small trowels, hand rakes, and labeled pots.",
    isActive: true,
  },
  {
    id: "item-watering-cans-01",
    assetTag: "MG-002",
    name: "Mini Watering Cans",
    zoneId: "mini-garden",
    typeId: "tool",
    conditionId: "good",
    status: "available",
    quantity: 5,
    minimumQuantity: 5,
    location: "Mini Garden Outdoor Rack",
    owner: "PAUD Makerspace",
    lastCheckedAt: "2026-05-18",
    isActive: true,
  },
  {
    id: "item-art-easel-01",
    assetTag: "AG-001",
    name: "Standing Art Easel",
    zoneId: "art-gallery",
    typeId: "equipment",
    conditionId: "needs-repair",
    status: "available",
    quantity: 2,
    minimumQuantity: 2,
    location: "Art Gallery Wall",
    owner: "PAUD Makerspace",
    lastCheckedAt: "2026-05-17",
    notes: "One clamp is loose and should be tightened.",
    isActive: true,
  },
  {
    id: "item-crayons-01",
    assetTag: "AG-002",
    name: "Large Crayon Set",
    zoneId: "art-gallery",
    typeId: "consumable",
    conditionId: "good",
    status: "available",
    quantity: 16,
    minimumQuantity: 20,
    location: "Art Supply Drawer 1",
    owner: "PAUD Makerspace",
    lastCheckedAt: "2026-05-19",
    notes: "Needs restock before the next exhibition activity.",
    isActive: true,
  },
  {
    id: "item-costume-rack-01",
    assetTag: "BD-001",
    name: "Animal Costume Rack",
    zoneId: "biodiversity-drama",
    typeId: "display",
    conditionId: "good",
    status: "available",
    quantity: 1,
    minimumQuantity: 1,
    location: "Drama Corner",
    owner: "PAUD Makerspace",
    lastCheckedAt: "2026-05-16",
    isActive: true,
  },
  {
    id: "item-magnifier-01",
    assetTag: "BD-002",
    name: "Nature Magnifier Set",
    zoneId: "biodiversity-drama",
    typeId: "learning-kit",
    conditionId: "damaged",
    status: "available",
    quantity: 4,
    minimumQuantity: 4,
    location: "Biodiversity Observation Bin",
    owner: "PAUD Makerspace",
    lastCheckedAt: "2026-05-14",
    notes: "Two lenses are scratched and should be replaced.",
    isActive: true,
  },
  {
    id: "item-balance-scale-01",
    assetTag: "SL-001",
    name: "Balance Scale",
    zoneId: "steam-lab",
    typeId: "equipment",
    conditionId: "good",
    status: "available",
    quantity: 3,
    minimumQuantity: 2,
    location: "STEAM Lab Table",
    owner: "PAUD Makerspace",
    lastCheckedAt: "2026-05-21",
    isActive: true,
  },
  {
    id: "item-blocks-01",
    assetTag: "SL-002",
    name: "Magnetic Building Blocks",
    zoneId: "steam-lab",
    typeId: "learning-kit",
    conditionId: "good",
    status: "available",
    quantity: 10,
    minimumQuantity: 8,
    location: "STEAM Lab Cabinet B",
    owner: "PAUD Makerspace",
    lastCheckedAt: "2026-05-15",
    isActive: true,
  },
  {
    id: "item-recycle-scissors-01",
    assetTag: "EU-001",
    name: "Child-Safe Recycle Scissors",
    zoneId: "eco-upcycle",
    typeId: "tool",
    conditionId: "missing",
    status: "missing",
    quantity: 3,
    minimumQuantity: 8,
    location: "Eco Upcycle Tool Bin",
    owner: "PAUD Makerspace",
    lastCheckedAt: "2026-05-12",
    notes: "Several units missing after cardboard project week.",
    isActive: true,
  },
  {
    id: "item-cardboard-stock-01",
    assetTag: "EU-002",
    name: "Clean Cardboard Stock",
    zoneId: "eco-upcycle",
    typeId: "consumable",
    conditionId: "good",
    status: "available",
    quantity: 24,
    minimumQuantity: 20,
    location: "Eco Upcycle Material Shelf",
    owner: "PAUD Makerspace",
    lastCheckedAt: "2026-05-20",
    isActive: true,
  },
];

export const CONDITION_LOGS: ConditionLog[] = [
  {
    id: "log-001",
    itemId: "item-planter-kit-01",
    conditionId: "good",
    checkedAt: "2026-05-20",
    checkedBy: "Rina",
    note: "All pots and child-safe tools are clean and labeled.",
  },
  {
    id: "log-002",
    itemId: "item-art-easel-01",
    conditionId: "needs-repair",
    checkedAt: "2026-05-17",
    checkedBy: "Dimas",
    note: "One clamp is loose; easel remains usable with supervision.",
  },
  {
    id: "log-003",
    itemId: "item-magnifier-01",
    conditionId: "damaged",
    checkedAt: "2026-05-14",
    checkedBy: "Nadia",
    note: "Scratched lenses found after outdoor observation activity.",
  },
  {
    id: "log-004",
    itemId: "item-balance-scale-01",
    conditionId: "good",
    checkedAt: "2026-05-21",
    checkedBy: "Rina",
    note: "Bowls balanced properly during test activity.",
  },
  {
    id: "log-005",
    itemId: "item-recycle-scissors-01",
    conditionId: "missing",
    checkedAt: "2026-05-12",
    checkedBy: "Dimas",
    note: "Only three scissors found in the tool bin.",
  },
];

const SERVICEABLE_CONDITION_IDS = new Set<ConditionTypeId>(
  CONDITION_TYPES.filter((condition) => condition.serviceable).map(
    (condition) => condition.id,
  ),
);

const ATTENTION_CONDITION_IDS = new Set<ConditionTypeId>([
  "needs-repair",
  "damaged",
  "missing",
]);

export function getZoneById(zoneId: InventoryZoneId): InventoryZone {
  return INVENTORY_ZONES.find((zone) => zone.id === zoneId) ?? INVENTORY_ZONES[0];
}

export function getItemTypeById(typeId: ItemTypeId): ItemType {
  return ITEM_TYPES.find((type) => type.id === typeId) ?? ITEM_TYPES[0];
}

export function getConditionById(conditionId: ConditionTypeId): ConditionType {
  return (
    CONDITION_TYPES.find((condition) => condition.id === conditionId) ??
    CONDITION_TYPES[0]
  );
}

export function isLowStock(item: InventoryItem): boolean {
  return item.quantity < item.minimumQuantity;
}

export function isServiceable(item: InventoryItem): boolean {
  return SERVICEABLE_CONDITION_IDS.has(item.conditionId);
}

export function needsAttention(item: InventoryItem): boolean {
  return item.status === "missing" || ATTENTION_CONDITION_IDS.has(item.conditionId);
}

export function getAvailableUnits(items: InventoryItem[] = INVENTORY_ITEMS): number {
  return sumUnits(items.filter((item) => item.status === "available"));
}

export function getLowStockItems(
  items: InventoryItem[] = INVENTORY_ITEMS,
): InventoryItem[] {
  return items.filter(isLowStock);
}

export function getItemsNeedingAttention(
  items: InventoryItem[] = INVENTORY_ITEMS,
): InventoryItem[] {
  return items.filter(needsAttention);
}

export function getConditionLogsForItem(
  itemId: InventoryItem["id"],
  logs: ConditionLog[] = CONDITION_LOGS,
): ConditionLog[] {
  return logs
    .filter((log) => log.itemId === itemId)
    .sort((first, second) => second.checkedAt.localeCompare(first.checkedAt));
}

export function getMostRecentConditionLog(
  itemId: InventoryItem["id"],
  logs: ConditionLog[] = CONDITION_LOGS,
): ConditionLog | undefined {
  return getConditionLogsForItem(itemId, logs)[0];
}

export function summarizeInventory(
  items: InventoryItem[] = INVENTORY_ITEMS,
): InventorySummary {
  return {
    totalItems: items.length,
    totalUnits: sumUnits(items),
    availableUnits: sumUnits(items.filter((item) => item.status === "available")),
    checkedOutUnits: sumUnits(items.filter((item) => item.status === "checked-out")),
    reservedUnits: sumUnits(items.filter((item) => item.status === "reserved")),
    missingUnits: sumUnits(items.filter((item) => item.status === "missing")),
    lowStockItems: getLowStockItems(items).length,
    needsAttentionItems: getItemsNeedingAttention(items).length,
    serviceableItems: items.filter(isServiceable).length,
    byZone: countByCatalog(items, INVENTORY_ZONES, "zoneId"),
    byType: countByCatalog(items, ITEM_TYPES, "typeId"),
    byCondition: countByCatalog(items, CONDITION_TYPES, "conditionId"),
  };
}

export function getDashboardStats(
  items: InventoryItem[] = INVENTORY_ITEMS,
  today = "2026-05-22",
): DashboardStats {
  const summary = summarizeInventory(items);
  const availableRate =
    summary.totalUnits === 0 ? 0 : summary.availableUnits / summary.totalUnits;

  return {
    totalAssets: summary.totalItems,
    totalUnits: summary.totalUnits,
    availableRate: roundToPercent(availableRate),
    lowStockCount: summary.lowStockItems,
    repairQueueCount: items.filter((item) => item.conditionId === "needs-repair")
      .length,
    missingCount: items.filter((item) => item.status === "missing").length,
    recentlyCheckedCount: countRecentlyChecked(items, today, 7),
  };
}

export function countRecentlyChecked(
  items: InventoryItem[] = INVENTORY_ITEMS,
  today = "2026-05-22",
  windowDays = 7,
): number {
  const todayTime = Date.parse(today);

  if (Number.isNaN(todayTime)) {
    return 0;
  }

  return items.filter((item) => {
    const checkedTime = Date.parse(item.lastCheckedAt);

    if (Number.isNaN(checkedTime)) {
      return false;
    }

    const ageInDays = (todayTime - checkedTime) / 86_400_000;
    return ageInDays >= 0 && ageInDays <= windowDays;
  }).length;
}

export function sortItemsByAttention(
  items: InventoryItem[] = INVENTORY_ITEMS,
): InventoryItem[] {
  return [...items].sort((first, second) => {
    const firstScore = getAttentionScore(first);
    const secondScore = getAttentionScore(second);

    if (firstScore !== secondScore) {
      return secondScore - firstScore;
    }

    return first.name.localeCompare(second.name);
  });
}

function getAttentionScore(item: InventoryItem): number {
  const condition = getConditionById(item.conditionId);
  const statusScore = item.status === "missing" ? 5 : item.status === "reserved" ? 1 : 0;
  const stockScore = isLowStock(item) ? 3 : 0;

  return condition.severity + statusScore + stockScore;
}

function sumUnits(items: InventoryItem[]): number {
  return items.reduce((total, item) => total + item.quantity, 0);
}

function countByCatalog<
  TCatalog extends ReadonlyArray<{ id: string; name: string }>,
  TKey extends keyof InventoryItem,
>(
  items: InventoryItem[],
  catalog: TCatalog,
  key: TKey,
): InventoryCount[] {
  return catalog.map((entry) => ({
    id: entry.id,
    name: entry.name,
    count: items.filter((item) => item[key] === entry.id).length,
  }));
}

function roundToPercent(value: number): number {
  return Math.round(value * 100);
}
