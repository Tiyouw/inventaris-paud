"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  CONDITION_LOGS,
  CONDITION_TYPES,
  INVENTORY_ITEMS,
  INVENTORY_ZONES,
  ITEM_TYPES,
  type ConditionLog,
  type ConditionTypeId,
  type InventoryItem,
  type InventoryStatus,
  type InventoryZoneId,
  type ItemTypeId,
  getConditionById,
  getDashboardStats,
  getItemTypeById,
  getItemsNeedingAttention,
  getLowStockItems,
  getMostRecentConditionLog,
  getZoneById,
  isLowStock,
  needsAttention,
  sortItemsByAttention,
  summarizeInventory,
} from "@/lib/inventory";
import {
  createInventoryItem,
  fetchInventory,
  softDeleteInventoryItem,
  updateInventoryItem,
  uploadInventoryPhoto,
  type SaveInventoryItemInput,
} from "@/lib/api-client";
import { compressImageToWebp } from "@/lib/media";
import { createInventoryReport } from "@/lib/reporting";

type AppTab = "dashboard" | "zones";

type ItemFormState = {
  id?: string;
  assetTag: string;
  name: string;
  zoneId: InventoryZoneId;
  typeId: ItemTypeId;
  conditionId: ConditionTypeId;
  status: InventoryStatus;
  quantity: string;
  minimumQuantity: string;
  location: string;
  notes: string;
  photoUrl?: string;
};

const conditionLabels: Record<ConditionTypeId, string> = {
  good: "Baik",
  "needs-repair": "Perlu Perbaikan",
  damaged: "Rusak",
  missing: "Hilang",
};

const statusLabels: Record<InventoryStatus, string> = {
  available: "Tersedia",
  "checked-out": "Dipakai",
  reserved: "Dipesan",
  missing: "Hilang",
};

const typeLabels: Record<ItemTypeId, string> = {
  equipment: "Peralatan",
  tool: "Alat",
  consumable: "Bahan Habis Pakai",
  "learning-kit": "Kit Belajar",
  display: "Display",
};

const zoneVisuals: Record<
  InventoryZoneId,
  {
    badge: string;
    theme: string;
    iconBg: string;
    accent: string;
  }
> = {
  "mini-garden": {
    badge: "MG",
    theme: "from-emerald-50 via-lime-50 to-cyan-50",
    iconBg: "bg-teal-100 text-teal-700",
    accent: "LINGKUNGAN",
  },
  "art-gallery": {
    badge: "AG",
    theme: "from-rose-50 via-pink-50 to-amber-50",
    iconBg: "bg-pink-100 text-pink-700",
    accent: "KREATIF",
  },
  "biodiversity-drama": {
    badge: "BD",
    theme: "from-sky-50 via-emerald-50 to-violet-50",
    iconBg: "bg-sky-100 text-sky-700",
    accent: "CERITA",
  },
  "steam-lab": {
    badge: "SL",
    theme: "from-indigo-50 via-sky-50 to-orange-50",
    iconBg: "bg-indigo-100 text-indigo-700",
    accent: "EKSPERIMEN",
  },
  "eco-upcycle": {
    badge: "EU",
    theme: "from-amber-50 via-yellow-50 to-emerald-50",
    iconBg: "bg-amber-100 text-amber-800",
    accent: "DAUR ULANG",
  },
};

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
    conditionId: "good",
    status: "available",
    quantity: "1",
    minimumQuantity: "1",
    location: "",
    notes: "",
  };
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<AppTab>("dashboard");
  const [selectedZoneId, setSelectedZoneId] = useState<InventoryZoneId | null>(
    null,
  );
  const [items, setItems] = useState<InventoryItem[]>(INVENTORY_ITEMS);
  const [conditionLogs, setConditionLogs] =
    useState<ConditionLog[]>(CONDITION_LOGS);
  const [conditionFilter, setConditionFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [photoStatus, setPhotoStatus] = useState("");
  const [dataSource, setDataSource] = useState<"seed" | "supabase">("seed");
  const [syncStatus, setSyncStatus] = useState(
    "Memuat data contoh sambil menunggu Supabase.",
  );
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState<ItemFormState>(
    createEmptyForm("mini-garden"),
  );

  useEffect(() => {
    let isMounted = true;

    fetchInventory()
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
  }, []);

  const activeItems = useMemo(
    () => items.filter((item) => item.isActive),
    [items],
  );
  const selectedZone = selectedZoneId ? getZoneById(selectedZoneId) : null;
  const stats = getDashboardStats(activeItems);
  const summary = summarizeInventory(activeItems);
  const attentionItems = sortItemsByAttention(
    getItemsNeedingAttention(activeItems),
  ).slice(0, 5);
  const lowStockItems = getLowStockItems(activeItems);
  const fullReport = createInventoryReport(activeItems, {
    title: "Laporan Inventaris Makerspace",
  });

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
    const zoneId = selectedZoneId ?? "mini-garden";
    setForm(createEmptyForm(zoneId));
    setPhotoStatus("");
    setIsFormOpen(true);
  }

  function openEditForm(item: InventoryItem) {
    setForm({
      id: item.id,
      assetTag: item.assetTag,
      name: item.name,
      zoneId: item.zoneId,
      typeId: item.typeId,
      conditionId: item.conditionId,
      status: item.status,
      quantity: String(item.quantity),
      minimumQuantity: String(item.minimumQuantity),
      location: item.location,
      notes: item.notes ?? "",
      photoUrl: item.photoUrl,
    });
    setPhotoStatus("");
    setIsFormOpen(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);

    const now = new Date().toISOString().slice(0, 10);
    const quantity = Math.max(0, Number.parseInt(form.quantity, 10) || 0);
    const minimumQuantity = Math.max(
      0,
      Number.parseInt(form.minimumQuantity, 10) || 0,
    );

    const itemInput: SaveInventoryItemInput = {
      id: form.id,
      assetTag: form.assetTag.trim() || `INV-${Date.now()}`,
      name: form.name.trim() || "Barang tanpa nama",
      zoneId: form.zoneId,
      typeId: form.typeId,
      conditionId: form.conditionId,
      status: form.status,
      quantity,
      minimumQuantity,
      location: form.location.trim() || "Belum ditentukan",
      owner: "PAUD Makerspace",
      lastCheckedAt: now,
      notes: form.notes.trim() || undefined,
      photoUrl: form.photoUrl,
      isActive: true,
    };

    const existingItem = form.id
      ? items.find((item) => item.id === form.id)
      : undefined;

    if (dataSource === "supabase") {
      try {
        const savedItem = form.id
          ? await updateInventoryItem(form.id, itemInput)
          : await createInventoryItem(itemInput);

        setItems((currentItems) => {
          const exists = currentItems.some((item) => item.id === savedItem.id);

          return exists
            ? currentItems.map((item) =>
                item.id === savedItem.id ? savedItem : item,
              )
            : [savedItem, ...currentItems];
        });

        if (!existingItem || existingItem.conditionId !== savedItem.conditionId) {
          const note = !existingItem
            ? `Barang baru ditambahkan dengan kondisi ${conditionLabels[savedItem.conditionId]}.`
            : `Kondisi berubah dari ${conditionLabels[existingItem.conditionId]} menjadi ${conditionLabels[savedItem.conditionId]}.`;

          setConditionLogs((currentLogs) => [
            {
              id: `local-log-${Date.now()}`,
              itemId: savedItem.id,
              conditionId: savedItem.conditionId,
              checkedAt: now,
              checkedBy: "Guru",
              note,
            },
            ...currentLogs,
          ]);
        }

        setSyncStatus("Data tersimpan ke Supabase.");
        setSelectedZoneId(savedItem.zoneId);
        setIsFormOpen(false);
        return;
      } catch (error) {
        setSyncStatus(
          error instanceof Error
            ? `Gagal menyimpan ke Supabase: ${error.message}`
            : "Gagal menyimpan ke Supabase.",
        );
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
          assetTag: form.assetTag.trim() || `INV-${Date.now()}`,
          name: form.name.trim() || "Barang tanpa nama",
          zoneId: form.zoneId,
          typeId: form.typeId,
          conditionId: form.conditionId,
          status: form.status,
          quantity,
          minimumQuantity,
          location: form.location.trim() || "Belum ditentukan",
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
              name: form.name.trim() || item.name,
              zoneId: form.zoneId,
              typeId: form.typeId,
              conditionId: form.conditionId,
              status: form.status,
              quantity,
              minimumQuantity,
              location: form.location.trim() || item.location,
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
    setSyncStatus("Perubahan tersimpan sementara di browser.");
  }

  async function softDeleteItem(itemId: string) {
    const previousItems = items;
    setItems((currentItems) =>
      currentItems.map((item) =>
        item.id === itemId ? { ...item, isActive: false } : item,
      ),
    );

    if (dataSource !== "supabase") {
      setSyncStatus("Barang dihapus sementara dari data contoh.");
      return;
    }

    try {
      await softDeleteInventoryItem(itemId);
      setSyncStatus("Barang berhasil dihapus dari daftar aktif.");
    } catch (error) {
      setItems(previousItems);
      setSyncStatus(
        error instanceof Error
          ? `Gagal menghapus barang: ${error.message}`
          : "Gagal menghapus barang.",
      );
    }
  }

  async function handlePhotoChange(file?: File) {
    if (!file) {
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
    } catch {
      setPhotoStatus("Foto belum bisa dikompresi di browser ini.");
    }
  }

  return (
    <main className="min-h-screen bg-[#f5f7fb] pb-28 text-slate-900">
      <header className="sticky top-0 z-20 border-b border-slate-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-black uppercase text-teal-700">
                Inventaris PAUD
              </p>
              <h1 className="mt-1 text-2xl font-black text-slate-950 sm:text-3xl">
                Logbook Makerspace
              </h1>
            </div>
            <button
              onClick={() => window.print()}
              title={`${fullReport.rows.length} baris laporan siap dicetak`}
              className="rounded-2xl bg-[#f7b733] px-5 py-3 text-sm font-black text-white shadow-[0_5px_0_#d95f0e] transition hover:-translate-y-0.5"
            >
              Cetak / PDF
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 rounded-[1.6rem] bg-slate-100 p-2 sm:max-w-lg">
            <TabButton
              active={activeTab === "dashboard"}
              label="Dashboard"
              onClick={() => {
                setActiveTab("dashboard");
                setSelectedZoneId(null);
              }}
            />
            <TabButton
              active={activeTab === "zones"}
              label="Zona Makerspace"
              onClick={() => setActiveTab("zones")}
            />
          </div>
        </div>
      </header>

      {activeTab === "dashboard" ? (
        <DashboardView
          activeItems={activeItems}
          attentionItems={attentionItems}
          lowStockItems={lowStockItems}
          stats={stats}
          summary={summary}
          syncStatus={syncStatus}
          onOpenZone={openZone}
        />
      ) : (
        <ZonesView
          conditionFilter={conditionFilter}
          conditionLogs={conditionLogs}
          isFormOpen={isFormOpen}
          onAddItem={openAddForm}
          onBack={() => {
            setSelectedZoneId(null);
            setIsFormOpen(false);
          }}
          onDeleteItem={softDeleteItem}
          onEditItem={openEditForm}
          onOpenZone={openZone}
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
          zoneItems={zoneItems}
          activeItems={activeItems}
        />
      )}

      <nav className="fixed inset-x-4 bottom-4 z-30 mx-auto grid max-w-md grid-cols-2 gap-2 rounded-[2rem] bg-white/95 p-2 shadow-2xl ring-1 ring-slate-100 backdrop-blur sm:hidden">
        <TabButton
          active={activeTab === "dashboard"}
          label="Dashboard"
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
      </nav>
    </main>
  );
}

function DashboardView({
  activeItems,
  attentionItems,
  lowStockItems,
  stats,
  summary,
  syncStatus,
  onOpenZone,
}: {
  activeItems: InventoryItem[];
  attentionItems: InventoryItem[];
  lowStockItems: InventoryItem[];
  stats: ReturnType<typeof getDashboardStats>;
  summary: ReturnType<typeof summarizeInventory>;
  syncStatus: string;
  onOpenZone: (zoneId: InventoryZoneId) => void;
}) {
  return (
    <section className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[1fr_360px] lg:px-8">
      <div className="space-y-6">
        <div className="rounded-[2rem] bg-gradient-to-br from-teal-100 via-white to-orange-100 p-6 shadow-sm">
          <p className="inline-flex rounded-full bg-white/80 px-4 py-2 text-sm font-black text-teal-700">
            Ringkasan Hari Ini
          </p>
          <h2 className="mt-4 max-w-2xl text-3xl font-black leading-tight text-slate-950 sm:text-4xl">
            Pantau kondisi sarana makerspace dalam satu tampilan.
          </h2>
          <p className="mt-3 max-w-2xl text-base font-medium leading-7 text-slate-600">
            Gunakan dashboard untuk melihat barang yang perlu perhatian sebelum
            membuka detail di setiap zona.
          </p>
          <p className="mt-4 inline-flex rounded-full bg-white/80 px-4 py-2 text-sm font-black text-slate-600">
            {syncStatus}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Total Barang" value={stats.totalAssets} />
          <MetricCard label="Total Unit" value={stats.totalUnits} />
          <MetricCard label="Tersedia" value={`${stats.availableRate}%`} />
          <MetricCard label="Perlu Cek" value={stats.repairQueueCount + stats.missingCount} />
        </div>

        <section className="rounded-[2rem] bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black text-slate-950">
                Progres per Zona
              </h2>
              <p className="text-sm font-medium text-slate-500">
                Klik zona untuk membuka kartu dan tabel inventaris.
              </p>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {summary.byZone.map((zoneCount) => {
              const zone = getZoneById(zoneCount.id as InventoryZoneId);
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
                  className="rounded-3xl border border-slate-100 bg-slate-50 p-4 text-left transition hover:-translate-y-0.5 hover:bg-white hover:shadow-md"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-black text-slate-950">{zone.name}</p>
                      <p className="text-sm font-medium text-slate-500">
                        {zoneCount.count} barang, {attentionCount} perhatian
                      </p>
                    </div>
                    <span className="rounded-full bg-teal-100 px-3 py-1 text-sm font-black text-teal-700">
                      {percent}%
                    </span>
                  </div>
                  <div className="mt-4 h-3 rounded-full bg-white">
                    <div
                      className="h-3 rounded-full bg-teal-500"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      </div>

      <aside className="space-y-4">
        <InfoPanel title="Butuh Perhatian">
          <div className="space-y-3">
            {attentionItems.map((item) => (
              <ItemAlert key={item.id} item={item} />
            ))}
          </div>
        </InfoPanel>

        <InfoPanel title="Stok Menipis">
          {lowStockItems.length > 0 ? (
            <ul className="space-y-2 text-sm font-bold text-slate-700">
              {lowStockItems.map((item) => (
                <li key={item.id} className="flex justify-between gap-3">
                  <span>{item.name}</span>
                  <span className="text-amber-700">
                    {item.quantity}/{item.minimumQuantity}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm font-medium text-slate-500">
              Semua stok aman.
            </p>
          )}
        </InfoPanel>
      </aside>
    </section>
  );
}

function ZonesView({
  activeItems,
  conditionFilter,
  conditionLogs,
  form,
  isFormOpen,
  isSaving,
  onAddItem,
  onBack,
  onDeleteItem,
  onEditItem,
  onOpenZone,
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
}: {
  activeItems: InventoryItem[];
  conditionFilter: string;
  conditionLogs: ConditionLog[];
  form: ItemFormState;
  isFormOpen: boolean;
  isSaving: boolean;
  onAddItem: () => void;
  onBack: () => void;
  onDeleteItem: (itemId: string) => void;
  onEditItem: (item: InventoryItem) => void;
  onOpenZone: (zoneId: InventoryZoneId) => void;
  onPhotoChange: (file?: File) => void;
  onQueryChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onUpdateConditionFilter: (value: string) => void;
  photoStatus: string;
  query: string;
  selectedZone: (typeof INVENTORY_ZONES)[number] | null;
  setForm: React.Dispatch<React.SetStateAction<ItemFormState>>;
  syncStatus: string;
  zoneItems: InventoryItem[];
}) {
  if (!selectedZone) {
    return (
      <section className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-5">
          <p className="inline-flex rounded-full bg-teal-100 px-4 py-2 text-sm font-black text-teal-700">
            Zona Makerspace
          </p>
          <h2 className="mt-3 text-3xl font-black text-slate-950">
            Pilih zona yang akan dicek.
          </h2>
        </div>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-5">
          {INVENTORY_ZONES.map((zone) => {
            const zoneItems = activeItems.filter((item) => item.zoneId === zone.id);
            const attentionCount = getItemsNeedingAttention(zoneItems).length;
            const visual = zoneVisuals[zone.id];

            return (
              <button
                key={zone.id}
                onClick={() => onOpenZone(zone.id)}
                className={`overflow-hidden rounded-[2rem] bg-gradient-to-br ${visual.theme} p-5 text-left shadow-sm ring-1 ring-slate-100 transition hover:-translate-y-1 hover:shadow-xl`}
              >
                <div className="flex justify-between gap-3">
                  <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-black text-teal-700">
                    {visual.accent}
                  </span>
                  <span className="rounded-full bg-pink-50 px-3 py-1 text-xs font-black text-pink-700">
                    Kelola
                  </span>
                </div>

                <div className="mt-8 flex justify-center">
                  <div
                    className={`grid h-24 w-24 place-items-center rounded-[1.7rem] ${visual.iconBg} text-3xl font-black shadow-sm`}
                  >
                    {visual.badge}
                  </div>
                </div>

                <div className="mt-7 text-center">
                  <h3 className="text-xl font-black text-slate-950">
                    {zone.name}
                  </h3>
                  <p className="mt-2 text-sm font-bold text-slate-500">
                    {zoneItems.length} barang / {attentionCount} perlu cek
                  </p>
                </div>

                <div className="mt-6 rounded-2xl bg-[#f7b733] px-4 py-4 text-center text-base font-black text-white shadow-[0_5px_0_#d95f0e]">
                  Buka Zona
                </div>
              </button>
            );
          })}
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <button
            onClick={onBack}
            className="mb-3 rounded-full bg-white px-4 py-2 text-sm font-black text-slate-600 shadow-sm"
          >
            Kembali ke Zona
          </button>
          <p className="text-sm font-black uppercase text-teal-700">
            Zona Terpilih
          </p>
          <h2 className="text-3xl font-black text-slate-950">
            {selectedZone.name}
          </h2>
          <p className="mt-2 text-sm font-bold text-slate-500">{syncStatus}</p>
        </div>
        <button
          onClick={onAddItem}
          className="rounded-2xl bg-[#f7b733] px-5 py-3 text-sm font-black text-white shadow-[0_5px_0_#d95f0e] transition hover:-translate-y-0.5"
        >
          Tambah Barang
        </button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <section className="rounded-[2rem] bg-white p-4 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <input
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Cari nama, kode, atau lokasi"
              className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold outline-none focus:border-teal-500"
            />
            <select
              value={conditionFilter}
              onChange={(event) => onUpdateConditionFilter(event.target.value)}
              className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold outline-none focus:border-teal-500"
            >
              <option value="all">Semua kondisi</option>
              {CONDITION_TYPES.map((condition) => (
                <option key={condition.id} value={condition.id}>
                  {conditionLabels[condition.id]}
                </option>
              ))}
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs font-black uppercase text-slate-400">
                  <th className="px-3 py-3">Barang</th>
                  <th className="px-3 py-3">Jenis</th>
                  <th className="px-3 py-3">Jumlah</th>
                  <th className="px-3 py-3">Kondisi</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Lokasi</th>
                  <th className="px-3 py-3">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {zoneItems.map((item) => {
                  const recentLog = getMostRecentConditionLog(
                    item.id,
                    conditionLogs,
                  );

                  return (
                    <tr key={item.id} className="border-b border-slate-100">
                      <td className="px-3 py-4">
                        <div className="flex items-center gap-3">
                          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-cyan-50 text-xs font-black text-cyan-700">
                            {item.assetTag.split("-")[0]}
                          </div>
                          <div>
                            <p className="font-black text-slate-950">{item.name}</p>
                            <p className="text-xs font-bold text-slate-400">
                              {item.assetTag}
                            </p>
                            {recentLog ? (
                              <p className="mt-1 text-xs font-medium text-slate-500">
                                Log: {recentLog.note}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-4 font-bold text-slate-600">
                        {typeLabels[getItemTypeById(item.typeId).id]}
                      </td>
                      <td className="px-3 py-4">
                        <span
                          className={
                            isLowStock(item)
                              ? "font-black text-amber-700"
                              : "font-black text-slate-700"
                          }
                        >
                          {item.quantity}
                        </span>
                        <span className="font-medium text-slate-400">
                          {" "}
                          / min {item.minimumQuantity}
                        </span>
                      </td>
                      <td className="px-3 py-4">
                        <ConditionBadge item={item} />
                      </td>
                      <td className="px-3 py-4 font-bold text-slate-600">
                        {statusLabels[item.status]}
                      </td>
                      <td className="px-3 py-4 font-medium text-slate-600">
                        {item.location}
                      </td>
                      <td className="px-3 py-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => onEditItem(item)}
                            className="rounded-xl bg-pink-50 px-3 py-2 text-xs font-black text-pink-700"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => onDeleteItem(item.id)}
                            className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-600"
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

        <aside className="space-y-4">
          {isFormOpen ? (
            <ItemForm
              form={form}
              onChange={setForm}
              onPhotoChange={onPhotoChange}
              onSubmit={onSubmit}
              photoStatus={photoStatus}
              isSaving={isSaving}
            />
          ) : (
            <InfoPanel title="Ringkasan Zona">
              <div className="space-y-3 text-sm font-bold text-slate-600">
                <p>{zoneItems.length} barang aktif ditampilkan.</p>
                <p>
                  {getItemsNeedingAttention(zoneItems).length} barang perlu
                  perhatian.
                </p>
                <p>{getLowStockItems(zoneItems).length} barang stok menipis.</p>
              </div>
            </InfoPanel>
          )}
        </aside>
      </div>
    </section>
  );
}

function ItemForm({
  form,
  onChange,
  onPhotoChange,
  onSubmit,
  photoStatus,
  isSaving,
}: {
  form: ItemFormState;
  onChange: React.Dispatch<React.SetStateAction<ItemFormState>>;
  onPhotoChange: (file?: File) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  photoStatus: string;
  isSaving: boolean;
}) {
  return (
    <form onSubmit={onSubmit} className="rounded-[2rem] bg-white p-5 shadow-sm">
      <h3 className="text-xl font-black text-slate-950">
        {form.id ? "Edit Barang" : "Tambah Barang"}
      </h3>
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
            className="mt-1 h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold outline-none"
          >
            {INVENTORY_ZONES.map((zone) => (
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
              className="mt-1 h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold outline-none"
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
              className="mt-1 h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold outline-none"
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
            label="Minimal"
            type="number"
            value={form.minimumQuantity}
            onChange={(value) =>
              onChange((current) => ({ ...current, minimumQuantity: value }))
            }
          />
        </div>
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
            className="mt-1 min-h-24 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-medium outline-none"
          />
        </label>
        <label className="block rounded-2xl border border-dashed border-teal-200 bg-teal-50 p-3">
          <span className="text-xs font-black uppercase text-teal-700">
            Foto Barang WebP
          </span>
          <input
            type="file"
            accept="image/*"
            onChange={(event) => onPhotoChange(event.target.files?.[0])}
            className="mt-2 w-full text-sm font-bold text-slate-600"
          />
          {photoStatus ? (
            <p className="mt-2 text-xs font-bold text-teal-700">{photoStatus}</p>
          ) : null}
        </label>
      </div>
      <button
        disabled={isSaving}
        className="mt-5 w-full rounded-2xl bg-[#f7b733] px-5 py-3 text-sm font-black text-white shadow-[0_5px_0_#d95f0e] disabled:opacity-60"
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
        className="mt-1 h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold outline-none focus:border-teal-500"
      />
    </label>
  );
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-[1.7rem] bg-white p-5 shadow-sm">
      <p className="text-sm font-black text-slate-400">{label}</p>
      <p className="mt-3 text-3xl font-black text-slate-950">{value}</p>
    </div>
  );
}

function InfoPanel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[2rem] bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-lg font-black text-slate-950">{title}</h2>
      {children}
    </section>
  );
}

function ItemAlert({ item }: { item: InventoryItem }) {
  return (
    <div className="rounded-3xl bg-amber-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-black text-slate-950">{item.name}</p>
          <p className="mt-1 text-xs font-bold text-slate-500">
            {conditionLabels[item.conditionId]} - {getZoneById(item.zoneId).name}
          </p>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-amber-700">
          {item.assetTag}
        </span>
      </div>
    </div>
  );
}

function TabButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-[1.2rem] px-4 py-3 text-sm font-black transition ${
        active
          ? "bg-white text-teal-700 shadow-sm"
          : "text-slate-500 hover:text-slate-900"
      }`}
    >
      {label}
    </button>
  );
}

function ConditionBadge({ item }: { item: InventoryItem }) {
  const condition = getConditionById(item.conditionId);
  const isAlert = needsAttention(item);
  const className = isAlert
    ? "bg-red-50 text-red-700"
    : "bg-teal-50 text-teal-700";

  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${className}`}>
      {conditionLabels[condition.id]}
    </span>
  );
}
