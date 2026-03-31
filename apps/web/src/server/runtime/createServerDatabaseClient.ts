import { createSupabaseDatabaseClient } from "@fieldpulse/platform-db";
import type { ServerRuntime } from "@fieldpulse/platform-runtime";

type SupabaseRuntime = Extract<ServerRuntime, { mode: "supabase" }>;
type SupabaseDatabaseConfig = {
  url: string;
  serviceRoleKey: string;
};

export function createServerDatabaseClient(
  input: SupabaseRuntime | SupabaseDatabaseConfig,
) {
  const url = "env" in input ? input.env.supabase.url! : input.url;
  const serviceKey =
    "env" in input ? input.env.supabase.serviceRoleKey! : input.serviceRoleKey;

  return createSupabaseDatabaseClient({
    url,
    serviceKey,
  });
}
