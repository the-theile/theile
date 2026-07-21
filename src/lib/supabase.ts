import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Same Supabase project as Gates (theile). Users are created in the dashboard
 * (no public sign-up). Override with NEXT_PUBLIC_SUPABASE_* if needed.
 */
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://iugxcfyczuvqwadnobvf.supabase.co";

const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "sb_publishable_eoHldj45IyICDc8W-14Gcg_jo7HEEhM";

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: "dictabird-auth",
      },
    });
  }
  return client;
}
