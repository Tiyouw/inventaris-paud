import { INVENTORY_ZONES, type ConditionLog, type InventoryItem, type InventoryZone } from "./inventory";

export type InventoryPayload = {
  items: InventoryItem[];
  conditionLogs: ConditionLog[];
  zones: InventoryZone[];
  source: "supabase" | "seed";
  message?: string;
};

export type SaveInventoryItemInput = Omit<InventoryItem, "id" | "isActive"> & {
  id?: string;
  isActive?: boolean;
  school_id?: string;
};

export type SaveInventoryZoneInput = {
  name: string;
  description?: string;
  school_id?: string;
};

type ApiErrorPayload = {
  error?: string;
  message?: string;
};

export async function fetchInventory(schoolId?: string): Promise<InventoryPayload> {
  const url = schoolId ? `/api/items?school_id=${schoolId}` : "/api/items";
  const response = await fetch(url, {
    cache: "no-store",
  });

  if (response.status === 503) {
    return {
      items: [],
      conditionLogs: [],
      zones: INVENTORY_ZONES,
      source: "seed",
      message: "Supabase belum dikonfigurasi. Menggunakan data contoh.",
    };
  }

  if (!response.ok) {
    throw new Error(await getApiError(response));
  }

  return response.json() as Promise<InventoryPayload>;
}

export async function createInventoryZone(
  zone: SaveInventoryZoneInput,
): Promise<InventoryZone> {
  const response = await fetch("/api/zones", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(zone),
  });

  if (!response.ok) {
    throw new Error(await getApiError(response));
  }

  const payload = (await response.json()) as { zone: InventoryZone };
  return payload.zone;
}

export async function updateInventoryZone(
  zoneId: string,
  zone: SaveInventoryZoneInput,
): Promise<InventoryZone> {
  const response = await fetch(`/api/zones/${zoneId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(zone),
  });

  if (!response.ok) {
    throw new Error(await getApiError(response));
  }

  const payload = (await response.json()) as { zone: InventoryZone };
  return payload.zone;
}

export async function deleteInventoryZone(zoneId: string): Promise<void> {
  const response = await fetch(`/api/zones/${zoneId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error(await getApiError(response));
  }
}

export async function createInventoryItem(
  item: SaveInventoryItemInput,
): Promise<InventoryItem> {
  const response = await fetch("/api/items", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(item),
  });

  if (!response.ok) {
    throw new Error(await getApiError(response));
  }

  const payload = (await response.json()) as { item: InventoryItem };
  return payload.item;
}

export async function updateInventoryItem(
  itemId: string,
  item: SaveInventoryItemInput,
): Promise<InventoryItem> {
  const response = await fetch(`/api/items/${itemId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(item),
  });

  if (!response.ok) {
    throw new Error(await getApiError(response));
  }

  const payload = (await response.json()) as { item: InventoryItem };
  return payload.item;
}

export async function softDeleteInventoryItem(itemId: string): Promise<void> {
  const response = await fetch(`/api/items/${itemId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error(await getApiError(response));
  }
}

export async function uploadInventoryPhoto(
  blob: Blob,
  fileName: string,
): Promise<string> {
  const formData = new FormData();
  formData.set("file", blob, fileName);

  const response = await fetch("/api/upload", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(await getApiError(response));
  }

  const payload = (await response.json()) as { url: string };
  return payload.url;
}

import type { ObservationSession, ObservationThemeId, ChildScores } from './observation';

export async function fetchObservationSessions(): Promise<ObservationSession[]> {
  const res = await fetch('/api/observation/sessions', { cache: 'no-store' });
  if (!res.ok) throw new Error('Gagal memuat sesi observasi.');
  return ((await res.json()) as { sessions: ObservationSession[] }).sessions;
}

export async function saveObservationSession(input: {
  themeId: ObservationThemeId;
  sessionDate: string;
  children: { name: string; scores: ChildScores }[];
}): Promise<ObservationSession> {
  const res = await fetch('/api/observation/sessions', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error('Gagal menyimpan sesi observasi.');
  return ((await res.json()) as { session: ObservationSession }).session;
}

export async function modifyObservationSession(id: string, input: {
  themeId: ObservationThemeId;
  sessionDate: string;
  children: { name: string; scores: ChildScores }[];
}): Promise<ObservationSession> {
  const res = await fetch(`/api/observation/sessions/${id}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error('Gagal memperbarui sesi observasi.');
  return ((await res.json()) as { session: ObservationSession }).session;
}

export function openObservationReport(sessionId: string): void {
  window.open(`/api/observation/report?sessionId=${sessionId}`, '_blank', 'noopener,noreferrer');
}

export async function removeObservationSession(sessionId: string): Promise<void> {
  const res = await fetch(`/api/observation/sessions/${sessionId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Gagal menghapus sesi observasi.');
}

async function getApiError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as ApiErrorPayload;
    return payload.message ?? payload.error ?? `Permintaan gagal: ${response.status}`;
  } catch {
    return `Permintaan gagal: ${response.status}`;
  }
}
