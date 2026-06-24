"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  CONDITION_LOGS,
  CONDITION_TYPES,
  INVENTORY_ITEMS,
  INVENTORY_ZONES,
  ITEM_SOURCES,
  ITEM_TYPES,
  type ConditionLog,
  type ConditionTypeId,
  type InventoryItem,
  type InventoryZone,
  type InventoryZoneId,
  type ItemSourceId,
  type ItemTypeId,
  getConditionById,
  getDashboardStats,
  getItemTypeById,
  getItemsNeedingAttention,
  needsAttention,
} from "@/lib/inventory";
import {
  createInventoryItem,
  createInventoryZone,
  deleteInventoryZone,
  fetchInventory,
  softDeleteInventoryItem,
  updateInventoryItem,
  updateInventoryZone,
  uploadInventoryPhoto,
  type SaveInventoryItemInput,
  type SaveInventoryZoneInput,
} from "@/lib/api-client";
import { compressImageToWebp, validateSourceImage } from "@/lib/media";
import { useSchool } from "@/lib/school-context";
import { SchoolGuard } from "@/components/SchoolGuard";
import {
  OBSERVATION_THEMES,
  OBSERVATION_INDICATORS,
  CATEGORY_LABELS,
  createEmptyWizard,
  createEmptyChild,
  getCategory,
  areAllScoresFilled,
  calculateAverageScore,
  type WizardState,
  type ObservationSession,
  type ChildScores,
  type ObservationThemeId,
} from "@/lib/observation";
import {
  fetchObservationSessions,
  saveObservationSession,
} from "@/lib/api-client";

type AppTab = "dashboard" | "zones" | "observasi";

type ItemFormState = {
  id?: string;
  assetTag: string;
  name: string;
  zoneId: InventoryZoneId;
  typeId: ItemTypeId;
  conditionId: ConditionTypeId;
  quantity: string;
  acquisitionDate: string;
  sourceId: ItemSourceId;
  location: string;
  notes: string;
  photoUrl?: string;
};

type ToastState = {
  id: number;
  tone: "error" | "success";
  message: string;
};

type ZoneFormState = {
  id?: InventoryZoneId;
  name: string;
  description: string;
};

const conditionLabels: Record<ConditionTypeId, string> = {
  baik: "Baik",
  "layak-pakai": "Layak Pakai",
  "rusak-ringan": "Rusak Ringan",
  "rusak-berat": "Rusak Berat",
  "perlu-perbaikan": "Perlu Perbaikan",
  "tidak-layak-pakai": "Tidak Layak Pakai",
};

const typeLabels: Record<ItemTypeId, string> = {
  equipment: "Peralatan",
  tool: "Alat",
  consumable: "Bahan Habis Pakai",
  "learning-kit": "Kit Belajar",
  display: "Pajangan",
};

const sourceLabels: Record<ItemSourceId, string> = {
  bos: "BOS",
  "bop-paud": "BOP PAUD",
  hibah: "Hibah",
  donasi: "Donasi",
  "pembelian-sekolah": "Pembelian Sekolah",
  "bantuan-pemerintah": "Bantuan Pemerintah",
  csr: "CSR",
  "swadaya-orang-tua": "Swadaya Orang Tua",
};

const defaultZoneVisuals = [
  {
    id: "mini-garden",
    badge: "MG",
    theme: "bg-[#eef8ef]",
    iconBg: "bg-[#d3f0dc] text-[#27684f]",
  },
  {
    id: "art-gallery",
    badge: "AG",
    theme: "bg-[#fff0f5]",
    iconBg: "bg-[#f8d9e7] text-[#9d3e67]",
  },
  {
    id: "biodiversity-drama",
    badge: "BD",
    theme: "bg-[#eef7fb]",
    iconBg: "bg-[#d8edf7] text-[#2a6f86]",
  },
  {
    id: "steam-lab",
    badge: "SL",
    theme: "bg-[#f1f0ff]",
    iconBg: "bg-[#dedcff] text-[#514ba5]",
  },
  {
    id: "eco-upcycle",
    badge: "EU",
    theme: "bg-[#fff7df]",
    iconBg: "bg-[#f8e9b7] text-[#8a5a13]",
  },
];

function getZoneVisual(zone: InventoryZone, index: number) {
  const visual =
    defaultZoneVisuals.find((entry) => entry.id === zone.id) ??
    defaultZoneVisuals[index % defaultZoneVisuals.length];

  return {
    ...visual,
    badge: getZoneBadge(zone.name),
  };
}

function getZoneBadge(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const initials = words
    .map((word) => word.match(/[a-z0-9]/i)?.[0] ?? "")
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return initials || "Z";
}

function createEmptyForm(zoneId: InventoryZoneId): ItemFormState {
  const prefix = zoneId
    .split("-")
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return {
    assetTag: `${prefix}-BARU`,
    name: "",
    zoneId,
    typeId: "equipment",
    conditionId: "baik",
    quantity: "1",
    acquisitionDate: new Date().toISOString().slice(0, 10),
    sourceId: "bop-paud",
    location: "",
    notes: "",
  };
}

function createSuggestedAssetTag(
  zoneId: InventoryZoneId,
  items: InventoryItem[],
): string {
  const prefix = zoneId
    .split("-")
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  const usedNumbers = items
    .filter((item) => item.zoneId === zoneId)
    .map((item) => item.assetTag.match(new RegExp(`^${prefix}-(\\d+)$`))?.[1])
    .filter((value): value is string => Boolean(value))
    .map((value) => Number.parseInt(value, 10))
    .filter((value) => Number.isFinite(value));
  const nextNumber = usedNumbers.length > 0 ? Math.max(...usedNumbers) + 1 : 1;

  return `${prefix}-${String(nextNumber).padStart(3, "0")}`;
}

function validateFormInput(
  form: ItemFormState,
  items: InventoryItem[],
): string {
  const assetTag = form.assetTag.trim();
  const name = form.name.trim();
  const location = form.location.trim();
  const quantity = Number.parseInt(form.quantity, 10);
  const duplicateAsset = items.some(
    (item) =>
      item.isActive &&
      item.id !== form.id &&
      item.assetTag.trim().toLowerCase() === assetTag.toLowerCase(),
  );

  if (!assetTag) {
    return "Kode barang wajib diisi.";
  }

  if (assetTag.length > 40) {
    return "Kode barang maksimal 40 karakter.";
  }

  if (duplicateAsset) {
    return "Kode barang sudah digunakan. Pakai kode lain.";
  }

  if (!name) {
    return "Nama barang wajib diisi.";
  }

  if (name.length > 120) {
    return "Nama barang maksimal 120 karakter.";
  }

  if (!location) {
    return "Lokasi barang wajib diisi.";
  }

  if (!Number.isInteger(quantity) || quantity < 0) {
    return "Jumlah barang harus angka 0 atau lebih.";
  }

  if (!form.acquisitionDate || Number.isNaN(Date.parse(form.acquisitionDate))) {
    return "Tanggal perolehan wajib diisi.";
  }

  if (!ITEM_SOURCES.some((source) => source.id === form.sourceId)) {
    return "Asal barang wajib dipilih.";
  }

  return "";
}

function validateZoneForm(form: ZoneFormState): string {
  const name = form.name.trim();
  const description = form.description.trim();

  if (!name) {
    return "Nama zona wajib diisi.";
  }

  if (name.length > 80) {
    return "Nama zona maksimal 80 karakter.";
  }

  if (description.length > 240) {
    return "Deskripsi zona maksimal 240 karakter.";
  }

  return "";
}

function formatConditionNote(note: string): string {
  return note
    .replace(/\bgood\b/gi, conditionLabels.baik)
    .replace(/\bneeds-repair\b/gi, conditionLabels["perlu-perbaikan"])
    .replace(/\bdamaged\b/gi, conditionLabels["rusak-berat"])
    .replace(/\bmissing\b/gi, conditionLabels["tidak-layak-pakai"]);
}

function createLocalZoneId(name: string, zones: InventoryZone[]): string {
  const baseId =
    name
      .trim()
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || `zona-${Date.now()}`;
  const usedIds = new Set(zones.map((zone) => zone.id));
  let candidate = baseId;
  let suffix = 2;

  while (usedIds.has(candidate)) {
    candidate = `${baseId}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

export default function Home() {
  const { selectedSchool, clearSchool, isAdmin } = useSchool();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<AppTab>("dashboard");
  const [selectedZoneId, setSelectedZoneId] = useState<InventoryZoneId | null>(
    null,
  );
  const [zones, setZones] = useState<InventoryZone[]>(INVENTORY_ZONES);
  const [items, setItems] = useState<InventoryItem[]>(INVENTORY_ITEMS);
  const [conditionLogs, setConditionLogs] =
    useState<ConditionLog[]>(CONDITION_LOGS);
  const [conditionFilter, setConditionFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [photoStatus, setPhotoStatus] = useState("");
  const [formStatus, setFormStatus] = useState("");
  const [toast, setToast] = useState<ToastState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<InventoryItem | null>(null);
  const [zoneDeleteTarget, setZoneDeleteTarget] = useState<InventoryZone | null>(
    null,
  );
  const [zoneDialogMode, setZoneDialogMode] = useState<"create" | "edit" | null>(
    null,
  );
  const [zoneForm, setZoneForm] = useState<ZoneFormState>({
    name: "",
    description: "",
  });
  const [zoneFormStatus, setZoneFormStatus] = useState("");
  const [dataSource, setDataSource] = useState<"seed" | "supabase">("seed");
  const [syncStatus, setSyncStatus] = useState(
    "Memuat data contoh sambil menunggu Supabase.",
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isZoneSaving, setIsZoneSaving] = useState(false);
  const [form, setForm] = useState<ItemFormState>(
    createEmptyForm("mini-garden"),
  );
  const [schoolCode] = useState<string>(() =>
    typeof window !== 'undefined' ? sessionStorage.getItem('school_code') ?? '' : ''
  );

  useEffect(() => {
    let isMounted = true;

    fetchInventory(isAdmin ? undefined : selectedSchool?.id)
      .then((payload) => {
        if (!isMounted) {
          return;
        }

        if (payload.source === "supabase" || payload.items.length > 0) {
          setItems(payload.items);
        }

        if (
          payload.source === "supabase" ||
          payload.conditionLogs.length > 0
        ) {
          setConditionLogs(payload.conditionLogs);
        }

        if (payload.zones.length > 0) {
          setZones(payload.zones);
        }

        setDataSource(payload.source);
        setSyncStatus(
          payload.source === "supabase"
            ? "Tersambung ke Supabase."
            : (payload.message ?? "Mode data contoh aktif."),
        );
      })
      .catch((error: unknown) => {
        if (!isMounted) {
          return;
        }

        setDataSource("seed");
        setSyncStatus(
          error instanceof Error
            ? `Gagal memuat Supabase: ${error.message}`
            : "Gagal memuat Supabase. Mode data contoh aktif.",
        );
      });

    return () => {
      isMounted = false;
    };
  }, [selectedSchool?.id, isAdmin]);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timeout = window.setTimeout(() => setToast(null), 3200);

    return () => window.clearTimeout(timeout);
  }, [toast]);

  const activeItems = useMemo(
    () => items.filter((item) => item.isActive),
    [items],
  );
  const selectedZone = selectedZoneId
    ? zones.find((zone) => zone.id === selectedZoneId) ?? null
    : null;
  const stats = getDashboardStats(activeItems);

  const zoneItems = useMemo(() => {
    if (!selectedZoneId) {
      return [];
    }

    return activeItems.filter((item) => {
      const normalizedQuery = query.trim().toLowerCase();
      const matchesZone = item.zoneId === selectedZoneId;
      const matchesCondition =
        conditionFilter === "all" || item.conditionId === conditionFilter;
      const matchesQuery =
        normalizedQuery.length === 0 ||
        item.name.toLowerCase().includes(normalizedQuery) ||
        item.assetTag.toLowerCase().includes(normalizedQuery) ||
        item.location.toLowerCase().includes(normalizedQuery);

      return matchesZone && matchesCondition && matchesQuery;
    });
  }, [activeItems, conditionFilter, query, selectedZoneId]);

  function openZone(zoneId: InventoryZoneId) {
    setSelectedZoneId(zoneId);
    setActiveTab("zones");
    setConditionFilter("all");
    setQuery("");
    setIsFormOpen(false);
    setForm(createEmptyForm(zoneId));
  }

  function openAddForm() {
    const zoneId = selectedZoneId ?? zones[0]?.id ?? "mini-garden";
    setForm({
      ...createEmptyForm(zoneId),
      assetTag: createSuggestedAssetTag(zoneId, activeItems),
      location: selectedSchool?.name ?? "",
    });
    setPhotoStatus("");
    setFormStatus("");
    setIsFormOpen(true);
  }

  function openReport(zoneId?: InventoryZoneId) {
    const params = new URLSearchParams();
    if (zoneId) params.set("zoneId", zoneId);
    if (selectedSchool?.id && !isAdmin) params.set("school_id", selectedSchool.id);
    const qs = params.toString();
    const path = qs ? `/api/reports?${qs}` : "/api/reports";
    window.open(path, "_blank", "noopener,noreferrer");
  }

  function openObservasi() { setActiveTab('observasi'); }

  function showToast(message: string, tone: ToastState["tone"] = "success") {
    setToast({ id: Date.now(), message, tone });
  }

  async function refreshInventoryFromApi(successMessage: string) {
    const payload = await fetchInventory(isAdmin ? undefined : selectedSchool?.id);

    if (payload.source === "supabase" || payload.items.length > 0) {
      setItems(payload.items);
    }

    if (payload.source === "supabase" || payload.conditionLogs.length > 0) {
      setConditionLogs(payload.conditionLogs);
    }

    if (payload.zones.length > 0) {
      setZones(payload.zones);
    }

    setDataSource(payload.source);
    setSyncStatus(successMessage);
  }

  function openEditForm(item: InventoryItem) {
    setForm({
      id: item.id,
      assetTag: item.assetTag,
      name: item.name,
      zoneId: item.zoneId,
      typeId: item.typeId,
      conditionId: item.conditionId,
      quantity: String(item.quantity),
      acquisitionDate: item.acquisitionDate,
      sourceId: item.sourceId,
      location: item.location,
      notes: item.notes ?? "",
      photoUrl: item.photoUrl,
    });
    setPhotoStatus("");
    setFormStatus("");
    setIsFormOpen(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);

    const now = new Date().toISOString().slice(0, 10);
    const quantity = Math.max(0, Number.parseInt(form.quantity, 10) || 0);
    const validationMessage = validateFormInput(form, items);

    if (validationMessage) {
      setFormStatus(validationMessage);
      setIsSaving(false);
      return;
    }

    const itemInput: SaveInventoryItemInput = {
      id: form.id,
      assetTag: form.assetTag.trim(),
      name: form.name.trim(),
      zoneId: form.zoneId,
      typeId: form.typeId,
      conditionId: form.conditionId,
      status: "available",
      quantity,
      minimumQuantity: 0,
      acquisitionDate: form.acquisitionDate,
      sourceId: form.sourceId,
      location: form.location.trim(),
      owner: "PAUD Makerspace",
      lastCheckedAt: now,
      notes: form.notes.trim() || undefined,
      photoUrl: form.photoUrl,
      isActive: true,
      school_id: isAdmin ? undefined : selectedSchool?.id,
    };

    if (dataSource === "supabase") {
      try {
        const savedItem = form.id
          ? await updateInventoryItem(form.id, itemInput)
          : await createInventoryItem(itemInput);

        await refreshInventoryFromApi("Data tersimpan ke Supabase.");
        setSelectedZoneId(savedItem.zoneId);
        setIsFormOpen(false);
        setFormStatus("");
        showToast(form.id ? "Barang berhasil diperbarui." : "Barang berhasil ditambahkan.");
        return;
      } catch (error) {
        setSyncStatus(
          error instanceof Error
            ? `Gagal menyimpan ke Supabase: ${error.message}`
            : "Gagal menyimpan ke Supabase.",
        );
        setFormStatus(
          error instanceof Error
            ? error.message
            : "Gagal menyimpan barang. Coba ulangi.",
        );
        showToast("Gagal menyimpan barang. Coba ulangi.", "error");
      } finally {
        setIsSaving(false);
      }

      return;
    }

    setItems((currentItems) => {
      const existingItem = form.id
        ? currentItems.find((item) => item.id === form.id)
        : undefined;

      if (!existingItem) {
        const newItem: InventoryItem = {
          id: `item-${Date.now()}`,
          assetTag: form.assetTag.trim(),
          name: form.name.trim(),
          zoneId: form.zoneId,
          typeId: form.typeId,
          conditionId: form.conditionId,
          status: "available",
          quantity,
          minimumQuantity: 0,
          acquisitionDate: form.acquisitionDate,
          sourceId: form.sourceId,
          location: form.location.trim(),
          owner: "PAUD Makerspace",
          lastCheckedAt: now,
          notes: form.notes.trim() || undefined,
          photoUrl: form.photoUrl,
          isActive: true,
        };

        setConditionLogs((currentLogs) => [
          {
            id: `log-${Date.now()}`,
            itemId: newItem.id,
            conditionId: newItem.conditionId,
            checkedAt: now,
            checkedBy: "Guru",
            note: `Barang baru ditambahkan dengan kondisi ${conditionLabels[newItem.conditionId]}.`,
          },
          ...currentLogs,
        ]);

        return [newItem, ...currentItems];
      }

      if (existingItem.conditionId !== form.conditionId) {
        setConditionLogs((currentLogs) => [
          {
            id: `log-${Date.now()}`,
            itemId: existingItem.id,
            conditionId: form.conditionId,
            checkedAt: now,
            checkedBy: "Guru",
            note: `Kondisi berubah dari ${conditionLabels[existingItem.conditionId]} menjadi ${conditionLabels[form.conditionId]}.`,
          },
          ...currentLogs,
        ]);
      }

      return currentItems.map((item) =>
        item.id === existingItem.id
          ? {
              ...item,
              assetTag: form.assetTag.trim() || item.assetTag,
              name: form.name.trim(),
              zoneId: form.zoneId,
              typeId: form.typeId,
              conditionId: form.conditionId,
              status: "available",
              quantity,
              minimumQuantity: 0,
              acquisitionDate: form.acquisitionDate,
              sourceId: form.sourceId,
              location: form.location.trim(),
              notes: form.notes.trim() || undefined,
              photoUrl: form.photoUrl,
              lastCheckedAt: now,
            }
          : item,
      );
    });

    setSelectedZoneId(form.zoneId);
    setIsFormOpen(false);
    setIsSaving(false);
    setFormStatus("");
    setSyncStatus("Perubahan tersimpan sementara di browser.");
    showToast(form.id ? "Barang berhasil diperbarui." : "Barang berhasil ditambahkan.");
  }

  function requestDeleteItem(itemId: string) {
    const item = items.find((entry) => entry.id === itemId);

    if (item) {
      setDeleteTarget(item);
    }
  }

  async function confirmDeleteItem() {
    if (!deleteTarget) {
      return;
    }

    const itemId = deleteTarget.id;
    const previousItems = items;
    setDeleteTarget(null);
    setItems((currentItems) =>
      currentItems.map((item) =>
        item.id === itemId ? { ...item, isActive: false } : item,
      ),
    );

    if (dataSource !== "supabase") {
      setSyncStatus("Barang dihapus sementara dari data contoh.");
      showToast("Barang dihapus dari daftar aktif.");
      return;
    }

    try {
      await softDeleteInventoryItem(itemId);
    } catch (error) {
      setItems(previousItems);
      setSyncStatus(
        error instanceof Error
          ? `Gagal menghapus barang: ${error.message}`
          : "Gagal menghapus barang.",
      );
      showToast("Gagal menghapus barang. Coba ulangi.", "error");
      return;
    }

    showToast("Barang berhasil dihapus dari daftar aktif.");

    try {
      await refreshInventoryFromApi("Barang berhasil dihapus dari daftar aktif.");
    } catch {
      // Refresh failed but delete already succeeded, don't show error
    }
  }

  function openAddZoneDialog() {
    setZoneForm({ name: "", description: "" });
    setZoneFormStatus("");
    setZoneDialogMode("create");
  }

  function openEditZoneDialog(zone: InventoryZone) {
    setZoneForm({
      id: zone.id,
      name: zone.name,
      description: zone.description,
    });
    setZoneFormStatus("");
    setZoneDialogMode("edit");
  }

  async function handleZoneSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsZoneSaving(true);

    const name = zoneForm.name.trim();
    const description = zoneForm.description.trim();
    const validationMessage = validateZoneForm(zoneForm);

    if (validationMessage) {
      setZoneFormStatus(validationMessage);
      setIsZoneSaving(false);
      return;
    }

    const zoneInput: SaveInventoryZoneInput = {
      name,
      description: description || undefined,
      school_id: isAdmin ? undefined : selectedSchool?.id,
    };

    if (dataSource === "supabase") {
      try {
        const savedZone =
          zoneDialogMode === "edit" && zoneForm.id
            ? await updateInventoryZone(zoneForm.id, zoneInput)
            : await createInventoryZone(zoneInput);

        await refreshInventoryFromApi("Data zona tersimpan ke Supabase.");
        setZoneDialogMode(null);
        setZoneFormStatus("");
        showToast(
          zoneDialogMode === "edit"
            ? "Zona berhasil diperbarui."
            : "Zona berhasil ditambahkan.",
        );

        if (zoneDialogMode !== "edit") {
          setSelectedZoneId(savedZone.id);
          setActiveTab("zones");
        }
      } catch (error) {
        setZoneFormStatus(
          error instanceof Error
            ? error.message
            : "Zona belum bisa disimpan. Coba ulangi.",
        );
        showToast("Zona belum bisa disimpan. Coba ulangi.", "error");
      } finally {
        setIsZoneSaving(false);
      }

      return;
    }

    if (zoneDialogMode === "edit" && zoneForm.id) {
      setZones((currentZones) =>
        currentZones.map((zone) =>
          zone.id === zoneForm.id ? { ...zone, name, description } : zone,
        ),
      );
      setSyncStatus("Perubahan zona tersimpan sementara di browser.");
      showToast("Zona berhasil diperbarui.");
    } else {
      const newZone: InventoryZone = {
        id: createLocalZoneId(name, zones),
        name,
        description,
      };
      setZones((currentZones) => [...currentZones, newZone]);
      setSelectedZoneId(newZone.id);
      setActiveTab("zones");
      setSyncStatus("Zona baru tersimpan sementara di browser.");
      showToast("Zona berhasil ditambahkan.");
    }

    setZoneDialogMode(null);
    setZoneFormStatus("");
    setIsZoneSaving(false);
  }

  async function confirmDeleteZone() {
    if (!zoneDeleteTarget) {
      return;
    }

    const zone = zoneDeleteTarget;
    const hasItems = items.some((item) => item.zoneId === zone.id);

    if (hasItems) {
      setZoneDeleteTarget(null);
      showToast(
        "Zona masih memiliki barang. Pindahkan atau hapus barangnya dulu.",
        "error",
      );
      return;
    }

    if (dataSource === "supabase") {
      try {
        await deleteInventoryZone(zone.id);
      } catch (error) {
        setZoneDeleteTarget(null);
        showToast(
          error instanceof Error
            ? error.message
            : "Zona belum bisa dihapus. Coba ulangi.",
          "error",
        );
        return;
      }

      if (selectedZoneId === zone.id) {
        setSelectedZoneId(null);
      }
      setZoneDeleteTarget(null);
      showToast("Zona berhasil dihapus.");

      try {
        await refreshInventoryFromApi("Zona berhasil dihapus dari Supabase.");
      } catch {
        // Refresh failed but delete already succeeded, don't show error
      }

      return;
    }

    setZones((currentZones) =>
      currentZones.filter((currentZone) => currentZone.id !== zone.id),
    );
    if (selectedZoneId === zone.id) {
      setSelectedZoneId(null);
    }
    setZoneDeleteTarget(null);
    setSyncStatus("Zona dihapus sementara dari data contoh.");
    showToast("Zona berhasil dihapus.");
  }

  async function handlePhotoChange(file?: File) {
    if (!file) {
      return;
    }

    const validation = validateSourceImage(file);

    if (!validation.valid) {
      setPhotoStatus(validation.message);
      return;
    }

    setPhotoStatus("Mengompresi foto...");

    try {
      const result = await compressImageToWebp(file, {
        maxWidth: 1200,
        maxHeight: 1200,
        quality: 0.76,
        fileName: file.name,
      });
      const photoUrl =
        dataSource === "supabase"
          ? await uploadInventoryPhoto(result.blob, result.fileName)
          : URL.createObjectURL(result.blob);

      setForm((currentForm) => ({ ...currentForm, photoUrl }));
      setPhotoStatus(
        `Foto WebP siap: ${Math.max(1, Math.round(result.compressedSize / 1024))} KB`,
      );
    } catch (error) {
      setPhotoStatus(
        error instanceof Error
          ? `Foto gagal diproses: ${error.message}`
          : "Foto belum bisa diproses.",
      );
    }
  }

  return (
    <SchoolGuard>
    <main className="min-h-dvh bg-[var(--background)] pb-28 text-slate-900">
      <header className="sticky top-0 z-20 border-b border-[#ddebdc] bg-white/90 shadow-sm backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#2f7d68] text-base font-black text-white">
                IP
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-normal text-[#2f7d68]">
                  Inventaris PAUD
                </p>
                <h1 className="mt-0.5 text-xl font-black text-slate-950 sm:text-2xl">
                  Catatan Makerspace
                </h1>
              </div>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-3">
            {selectedSchool ? (
              <>
                <span className="hidden rounded-full bg-[#edf7f1] px-3 py-1.5 text-xs font-black text-[#2f7d68] ring-1 ring-[#dbe9de] sm:inline-flex">
                  {isAdmin ? "Admin - Kelola Sekolah" : selectedSchool.name}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    clearSchool();
                    router.push("/select-school");
                  }}
                  className="min-h-10 rounded-full bg-white px-3 py-2 text-xs font-black text-slate-600 ring-1 ring-slate-200 transition hover:bg-slate-50"
                >
                  Ganti Sekolah
                </button>
              </>
            ) : null}
          </div>
        </div>
      </header>

      {activeTab === "dashboard" ? (
        <DashboardView
          activeItems={activeItems}
          stats={stats}
          syncStatus={syncStatus}
          zones={zones}
          onOpenZone={openZone}
          isAdmin={isAdmin}
          onStartObservasi={openObservasi}
        />
      ) : activeTab === "zones" ? (
        <ZonesView
          zones={zones}
          conditionFilter={conditionFilter}
          conditionLogs={conditionLogs}
          isFormOpen={isFormOpen}
          onAddItem={openAddForm}
          onBack={() => {
            setSelectedZoneId(null);
            setIsFormOpen(false);
            setFormStatus("");
          }}
          onCancelForm={() => {
            setIsFormOpen(false);
            setFormStatus("");
            setPhotoStatus("");
          }}
          onClearPhoto={() => {
            setForm((current) => ({ ...current, photoUrl: undefined }));
            setPhotoStatus("");
          }}
          onDeleteItem={requestDeleteItem}
          onDeleteZone={setZoneDeleteTarget}
          onEditItem={openEditForm}
          onEditZone={openEditZoneDialog}
          onAddZone={openAddZoneDialog}
          onOpenZone={openZone}
          onPrintZone={openReport}
          onPhotoChange={handlePhotoChange}
          onQueryChange={setQuery}
          onSubmit={handleSubmit}
          onUpdateConditionFilter={setConditionFilter}
          photoStatus={photoStatus}
          query={query}
          selectedZone={selectedZone}
          setForm={setForm}
          syncStatus={syncStatus}
          isSaving={isSaving}
          form={form}
          formStatus={formStatus}
          zoneItems={zoneItems}
          activeItems={activeItems}
        />
      ) : (
        <ObservasiView schoolCode={schoolCode} />
      )}

      <nav className="fixed inset-x-4 bottom-4 z-30 mx-auto grid max-w-md grid-cols-3 gap-2 rounded-3xl border border-[#d9eadf] bg-white/95 p-2 shadow-2xl backdrop-blur">
        <TabButton
          active={activeTab === "dashboard"}
          label="Dasbor"
          onClick={() => {
            setActiveTab("dashboard");
            setSelectedZoneId(null);
          }}
        />
        <TabButton
          active={activeTab === "zones"}
          label="Zona"
          onClick={() => setActiveTab("zones")}
        />
        <TabButton
          active={activeTab === "observasi"}
          label="Observasi"
          onClick={() => setActiveTab("observasi")}
        />
      </nav>

      {toast ? (
        <Toast
          key={toast.id}
          message={toast.message}
          onClose={() => setToast(null)}
          tone={toast.tone}
        />
      ) : null}

      {deleteTarget ? (
        <DeleteConfirmDialog
          item={deleteTarget}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDeleteItem}
        />
      ) : null}

      {zoneDialogMode ? (
        <ZoneFormDialog
          form={zoneForm}
          isSaving={isZoneSaving}
          mode={zoneDialogMode}
          onCancel={() => {
            setZoneDialogMode(null);
            setZoneFormStatus("");
          }}
          onChange={setZoneForm}
          onSubmit={handleZoneSubmit}
          status={zoneFormStatus}
        />
      ) : null}

      {zoneDeleteTarget ? (
        <ZoneDeleteDialog
          zone={zoneDeleteTarget}
          onCancel={() => setZoneDeleteTarget(null)}
          onConfirm={confirmDeleteZone}
        />
      ) : null}
    </main>
    </SchoolGuard>
  );
}

function ObservasiDashboardCard({ onStartObservasi }: { onStartObservasi: () => void }) {
  return (
    <div
      onClick={onStartObservasi}
      className="relative cursor-pointer overflow-hidden rounded-3xl border border-[#c5e8d0] p-5 shadow-[var(--shadow-card)] transition hover:-translate-y-1 hover:shadow-lg"
      style={{ background: 'linear-gradient(135deg, #edf7f4 0%, #f1f0ff 100%)' }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="mb-2 text-3xl">🔬</div>
          <h2 className="text-lg font-black text-slate-950">Form Observasi Eksperimen</h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
            Isi penilaian perkembangan anak untuk kegiatan VFT &amp; STEAM EduGreen.
            Skor dihitung otomatis dan rekap kelas bisa langsung dicetak.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {OBSERVATION_THEMES.map((t) => (
              <span key={t.id} className="rounded-full border border-[#dbe9de] bg-white px-3 py-1 text-xs font-bold text-[#2f7d68]">
                {t.emoji} {t.name.replace('Eksperimen ', '')}
              </span>
            ))}
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-[#f1f0ff] px-3 py-1 text-xs font-black text-[#514ba5]">5 Tema</span>
      </div>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onStartObservasi(); }}
        className="mt-4 rounded-full bg-[#2f7d68] px-5 py-2.5 text-sm font-black text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#276c59] active:translate-y-0"
      >
        Mulai Observasi →
      </button>
    </div>
  );
}

function DashboardView({
  activeItems,
  stats,
  syncStatus,
  zones,
  onOpenZone,
  isAdmin,
  onStartObservasi,
}: {
  activeItems: InventoryItem[];
  stats: ReturnType<typeof getDashboardStats>;
  syncStatus: string;
  zones: InventoryZone[];
  onOpenZone: (zoneId: InventoryZoneId) => void;
  isAdmin: boolean;
  onStartObservasi: () => void;
}) {
  return (
    <section className="mx-auto w-full max-w-7xl space-y-5 px-4 py-5 sm:px-6 lg:px-8">
      <div className="rounded-3xl border border-[#dbe9de] bg-white p-5 shadow-[var(--shadow-card)] sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="inline-flex rounded-full bg-[#edf7f1] px-4 py-2 text-sm font-black text-[#2f7d68]">
              Ringkasan Hari Ini
            </p>
            <h2 className="mt-4 max-w-3xl text-3xl font-black leading-tight text-slate-950 sm:text-4xl">
              Pantau inventaris makerspace dengan ringkas.
            </h2>
            <p className="mt-3 max-w-2xl text-base font-semibold leading-7 text-slate-600">
              Buka zona untuk memperbarui kondisi barang, foto, dan riwayat
              pengecekan.
            </p>
          </div>
          <p className="inline-flex w-fit rounded-full bg-[#fff6df] px-4 py-2 text-sm font-black text-[#8a5a13]">
            {syncStatus}
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total Barang" tone="green" value={stats.totalAssets} />
        <MetricCard label="Total Unit" tone="yellow" value={stats.totalUnits} />
        <MetricCard label="Tersedia" tone="mint" value={`${stats.availableRate}%`} />
        <MetricCard label="Perlu Cek" tone="rose" value={stats.repairQueueCount + stats.missingCount} />
      </div>

      <ObservasiDashboardCard onStartObservasi={onStartObservasi} />

      <section className="rounded-3xl border border-[#dbe9de] bg-white p-5 shadow-[var(--shadow-card)]">
        <div className="mb-4">
          <h2 className="text-xl font-black text-slate-950">
            Progres per Zona
          </h2>
          <p className="text-sm font-semibold text-slate-500">
            Pilih zona untuk melihat tabel dan mengelola barang.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {zones.map((zone) => {
            const zoneItems = activeItems.filter(
              (item) => item.zoneId === zone.id,
            );
            const attentionCount = getItemsNeedingAttention(zoneItems).length;
            const checkedCount = zoneItems.filter(
              (item) => Date.parse(item.lastCheckedAt) >= Date.parse("2026-05-15"),
            ).length;
            const percent =
              zoneItems.length === 0
                ? 0
                : Math.round((checkedCount / zoneItems.length) * 100);

            return (
              <button
                key={zone.id}
                onClick={() => onOpenZone(zone.id)}
                className="rounded-2xl border border-[#dbe9de] bg-[#f7fbf6] p-4 text-left transition hover:-translate-y-0.5 hover:bg-white hover:shadow-md active:translate-y-0"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-black text-slate-950">{zone.name}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-500">
                      {zoneItems.length} barang
                    </p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-sm font-black text-[#2f7d68] ring-1 ring-[#dbe9de]">
                    {percent}%
                  </span>
                </div>
                <div className="mt-4 h-2 rounded-full bg-white ring-1 ring-[#dbe9de]">
                  <div
                    className="h-2 rounded-full bg-[#2f7d68]"
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <p className="mt-3 text-xs font-bold text-slate-500">
                  {attentionCount} perlu perhatian
                </p>
              </button>
            );
          })}
        </div>
      </section>

      {isAdmin ? <SchoolManagementSection /> : null}
    </section>
  );
}

function SchoolManagementSection() {
  const [schools, setSchools] = useState<Array<{ id: string; name: string; access_code?: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [schoolName, setSchoolName] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [formStatus, setFormStatus] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCode, setEditCode] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [isEditSaving, setIsEditSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/schools?include_codes=true")
      .then((res) => res.json())
      .then((data: { schools: Array<{ id: string; name: string; access_code?: string }> }) => {
        setSchools(data.schools.filter((s) => s.id !== "admin"));
        setIsLoading(false);
      })
      .catch(() => {
        setIsLoading(false);
      });
  }, []);

  async function handleAddSchool(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = schoolName.trim();
    const code = accessCode.trim();

    if (!name) {
      setFormStatus("Nama sekolah wajib diisi.");
      return;
    }

    if (!code) {
      setFormStatus("Kode akses wajib diisi.");
      return;
    }

    setIsSaving(true);
    setFormStatus("");

    try {
      const response = await fetch("/api/schools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, access_code: code }),
      });

      if (!response.ok) {
        const errorData = (await response.json()) as { error?: string };
        throw new Error(errorData.error ?? "Gagal menambahkan sekolah.");
      }

      const data = (await response.json()) as { school: { id: string; name: string; access_code?: string } };
      setSchools((prev) => [...prev, { ...data.school, access_code: code }]);
      setSchoolName("");
      setAccessCode("");
      setShowForm(false);
    } catch (error) {
      setFormStatus(
        error instanceof Error ? error.message : "Gagal menambahkan sekolah.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  function startEdit(school: { id: string; name: string; access_code?: string }) {
    setEditingId(school.id);
    setEditName(school.name);
    setEditCode(school.access_code ?? "");
    setEditStatus("");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
    setEditCode("");
    setEditStatus("");
  }

  async function handleEditSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingId) return;

    const name = editName.trim();
    const code = editCode.trim();

    if (!name) {
      setEditStatus("Nama sekolah wajib diisi.");
      return;
    }

    if (!code) {
      setEditStatus("Kode akses wajib diisi.");
      return;
    }

    setIsEditSaving(true);
    setEditStatus("");

    try {
      const response = await fetch(`/api/schools/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, access_code: code }),
      });

      if (!response.ok) {
        const errorData = (await response.json()) as { error?: string };
        throw new Error(errorData.error ?? "Gagal memperbarui sekolah.");
      }

      setSchools((prev) =>
        prev.map((s) =>
          s.id === editingId ? { ...s, name, access_code: code } : s,
        ),
      );
      cancelEdit();
    } catch (error) {
      setEditStatus(
        error instanceof Error ? error.message : "Gagal memperbarui sekolah.",
      );
    } finally {
      setIsEditSaving(false);
    }
  }

  async function handleDelete(schoolId: string) {
    try {
      const response = await fetch(`/api/schools/${schoolId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = (await response.json()) as { error?: string };
        throw new Error(errorData.error ?? "Gagal menghapus sekolah.");
      }

      setSchools((prev) => prev.filter((s) => s.id !== schoolId));
    } catch {
      // Deletion failed silently handled
    } finally {
      setDeleteConfirmId(null);
    }
  }

  return (
    <section className="rounded-3xl border border-[#dbe9de] bg-white p-5 shadow-[var(--shadow-card)]">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-950">Kelola Sekolah</h2>
          <p className="text-sm font-semibold text-slate-500">
            Daftar sekolah yang terdaftar di sistem.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="min-h-11 rounded-full bg-[#2f7d68] px-5 py-2.5 text-sm font-black text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#276c59] active:translate-y-0"
        >
          Tambah Sekolah
        </button>
      </div>

      {showForm ? (
        <form
          onSubmit={handleAddSchool}
          className="mb-5 rounded-2xl border border-[#dbe9de] bg-[#f7fbf6] p-4"
        >
          <h3 className="text-base font-black text-slate-950">
            Sekolah Baru
          </h3>
          {formStatus ? (
            <p className="mt-2 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
              {formStatus}
            </p>
          ) : null}
          <div className="mt-3 space-y-3">
            <label className="block">
              <span className="text-xs font-black uppercase text-slate-400">
                Nama Sekolah
              </span>
              <input
                type="text"
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                placeholder="Contoh: TK Maju Bersama"
                className="mt-1 h-12 w-full rounded-2xl border border-[#dbe9de] bg-white px-4 text-sm font-semibold outline-none focus:border-[#2f7d68]"
              />
            </label>
            <label className="block">
              <span className="text-xs font-black uppercase text-slate-400">
                Kode Akses
              </span>
              <input
                type="text"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value)}
                placeholder="Kode untuk login sekolah"
                className="mt-1 h-12 w-full rounded-2xl border border-[#dbe9de] bg-white px-4 text-sm font-semibold outline-none focus:border-[#2f7d68]"
              />
            </label>
          </div>
          <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setFormStatus("");
              }}
              className="min-h-11 rounded-full bg-slate-50 px-5 py-2.5 text-sm font-black text-slate-600 ring-1 ring-slate-200"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="min-h-11 rounded-full bg-[#2f7d68] px-5 py-2.5 text-sm font-black text-white disabled:opacity-60"
            >
              {isSaving ? "Menyimpan..." : "Simpan Sekolah"}
            </button>
          </div>
        </form>
      ) : null}

      {isLoading ? (
        <p className="py-6 text-center text-sm font-semibold text-slate-500">
          Memuat daftar sekolah...
        </p>
      ) : schools.length === 0 ? (
        <p className="py-6 text-center text-sm font-semibold text-slate-500">
          Belum ada sekolah terdaftar.
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {schools.map((school) => (
            <div
              key={school.id}
              className="rounded-2xl border border-[#dbe9de] bg-[#f7fbf6] p-4"
            >
              {editingId === school.id ? (
                <form onSubmit={handleEditSubmit} className="space-y-3">
                  {editStatus ? (
                    <p className="rounded-2xl bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
                      {editStatus}
                    </p>
                  ) : null}
                  <label className="block">
                    <span className="text-xs font-black uppercase text-slate-400">
                      Nama Sekolah
                    </span>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="mt-1 h-10 w-full rounded-xl border border-[#dbe9de] bg-white px-3 text-sm font-semibold outline-none focus:border-[#2f7d68]"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-black uppercase text-slate-400">
                      Kode Akses
                    </span>
                    <input
                      type="text"
                      value={editCode}
                      onChange={(e) => setEditCode(e.target.value)}
                      className="mt-1 h-10 w-full rounded-xl border border-[#dbe9de] bg-white px-3 text-sm font-semibold outline-none focus:border-[#2f7d68]"
                    />
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="min-h-10 flex-1 rounded-full bg-slate-50 px-3 py-2 text-xs font-black text-slate-600 ring-1 ring-slate-200"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={isEditSaving}
                      className="min-h-10 flex-1 rounded-full bg-[#2f7d68] px-3 py-2 text-xs font-black text-white disabled:opacity-60"
                    >
                      {isEditSaving ? "Menyimpan..." : "Simpan"}
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <p className="font-black text-slate-950">{school.name}</p>
                  <p className="mt-1 text-xs font-bold text-slate-400">
                    Kode Akses: {school.access_code ?? "-"}
                  </p>
                  {deleteConfirmId === school.id ? (
                    <div className="mt-3 rounded-xl border border-red-100 bg-red-50 p-3">
                      <p className="text-xs font-bold text-red-700">
                        Yakin hapus sekolah ini?
                      </p>
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmId(null)}
                          className="min-h-9 flex-1 rounded-full bg-white px-3 py-1.5 text-xs font-black text-slate-600 ring-1 ring-slate-200"
                        >
                          Batal
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(school.id)}
                          className="min-h-9 flex-1 rounded-full bg-red-600 px-3 py-1.5 text-xs font-black text-white"
                        >
                          Hapus
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(school)}
                        className="min-h-10 flex-1 rounded-full bg-white px-3 py-2 text-xs font-black text-[#2f7d68] ring-1 ring-[#dbe9de] transition hover:bg-[#f7fbf6]"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmId(school.id)}
                        className="min-h-10 flex-1 rounded-full bg-white px-3 py-2 text-xs font-black text-red-600 ring-1 ring-red-100 transition hover:bg-red-50"
                      >
                        Hapus
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ─── Print Preview Modal ─────────────────────────────────────────────────────
function PrintPreviewModal({ sessionId, onClose }: { sessionId: string; onClose: () => void }) {
  const url = `/api/observation/report?sessionId=${sessionId}`;
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-slate-950/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      {/* Toolbar */}
      <div className="flex items-center gap-3 border-b border-[#dbe9de] bg-white px-4 py-3 shadow-sm">
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-2 rounded-full bg-slate-50 px-4 py-2 text-sm font-black text-slate-600 ring-1 ring-slate-200 transition hover:bg-white"
        >
          ← Kembali
        </button>
        <div className="ml-auto flex items-center gap-2">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-full bg-[#2f7d68] px-5 py-2 text-sm font-black text-white shadow-sm transition hover:bg-[#276c59]"
          >
            🖨️ Cetak / Unduh PDF
          </a>
        </div>
      </div>
      {/* Preview */}
      <iframe
        src={url}
        className="flex-1 w-full bg-white"
        title="Preview Rekap Observasi"
      />
    </div>
  );
}

function ObservasiView({ schoolCode }: { schoolCode: string }) {
  const [step, setStep] = useState<'list' | 'step1' | 'step2' | 'step3'>('list');
  const [wizard, setWizard] = useState(createEmptyWizard());
  const [activeChildIndex, setActiveChildIndex] = useState(0);
  const [sessions, setSessions] = useState<ObservationSession[]>([]);
  const [savedSession, setSavedSession] = useState<ObservationSession | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [printSessionId, setPrintSessionId] = useState<string | null>(null);

  useEffect(() => {
    fetchObservationSessions().then(setSessions).catch(() => setSessions([])).finally(() => setIsLoading(false));
  }, []);

  function goToStep1() {
    setWizard(createEmptyWizard());
    setActiveChildIndex(0);
    setSavedSession(null);
    setSaveError('');
    setStep('step1');
  }

  function goToStep2() {
    if (!wizard.themeId) { setSaveError('Pilih tema eksperimen.'); return; }
    if (!wizard.sessionDate) { setSaveError('Pilih tanggal sesi.'); return; }
    const valid = wizard.children.filter((c) => c.name.trim().length > 0);
    if (valid.length === 0) { setSaveError('Tambahkan minimal 1 anak.'); return; }
    setSaveError('');
    setWizard((prev) => ({ ...prev, children: valid }));
    setActiveChildIndex(0);
    setStep('step2');
  }

  function setChildScore(childIdx: number, indicatorIdx: number, score: number) {
    setWizard((prev) => {
      const children = prev.children.map((child, i) => {
        if (i !== childIdx) return child;
        const scores = [...child.scores] as ChildScores;
        scores[indicatorIdx] = score as ChildScores[number];
        return { ...child, scores };
      });
      return { ...prev, children };
    });
  }

  async function goToStep3() {
    const allFilled = wizard.children.every((c) => areAllScoresFilled(c.scores));
    if (!allFilled) { setSaveError('Semua skor harus diisi untuk setiap anak.'); return; }
    setSaveError('');
    setIsSaving(true);
    try {
      const session = await saveObservationSession({
        themeId: wizard.themeId as ObservationThemeId,
        sessionDate: wizard.sessionDate,
        children: wizard.children.map((c) => ({ name: c.name.trim(), scores: c.scores })),
      });
      setSavedSession(session);
      setSessions((prev) => [session, ...prev]);
      setStep('step3');
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Gagal menyimpan sesi observasi.');
    } finally {
      setIsSaving(false);
    }
  }

  function goBackToList() {
    setStep('list');
    setSavedSession(null);
    setSaveError('');
  }

  const currentTheme = wizard.themeId ? OBSERVATION_THEMES.find((t) => t.id === wizard.themeId) : null;

  // If print modal is open, render it full-screen
  if (printSessionId) {
    return <PrintPreviewModal sessionId={printSessionId} onClose={() => setPrintSessionId(null)} />;
  }

  return (
    <section className="mx-auto w-full max-w-7xl space-y-5 px-4 py-5 sm:px-6 lg:px-8">
      {step === 'list' ? (
        <>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="inline-flex rounded-full bg-[#edf7f1] px-4 py-2 text-sm font-black text-[#2f7d68] ring-1 ring-[#dbe9de]">
                Observasi Eksperimen
              </p>
              <h2 className="mt-3 text-3xl font-black text-slate-950">
                {schoolCode ? 'Sesi Observasi' : 'Pilih sekolah terlebih dahulu.'}
              </h2>
            </div>
            {schoolCode ? (
              <button onClick={goToStep1} className="min-h-11 rounded-full bg-[#2f7d68] px-5 py-2.5 text-sm font-black text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#276c59] active:translate-y-0">
                + Sesi Baru
              </button>
            ) : null}
          </div>

          {isLoading ? (
            <p className="text-sm font-bold text-slate-500">Memuat sesi tersimpan...</p>
          ) : sessions.length === 0 ? (
            <div className="rounded-3xl border border-[#dbe9de] bg-white p-8 text-center">
              <p className="text-4xl">🔬</p>
              <p className="mt-3 text-lg font-black text-slate-950">Belum ada sesi observasi</p>
              <p className="mt-2 text-sm font-semibold text-slate-500">Klik &quot;+ Sesi Baru&quot; untuk memulai.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {sessions.map((s) => {
                const theme = OBSERVATION_THEMES.find((t) => t.id === s.themeId);
                return (
                  <div key={s.id} className="flex items-center justify-between rounded-3xl border border-[#dbe9de] bg-white p-5 shadow-[var(--shadow-card)]">
                    <div>
                      <p className="font-black text-slate-950">{theme?.emoji} {theme?.name ?? s.themeId}</p>
                      <p className="text-sm font-semibold text-slate-500">{s.sessionDate} &middot; {s.records.length} anak</p>
                    </div>
                    <button
                      onClick={() => setPrintSessionId(s.id)}
                      className="rounded-full bg-[#edf7f1] px-4 py-2 text-sm font-black text-[#2f7d68] transition hover:bg-[#d3f0dc]"
                    >
                      🖨️ Cetak
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center justify-between mb-4">
            <button onClick={goBackToList} className="rounded-full bg-white px-4 py-2 text-sm font-black text-slate-600 ring-1 ring-[#dbe9de]">← Kembali</button>
            <ObsStepIndicator current={step === 'step1' ? 1 : step === 'step2' ? 2 : 3} />
          </div>
          {saveError ? (
            <p className="mb-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{saveError}</p>
          ) : null}

          {step === 'step1' && (
            <div className="rounded-3xl border border-[#dbe9de] bg-white p-6 shadow-[var(--shadow-card)] space-y-5">
              <h3 className="text-xl font-black text-slate-950">Setup Sesi Observasi</h3>

              {/* Theme card picker */}
              <div>
                <span className="text-xs font-black uppercase text-slate-400">Tema Eksperimen</span>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {OBSERVATION_THEMES.map((t) => {
                    const isSelected = wizard.themeId === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setWizard((p) => ({ ...p, themeId: t.id }))}
                        className={`flex items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left transition ${
                          isSelected
                            ? 'border-[#2f7d68] bg-[#edf7f1] shadow-sm'
                            : 'border-[#dbe9de] bg-[#f7fbf6] hover:border-[#aad4c4] hover:bg-white'
                        }`}
                      >
                        <span className="text-2xl">{t.emoji}</span>
                        <span className={`text-sm font-black leading-snug ${
                          isSelected ? 'text-[#2f7d68]' : 'text-slate-700'
                        }`}>
                          {t.name.replace('Eksperimen ', '')}
                        </span>
                        {isSelected && <span className="ml-auto text-[#2f7d68]">✓</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Date picker */}
              <div>
                <span className="text-xs font-black uppercase text-slate-400">Tanggal Sesi</span>
                <div className="relative mt-2">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-base">📅</span>
                  <input
                    type="date"
                    value={wizard.sessionDate}
                    onChange={(e) => setWizard((p) => ({ ...p, sessionDate: e.target.value }))}
                    className="h-12 w-full rounded-2xl border-2 border-[#dbe9de] bg-[#f7fbf6] py-0 pl-11 pr-4 text-sm font-semibold text-slate-800 outline-none transition focus:border-[#2f7d68] focus:bg-white"
                  />
                </div>
              </div>

              {/* Child names */}
              <div>
                <span className="text-xs font-black uppercase text-slate-400">Nama Anak</span>
                {wizard.children.map((child, i) => (
                  <div key={i} className="mt-2 flex gap-2">
                    <input
                      value={child.name}
                      onChange={(e) => setWizard((p) => {
                        const children = p.children.map((c, j) => j === i ? { ...c, name: e.target.value } : c);
                        return { ...p, children };
                      })}
                      placeholder={`Nama anak ${i + 1}`}
                      className="h-12 flex-1 rounded-2xl border-2 border-[#dbe9de] bg-[#f7fbf6] px-4 text-sm font-semibold outline-none transition focus:border-[#2f7d68] focus:bg-white"
                    />
                    {wizard.children.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setWizard((p) => ({ ...p, children: p.children.filter((_, j) => j !== i) }))}
                        className="rounded-full bg-red-50 px-4 text-sm font-black text-red-600 transition hover:bg-red-100"
                      >
                        Hapus
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setWizard((p) => ({ ...p, children: [...p.children, createEmptyChild('')] }))}
                  className="mt-2 rounded-full border border-dashed border-[#aad4c4] bg-[#edf7f1] px-4 py-2 text-sm font-black text-[#2f7d68] transition hover:bg-[#d3f0dc]"
                >
                  + Tambah Anak
                </button>
              </div>

              <button
                type="button"
                onClick={goToStep2}
                className="min-h-12 w-full rounded-full bg-[#2f7d68] px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-[#276c59]"
              >
                Lanjut Isi Skor →
              </button>
            </div>
          )}

          {step === 'step2' && wizard.children[activeChildIndex] && (
            <div className="rounded-3xl border border-[#dbe9de] bg-white p-6 shadow-[var(--shadow-card)]">
              {/* Child tabs */}
              <div className="mb-5 flex flex-wrap gap-2">
                {wizard.children.map((child, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => { setActiveChildIndex(i); setSaveError(''); }}
                    className={`rounded-full px-4 py-2 text-sm font-black transition ${
                      i === activeChildIndex
                        ? 'bg-[#2f7d68] text-white shadow-sm'
                        : 'bg-[#edf7f1] text-[#2f7d68] hover:bg-[#d3f0dc]'
                    }`}
                  >
                    {child.name || `Anak ${i + 1}`}
                    {areAllScoresFilled(child.scores) && i !== activeChildIndex && (
                      <span className="ml-1.5 text-xs">✓</span>
                    )}
                  </button>
                ))}
              </div>

              <div className="mb-4 flex items-center gap-3">
                <span className="text-3xl">{currentTheme?.emoji}</span>
                <div>
                  <h3 className="text-base font-black text-slate-950">{currentTheme?.name}</h3>
                  <p className="text-xs font-semibold text-slate-500">Skor: 1=BB · 2=MB · 3=BSH · 4=BSB</p>
                </div>
              </div>

              <div className="space-y-3">
                {OBSERVATION_INDICATORS.map((indicator, idx) => {
                  const score = wizard.children[activeChildIndex].scores[idx];
                  return (
                    <div key={idx} className={`rounded-2xl border p-4 transition ${
                      score > 0 ? 'border-[#aad4c4] bg-[#f0faf5]' : 'border-[#dbe9de] bg-[#f7fbf6]'
                    }`}>
                      <p className="text-sm font-bold text-slate-700 mb-3">
                        <span className="mr-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#2f7d68] text-[10px] font-black text-white">{idx + 1}</span>
                        {indicator}
                      </p>
                      <div className="flex gap-2">
                        {[1, 2, 3, 4].map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setChildScore(activeChildIndex, idx, s)}
                            className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-black transition ${
                              score === s
                                ? 'bg-[#2f7d68] text-white shadow-sm scale-110'
                                : 'bg-white text-slate-600 ring-1 ring-[#dbe9de] hover:ring-[#2f7d68] hover:text-[#2f7d68]'
                            }`}
                          >
                            {s}
                          </button>
                        ))}
                        {score > 0 && (
                          <span className="ml-2 self-center rounded-full bg-[#edf7f1] px-2.5 py-0.5 text-xs font-black text-[#2f7d68]">
                            {['', 'BB', 'MB', 'BSH', 'BSB'][score]}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-5 flex items-center justify-between border-t border-[#dbe9de] pt-4">
                <div>
                  <p className="text-xs font-bold text-slate-500">Rata-rata skor</p>
                  <p className="text-lg font-black text-[#2f7d68]">
                    {calculateAverageScore(wizard.children[activeChildIndex].scores).toFixed(2)}
                  </p>
                </div>
                {activeChildIndex < wizard.children.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => { setActiveChildIndex((prev) => prev + 1); setSaveError(''); }}
                    className="rounded-full bg-[#2f7d68] px-5 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-[#276c59]"
                  >
                    Anak Selanjutnya →
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={goToStep3}
                    disabled={isSaving}
                    className="rounded-full bg-[#2f7d68] px-5 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-[#276c59] disabled:opacity-60"
                  >
                    {isSaving ? 'Menyimpan...' : 'Simpan & Lihat Rekap →'}
                  </button>
                )}
              </div>
            </div>
          )}

          {step === 'step3' && savedSession && (
            <div className="rounded-3xl border border-[#dbe9de] bg-white p-6 shadow-[var(--shadow-card)] space-y-4">
              <h3 className="text-xl font-black text-slate-950">Rekap Observasi ✅</h3>
              <div className="flex flex-wrap gap-3 text-sm">
                <div className="rounded-2xl bg-[#edf7f1] px-4 py-2.5">
                  <span className="font-black">{currentTheme?.emoji} {currentTheme?.name}</span>
                </div>
                <div className="rounded-2xl bg-[#edf7f1] px-4 py-2.5">
                  <span className="font-black">{savedSession.sessionDate}</span>
                </div>
              </div>
              <div className="overflow-x-auto rounded-2xl border border-slate-100">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-[#f7fbf6] text-xs font-black uppercase text-slate-500">
                      <th className="px-4 py-3">Anak</th>
                      <th className="px-4 py-3">Total</th>
                      <th className="px-4 py-3">Rata</th>
                      <th className="px-4 py-3">Kategori</th>
                    </tr>
                  </thead>
                  <tbody>
                    {savedSession.records.map((r) => (
                      <tr key={r.id} className="border-b border-slate-100">
                        <td className="px-4 py-4 font-black text-slate-950">{r.childName}</td>
                        <td className="px-4 py-4 font-semibold">{r.totalScore}/48</td>
                        <td className="px-4 py-4 font-semibold">{r.averageScore.toFixed(2)}</td>
                        <td className="px-4 py-4">
                          <span className="rounded-full bg-[#edf7f1] px-3 py-1 text-xs font-black text-[#2f7d68]">
                            {r.category} — {CATEGORY_LABELS[r.category]}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={goBackToList}
                  className="min-h-12 flex-1 rounded-full border border-[#dbe9de] bg-white px-5 py-3 text-sm font-black text-slate-700 shadow-sm transition hover:bg-[#f7fbf6]"
                >
                  ← Kembali ke Daftar
                </button>
                <button
                  type="button"
                  onClick={() => setPrintSessionId(savedSession.id)}
                  className="min-h-12 flex-1 rounded-full bg-[#2f7d68] px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-[#276c59]"
                >
                  🖨️ Preview & Cetak PDF
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function ObsStepIndicator({ current }: { current: 1 | 2 | 3 }) {
  const steps = ['Setup Sesi', 'Isi Skor', 'Rekap & Cetak'];
  return (
    <div className="flex items-center">
      {steps.map((label, i) => {
        const num = (i + 1) as 1 | 2 | 3;
        const done = current > num;
        const active = current === num;
        return (
          <Fragment key={i}>
            <div className="flex flex-col items-center">
              <div className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-black ${
                done ? 'border-[#2f7d68] bg-[#2f7d68] text-white'
                : active ? 'border-[#2f7d68] bg-[#edf7f1] text-[#2f7d68]'
                : 'border-slate-200 bg-white text-slate-400'
              }`}>{done ? '✓' : num}</div>
              <p className={`mt-1 text-[10px] font-bold ${active || done ? 'text-[#2f7d68]' : 'text-slate-400'}`}>{label}</p>
            </div>
            {i < 2 && <div className={`mb-5 h-0.5 flex-1 mx-1 ${done ? 'bg-[#2f7d68]' : 'bg-slate-200'}`} />}
          </Fragment>
        );
      })}
    </div>
  );
}

function Toast({
  message,
  onClose,
  tone,
}: {
  message: string;
  onClose: () => void;
  tone: ToastState["tone"];
}) {
  const className =
    tone === "success"
      ? "border-[#dbe9de] bg-white text-[#1f5f50]"
      : "border-red-100 bg-white text-red-700";

  return (
    <div
      className={`fixed right-4 top-24 z-40 flex max-w-sm items-start gap-3 rounded-2xl border px-4 py-3 shadow-xl ${className}`}
      role="status"
    >
      <p className="text-sm font-black">{message}</p>
      <button
        type="button"
        onClick={onClose}
        className="ml-auto rounded-full px-2 text-sm font-black text-slate-400 hover:bg-slate-50 hover:text-slate-700"
        aria-label="Tutup notifikasi"
      >
        Tutup
      </button>
    </div>
  );
}

function DeleteConfirmDialog({
  item,
  onCancel,
  onConfirm,
}: {
  item: InventoryItem;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-dialog-title"
    >
      <div className="w-full max-w-md rounded-3xl border border-[#dbe9de] bg-white p-5 shadow-2xl">
        <h2 id="delete-dialog-title" className="text-xl font-black text-slate-950">
          Hapus barang?
        </h2>
        <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">
          Barang <span className="font-black text-slate-950">{item.name}</span>{" "}
          akan dihapus dari daftar aktif. Riwayat kondisi tetap disimpan.
        </p>
        <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-11 rounded-full bg-slate-50 px-5 py-2.5 text-sm font-black text-slate-600 ring-1 ring-slate-200"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="min-h-11 rounded-full bg-red-600 px-5 py-2.5 text-sm font-black text-white"
          >
            Hapus
          </button>
        </div>
      </div>
    </div>
  );
}

function ZoneFormDialog({
  form,
  isSaving,
  mode,
  onCancel,
  onChange,
  onSubmit,
  status,
}: {
  form: ZoneFormState;
  isSaving: boolean;
  mode: "create" | "edit";
  onCancel: () => void;
  onChange: React.Dispatch<React.SetStateAction<ZoneFormState>>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  status: string;
}) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="zone-dialog-title"
    >
      <form
        onSubmit={onSubmit}
        className="w-full max-w-lg rounded-3xl border border-[#dbe9de] bg-white p-5 shadow-2xl"
      >
        <h2 id="zone-dialog-title" className="text-xl font-black text-slate-950">
          {mode === "edit" ? "Edit Zona" : "Tambah Zona"}
        </h2>
        <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
          Nama zona akan tampil di kartu dan pilihan form barang.
        </p>
        {status ? (
          <p className="mt-3 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
            {status}
          </p>
        ) : null}
        <div className="mt-4 space-y-3">
          <FormInput
            label="Nama Zona"
            value={form.name}
            onChange={(value) =>
              onChange((current) => ({ ...current, name: value }))
            }
          />
          <label className="block">
            <span className="text-xs font-black uppercase text-slate-400">
              Deskripsi
            </span>
            <textarea
              value={form.description}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
              className="mt-1 min-h-24 w-full rounded-2xl border border-[#dbe9de] bg-[#f7fbf6] px-3 py-3 text-sm font-medium outline-none focus:border-[#2f7d68]"
            />
          </label>
        </div>
        <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-11 rounded-full bg-slate-50 px-5 py-2.5 text-sm font-black text-slate-600 ring-1 ring-slate-200"
          >
            Batal
          </button>
          <button
            disabled={isSaving}
            className="min-h-11 rounded-full bg-[#2f7d68] px-5 py-2.5 text-sm font-black text-white disabled:opacity-60"
          >
            {isSaving
              ? "Menyimpan..."
              : mode === "edit"
                ? "Simpan Zona"
                : "Tambah Zona"}
          </button>
        </div>
      </form>
    </div>
  );
}

function ZoneDeleteDialog({
  onCancel,
  onConfirm,
  zone,
}: {
  onCancel: () => void;
  onConfirm: () => void;
  zone: InventoryZone;
}) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="zone-delete-dialog-title"
    >
      <div className="w-full max-w-md rounded-3xl border border-[#dbe9de] bg-white p-5 shadow-2xl">
        <h2
          id="zone-delete-dialog-title"
          className="text-xl font-black text-slate-950"
        >
          Hapus zona?
        </h2>
        <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">
          Zona <span className="font-black text-slate-950">{zone.name}</span>{" "}
          akan dihapus. Zona yang masih memiliki barang tidak bisa dihapus.
        </p>
        <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-11 rounded-full bg-slate-50 px-5 py-2.5 text-sm font-black text-slate-600 ring-1 ring-slate-200"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="min-h-11 rounded-full bg-red-600 px-5 py-2.5 text-sm font-black text-white"
          >
            Hapus Zona
          </button>
        </div>
      </div>
    </div>
  );
}

function PencilIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2.4"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2.4"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6 18 20H6L5 6" />
      <path d="M10 11v5" />
      <path d="M14 11v5" />
    </svg>
  );
}

function ZonesView({
  activeItems,
  conditionFilter,
  conditionLogs,
  form,
  formStatus,
  isFormOpen,
  isSaving,
  onAddItem,
  onAddZone,
  onBack,
  onCancelForm,
  onClearPhoto,
  onDeleteItem,
  onDeleteZone,
  onEditItem,
  onEditZone,
  onOpenZone,
  onPrintZone,
  onPhotoChange,
  onQueryChange,
  onSubmit,
  onUpdateConditionFilter,
  photoStatus,
  query,
  selectedZone,
  setForm,
  syncStatus,
  zoneItems,
  zones,
}: {
  activeItems: InventoryItem[];
  conditionFilter: string;
  conditionLogs: ConditionLog[];
  form: ItemFormState;
  formStatus: string;
  isFormOpen: boolean;
  isSaving: boolean;
  onAddItem: () => void;
  onAddZone: () => void;
  onBack: () => void;
  onCancelForm: () => void;
  onClearPhoto: () => void;
  onDeleteItem: (itemId: string) => void;
  onDeleteZone: (zone: InventoryZone) => void;
  onEditItem: (item: InventoryItem) => void;
  onEditZone: (zone: InventoryZone) => void;
  onOpenZone: (zoneId: InventoryZoneId) => void;
  onPrintZone: (zoneId?: InventoryZoneId) => void;
  onPhotoChange: (file?: File) => void;
  onQueryChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onUpdateConditionFilter: (value: string) => void;
  photoStatus: string;
  query: string;
  selectedZone: InventoryZone | null;
  setForm: React.Dispatch<React.SetStateAction<ItemFormState>>;
  syncStatus: string;
  zoneItems: InventoryItem[];
  zones: InventoryZone[];
}) {
  if (!selectedZone) {
    return (
      <section className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="inline-flex rounded-full bg-[#edf7f1] px-4 py-2 text-sm font-black text-[#2f7d68] ring-1 ring-[#dbe9de]">
              Zona Makerspace
            </p>
            <h2 className="mt-3 text-3xl font-black text-slate-950">
              Pilih zona yang akan dicek.
            </h2>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              onClick={onAddZone}
              className="min-h-11 rounded-full bg-[#2f7d68] px-5 py-2.5 text-sm font-black text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#276c59] active:translate-y-0"
            >
              Tambah Zona
            </button>
            <button
              onClick={() => onPrintZone()}
              className="min-h-11 rounded-full border border-[#d9eadf] bg-white px-5 py-2.5 text-sm font-black text-[#2f7d68] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:translate-y-0"
            >
              Cetak PDF Semua Zona
            </button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {zones.map((zone, index) => {
            const zoneItems = activeItems.filter((item) => item.zoneId === zone.id);
            const attentionCount = getItemsNeedingAttention(zoneItems).length;
            const visual = getZoneVisual(zone, index);

            return (
              <article
                key={zone.id}
                className={`relative flex min-h-[17rem] flex-col rounded-3xl border border-[#dbe9de] ${visual.theme} p-5 text-left shadow-[var(--shadow-card)] transition hover:-translate-y-1 hover:shadow-lg`}
              >
                <div className="absolute left-4 right-4 top-4 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => onEditZone(zone)}
                    className="grid h-10 w-10 place-items-center rounded-full bg-white/85 text-[#2f7d68] shadow-sm ring-1 ring-[#dbe9de] transition hover:bg-white"
                    aria-label={`Edit zona ${zone.name}`}
                  >
                    <PencilIcon />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteZone(zone)}
                    className="grid h-10 w-10 place-items-center rounded-full bg-white/85 text-red-600 shadow-sm ring-1 ring-red-100 transition hover:bg-white"
                    aria-label={`Hapus zona ${zone.name}`}
                  >
                    <TrashIcon />
                  </button>
                </div>
                <div className="flex justify-center">
                  <div
                    className={`grid h-20 w-20 place-items-center rounded-3xl ${visual.iconBg} text-2xl font-black shadow-sm ring-1 ring-white/70`}
                  >
                    {visual.badge}
                  </div>
                </div>

                <div className="mt-5 flex-1 text-center">
                  <h3 className="text-xl font-black text-slate-950">
                    {zone.name}
                  </h3>
                  <p className="mt-2 text-sm font-semibold text-slate-500">
                    {zoneItems.length} barang / {attentionCount} perlu cek
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => onOpenZone(zone.id)}
                  className="mt-5 min-h-11 rounded-full bg-white px-4 py-3 text-center text-sm font-black text-[#2f7d68] shadow-sm ring-1 ring-[#dbe9de] transition hover:bg-[#f7fbf6]"
                >
                  Buka Zona
                </button>
              </article>
            );
          })}
        </div>
      </section>
    );
  }

  const zoneHistory = conditionLogs
    .map((log) => {
      const item = activeItems.find((entry) => entry.id === log.itemId);

      return item && item.zoneId === selectedZone.id ? { item, log } : null;
    })
    .filter((entry): entry is { item: InventoryItem; log: ConditionLog } =>
      Boolean(entry),
    )
    .slice(0, 6);
  const allZoneItems = activeItems.filter((item) => item.zoneId === selectedZone.id);
  const zoneAttentionCount = getItemsNeedingAttention(allZoneItems).length;

  return (
    <section className="mx-auto w-full max-w-7xl space-y-5 px-4 py-5 sm:px-6 lg:px-8">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <button
            onClick={onBack}
            className="mb-3 min-h-11 rounded-full bg-white px-4 py-2 text-sm font-black text-slate-600 shadow-sm ring-1 ring-[#dbe9de]"
          >
            Kembali ke Zona
          </button>
          <p className="text-sm font-black uppercase text-[#2f7d68]">
            Zona Terpilih
          </p>
          <h2 className="text-3xl font-black text-slate-950">
            {selectedZone.name}
          </h2>
          <p className="mt-2 text-sm font-bold text-slate-500">{syncStatus}</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            onClick={() => onPrintZone(selectedZone.id)}
            className="min-h-11 rounded-full bg-white px-5 py-2.5 text-sm font-black text-[#2f7d68] shadow-sm ring-1 ring-[#dbe9de] transition hover:-translate-y-0.5 active:translate-y-0"
          >
            Cetak Zona
          </button>
          <button
            onClick={onAddItem}
            className="min-h-11 rounded-full bg-[#2f7d68] px-5 py-2.5 text-sm font-black text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#276c59] active:translate-y-0"
          >
            Tambah Barang
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <MetricCard label="Barang Zona" tone="green" value={allZoneItems.length} />
        <MetricCard label="Perlu Cek" tone="rose" value={zoneAttentionCount} />
      </div>

      <div className={isFormOpen ? "grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]" : "space-y-5"}>
        <div className="space-y-5">
          <section className="rounded-3xl border border-[#dbe9de] bg-white p-4 shadow-[var(--shadow-card)]">
          <div className="mb-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
            <input
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Cari nama, kode, atau lokasi"
              className="h-12 min-w-0 rounded-2xl border border-[#dbe9de] bg-[#f7fbf6] px-4 text-sm font-semibold outline-none focus:border-[#2f7d68]"
            />
            <select
              value={conditionFilter}
              onChange={(event) => onUpdateConditionFilter(event.target.value)}
              className="h-12 min-w-0 rounded-2xl border border-[#dbe9de] bg-[#f7fbf6] px-4 text-sm font-semibold outline-none focus:border-[#2f7d68]"
            >
              <option value="all">Semua kondisi</option>
              {CONDITION_TYPES.map((condition) => (
                <option key={condition.id} value={condition.id}>
                  {conditionLabels[condition.id]}
                </option>
              ))}
            </select>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-100">
            <table className="w-full min-w-[760px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-[#f7fbf6] text-xs font-black uppercase text-slate-500">
                  <th className="w-[28%] px-4 py-3">Barang</th>
                  <th className="px-4 py-3">Jenis</th>
                  <th className="px-4 py-3">Tanggal</th>
                  <th className="px-4 py-3">Jumlah</th>
                  <th className="px-4 py-3">Asal</th>
                  <th className="px-4 py-3">Kondisi</th>
                  <th className="px-4 py-3">Lokasi</th>
                  <th className="px-4 py-3">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {zoneItems.map((item) => {
                  return (
                    <tr key={item.id} className="border-b border-slate-100 transition hover:bg-[#f7fbf6]">
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#edf7f1] text-xs font-black text-[#2f7d68] ring-1 ring-[#dbe9de]">
                            {item.assetTag.split("-")[0]}
                          </div>
                          <div className="min-w-0">
                            <p className="break-words font-black leading-snug text-slate-950">{item.name}</p>
                            <p className="text-xs font-bold text-slate-400">
                              {item.assetTag}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 font-semibold text-slate-600">
                        {typeLabels[getItemTypeById(item.typeId).id]}
                      </td>
                      <td className="px-4 py-4 font-semibold text-slate-600">
                        {item.acquisitionDate}
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className="font-black text-slate-700"
                        >
                          {item.quantity}
                        </span>
                      </td>
                      <td className="px-4 py-4 font-semibold text-slate-600">
                        {sourceLabels[item.sourceId]}
                      </td>
                      <td className="px-4 py-4">
                        <ConditionBadge item={item} />
                      </td>
                      <td className="max-w-[180px] break-words px-4 py-4 font-medium text-slate-600">
                        {item.location}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => onEditItem(item)}
                            className="min-h-10 rounded-full bg-[#fff2f6] px-4 py-2 text-xs font-black text-[#9d3e67] ring-1 ring-[#f3d6e2]"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => onDeleteItem(item.id)}
                            className="min-h-10 rounded-full bg-slate-50 px-4 py-2 text-xs font-black text-slate-600 ring-1 ring-slate-200"
                          >
                            Hapus
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {zoneItems.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <h3 className="text-lg font-black text-slate-950">
                Data belum ditemukan
              </h3>
              <p className="mt-2 text-sm font-medium text-slate-500">
                Coba ubah filter atau tambahkan barang baru.
              </p>
            </div>
          ) : null}
        </section>

          <HistoryPanel zoneHistory={zoneHistory} />
        </div>

        {isFormOpen ? (
          <aside>
            <ItemForm
              form={form}
              formStatus={formStatus}
              onChange={setForm}
              onCancel={onCancelForm}
              onClearPhoto={onClearPhoto}
              onPhotoChange={onPhotoChange}
              onSubmit={onSubmit}
              photoStatus={photoStatus}
              isSaving={isSaving}
              zones={zones}
            />
          </aside>
        ) : null}
      </div>
    </section>
  );
}

function HistoryPanel({
  zoneHistory,
}: {
  zoneHistory: Array<{ item: InventoryItem; log: ConditionLog }>;
}) {
  return (
    <section className="rounded-3xl border border-[#dbe9de] bg-white p-5 shadow-[var(--shadow-card)]">
      <h2 className="text-lg font-black text-slate-950">Riwayat Kondisi</h2>
      {zoneHistory.length > 0 ? (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {zoneHistory.map(({ item, log }) => (
            <div
              key={log.id}
              className="rounded-2xl border border-slate-100 bg-[#f7fbf6] p-4 text-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-words font-black text-slate-950">
                    {item.name}
                  </p>
                  <p className="mt-1 font-medium leading-6 text-slate-500">
                    {formatConditionNote(log.note)}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-black text-[#2f7d68] ring-1 ring-[#dbe9de]">
                  {conditionLabels[log.conditionId]}
                </span>
              </div>
              <p className="mt-3 text-xs font-bold text-slate-400">
                {log.checkedAt} oleh {log.checkedBy}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm font-medium text-slate-500">
          Belum ada riwayat kondisi untuk zona ini.
        </p>
      )}
    </section>
  );
}

function ItemForm({
  form,
  formStatus,
  onCancel,
  onChange,
  onClearPhoto,
  onPhotoChange,
  onSubmit,
  photoStatus,
  isSaving,
  zones,
}: {
  form: ItemFormState;
  formStatus: string;
  onCancel: () => void;
  onChange: React.Dispatch<React.SetStateAction<ItemFormState>>;
  onClearPhoto: () => void;
  onPhotoChange: (file?: File) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  photoStatus: string;
  isSaving: boolean;
  zones: InventoryZone[];
}) {
  return (
    <form
      onSubmit={onSubmit}
      className="rounded-3xl border border-[#dbe9de] bg-white p-5 shadow-[var(--shadow-card)]"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-xl font-black text-slate-950">
          {form.id ? "Edit Barang" : "Tambah Barang"}
        </h3>
        <button
          type="button"
          onClick={onCancel}
          className="min-h-10 rounded-full bg-slate-50 px-4 py-2 text-xs font-black text-slate-600 ring-1 ring-slate-200"
        >
          Batal
        </button>
      </div>
      {formStatus ? (
        <p className="mt-3 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {formStatus}
        </p>
      ) : null}
      <div className="mt-4 space-y-3">
        <FormInput
          label="Nama Barang"
          value={form.name}
          onChange={(value) => onChange((current) => ({ ...current, name: value }))}
        />
        <FormInput
          label="Kode Barang"
          value={form.assetTag}
          onChange={(value) =>
            onChange((current) => ({ ...current, assetTag: value }))
          }
        />
        <label className="block">
          <span className="text-xs font-black uppercase text-slate-400">Zona</span>
          <select
            value={form.zoneId}
            onChange={(event) =>
              onChange((current) => ({
                ...current,
                zoneId: event.target.value as InventoryZoneId,
              }))
            }
            className="mt-1 h-12 w-full rounded-2xl border border-[#dbe9de] bg-[#f7fbf6] px-3 text-sm font-semibold outline-none focus:border-[#2f7d68]"
          >
            {zones.map((zone) => (
              <option key={zone.id} value={zone.id}>
                {zone.name}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs font-black uppercase text-slate-400">
              Jenis
            </span>
            <select
              value={form.typeId}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  typeId: event.target.value as ItemTypeId,
                }))
              }
              className="mt-1 h-12 w-full rounded-2xl border border-[#dbe9de] bg-[#f7fbf6] px-3 text-sm font-semibold outline-none focus:border-[#2f7d68]"
            >
              {ITEM_TYPES.map((type) => (
                <option key={type.id} value={type.id}>
                  {typeLabels[type.id]}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-black uppercase text-slate-400">
              Kondisi
            </span>
            <select
              value={form.conditionId}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  conditionId: event.target.value as ConditionTypeId,
                }))
              }
              className="mt-1 h-12 w-full rounded-2xl border border-[#dbe9de] bg-[#f7fbf6] px-3 text-sm font-semibold outline-none focus:border-[#2f7d68]"
            >
              {CONDITION_TYPES.map((condition) => (
                <option key={condition.id} value={condition.id}>
                  {conditionLabels[condition.id]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FormInput
            label="Jumlah"
            type="number"
            value={form.quantity}
            onChange={(value) =>
              onChange((current) => ({ ...current, quantity: value }))
            }
          />
          <FormInput
            label="Tanggal Perolehan"
            type="date"
            value={form.acquisitionDate}
            onChange={(value) =>
              onChange((current) => ({ ...current, acquisitionDate: value }))
            }
          />
        </div>
        <label className="block">
          <span className="text-xs font-black uppercase text-slate-400">
            Asal Barang
          </span>
          <select
            value={form.sourceId}
            onChange={(event) =>
              onChange((current) => ({
                ...current,
                sourceId: event.target.value as ItemSourceId,
              }))
            }
            className="mt-1 h-12 w-full rounded-2xl border border-[#dbe9de] bg-[#f7fbf6] px-3 text-sm font-semibold outline-none focus:border-[#2f7d68]"
          >
            {ITEM_SOURCES.map((source) => (
              <option key={source.id} value={source.id}>
                {sourceLabels[source.id]}
              </option>
            ))}
          </select>
        </label>
        <FormInput
          label="Lokasi"
          value={form.location}
          onChange={(value) =>
            onChange((current) => ({ ...current, location: value }))
          }
        />
        <label className="block">
          <span className="text-xs font-black uppercase text-slate-400">
            Catatan
          </span>
          <textarea
            value={form.notes}
            onChange={(event) =>
              onChange((current) => ({ ...current, notes: event.target.value }))
            }
            className="mt-1 min-h-24 w-full rounded-2xl border border-[#dbe9de] bg-[#f7fbf6] px-3 py-3 text-sm font-medium outline-none focus:border-[#2f7d68]"
          />
        </label>
        <label className="block rounded-2xl border border-dashed border-[#dbe9de] bg-[#f7fbf6] p-3">
          <span className="text-xs font-black uppercase text-[#2f7d68]">
            Foto Barang WebP
          </span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => onPhotoChange(event.target.files?.[0])}
            className="mt-2 w-full text-sm font-bold text-slate-600"
          />
          {photoStatus ? (
            <p className="mt-2 text-xs font-bold text-[#2f7d68]">{photoStatus}</p>
          ) : null}
          {form.photoUrl ? (
            <button
              type="button"
              onClick={onClearPhoto}
              className="mt-2 rounded-full bg-red-50 px-3 py-1.5 text-xs font-black text-red-600 ring-1 ring-red-200 transition hover:bg-red-100"
            >
              Hapus Foto
            </button>
          ) : null}
        </label>
      </div>
      <button
        disabled={isSaving}
        className="mt-5 min-h-12 w-full rounded-full bg-[#2f7d68] px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-[#276c59] active:translate-y-0 disabled:opacity-60"
      >
        {isSaving ? "Menyimpan..." : "Simpan Barang"}
      </button>
    </form>
  );
}

function FormInput({
  label,
  onChange,
  type = "text",
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  type?: string;
  value: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-black uppercase text-slate-400">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        inputMode={type === "number" ? "numeric" : undefined}
        className="mt-1 h-12 w-full rounded-2xl border border-[#dbe9de] bg-[#f7fbf6] px-3 text-sm font-semibold outline-none focus:border-[#2f7d68]"
      />
    </label>
  );
}

function MetricCard({
  label,
  tone,
  value,
}: {
  label: string;
  tone: "green" | "mint" | "rose" | "yellow";
  value: string | number;
}) {
  const tones = {
    green: "bg-[#edf7f1] text-[#2f7d68] border-[#dbe9de]",
    mint: "bg-[#eaf8f0] text-[#2e745a] border-[#d1eadb]",
    rose: "bg-[#fff0f5] text-[#9d3e67] border-[#f3d6e2]",
    yellow: "bg-[#fff7df] text-[#8a5a13] border-[#f0dfad]",
  };

  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${tones[tone]}`}>
      <p className="text-sm font-black opacity-80">{label}</p>
      <p className="mt-3 text-3xl font-black text-slate-950">{value}</p>
    </div>
  );
}

function TabButton({
  active,
  label,
  onClick,
  badge,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  badge?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative min-h-11 rounded-xl px-4 py-3 text-sm font-black transition ${
        active
          ? "bg-[#2f7d68] text-white shadow-sm"
          : "text-slate-500 hover:bg-[#edf7f1] hover:text-slate-900"
      }`}
    >
      {label}
      {badge ? (
        <span className="absolute right-1.5 top-1.5 rounded-full bg-orange-500 px-1.5 py-0.5 text-[8px] font-black text-white leading-none">
          {badge}
        </span>
      ) : null}
    </button>
  );
}

function ConditionBadge({ item }: { item: InventoryItem }) {
  const condition = getConditionById(item.conditionId);
  const isAlert = needsAttention(item);
  const className = isAlert
    ? "bg-red-50 text-red-700"
    : "bg-[#edf7f1] text-[#2f7d68]";

  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${className}`}>
      {conditionLabels[condition.id]}
    </span>
  );
}
