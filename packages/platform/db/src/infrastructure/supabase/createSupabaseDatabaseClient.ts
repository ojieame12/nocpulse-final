import { createClient } from "@supabase/supabase-js";
import type { DatabaseClient, DatabaseClientOptions } from "../../contracts/DatabaseClient";
import type { DatabaseSchema } from "../../contracts/DatabaseSchema";

export function createSupabaseDatabaseClient(
  options: DatabaseClientOptions,
): DatabaseClient {
  return createClient<DatabaseSchema, "app">(options.url, options.serviceKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
    db: {
      schema: "app",
    },
    global: options.accessToken
      ? {
          headers: {
            Authorization: `Bearer ${options.accessToken}`,
          },
        }
      : undefined,
  });
}
