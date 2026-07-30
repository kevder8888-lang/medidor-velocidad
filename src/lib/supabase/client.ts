import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

let browserClient: SupabaseClient<Database> | null = null;

export function getSupabaseConfig(): {
  url: string;
  anonKey: string;
} | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

export function isSupabaseConfigured(): boolean {
  return getSupabaseConfig() != null;
}

/** Cliente singleton para el browser (anon o sesión admin). */
export function getSupabase(): SupabaseClient<Database> | null {
  const cfg = getSupabaseConfig();
  if (!cfg) return null;
  if (typeof window === "undefined") {
    return createClient<Database>(cfg.url, cfg.anonKey);
  }
  if (!browserClient) {
    browserClient = createClient<Database>(cfg.url, cfg.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: "osiptel-medidor-supabase-auth",
      },
    });
  }
  return browserClient;
}
