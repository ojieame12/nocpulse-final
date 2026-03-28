import type { SupabaseClient } from "@supabase/supabase-js";
import type { DatabaseSchema } from "./DatabaseSchema";

export type DatabaseClient = SupabaseClient<DatabaseSchema, "app">;

export type DatabaseClientOptions = {
  url: string;
  serviceKey: string;
  accessToken?: string;
};
