import type { SupabaseClient } from "@supabase/supabase-js";

import {
  CONDITION_TYPES,
  INVENTORY_ZONES,
  ITEM_SOURCES,
  ITEM_TYPES,
  type ConditionLog,
  type ConditionTypeId,
  type InventoryItem,
  type InventoryStatus,
  type InventoryZone,
  type InventoryZoneId,
  type ItemSourceId,
  type ItemTypeId,
} from "./inventory";
import {
  getMissingSupabaseConfigMessage,
  getSupabaseServerClient,
  getSupabaseServerConfig,
} from "./supabase";

let schoolUuidCache: Record<string, string> | null = null;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function getSchoolUuid(
  supabase: SupabaseClient,
  schoolCode: string,
): Promise<string> {
  if (UUID_REGEX.test(schoolCode)) {
    return schoolCode;
  }

  if (schoolUuidCache && schoolUuidCache[schoolCode]) {
    return schoolUuidCache[schoolCode];
  }

  const { data, error } = await supabase.from("schools").select("id, access_code");

  if (error || !data) {
    throw error || new Error("Gagal mengambil data sekolah");
  }

  schoolUuidCache = {};
  for (const row of data) {
    schoolUuidCache[row.access_code] = row.id;
  }

  const uuid = schoolUuidCache[schoolCode];
  if (!uuid) {
    throw new InventoryValidationError("Sekolah tidak ditemukan.");
  }

  return uuid;
}

type InventoryPayload = {
  items: InventoryItem[];
  conditionLogs: ConditionLog[];
  zones: InventoryZone[];
  source: "supabase";
};

type SaveInventoryItemInput = Omit<InventoryItem, "id" | "isActive"> & {
  id?: string;
  isActive?: boolean;
  school_id?: string;
};

export type SaveInventoryZoneInput = {
  name: string;
  description?: string;
  school_id?: string;
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
  acquisition_date: string | null;
  source_id: string | null;
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

export class InventoryValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InventoryValidationError";
  }
}

const CONDITION_LABELS: Record<ConditionTypeId, string> = {
  baik: "Baik",
  "layak-pakai": "Layak Pakai",
  "rusak-ringan": "Rusak Ringan",
  "rusak-berat": "Rusak Berat",
  "perlu-perbaikan": "Perlu Perbaikan",
  "tidak-layak-pakai": "Tidak Layak Pakai",
};

const LEGACY_CONDITION_MAP: Record<string, ConditionTypeId> = {
  good: "baik",
  "needs-repair": "perlu-perbaikan",
  damaged: "rusak-berat",
  missing: "tidak-layak-pakai",
};

export async function listInventory(schoolId?: string): Promise<InventoryPayload> {
  const supabase = requireSupabaseClient();
  const schoolUuid = schoolId ? await getSchoolUuid(supabase, schoolId) : undefined;

  let itemsQuery = supabase
    .from("items")
    .select(
      "id, zone_id, asset_tag, name, type_id, condition_id, status, quantity, minimum_quantity, acquisition_date, source_id, location_detail, owner, primary_photo_url, notes, last_checked_at, is_active, zones(slug)",
    )
    .eq("is_active", true)
    .order("updated_at", { ascending: false });

  if (schoolUuid) {
    itemsQuery = itemsQuery.eq("school_id", schoolUuid);
  }

  const [zonesResult, itemsResult] = await Promise.all([
    (() => {
      let zonesQuery = supabase.from("zones").select("id, name, slug, description").order("name");
      if (schoolUuid) {
        zonesQuery = zonesQuery.eq("school_id", schoolUuid);
      }
      return zonesQuery;
    })(),
    itemsQuery,
  ]);

  if (zonesResult.error) {
    throw zonesResult.error;
  }

  if (itemsResult.error) {
    throw itemsResult.error;
  }

  const zones = mapZones((zonesResult.data ?? []) as DbZoneRow[]);
  const zoneSlugById = new Map(
    ((zonesResult.data ?? []) as DbZoneRow[]).map((zone) => [zone.id, zone.slug]),
  );
  const items = ((itemsResult.data ?? []) as DbItemRow[]).map((item) =>
    mapInventoryItem(item, zoneSlugById),
  );
  const activeItemIds = new Set(items.map((item) => item.id));

  let logsQuery = supabase
    .from("item_condition_logs")
    .select("id, item_id, new_condition_id, notes, checked_by, checked_at")
    .order("checked_at", { ascending: false });

  if (activeItemIds.size > 0) {
    logsQuery = logsQuery.in("item_id", [...activeItemIds]);
  } else {
    return { items, conditionLogs: [], zones, source: "supabase" };
  }

  const logsResult = await logsQuery;

  if (logsResult.error) {
    throw logsResult.error;
  }

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
  validateInventoryInput(input);

  const supabase = requireSupabaseClient();
  const zone = await getZoneBySlug(supabase, input.zoneId);
  const now = new Date().toISOString();
  const schoolUuid = input.school_id ? await getSchoolUuid(supabase, input.school_id) : undefined;
  const inputWithUuid = { ...input, school_id: schoolUuid };
  const itemToInsert = toDbItemInsert(inputWithUuid, zone.id, now);

  const { data: insertedItem, error: itemError } = await supabase
    .from("items")
    .insert(itemToInsert)
    .select(
      "id, zone_id, asset_tag, name, type_id, condition_id, status, quantity, minimum_quantity, acquisition_date, source_id, location_detail, owner, primary_photo_url, notes, last_checked_at, is_active, zones(slug)",
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
    notes: `Barang baru ditambahkan dengan kondisi ${getConditionLabel(item.conditionId)}.`,
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
  schoolId?: string,
): Promise<InventoryItem> {
  validateInventoryInput(input);

  const supabase = requireSupabaseClient();
  const zone = await getZoneBySlug(supabase, input.zoneId);
  const existing = await getItemById(supabase, itemId);
  const nextCheckedAt = toTimestamp(input.lastCheckedAt) ?? new Date().toISOString();

  const schoolUuid = schoolId ? await getSchoolUuid(supabase, schoolId) : undefined;
  const inputSchoolUuid = input.school_id ? await getSchoolUuid(supabase, input.school_id) : undefined;
  const inputWithUuid = { ...input, school_id: inputSchoolUuid };

  let updateQuery = supabase
    .from("items")
    .update(toDbItemUpdate(inputWithUuid, zone.id, nextCheckedAt))
    .eq("id", itemId);

  if (schoolUuid) {
    updateQuery = updateQuery.eq("school_id", schoolUuid);
  }

  const { data: updatedItem, error: updateError } = await updateQuery
    .select(
      "id, zone_id, asset_tag, name, type_id, condition_id, status, quantity, minimum_quantity, acquisition_date, source_id, location_detail, owner, primary_photo_url, notes, last_checked_at, is_active, zones(slug)",
    )
    .single();

  if (updateError) {
    throw updateError;
  }

  const item = mapInventoryItem(updatedItem as DbItemRow, new Map([[zone.id, zone.slug]]));

  const previousConditionId = normalizeConditionId(existing.condition_id);

  if (previousConditionId !== item.conditionId) {
    const { error: logError } = await supabase.from("item_condition_logs").insert({
      item_id: item.id,
      previous_condition_id: previousConditionId,
      new_condition_id: item.conditionId,
      notes: `Kondisi berubah dari ${getConditionLabel(previousConditionId)} menjadi ${getConditionLabel(item.conditionId)}.`,
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

export async function softDeleteInventoryItem(itemId: string, schoolId?: string): Promise<void> {
  const supabase = requireSupabaseClient();
  const schoolUuid = schoolId ? await getSchoolUuid(supabase, schoolId) : undefined;

  let deleteQuery = supabase
    .from("items")
    .update({
      is_active: false,
      deleted_at: new Date().toISOString(),
      deleted_reason: "Soft deleted from inventory app.",
    })
    .eq("id", itemId);

  if (schoolUuid) {
    deleteQuery = deleteQuery.eq("school_id", schoolUuid);
  }

  const { error } = await deleteQuery;

  if (error) {
    throw error;
  }
}

export async function createInventoryZone(
  input: SaveInventoryZoneInput,
): Promise<InventoryZone> {
  const name = validateZoneInput(input);
  const supabase = requireSupabaseClient();
  const schoolUuid = input.school_id ? await getSchoolUuid(supabase, input.school_id) : undefined;
  const slug = await createUniqueZoneSlug(supabase, name, schoolUuid);

  const { data, error } = await supabase
    .from("zones")
    .insert({
      name,
      slug,
      description: input.description?.trim() || null,
      school_id: schoolUuid || null,
    })
    .select("id, name, slug, description")
    .single();

  if (error) {
    throw error;
  }

  return mapZone(data as DbZoneRow);
}

export async function updateInventoryZone(
  zoneId: InventoryZoneId,
  input: SaveInventoryZoneInput,
): Promise<InventoryZone> {
  const name = validateZoneInput(input);
  const supabase = requireSupabaseClient();

  const { data, error } = await supabase
    .from("zones")
    .update({
      name,
      description: input.description?.trim() || null,
    })
    .eq("slug", zoneId)
    .select("id, name, slug, description")
    .single();

  if (error) {
    throw error;
  }

  return mapZone(data as DbZoneRow);
}

export async function deleteInventoryZone(zoneId: InventoryZoneId): Promise<void> {
  const supabase = requireSupabaseClient();
  const zone = await getZoneBySlug(supabase, zoneId);
  const { count, error: countError } = await supabase
    .from("items")
    .select("id", { count: "exact", head: true })
    .eq("zone_id", zone.id);

  if (countError) {
    throw countError;
  }

  if ((count ?? 0) > 0) {
    throw new InventoryValidationError(
      "Zona masih memiliki barang, jadi belum bisa dihapus. Pindahkan atau hapus barangnya dulu.",
    );
  }

  const { error } = await supabase.from("zones").delete().eq("id", zone.id);

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
    throw new Error("Foto inventaris hanya menerima format WebP.");
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
      "id, zone_id, asset_tag, name, type_id, condition_id, status, quantity, minimum_quantity, acquisition_date, source_id, location_detail, owner, primary_photo_url, notes, last_checked_at, is_active",
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
    status: "available",
    quantity: input.quantity,
    minimum_quantity: 0,
    acquisition_date: toTimestamp(input.acquisitionDate) ?? checkedAt,
    source_id: input.sourceId,
    location_detail: input.location || null,
    owner: input.owner,
    primary_photo_url: input.photoUrl ?? null,
    notes: input.notes ?? null,
    last_checked_at: toTimestamp(input.lastCheckedAt) ?? checkedAt,
    is_active: input.isActive ?? true,
    school_id: input.school_id ?? null,
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
    conditionId: normalizeConditionId(row.condition_id),
    status: row.status as InventoryStatus,
    quantity: row.quantity,
    minimumQuantity: row.minimum_quantity,
    acquisitionDate: toDateOnly(row.acquisition_date ?? row.last_checked_at),
    sourceId: normalizeSourceId(row.source_id),
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
    conditionId: normalizeConditionId(row.new_condition_id),
    checkedAt: toDateOnly(row.checked_at),
    checkedBy: row.checked_by ?? "Guru",
    note: normalizeConditionNote(row.notes ?? ""),
  };
}

function mapZones(rows: DbZoneRow[]): InventoryZone[] {
  if (rows.length === 0) {
    return [...INVENTORY_ZONES];
  }

  return rows.map(mapZone);
}

function mapZone(zone: DbZoneRow): InventoryZone {
  return {
    id: zone.slug as InventoryZoneId,
    name: zone.name,
    description: zone.description ?? "",
  };
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

function getConditionLabel(conditionId: string): string {
  const normalizedCondition = normalizeConditionId(conditionId);

  return CONDITION_LABELS[normalizedCondition] ?? conditionId;
}

function normalizeConditionNote(note: string): string {
  return note
    .replace(/\bgood\b/gi, CONDITION_LABELS.baik)
    .replace(/\bneeds-repair\b/gi, CONDITION_LABELS["perlu-perbaikan"])
    .replace(/\bdamaged\b/gi, CONDITION_LABELS["rusak-berat"])
    .replace(/\bmissing\b/gi, CONDITION_LABELS["tidak-layak-pakai"]);
}

function normalizeConditionId(conditionId: string): ConditionTypeId {
  return (
    LEGACY_CONDITION_MAP[conditionId] ??
    (CONDITION_TYPES.some((condition) => condition.id === conditionId)
      ? (conditionId as ConditionTypeId)
      : "baik")
  );
}

function normalizeSourceId(sourceId: string | null): ItemSourceId {
  return ITEM_SOURCES.some((source) => source.id === sourceId)
    ? (sourceId as ItemSourceId)
    : "bop-paud";
}

function validateZoneInput(input: SaveInventoryZoneInput): string {
  const name = input.name?.trim();
  const description = input.description?.trim() ?? "";

  if (!name) {
    throw new InventoryValidationError("Nama zona wajib diisi.");
  }

  if (name.length > 80) {
    throw new InventoryValidationError("Nama zona maksimal 80 karakter.");
  }

  if (description.length > 240) {
    throw new InventoryValidationError("Deskripsi zona maksimal 240 karakter.");
  }

  return name;
}

async function createUniqueZoneSlug(
  supabase: SupabaseClient,
  name: string,
  schoolId?: string | null,
): Promise<string> {
  const baseSlug = slugifyZoneName(name);
  let candidate = baseSlug;
  let suffix = 2;

  while (await zoneSlugExists(supabase, candidate, schoolId)) {
    candidate = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

async function zoneSlugExists(
  supabase: SupabaseClient,
  slug: string,
  schoolId?: string | null,
): Promise<boolean> {
  let query = supabase
    .from("zones")
    .select("id")
    .eq("slug", slug);

  if (schoolId) {
    query = query.eq("school_id", schoolId);
  } else {
    query = query.is("school_id", null);
  }

  const { data, error } = await query.limit(1).maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data);
}

function slugifyZoneName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || `zona-${Date.now()}`;
}

function validateInventoryInput(input: SaveInventoryItemInput): void {
  const assetTag = input.assetTag?.trim();
  const name = input.name?.trim();
  const location = input.location?.trim();
  const validTypes = new Set(ITEM_TYPES.map((type) => type.id));
  const validConditions = new Set(CONDITION_TYPES.map((condition) => condition.id));
  const validSources = new Set(ITEM_SOURCES.map((source) => source.id));

  if (!assetTag) {
    throw new InventoryValidationError("Kode barang wajib diisi.");
  }

  if (assetTag.length > 40) {
    throw new InventoryValidationError("Kode barang maksimal 40 karakter.");
  }

  if (!name) {
    throw new InventoryValidationError("Nama barang wajib diisi.");
  }

  if (name.length > 120) {
    throw new InventoryValidationError("Nama barang maksimal 120 karakter.");
  }

  if (!location) {
    throw new InventoryValidationError("Lokasi barang wajib diisi.");
  }

  if (!input.zoneId?.trim()) {
    throw new InventoryValidationError("Zona barang wajib dipilih.");
  }

  if (!validTypes.has(input.typeId)) {
    throw new InventoryValidationError("Jenis barang tidak valid.");
  }

  if (!validConditions.has(input.conditionId)) {
    throw new InventoryValidationError("Kondisi barang tidak valid.");
  }

  if (!input.acquisitionDate || Number.isNaN(Date.parse(input.acquisitionDate))) {
    throw new InventoryValidationError("Tanggal perolehan wajib diisi.");
  }

  if (!validSources.has(input.sourceId)) {
    throw new InventoryValidationError("Asal barang tidak valid.");
  }

  if (!Number.isInteger(input.quantity) || input.quantity < 0) {
    throw new InventoryValidationError("Jumlah barang harus angka 0 atau lebih.");
  }

}

