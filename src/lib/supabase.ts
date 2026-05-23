import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type SupabaseServerConfig = {
  url: string;
  serviceRoleKey: string;
  storageBucket: string;
};

const DEFAULT_STORAGE_BUCKET = "inventory-photos";

let cachedClient: SupabaseClient | undefined;

export function getSupabaseServerConfig(): SupabaseServerConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !serviceRoleKey) {
    return null;
  }

  return {
    url,
    serviceRoleKey,
    storageBucket:
      process.env.SUPABASE_STORAGE_BUCKET?.trim() || DEFAULT_STORAGE_BUCKET,
  };
}

export function isSupabaseServerConfigured(): boolean {
  return getSupabaseServerConfig() !== null;
}

export function getSupabaseServerClient(): SupabaseClient | null {
  const config = getSupabaseServerConfig();

  if (!config) {
    return null;
  }

  cachedClient ??= createClient(config.url, config.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return cachedClient;
}

export function getMissingSupabaseConfigMessage(): string {
  return "Konfigurasi server Supabase belum lengkap. Isi NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY.";
}
