import type { SupabaseClient } from "@supabase/supabase-js";

import {
  INVENTORY_ZONES,
  type ConditionLog,
  type ConditionTypeId,
  type InventoryItem,
  type InventoryStatus,
  type InventoryZoneId,
  type ItemTypeId,
} from "./inventory";
import {
  getMissingSupabaseConfigMessage,
  getSupabaseServerClient,
  getSupabaseServerConfig,
} from "./supabase";

type InventoryPayload = {
  items: InventoryItem[];
  conditionLogs: ConditionLog[];
  zones: InventoryZonePayload[];
  source: "supabase";
};

type InventoryZonePayload = {
  id: InventoryZoneId;
  name: string;
  description: string;
};

type SaveInventoryItemInput = Omit<InventoryItem, "id" | "isActive"> & {
  id?: string;
  isActive?: boolean;
};

type UploadInventoryPhotoInput = {
  content: ArrayBuffer | Buffer;
  fileName?: string;
  contentType?: string;
};

type DbZoneRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
};

type DbItemRow = {
  id: string;
  zone_id: string;
  asset_tag: string | null;
  name: string;
  type_id: string;
  condition_id: string;
  status: string;
  quantity: number;
  minimum_quantity: number;
  location_detail: string | null;
  owner: string | null;
  primary_photo_url: string | null;
  notes: string | null;
  last_checked_at: string | null;
  is_active: boolean;
  zones?: Pick<DbZoneRow, "slug"> | Pick<DbZoneRow, "slug">[] | null;
};

type DbConditionLogRow = {
  id: string;
  item_id: string;
  new_condition_id: string;
  notes: string | null;
  checked_by: string | null;
  checked_at: string;
};

export class SupabaseConfigurationError extends Error {
  constructor() {
    super(getMissingSupabaseConfigMessage());
    this.name = "SupabaseConfigurationError";
  }
}

export async function listInventory(): Promise<InventoryPayload> {
  const supabase = requireSupabaseClient();
  const [zonesResult, itemsResult, logsResult] = await Promise.all([
    supabase.from("zones").select("id, name, slug, description").order("name"),
    supabase
      .from("items")
      .select(
        "id, zone_id, asset_tag, name, type_id, condition_id, status, quantity, minimum_quantity, location_detail, owner, primary_photo_url, notes, last_checked_at, is_active, zones(slug)",
      )
      .eq("is_active", true)
      .order("updated_at", { ascending: false }),
    supabase
      .from("item_condition_logs")
      .select("id, item_id, new_condition_id, notes, checked_by, checked_at")
      .order("checked_at", { ascending: false }),
  ]);

  if (zonesResult.error) {
    throw zonesResult.error;
  }

  if (itemsResult.error) {
    throw itemsResult.error;
  }

  if (logsResult.error) {
    throw logsResult.error;
  }

  const zones = mapZones((zonesResult.data ?? []) as DbZoneRow[]);
  const zoneSlugById = new Map(
    ((zonesResult.data ?? []) as DbZoneRow[]).map((zone) => [zone.id, zone.slug]),
  );
  const items = ((itemsResult.data ?? []) as DbItemRow[]).map((item) =>
    mapInventoryItem(item, zoneSlugById),
  );
  const activeItemIds = new Set(items.map((item) => item.id));
  const conditionLogs = ((logsResult.data ?? []) as DbConditionLogRow[])
    .filter((log) => activeItemIds.has(log.item_id))
    .map(mapConditionLog);

  return {
    items,
    conditionLogs,
    zones,
    source: "supabase",
  };
}

export async function createInventoryItem(
  input: SaveInventoryItemInput,
): Promise<InventoryItem> {
  const supabase = requireSupabaseClient();
  const zone = await getZoneBySlug(supabase, input.zoneId);
  const now = new Date().toISOString();
  const itemToInsert = toDbItemInsert(input, zone.id, now);

  const { data: insertedItem, error: itemError } = await supabase
    .from("items")
    .insert(itemToInsert)
    .select(
      "id, zone_id, asset_tag, name, type_id, condition_id, status, quantity, minimum_quantity, location_detail, owner, primary_photo_url, notes, last_checked_at, is_active, zones(slug)",
    )
    .single();

  if (itemError) {
    throw itemError;
  }

  const item = mapInventoryItem(insertedItem as DbItemRow, new Map([[zone.id, zone.slug]]));
  const { error: logError } = await supabase.from("item_condition_logs").insert({
    item_id: item.id,
    previous_condition_id: null,
    new_condition_id: item.conditionId,
    notes: `Barang baru ditambahkan dengan kondisi ${item.conditionId}.`,
    photo_url: item.photoUrl ?? null,
    checked_by: "Guru",
    changed_by: "Guru",
    checked_at: toTimestamp(input.lastCheckedAt) ?? now,
  });

  if (logError) {
    throw logError;
  }

  return item;
}

export async function updateInventoryItem(
  itemId: string,
  input: SaveInventoryItemInput,
): Promise<InventoryItem> {
  const supabase = requireSupabaseClient();
  const zone = await getZoneBySlug(supabase, input.zoneId);
  const existing = await getItemById(supabase, itemId);
  const nextCheckedAt = toTimestamp(input.lastCheckedAt) ?? new Date().toISOString();

  const { data: updatedItem, error: updateError } = await supabase
    .from("items")
    .update(toDbItemUpdate(input, zone.id, nextCheckedAt))
    .eq("id", itemId)
    .select(
      "id, zone_id, asset_tag, name, type_id, condition_id, status, quantity, minimum_quantity, location_detail, owner, primary_photo_url, notes, last_checked_at, is_active, zones(slug)",
    )
    .single();

  if (updateError) {
    throw updateError;
  }

  const item = mapInventoryItem(updatedItem as DbItemRow, new Map([[zone.id, zone.slug]]));

  if (existing.condition_id !== item.conditionId) {
    const { error: logError } = await supabase.from("item_condition_logs").insert({
      item_id: item.id,
      previous_condition_id: existing.condition_id,
      new_condition_id: item.conditionId,
      notes: `Kondisi berubah dari ${existing.condition_id} menjadi ${item.conditionId}.`,
      photo_url: item.photoUrl ?? null,
      checked_by: "Guru",
      changed_by: "Guru",
      checked_at: nextCheckedAt,
    });

    if (logError) {
      throw logError;
    }
  }

  return item;
}

export async function softDeleteInventoryItem(itemId: string): Promise<void> {
  const supabase = requireSupabaseClient();
  const { error } = await supabase
    .from("items")
    .update({
      is_active: false,
      deleted_at: new Date().toISOString(),
      deleted_reason: "Soft deleted from inventory app.",
    })
    .eq("id", itemId);

  if (error) {
    throw error;
  }
}

export async function uploadInventoryPhoto({
  content,
  fileName,
  contentType = "image/webp",
}: UploadInventoryPhotoInput): Promise<string> {
  const supabase = requireSupabaseClient();
  const config = getSupabaseServerConfig();

  if (!config) {
    throw new SupabaseConfigurationError();
  }

  if (contentType !== "image/webp") {
    throw new Error("Only WebP inventory photos are supported.");
  }

  const path = createStoragePath(fileName);
  const { error: uploadError } = await supabase.storage
    .from(config.storageBucket)
    .upload(path, content, {
      contentType,
      upsert: false,
    });

  if (uploadError) {
    throw uploadError;
  }

  const { data } = supabase.storage.from(config.storageBucket).getPublicUrl(path);

  return data.publicUrl;
}

function requireSupabaseClient(): SupabaseClient {
  const supabase = getSupabaseServerClient();

  if (!supabase) {
    throw new SupabaseConfigurationError();
  }

  return supabase;
}

async function getZoneBySlug(
  supabase: SupabaseClient,
  zoneId: InventoryZoneId,
): Promise<DbZoneRow> {
  const { data, error } = await supabase
    .from("zones")
    .select("id, name, slug, description")
    .eq("slug", zoneId)
    .single();

  if (error) {
    throw error;
  }

  return data as DbZoneRow;
}

async function getItemById(
  supabase: SupabaseClient,
  itemId: string,
): Promise<DbItemRow> {
  const { data, error } = await supabase
    .from("items")
    .select(
      "id, zone_id, asset_tag, name, type_id, condition_id, status, quantity, minimum_quantity, location_detail, owner, primary_photo_url, notes, last_checked_at, is_active",
    )
    .eq("id", itemId)
    .single();

  if (error) {
    throw error;
  }

  return data as DbItemRow;
}

function toDbItemInsert(
  input: SaveInventoryItemInput,
  zoneId: string,
  checkedAt: string,
): Record<string, string | number | boolean | null> {
  return {
    zone_id: zoneId,
    asset_tag: input.assetTag || null,
    name: input.name,
    type_id: input.typeId,
    condition_id: input.conditionId,
    status: input.status,
    quantity: input.quantity,
    minimum_quantity: input.minimumQuantity,
    location_detail: input.location || null,
    owner: input.owner,
    primary_photo_url: input.photoUrl ?? null,
    notes: input.notes ?? null,
    last_checked_at: toTimestamp(input.lastCheckedAt) ?? checkedAt,
    is_active: input.isActive ?? true,
  };
}

function toDbItemUpdate(
  input: SaveInventoryItemInput,
  zoneId: string,
  checkedAt: string,
): Record<string, string | number | boolean | null> {
  return {
    ...toDbItemInsert(input, zoneId, checkedAt),
    last_checked_at: checkedAt,
  };
}

function mapInventoryItem(
  row: DbItemRow,
  zoneSlugById: Map<string, string>,
): InventoryItem {
  return {
    id: row.id,
    assetTag: row.asset_tag ?? "",
    name: row.name,
    zoneId: getZoneSlug(row, zoneSlugById) as InventoryZoneId,
    typeId: row.type_id as ItemTypeId,
    conditionId: row.condition_id as ConditionTypeId,
    status: row.status as InventoryStatus,
    quantity: row.quantity,
    minimumQuantity: row.minimum_quantity,
    location: row.location_detail ?? "",
    owner: row.owner ?? "PAUD Makerspace",
    lastCheckedAt: toDateOnly(row.last_checked_at),
    notes: row.notes ?? undefined,
    photoUrl: row.primary_photo_url ?? undefined,
    isActive: row.is_active,
  };
}

function mapConditionLog(row: DbConditionLogRow): ConditionLog {
  return {
    id: row.id,
    itemId: row.item_id,
    conditionId: row.new_condition_id as ConditionTypeId,
    checkedAt: toDateOnly(row.checked_at),
    checkedBy: row.checked_by ?? "Guru",
    note: row.notes ?? "",
  };
}

function mapZones(rows: DbZoneRow[]): InventoryZonePayload[] {
  if (rows.length === 0) {
    return [...INVENTORY_ZONES];
  }

  return rows.map((zone) => ({
    id: zone.slug as InventoryZoneId,
    name: zone.name,
    description: zone.description ?? "",
  }));
}

function getZoneSlug(row: DbItemRow, zoneSlugById: Map<string, string>): string {
  const joinedZone = Array.isArray(row.zones) ? row.zones[0] : row.zones;

  return joinedZone?.slug ?? zoneSlugById.get(row.zone_id) ?? "mini-garden";
}

function toTimestamp(value: string): string | null {
  if (!value) {
    return null;
  }

  const timestamp = Date.parse(value);

  if (Number.isNaN(timestamp)) {
    return null;
  }

  return new Date(timestamp).toISOString();
}

function toDateOnly(value: string | null): string {
  if (!value) {
    return new Date().toISOString().slice(0, 10);
  }

  return value.slice(0, 10);
}

function createStoragePath(fileName = "inventory-photo.webp"): string {
  const safeName = fileName
    .replace(/\\/g, "/")
    .split("/")
    .pop()
    ?.replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^\.+/, "");
  const webpName = (safeName || "inventory-photo.webp").replace(/\.[^.]+$/, ".webp");

  return `items/${Date.now()}-${crypto.randomUUID()}-${webpName}`;
}
