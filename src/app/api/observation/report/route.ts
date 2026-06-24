import { NextResponse } from 'next/server';
import { getObservationSession } from '@/lib/observation-store';
import { getSchoolCodeFromCookie, escapeHtml } from '@/lib/observation-server';
import {
  OBSERVATION_THEMES, CATEGORY_RANGES, CATEGORY_LABELS,
  getSchoolByCode, getTtdUrl,
} from '@/lib/observation';

// Teacher name per school code
const TEACHER_NAMES: Record<string, string> = {
  '59': 'Musbiha',
  '69': 'Mei Al Ifa',
  '01': 'Khumaidah',
  '15': 'Avin Wardani',
  '02': 'Anik Susiawati',
};

export async function GET(request: Request) {
  const schoolCode = await getSchoolCodeFromCookie();
  if (!schoolCode) {
    return new NextResponse('Tidak ada sesi sekolah. Silakan login ulang.', { status: 401 });
  }
  const sessionId = new URL(request.url).searchParams.get('sessionId');
  if (!sessionId) {
    return new NextResponse('Parameter sessionId diperlukan.', { status: 400 });
  }
  const session = await getObservationSession(sessionId, schoolCode);
  if (!session) {
    return new NextResponse('Sesi observasi tidak ditemukan.', { status: 404 });
  }

  const school = getSchoolByCode(schoolCode);
  const theme = OBSERVATION_THEMES.find((t) => t.id === session.themeId);
  const ttdUrl = getTtdUrl(schoolCode);
  const teacherName = TEACHER_NAMES[schoolCode] ?? '';
  // Append T00:00:00 so Date() parses as local time, not UTC midnight (avoids off-by-one-day)
  const dateStr = new Date(`${session.sessionDate}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  const classAvg = session.records.length > 0
    ? (session.records.reduce((s, r) => s + r.averageScore, 0) / session.records.length).toFixed(2) : '0,00';

  const rows = session.records.map((r, i) => `
    <tr><td>${i + 1}</td><td>${escapeHtml(r.childName)}</td><td>${r.totalScore}/48</td>
    <td>${r.averageScore.toFixed(2)}</td><td><strong>${r.category}</strong> \u2014 ${CATEGORY_LABELS[r.category]}</td></tr>
  `).join('');

  const html = `<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"/>
<title>Rekap Observasi \u2013 ${escapeHtml(school?.name ?? schoolCode)}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,sans-serif;font-size:12px;padding:24px;color:#0f172a}
h1{font-size:15px;text-align:center;margin-bottom:4px}
.sub{text-align:center;font-size:12px;color:#475569;margin-bottom:16px}
.meta{display:flex;gap:24px;background:#f7fbf6;padding:10px 14px;border-radius:8px;margin-bottom:16px}
.meta label{font-size:10px;color:#64748b;display:block;font-weight:bold;text-transform:uppercase}
.meta span{font-weight:bold}
table{width:100%;border-collapse:collapse;margin-bottom:16px}
th{background:#2f7d68;color:#fff;padding:8px 10px;text-align:left;font-size:11px}
td{padding:8px 10px;border-bottom:1px solid #dbe9de;font-size:11px}
tr:nth-child(even) td{background:#f7fbf6}
.legend{font-size:10px;color:#475569;margin-bottom:20px}
.ttd{margin-top:40px;text-align:right}
.ttd p{margin-bottom:4px;font-size:11px}
.ttd img{max-width:160px;max-height:80px;margin:8px 0;display:block;margin-left:auto}
.name-line{border-top:1px solid #0f172a;padding-top:6px;min-width:200px;display:inline-block;font-size:11px;font-weight:bold;text-align:center}
@media print{body{padding:12px;-webkit-print-color-adjust:exact;print-color-adjust:exact;}@page{size:A4;margin:16mm}}
</style></head><body>
<h1>FORM OBSERVASI PERKEMBANGAN ANAK</h1>
<p class="sub">VFT Experiment Natural Science &amp; Eksperimen STEAM EduGreen</p>
<div class="meta">
  <div><label>Sekolah</label><span>${escapeHtml(school?.name ?? schoolCode)}</span></div>
  <div><label>Tema</label><span>${escapeHtml(theme?.name ?? session.themeId)}</span></div>
  <div><label>Tanggal</label><span>${dateStr}</span></div>
  <div><label>Rata-rata Kelas</label><span>${classAvg}</span></div>
</div>
<table>
  <thead><tr><th>No</th><th>Nama Anak</th><th>Total</th><th>Rata-rata</th><th>Kategori</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
<p class="legend"><strong>Keterangan:</strong>
BSB (${CATEGORY_RANGES.BSB})=${CATEGORY_LABELS.BSB} | BSH (${CATEGORY_RANGES.BSH})=${CATEGORY_LABELS.BSH} |
MB (${CATEGORY_RANGES.MB})=${CATEGORY_LABELS.MB} | BB (${CATEGORY_RANGES.BB})=${CATEGORY_LABELS.BB}</p>
<div class="ttd">
  <p>Mengetahui,</p><p>Guru Pendamping,</p>
  ${ttdUrl ? `<img src="${escapeHtml(ttdUrl)}" alt="Tanda tangan" />` : '<div style="height:80px"></div>'}
  <div><span class="name-line">${escapeHtml(teacherName)}</span></div>
</div>
${new URL(request.url).searchParams.get('print') === '1' ? "<script>window.addEventListener('load',()=>window.print());</script>" : ""}
</body></html>`;

  return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
