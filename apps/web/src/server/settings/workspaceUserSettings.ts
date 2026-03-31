import type { DatabaseClient } from "@fieldpulse/platform-db";
import {
  normalizeWorkspaceSettings,
  type WorkspaceSettingsState,
} from "../../features/settings/workspaceSettings";

type WorkspaceUserSettingsRow = {
  email_alerts: boolean;
  health_warnings: boolean;
  spray_windows: boolean;
  weekly_digest: boolean;
  units: "metric" | "imperial";
  temperature_unit: "celsius" | "fahrenheit";
};

function mapRowToSettings(row: WorkspaceUserSettingsRow | null) {
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

export function isMissingWorkspaceSettingsTable(error: unknown) {
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

export async function loadWorkspaceSettingsState(input: {
  client: DatabaseClient;
  workspaceId: string;
  userId: string;
}) {
  const result = await input.client
    .from("workspace_user_settings")
    .select(
      "email_alerts,health_warnings,spray_windows,weekly_digest,units,temperature_unit",
    )
    .eq("workspace_id", input.workspaceId)
    .eq("user_id", input.userId)
    .maybeSingle();

  if (result.error) {
    throw result.error;
  }

  return mapRowToSettings(result.data);
}

export async function saveWorkspaceSettingsState(input: {
  client: DatabaseClient;
  workspaceId: string;
  userId: string;
  settings: WorkspaceSettingsState;
}) {
  const upserted = await input.client
    .from("workspace_user_settings")
    .upsert(
      {
        workspace_id: input.workspaceId,
        user_id: input.userId,
        email_alerts: input.settings.emailAlerts,
        health_warnings: input.settings.healthWarnings,
        spray_windows: input.settings.sprayWindows,
        weekly_digest: input.settings.weeklyDigest,
        units: input.settings.units,
        temperature_unit: input.settings.tempUnit,
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

  return mapRowToSettings(upserted.data);
}
