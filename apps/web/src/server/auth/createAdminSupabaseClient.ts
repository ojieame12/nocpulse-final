import { readAppEnv } from "@fieldpulse/platform-config";
import { createSupabaseAdminClient } from "./createSupabaseAdminClient";

export function createAdminSupabaseClient() {
  const env = readAppEnv(process.env);

  if (!env.supabase.url || !env.supabase.serviceRoleKey) {
    throw new Error(
      "[auth] Admin Supabase client requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  return createSupabaseAdminClient({
    url: env.supabase.url,
    serviceRoleKey: env.supabase.serviceRoleKey,
  });
}
