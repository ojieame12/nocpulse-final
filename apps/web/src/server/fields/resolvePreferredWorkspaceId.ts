import type { ServerRuntime } from "@fieldpulse/platform-runtime";
import { createServerDatabaseClient } from "../runtime/createServerDatabaseClient";

function isUuidLike(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export async function resolvePreferredWorkspaceId(
  runtime: ServerRuntime,
  workspaceHeader: string | null,
) {
  const rawValue = workspaceHeader?.trim() ?? "";

  if (!rawValue) {
    return undefined;
  }

  if (isUuidLike(rawValue)) {
    return rawValue;
  }

  if (runtime.mode !== "supabase") {
    return undefined;
  }

  const client = createServerDatabaseClient(runtime);
  const result = await client
    .from("workspaces")
    .select("id")
    .eq("slug", rawValue)
    .maybeSingle();

  if (result.error) {
    throw result.error;
  }

  return result.data?.id ?? undefined;
}
