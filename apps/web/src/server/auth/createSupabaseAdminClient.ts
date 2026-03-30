import type { DatabaseSchema } from "@fieldpulse/platform-db";
import { createClient } from "@supabase/supabase-js";

export function createSupabaseAdminClient(input: {
  url: string;
  serviceRoleKey: string;
}) {
  return createClient<DatabaseSchema>(input.url, input.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
