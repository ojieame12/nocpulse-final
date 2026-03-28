import type { PostgrestError } from "@supabase/supabase-js";
import { DatabaseQueryError } from "../contracts/DatabaseQueryError";

type ResultEnvelope<T> = {
  data: T | null;
  error: PostgrestError | null;
};

export function requireSupabaseData<T>(
  result: ResultEnvelope<T>,
  context: string,
): T {
  if (result.error) {
    throw new DatabaseQueryError(context, result.error.message);
  }

  if (result.data == null) {
    throw new DatabaseQueryError(context, "expected data but received null");
  }

  return result.data;
}
