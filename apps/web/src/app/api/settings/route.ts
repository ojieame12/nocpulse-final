import { createSupabaseDatabaseClient } from "@fieldpulse/platform-db";
import { jsonError, jsonOk, readJsonObject } from "../../../server/http/json";
import { getWebServerRuntime } from "../../../server/runtime/getWebServerRuntime";
import {
  RequestContextError,
  resolveRequestActor,
} from "../../../server/runtime/resolveRequestContext";
import {
  normalizeWorkspaceSettings,
  type WorkspaceSettingsState,
} from "../../../features/settings/workspaceSettings";

function isMissingWorkspaceSettingsTable(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const code =
    "code" in error && typeof error.code === "string" ? error.code : null;
  const message =
    "message" in error && typeof error.message === "string"
      ? error.message
      : "";

  return code === "42P01" || message.includes("workspace_user_settings");
}

function readRequestedWorkspaceId(request: Request, body?: Record<string, unknown> | null) {
  const { searchParams } = new URL(request.url);
  const queryWorkspaceId = searchParams.get("workspaceId")?.trim();

  if (queryWorkspaceId) {
    return queryWorkspaceId;
  }

  const bodyWorkspaceId =
    typeof body?.workspaceId === "string" ? body.workspaceId.trim() : "";

  return bodyWorkspaceId || null;
}

function mapRowToSettings(
  row:
    | {
        email_alerts: boolean;
        health_warnings: boolean;
        spray_windows: boolean;
        weekly_digest: boolean;
        units: "metric" | "imperial";
        temperature_unit: "celsius" | "fahrenheit";
      }
    | null,
) {
  return normalizeWorkspaceSettings(
    row
      ? {
          emailAlerts: row.email_alerts,
          healthWarnings: row.health_warnings,
          sprayWindows: row.spray_windows,
          weeklyDigest: row.weekly_digest,
          units: row.units,
          tempUnit: row.temperature_unit,
        }
      : null,
  );
}

export async function GET(request: Request) {
  try {
    const runtime = getWebServerRuntime();

    if (runtime.mode !== "supabase") {
      return jsonError(503, "Supabase runtime is not configured.");
    }

    const requestedWorkspaceId = readRequestedWorkspaceId(request);
    const actor = await resolveRequestActor(request, runtime, {
      preferredWorkspaceId: requestedWorkspaceId,
    });
    const client = createSupabaseDatabaseClient({
      url: runtime.env.supabase.url!,
      serviceKey: runtime.env.supabase.serviceRoleKey!,
    });
    const result = await client
      .from("workspace_user_settings")
      .select(
        "email_alerts,health_warnings,spray_windows,weekly_digest,units,temperature_unit",
      )
      .eq("workspace_id", actor.workspaceId)
      .eq("user_id", actor.userId)
      .maybeSingle();

    if (result.error) {
      throw result.error;
    }

    return jsonOk({
      result: {
        workspaceId: actor.workspaceId,
        settings: mapRowToSettings(result.data),
      },
    });
  } catch (error) {
    if (error instanceof RequestContextError) {
      return jsonError(error.status, error.message);
    }

    if (isMissingWorkspaceSettingsTable(error)) {
      return jsonError(
        503,
        "Workspace settings storage is not migrated yet.",
      );
    }

    return jsonError(
      500,
      error instanceof Error ? error.message : "Settings lookup failed.",
    );
  }
}

export async function POST(request: Request) {
  const body = await readJsonObject(request);

  if (!body) {
    return jsonError(400, "Expected a JSON request body.");
  }

  try {
    const runtime = getWebServerRuntime();

    if (runtime.mode !== "supabase") {
      return jsonError(503, "Supabase runtime is not configured.");
    }

    const requestedWorkspaceId = readRequestedWorkspaceId(request, body);
    const actor = await resolveRequestActor(request, runtime, {
      preferredWorkspaceId: requestedWorkspaceId,
    });
    const settings = normalizeWorkspaceSettings(
      (typeof body.settings === "object" && body.settings !== null
        ? body.settings
        : body) as Partial<WorkspaceSettingsState>,
    );
    const client = createSupabaseDatabaseClient({
      url: runtime.env.supabase.url!,
      serviceKey: runtime.env.supabase.serviceRoleKey!,
    });
    const upserted = await client
      .from("workspace_user_settings")
      .upsert(
        {
          workspace_id: actor.workspaceId,
          user_id: actor.userId,
          email_alerts: settings.emailAlerts,
          health_warnings: settings.healthWarnings,
          spray_windows: settings.sprayWindows,
          weekly_digest: settings.weeklyDigest,
          units: settings.units,
          temperature_unit: settings.tempUnit,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "workspace_id,user_id",
        },
      )
      .select(
        "email_alerts,health_warnings,spray_windows,weekly_digest,units,temperature_unit",
      )
      .single();

    if (upserted.error) {
      throw upserted.error;
    }

    return jsonOk(
      {
        result: {
          workspaceId: actor.workspaceId,
          settings: mapRowToSettings(upserted.data),
        },
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    if (error instanceof RequestContextError) {
      return jsonError(error.status, error.message);
    }

    if (isMissingWorkspaceSettingsTable(error)) {
      return jsonError(
        503,
        "Workspace settings storage is not migrated yet.",
      );
    }

    return jsonError(
      500,
      error instanceof Error ? error.message : "Settings save failed.",
    );
  }
}
