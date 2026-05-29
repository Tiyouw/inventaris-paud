"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
} from "react";
import type { ReactNode } from "react";

export type School = {
  id: string;
  name: string;
};

type SchoolContextValue = {
  selectedSchool: School | null;
  isHydrated: boolean;
  selectSchool: (school: School) => void;
  clearSchool: () => void;
};

const STORAGE_KEY = "inventaris-paud-school";

const SchoolContext = createContext<SchoolContextValue | null>(null);

let cachedSchool: School | null | undefined;

function getSchoolSnapshot(): School | null {
  if (cachedSchool === undefined) {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);

      if (stored) {
        const parsed = JSON.parse(stored) as School;

        if (parsed && parsed.id && parsed.name) {
          cachedSchool = parsed;
        } else {
          cachedSchool = null;
        }
      } else {
        cachedSchool = null;
      }
    } catch {
      cachedSchool = null;
    }
  }

  return cachedSchool ?? null;
}

function getServerSnapshot(): School | null {
  return null;
}

function subscribeToStorage(callback: () => void): () => void {
  function handleStorage(event: StorageEvent) {
    if (event.key === STORAGE_KEY) {
      cachedSchool = undefined;
      callback();
    }
  }

  window.addEventListener("storage", handleStorage);

  return () => window.removeEventListener("storage", handleStorage);
}

export function SchoolProvider({ children }: { children: ReactNode }) {
  const storedSchool = useSyncExternalStore(
    subscribeToStorage,
    getSchoolSnapshot,
    getServerSnapshot,
  );

  const selectSchool = useCallback((school: School) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(school));
    } catch {
      // Ignore storage errors
    }

    cachedSchool = school;
    // Force re-render by dispatching a storage event on same page
    window.dispatchEvent(
      new StorageEvent("storage", { key: STORAGE_KEY }),
    );
  }, []);

  const clearSchool = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }

    cachedSchool = null;
    window.dispatchEvent(
      new StorageEvent("storage", { key: STORAGE_KEY }),
    );
  }, []);

  const value = useMemo<SchoolContextValue>(
    () => ({
      selectedSchool: storedSchool,
      isHydrated: true,
      selectSchool,
      clearSchool,
    }),
    [storedSchool, selectSchool, clearSchool],
  );

  return (
    <SchoolContext.Provider value={value}>{children}</SchoolContext.Provider>
  );
}

export function useSchool(): SchoolContextValue {
  const context = useContext(SchoolContext);

  if (!context) {
    throw new Error("useSchool must be used within a SchoolProvider");
  }

  return context;
}
