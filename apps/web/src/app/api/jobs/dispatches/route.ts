import { createSupabaseDatabaseClient } from "@fieldpulse/platform-db";
import { jsonError, jsonOk, readJsonObject } from "../../../../server/http/json";
import { getWebServerRuntime } from "../../../../server/runtime/getWebServerRuntime";
import {
  RequestContextError,
  resolveRequestActor,
} from "../../../../server/runtime/resolveRequestContext";

type JobDispatchPayload = {
  workspaceId?: string;
  fieldId?: string;
};

type JobDispatchRow = {
  id: string;
  job_key: string;
  status: string;
  active_phase_label: string | null;
  progress_pct: number | null;
  progress_message: string | null;
  progress_updated_at: string | null;
  completed_at: string | null;
  failed_at: string | null;
  cancelled_at: string | null;
  updated_at: string;
  last_error: string | null;
  payload: unknown;
};

function toPayload(value: unknown): JobDispatchPayload | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const payload = value as Record<string, unknown>;
  return {
    workspaceId:
      typeof payload.workspaceId === "string" ? payload.workspaceId : undefined,
    fieldId: typeof payload.fieldId === "string" ? payload.fieldId : undefined,
  };
}

export async function POST(request: Request) {
  const body = await readJsonObject(request);

  if (!body) {
    return jsonError(400, "Expected a JSON request body.");
  }

  const ids = Array.isArray(body.ids)
    ? body.ids.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    : [];
  const requestedWorkspaceId =
    typeof body.workspaceId === "string" ? body.workspaceId.trim() : null;

  if (ids.length === 0) {
    return jsonError(400, "At least one dispatch id is required.");
  }

  try {
    const runtime = getWebServerRuntime();

    if (runtime.mode !== "supabase") {
      return jsonError(503, "Supabase runtime is not configured.");
    }

    const actor = await resolveRequestActor(request, runtime, {
      preferredWorkspaceId: requestedWorkspaceId,
    });
    const client = createSupabaseDatabaseClient({
      url: runtime.env.supabase.url!,
      serviceKey: runtime.env.supabase.serviceRoleKey!,
    });

    const result = await client
      .from("job_dispatches")
      .select(
        [
          "id",
          "job_key",
          "status",
          "active_phase_label",
          "progress_pct",
          "progress_message",
          "progress_updated_at",
          "completed_at",
          "failed_at",
          "cancelled_at",
          "updated_at",
          "last_error",
          "payload",
        ].join(","),
      )
      .in("id", ids);

    if (result.error) {
      throw result.error;
    }

    const rows = (result.data ?? []) as unknown as JobDispatchRow[];
    const dispatches = rows
      .map((row) => {
        const payload = toPayload(row.payload);
        if (payload?.workspaceId !== actor.workspaceId) {
          return null;
        }

        return {
          id: row.id,
          key: row.job_key,
          status: row.status,
          activePhaseLabel: row.active_phase_label,
          progressPct: row.progress_pct,
          progressMessage: row.progress_message,
          progressUpdatedAt: row.progress_updated_at,
          completedAt: row.completed_at,
          failedAt: row.failed_at,
          cancelledAt: row.cancelled_at,
          updatedAt: row.updated_at,
          lastError: row.last_error,
          fieldId: payload.fieldId ?? null,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row != null);

    return jsonOk({
      result: {
        workspaceId: actor.workspaceId,
        dispatches,
      },
    });
  } catch (error) {
    if (error instanceof RequestContextError) {
      return jsonError(error.status, error.message);
    }

    return jsonError(
      500,
      error instanceof Error ? error.message : "Job dispatch lookup failed.",
    );
  }
}
