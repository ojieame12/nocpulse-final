import { createClient } from "@supabase/supabase-js";
import { getSupabaseAuthConfig } from "./getSupabaseAuthConfig";

export function createSupabasePublicAuthClient() {
  const config = getSupabaseAuthConfig();

  return createClient(config.url, config.anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}
