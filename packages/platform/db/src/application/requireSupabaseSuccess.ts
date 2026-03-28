import type { PostgrestError } from "@supabase/supabase-js";
import { DatabaseQueryError } from "../contracts/DatabaseQueryError";

type SuccessEnvelope = {
  error: PostgrestError | null;
};

export function requireSupabaseSuccess(
  result: SuccessEnvelope,
  context: string,
): void {
  if (result.error) {
    throw new DatabaseQueryError(context, result.error.message);
  }
}
