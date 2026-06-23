"use client";

import { OBSERVATION_SCHOOLS } from "@/lib/observation";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";

export default function SelectSchoolPage() {
  const router = useRouter();
  const [selectedCode, setSelectedCode] = useState<string>("");
  const [accessCode, setAccessCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCode) {
      setError("Pilih sekolah terlebih dahulu.");
      return;
    }
    if (!accessCode.trim()) {
      setError("Masukkan kode akses.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/school", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schoolCode: selectedCode, accessCode: accessCode.trim() }),
      });

      if (!res.ok) {
        const data = await res.json() as { error: string };
        setError(data.error || "Kode akses salah.");
        return;
      }

      sessionStorage.setItem("school_code", selectedCode);
      router.push("/");
    } catch {
      setError("Gagal terhubung ke server. Coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#f7fbf6] px-4">
      <div className="w-full max-w-xl">
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
            Pilih sekolah untuk melanjutkan ke catatan observasi.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            {OBSERVATION_SCHOOLS.map((school) => {
              const isSelected = selectedCode === school.code;
              return (
                <button
                  key={school.code}
                  type="button"
                  onClick={() => {
                    setSelectedCode(school.code);
                    setError("");
                  }}
                  className={`rounded-3xl border-2 p-5 text-left transition hover:-translate-y-0.5 active:translate-y-0 ${
                    isSelected
                      ? "border-[#2f7d68] bg-white shadow-md"
                      : "border-[#dbe9de] bg-white shadow-sm hover:bg-white hover:shadow-md"
                  }`}
                >
                  <div
                    className={`grid h-12 w-12 place-items-center rounded-2xl text-lg font-black shadow-sm ${
                      isSelected
                        ? "bg-[#2f7d68] text-white"
                        : "bg-[#edf7f1] text-[#2f7d68]"
                    }`}
                  >
                    {school.code}
                  </div>
                  <p
                    className={`mt-3 text-base font-black ${
                      isSelected ? "text-slate-950" : "text-slate-700"
                    }`}
                  >
                    {school.name}
                  </p>
                </button>
              );
            })}
          </div>

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
                  setError("");
                }}
                placeholder="Masukkan kode akses sekolah"
                className="mt-1 h-12 w-full rounded-2xl border border-[#dbe9de] bg-[#f7fbf6] px-4 text-sm font-semibold outline-none focus:border-[#2f7d68]"
                autoComplete="off"
              />
            </label>

            {error ? (
              <p className="mt-3 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="mt-4 min-h-12 w-full rounded-full bg-[#2f7d68] px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-[#276c59] active:translate-y-0 disabled:opacity-60"
            >
              {loading ? "Memeriksa..." : "Masuk"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
