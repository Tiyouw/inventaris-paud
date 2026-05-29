import {
  CONDITION_TYPES,
  INVENTORY_ZONES,
  ITEM_SOURCES,
  ITEM_TYPES,
  getConditionById,
  getItemTypeById,
  needsAttention,
} from "./inventory";
import type {
  ConditionTypeId,
  InventoryItem,
  InventoryZone,
  InventoryZoneId,
  ItemSourceId,
  ItemTypeId,
} from "./inventory";

export type InventoryReportFlag = "needs-attention" | "missing-photo";

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
  quantity: number;
  minimumQuantity: number;
  acquisitionDate: string;
  sourceId: ItemSourceId;
  sourceName: string;
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
  needsAttentionItems: number;
  itemsWithPhotos: number;
  byZone: InventoryReportCount[];
  byType: InventoryReportCount[];
  byCondition: InventoryReportCount[];
  bySource: InventoryReportCount[];
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
  schoolName?: string;
};

export type InventoryReportOptions = {
  title?: string;
  generatedAt?: string;
  includeInactive?: boolean;
  zones?: InventoryZone[];
  schoolName?: string;
};

const CONDITION_LABELS: Record<ConditionTypeId, string> = {
  baik: "Baik",
  "layak-pakai": "Layak Pakai",
  "rusak-ringan": "Rusak Ringan",
  "rusak-berat": "Rusak Berat",
  "perlu-perbaikan": "Perlu Perbaikan",
  "tidak-layak-pakai": "Tidak Layak Pakai",
};

const TYPE_LABELS: Record<ItemTypeId, string> = {
  equipment: "Peralatan",
  tool: "Alat",
  consumable: "Bahan Habis Pakai",
  "learning-kit": "Kit Belajar",
  display: "Pajangan",
};

const FLAG_LABELS: Record<InventoryReportFlag, string> = {
  "needs-attention": "Perlu Perhatian",
  "missing-photo": "Belum Ada Foto",
};

const SOURCE_LABELS: Record<ItemSourceId, string> = {
  bos: "BOS",
  "bop-paud": "BOP PAUD",
  hibah: "Hibah",
  donasi: "Donasi",
  "pembelian-sekolah": "Pembelian Sekolah",
  "bantuan-pemerintah": "Bantuan Pemerintah",
  csr: "CSR",
  "swadaya-orang-tua": "Swadaya Orang Tua",
};

export function createInventoryReport(
  items: InventoryItem[],
  options: InventoryReportOptions = {},
): InventoryReport {
  const reportItems = filterReportItems(items, options.includeInactive ?? false);
  const zones = options.zones ?? INVENTORY_ZONES;

  return {
    title: options.title ?? "Laporan Inventaris",
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    rows: createInventoryReportRows(reportItems, zones),
    summary: summarizeInventoryForReport(reportItems, zones),
    photoAppendix: createPhotoAppendixData(reportItems, zones),
    schoolName: options.schoolName,
  };
}

export function createInventoryReportRows(
  items: InventoryItem[],
  zones: InventoryZone[] = INVENTORY_ZONES,
): InventoryReportRow[] {
  return items.map((item) => {
    const zone = getReportZone(item.zoneId, zones);
    const type = getItemTypeById(item.typeId);
    const condition = getConditionById(item.conditionId);

    return {
      itemId: item.id,
      assetTag: item.assetTag,
      name: item.name,
      zoneId: item.zoneId,
      zoneName: zone.name,
      typeId: item.typeId,
      typeName: TYPE_LABELS[type.id],
      conditionId: item.conditionId,
      conditionName: CONDITION_LABELS[condition.id],
      quantity: item.quantity,
      minimumQuantity: item.minimumQuantity,
      acquisitionDate: item.acquisitionDate,
      sourceId: item.sourceId,
      sourceName: SOURCE_LABELS[item.sourceId],
      location: item.location,
      owner: item.owner,
      lastCheckedAt: item.lastCheckedAt,
      notes: item.notes ?? "",
      photoUrl: item.photoUrl,
      flags: getReportFlags(item),
    };
  });
}

export function createInventoryReportHtml(report: InventoryReport): string {
  const generatedAt = formatDateTime(report.generatedAt);
  const schoolLine = report.schoolName
    ? `<p class="muted" style="margin-top:4px;font-weight:700;">${escapeHtml(report.schoolName)}</p>`
    : "";

  return `<!doctype html>
<html lang="id">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(report.title)}</title>
    <style>
      :root {
        color: #0f172a;
        font-family: Arial, sans-serif;
      }
      body {
        margin: 0;
        background: #f8fafc;
      }
      @page {
        size: A4 landscape;
        margin: 12mm;
      }
      main {
        margin: 0 auto;
        max-width: 1120px;
        padding: 32px;
      }
      header, section {
        background: white;
        border: 1px solid #e2e8f0;
        border-radius: 18px;
        margin-bottom: 18px;
        padding: 22px;
      }
      h1, h2, p {
        margin: 0;
      }
      h1 {
        font-size: 28px;
      }
      h2 {
        font-size: 18px;
        margin-bottom: 14px;
      }
      .muted {
        color: #64748b;
        font-size: 13px;
        margin-top: 8px;
      }
      .summary {
        display: grid;
        gap: 12px;
        grid-template-columns: repeat(4, minmax(0, 1fr));
      }
      .breakdown {
        display: grid;
        gap: 14px;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        margin-top: 18px;
      }
      .metric {
        background: #f8fafc;
        border-radius: 14px;
        padding: 14px;
      }
      .metric strong {
        display: block;
        font-size: 24px;
      }
      .metric span {
        color: #64748b;
        font-size: 12px;
        font-weight: 700;
      }
      table {
        border-collapse: collapse;
        width: 100%;
      }
      th, td {
        border-bottom: 1px solid #e2e8f0;
        font-size: 12px;
        padding: 10px 8px;
        text-align: left;
        vertical-align: top;
      }
      th {
        color: #475569;
        text-transform: uppercase;
      }
      .tag {
        background: #ccfbf1;
        border-radius: 999px;
        color: #0f766e;
        display: inline-block;
        font-size: 11px;
        font-weight: 700;
        margin: 2px 4px 2px 0;
        padding: 4px 8px;
      }
      .subtable th, .subtable td {
        font-size: 11px;
        padding: 8px 6px;
      }
      .photos {
        display: grid;
        gap: 14px;
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      figure {
        break-inside: avoid;
        margin: 0;
      }
      figure img {
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        height: 220px;
        object-fit: cover;
        width: 100%;
      }
      figcaption {
        color: #475569;
        font-size: 12px;
        font-weight: 700;
        margin-top: 8px;
      }
      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-top: 18px;
      }
      .button {
        background: #f7b733;
        border: 0;
        border-radius: 14px;
        color: white;
        cursor: pointer;
        display: inline-block;
        font-size: 14px;
        font-weight: 800;
        padding: 12px 18px;
        text-decoration: none;
      }
      .button.secondary {
        background: #ffffff;
        border: 1px solid #dbe9de;
        color: #2f7d68;
      }
      @media print {
        body {
          background: white;
        }
        main {
          max-width: none;
          padding: 0;
        }
        header, section {
          border-radius: 0;
          border-width: 0 0 1px;
          page-break-inside: avoid;
        }
        section.table-section {
          page-break-inside: auto;
        }
        thead {
          display: table-header-group;
        }
        .actions {
          display: none;
        }
      }
    </style>
  </head>
  <body>
    <main>
      <header>
        <h1>${escapeHtml(report.title)}</h1>
        ${schoolLine}
        <p class="muted">Dibuat pada ${escapeHtml(generatedAt)}. Gunakan dialog cetak browser untuk menyimpan sebagai PDF.</p>
        <div class="actions">
          <a class="button secondary" href="/">Kembali ke Aplikasi</a>
          <button class="button" onclick="window.print()">Cetak / Simpan PDF</button>
        </div>
      </header>
      <section>
        <h2>Ringkasan</h2>
        <div class="summary">
          ${createMetricHtml("Barang Aktif", report.summary.activeItems)}
          ${createMetricHtml("Total Unit", report.summary.totalUnits)}
          ${createMetricHtml("Perlu Perhatian", report.summary.needsAttentionItems)}
        </div>
        <div class="breakdown">
          ${createCountTableHtml("Per Zona", report.summary.byZone)}
          ${createCountTableHtml("Per Kondisi", report.summary.byCondition)}
          ${createCountTableHtml("Per Asal Barang", report.summary.bySource)}
        </div>
      </section>
      <section class="table-section">
        <h2>Daftar Inventaris</h2>
        ${createRowsTableHtml(report.rows)}
      </section>
      <section>
        <h2>Lampiran Foto</h2>
        ${createPhotoAppendixHtml(report)}
      </section>
    </main>
  </body>
</html>`;
}

export function summarizeInventoryForReport(
  items: InventoryItem[],
  zones: InventoryZone[] = INVENTORY_ZONES,
): InventoryReportSummary {
  return {
    totalItems: items.length,
    totalUnits: sumUnits(items),
    activeItems: items.filter((item) => item.isActive).length,
    inactiveItems: items.filter((item) => !item.isActive).length,
    needsAttentionItems: items.filter(needsAttention).length,
    itemsWithPhotos: items.filter((item) => Boolean(item.photoUrl)).length,
    byZone: countByCatalog(items, zones, "zoneId"),
    byType: countByCatalog(items, ITEM_TYPES, "typeId", TYPE_LABELS),
    byCondition: countByCatalog(
      items,
      CONDITION_TYPES,
      "conditionId",
      CONDITION_LABELS,
    ),
    bySource: countByCatalog(items, ITEM_SOURCES, "sourceId", SOURCE_LABELS),
  };
}

export function createPhotoAppendixData(
  items: InventoryItem[],
  zones: InventoryZone[] = INVENTORY_ZONES,
): InventoryPhotoAppendixEntry[] {
  return items
    .filter((item) => Boolean(item.photoUrl))
    .map((item, index) => {
      const zone = getReportZone(item.zoneId, zones);

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

function getReportZone(
  zoneId: InventoryZoneId,
  zones: InventoryZone[],
): InventoryZone {
  return (
    zones.find((zone) => zone.id === zoneId) ??
    INVENTORY_ZONES.find((zone) => zone.id === zoneId) ??
    {
      id: zoneId,
      name: zoneId,
      description: "",
    }
  );
}

export function getReportFlags(item: InventoryItem): InventoryReportFlag[] {
  const flags: InventoryReportFlag[] = [];

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

function countByCatalog<
  TCatalog extends ReadonlyArray<{ id: string; name: string }>,
  TKey extends keyof InventoryItem,
>(
  items: InventoryItem[],
  catalog: TCatalog,
  key: TKey,
  labels?: Partial<Record<string, string>>,
): InventoryReportCount[] {
  return catalog.map((entry) => {
    const matchingItems = items.filter((item) => item[key] === entry.id);

    return {
      id: entry.id,
      name: labels?.[entry.id] ?? entry.name,
      count: matchingItems.length,
      units: sumUnits(matchingItems),
    };
  });
}

function sumUnits(items: InventoryItem[]): number {
  return items.reduce((total, item) => total + item.quantity, 0);
}

function createMetricHtml(label: string, value: number): string {
  return `<div class="metric"><strong>${value}</strong><span>${escapeHtml(label)}</span></div>`;
}

function createCountTableHtml(
  title: string,
  rows: InventoryReportCount[],
): string {
  const body = rows
    .map(
      (row) => `<tr>
        <td>${escapeHtml(row.name)}</td>
        <td>${row.count}</td>
        <td>${row.units}</td>
      </tr>`,
    )
    .join("");

  return `<div>
    <h2>${escapeHtml(title)}</h2>
    <table class="subtable">
      <thead>
        <tr>
          <th>Kategori</th>
          <th>Barang</th>
          <th>Unit</th>
        </tr>
      </thead>
      <tbody>${body}</tbody>
    </table>
  </div>`;
}

function createRowsTableHtml(rows: InventoryReportRow[]): string {
  if (rows.length === 0) {
    return `<p class="muted">Belum ada barang aktif pada laporan ini.</p>`;
  }

  const body = rows
    .map(
      (row) => `<tr>
        <td><strong>${escapeHtml(row.name)}</strong><br /><span class="muted">${escapeHtml(row.assetTag)}</span></td>
        <td>${escapeHtml(row.zoneName)}</td>
        <td>${escapeHtml(row.acquisitionDate)}</td>
        <td>${row.quantity}</td>
        <td>${escapeHtml(row.sourceName)}</td>
        <td>${escapeHtml(row.conditionName)}</td>
        <td>${escapeHtml(row.notes || row.location || "-")}</td>
        <td>${row.flags.map((flag) => `<span class="tag">${escapeHtml(FLAG_LABELS[flag])}</span>`).join("")}</td>
      </tr>`,
    )
    .join("");

  return `<table>
    <thead>
      <tr>
        <th>Barang</th>
        <th>Zona</th>
        <th>Tanggal Perolehan</th>
        <th>Jumlah Unit</th>
        <th>Asal Barang</th>
        <th>Kondisi</th>
        <th>Catatan</th>
        <th>Foto</th>
      </tr>
    </thead>
    <tbody>${body}</tbody>
  </table>`;
}

function createPhotoAppendixHtml(report: InventoryReport): string {
  if (report.photoAppendix.length === 0) {
    return `<p class="muted">Belum ada foto barang yang dilampirkan.</p>`;
  }

  return `<div class="photos">${report.photoAppendix
    .map(
      (entry) => `<figure>
        <img src="${escapeAttribute(entry.photoUrl)}" alt="${escapeAttribute(entry.caption)}" />
        <figcaption>${entry.appendixNumber}. ${escapeHtml(entry.caption)}<br />${escapeHtml(entry.location)}</figcaption>
      </figure>`,
    )
    .join("")}</div>`;
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/"/g, "&quot;");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
