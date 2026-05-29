"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSchool } from "@/lib/school-context";
import type { ReactNode } from "react";

export function SchoolGuard({ children }: { children: ReactNode }) {
  const { selectedSchool, isHydrated } = useSchool();
  const router = useRouter();

  useEffect(() => {
    if (isHydrated && !selectedSchool) {
      router.push("/select-school");
    }
  }, [isHydrated, selectedSchool, router]);

  if (!isHydrated) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#2f7d68] border-t-transparent" />
      </div>
    );
  }

  if (!selectedSchool) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#2f7d68] border-t-transparent" />
      </div>
    );
  }

  return <>{children}</>;
}
