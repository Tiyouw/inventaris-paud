"use client";

import { OBSERVATION_SCHOOLS } from "@/lib/observation";
import { useSchool } from "@/lib/school-context";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 flex items-center gap-3 rounded-2xl border border-red-100 bg-white px-5 py-3.5 shadow-xl">
      <span className="text-lg">⚠️</span>
      <p className="text-sm font-black text-red-700">{message}</p>
      <button
        type="button"
        onClick={onClose}
        className="ml-2 rounded-full px-2 py-0.5 text-xs font-black text-slate-400 hover:bg-slate-50"
      >
        ✕
      </button>
    </div>
  );
}

export default function SelectSchoolPage() {
  const router = useRouter();
  const { selectSchool } = useSchool();
  const [selectedCode, setSelectedCode] = useState<string>("");
  const [accessCode, setAccessCode] = useState("");
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(false);

  // Admin dialog
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminCode, setAdminCode] = useState("");
  const [adminLoading, setAdminLoading] = useState(false);
  const adminInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (adminOpen) setTimeout(() => adminInputRef.current?.focus(), 50);
  }, [adminOpen]);

  function showError(msg: string) {
    setToast(msg);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCode) {
      showError("Pilih sekolah terlebih dahulu.");
      return;
    }
    if (!accessCode.trim()) {
      showError("Masukkan kode akses.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/school", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schoolCode: selectedCode, accessCode: accessCode.trim() }),
      });

      if (!res.ok) {
        const data = await res.json() as { error: string };
        showError(data.error || "Kode akses salah. Coba lagi.");
        return;
      }

      // Set cookie via API (for server-side route auth)
      sessionStorage.setItem("school_code", selectedCode);

      // Also set localStorage via school-context so SchoolGuard lets the user through
      const school = OBSERVATION_SCHOOLS.find((s) => s.code === selectedCode);
      if (school) {
        selectSchool({ id: selectedCode, name: school.name });
      }

      router.push("/");
    } catch {
      showError("Gagal terhubung ke server. Periksa koneksi internet.");
    } finally {
      setLoading(false);
    }
  }

  async function handleAdminLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!adminCode.trim()) {
      showError("Masukkan kode akses admin.");
      return;
    }
    setAdminLoading(true);
    try {
      const res = await fetch("/api/schools/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schoolId: "admin", accessCode: adminCode.trim() }),
      });
      const data = await res.json() as { valid?: boolean; school?: { id: string; name: string }; error?: string };
      if (data.valid && data.school) {
        selectSchool(data.school as { id: string; name: string });
        router.push("/");
      } else {
        showError(data.error || "Kode admin salah.");
      }
    } catch {
      showError("Gagal terhubung ke server.");
    } finally {
      setAdminLoading(false);
    }
  }

  const THEME_COLORS = [
    { border: "border-[#2f7d68]", icon: "bg-[#2f7d68] text-white", iconIdle: "bg-[#edf7f1] text-[#2f7d68]" },
    { border: "border-[#9d3e67]", icon: "bg-[#9d3e67] text-white", iconIdle: "bg-[#fce7f3] text-[#9d3e67]" },
    { border: "border-[#2a6f86]", icon: "bg-[#2a6f86] text-white", iconIdle: "bg-[#e0f2fe] text-[#2a6f86]" },
    { border: "border-[#514ba5]", icon: "bg-[#514ba5] text-white", iconIdle: "bg-[#ede9fe] text-[#514ba5]" },
    { border: "border-[#8a5a13]", icon: "bg-[#8a5a13] text-white", iconIdle: "bg-[#fef3c7] text-[#8a5a13]" },
  ];

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#f7fbf6] px-4 py-10">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-[#2f7d68] text-2xl font-black text-white shadow-sm">
            IP
          </div>
          <p className="mt-4 text-sm font-black uppercase tracking-normal text-[#2f7d68]">
            Inventaris PAUD
          </p>
          <h1 className="mt-1 text-3xl font-black text-slate-950 sm:text-4xl">
            Pilih Sekolah
          </h1>
          <p className="mt-2 text-sm font-semibold text-slate-500">
            Pilih sekolah dan masukkan kode akses untuk melanjutkan.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* School grid */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {OBSERVATION_SCHOOLS.map((school, idx) => {
              const colors = THEME_COLORS[idx % THEME_COLORS.length];
              const isSelected = selectedCode === school.code;
              return (
                <button
                  key={school.code}
                  type="button"
                  onClick={() => {
                    setSelectedCode(school.code);
                    setToast("");
                  }}
                  className={`rounded-3xl border-2 p-5 text-left transition hover:-translate-y-0.5 active:translate-y-0 ${
                    isSelected
                      ? `${colors.border} bg-white shadow-md`
                      : "border-[#dbe9de] bg-white shadow-sm hover:shadow-md"
                  }`}
                >
                  <div
                    className={`grid h-12 w-12 place-items-center rounded-2xl text-lg font-black shadow-sm ${
                      isSelected ? colors.icon : colors.iconIdle
                    }`}
                  >
                    {school.code}
                  </div>
                  <p className={`mt-3 text-base font-black leading-snug ${isSelected ? "text-slate-950" : "text-slate-700"}`}>
                    {school.name}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Access code */}
          <div className="rounded-3xl border border-[#dbe9de] bg-white p-5 shadow-sm">
            <label className="block">
              <span className="text-xs font-black uppercase text-slate-400">
                Kode Akses
              </span>
              <input
                type="password"
                value={accessCode}
                onChange={(event) => {
                  setAccessCode(event.target.value);
                  setToast("");
                }}
                placeholder="Masukkan kode akses sekolah"
                className="mt-1 h-12 w-full rounded-2xl border border-[#dbe9de] bg-[#f7fbf6] px-4 text-sm font-semibold outline-none focus:border-[#2f7d68]"
                autoComplete="off"
              />
            </label>

            <button
              type="submit"
              disabled={loading}
              className="mt-4 min-h-12 w-full rounded-full bg-[#2f7d68] px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-[#276c59] active:translate-y-0 disabled:opacity-60"
            >
              {loading ? "Memeriksa..." : "Masuk →"}
            </button>
          </div>
        </form>

        {/* Admin button */}
        <div className="mt-5 flex justify-center">
          <button
            type="button"
            onClick={() => { setAdminOpen(true); setAdminCode(""); setToast(""); }}
            className="flex items-center gap-2 rounded-full border border-[#d4d0e8] bg-[#f3f1fc] px-5 py-2.5 text-sm font-black text-[#514ba5] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:translate-y-0"
          >
            <span className="grid h-7 w-7 place-items-center rounded-full bg-[#e0dcf5] text-xs font-black">
              ADM
            </span>
            Kelola Sekolah (Admin)
          </button>
        </div>
      </div>

      {/* Admin modal */}
      {adminOpen && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 px-4"
          role="dialog"
          aria-modal="true"
          onClick={(e) => { if (e.target === e.currentTarget) setAdminOpen(false); }}
        >
          <div className="w-full max-w-sm rounded-3xl border border-[#d4d0e8] bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#e0dcf5] text-sm font-black text-[#514ba5]">
                ADM
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-950">Masuk sebagai Admin</h2>
                <p className="text-xs font-semibold text-slate-500">Kelola semua sekolah & data</p>
              </div>
            </div>
            <form onSubmit={handleAdminLogin} className="space-y-3">
              <label className="block">
                <span className="text-xs font-black uppercase text-slate-400">Kode Admin</span>
                <input
                  ref={adminInputRef}
                  type="password"
                  value={adminCode}
                  onChange={(e) => setAdminCode(e.target.value)}
                  placeholder="Kode akses admin"
                  className="mt-1 h-12 w-full rounded-2xl border border-[#d4d0e8] bg-[#f8f7ff] px-4 text-sm font-semibold outline-none focus:border-[#514ba5]"
                  autoComplete="off"
                />
              </label>
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setAdminOpen(false)}
                  className="min-h-11 flex-1 rounded-full bg-slate-50 px-4 text-sm font-black text-slate-600 ring-1 ring-slate-200"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={adminLoading}
                  className="min-h-11 flex-1 rounded-full bg-[#514ba5] px-4 text-sm font-black text-white shadow-sm transition hover:bg-[#433e8e] disabled:opacity-60"
                >
                  {adminLoading ? "Memeriksa..." : "Masuk"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast error notification */}
      {toast && <Toast message={toast} onClose={() => setToast("")} />}
    </main>
  );
}
