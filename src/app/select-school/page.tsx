"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSchool, type School } from "@/lib/school-context";

type SchoolEntry = {
  id: string;
  name: string;
};

const PASTEL_COLORS = [
  { bg: "bg-[#edf7f1]", icon: "bg-[#d3f0dc] text-[#27684f]" },
  { bg: "bg-[#fff0f5]", icon: "bg-[#f8d9e7] text-[#9d3e67]" },
  { bg: "bg-[#eef7fb]", icon: "bg-[#d8edf7] text-[#2a6f86]" },
  { bg: "bg-[#f1f0ff]", icon: "bg-[#dedcff] text-[#514ba5]" },
  { bg: "bg-[#fff7df]", icon: "bg-[#f8e9b7] text-[#8a5a13]" },
];

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const initials = words
    .map((word) => word.match(/[A-Z0-9]/i)?.[0] ?? "")
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return initials || "S";
}

export default function SelectSchoolPage() {
  const router = useRouter();
  const { selectSchool, selectedSchool, isHydrated } = useSchool();
  const [schools, setSchools] = useState<SchoolEntry[]>([]);
  const [selectedForVerify, setSelectedForVerify] = useState<SchoolEntry | null>(null);
  const [accessCode, setAccessCode] = useState("");
  const [error, setError] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    if (isHydrated && selectedSchool) {
      router.push("/");
    }
  }, [isHydrated, selectedSchool, router]);

  useEffect(() => {
    fetch("/api/schools")
      .then((res) => res.json())
      .then((data: { schools: SchoolEntry[] }) => {
        setSchools(data.schools);
      })
      .catch(() => {
        // fallback silently
      });
  }, []);

  async function handleVerify() {
    if (!selectedForVerify || !accessCode.trim()) {
      setError("Masukkan kode akses.");
      return;
    }

    setIsVerifying(true);
    setError("");

    try {
      const response = await fetch("/api/schools/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolId: selectedForVerify.id,
          accessCode: accessCode.trim(),
        }),
      });

      const data = (await response.json()) as {
        valid: boolean;
        school?: School;
        message?: string;
      };

      if (data.valid && data.school) {
        selectSchool(data.school);
        router.push("/");
      } else {
        setError("Kode akses salah. Coba lagi.");
      }
    } catch {
      setError("Gagal memverifikasi. Coba lagi.");
    } finally {
      setIsVerifying(false);
    }
  }

  return (
    <main className="min-h-dvh bg-[var(--background)] text-slate-900">
      <header className="border-b border-[#ddebdc] bg-white/90 shadow-sm backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-7xl items-center gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#2f7d68] text-base font-black text-white">
            IP
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-normal text-[#2f7d68]">
              Inventaris PAUD
            </p>
            <h1 className="mt-0.5 text-xl font-black text-slate-950 sm:text-2xl">
              Pilih Sekolah Anda
            </h1>
          </div>
        </div>
      </header>

      <section className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {schools.filter((s) => s.id !== "admin").map((school, index) => {
            const colors = PASTEL_COLORS[index % PASTEL_COLORS.length];

            return (
              <button
                key={school.id}
                type="button"
                onClick={() => {
                  setSelectedForVerify(school);
                  setAccessCode("");
                  setError("");
                }}
                className={`flex min-h-[12rem] flex-col items-center justify-center rounded-3xl border border-[#dbe9de] ${colors.bg} p-6 text-center shadow-[var(--shadow-card)] transition hover:-translate-y-1 hover:shadow-lg active:translate-y-0`}
              >
                <div
                  className={`grid h-16 w-16 place-items-center rounded-full ${colors.icon} text-xl font-black shadow-sm`}
                >
                  {getInitials(school.name)}
                </div>
                <p className="mt-4 text-base font-black leading-snug text-slate-950">
                  {school.name}
                </p>
              </button>
            );
          })}
        </div>

        {schools.some((s) => s.id === "admin") ? (
          <div className="mt-6 flex justify-center">
            <button
              type="button"
              onClick={() => {
                setSelectedForVerify({ id: "admin", name: "Admin" });
                setAccessCode("");
                setError("");
              }}
              className="flex min-h-[12rem] w-full max-w-xs flex-col items-center justify-center rounded-3xl border border-[#d4d0e8] bg-[#f3f1fc] p-6 text-center shadow-[var(--shadow-card)] transition hover:-translate-y-1 hover:shadow-lg active:translate-y-0"
            >
              <div className="grid h-16 w-16 place-items-center rounded-full bg-[#e0dcf5] text-xl font-black text-[#514ba5] shadow-sm">
                ADM
              </div>
              <p className="mt-4 text-base font-black leading-snug text-[#514ba5]">
                Kelola Sekolah
              </p>
            </button>
          </div>
        ) : null}
      </section>

      {selectedForVerify ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="verify-dialog-title"
        >
          <div className="w-full max-w-md rounded-3xl border border-[#dbe9de] bg-white p-6 shadow-2xl">
            <h2
              id="verify-dialog-title"
              className="text-xl font-black text-slate-950"
            >
              Masukkan kode akses
            </h2>
            <p className="mt-2 text-sm font-semibold text-slate-500">
              untuk{" "}
              <span className="font-black text-slate-700">
                {selectedForVerify.name}
              </span>
            </p>

            {error ? (
              <p className="mt-3 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                {error}
              </p>
            ) : null}

            <input
              type="text"
              inputMode="numeric"
              value={accessCode}
              onChange={(e) => setAccessCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleVerify();
                }
              }}
              placeholder="Kode akses"
              className="mt-4 h-14 w-full rounded-2xl border border-[#dbe9de] bg-[#f7fbf6] px-4 text-center text-2xl font-black tracking-widest outline-none focus:border-[#2f7d68]"
              autoFocus
            />

            <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setSelectedForVerify(null)}
                className="min-h-12 rounded-full bg-slate-50 px-5 py-2.5 text-sm font-black text-slate-600 ring-1 ring-slate-200"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleVerify}
                disabled={isVerifying}
                className="min-h-12 rounded-full bg-[#2f7d68] px-5 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-[#276c59] disabled:opacity-60"
              >
                {isVerifying ? "Memverifikasi..." : "Masuk"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
