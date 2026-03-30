export type WorkspaceSettingsState = {
  emailAlerts: boolean;
  healthWarnings: boolean;
  sprayWindows: boolean;
  weeklyDigest: boolean;
  units: "metric" | "imperial";
  tempUnit: "celsius" | "fahrenheit";
};

export const DEFAULT_WORKSPACE_SETTINGS: WorkspaceSettingsState = {
  emailAlerts: true,
  healthWarnings: true,
  sprayWindows: false,
  weeklyDigest: true,
  units: "metric",
  tempUnit: "celsius",
};

export function normalizeWorkspaceSettings(
  input: Partial<WorkspaceSettingsState> | null | undefined,
): WorkspaceSettingsState {
  if (!input) {
    return { ...DEFAULT_WORKSPACE_SETTINGS };
  }

  return {
    emailAlerts: input.emailAlerts ?? DEFAULT_WORKSPACE_SETTINGS.emailAlerts,
    healthWarnings:
      input.healthWarnings ?? DEFAULT_WORKSPACE_SETTINGS.healthWarnings,
    sprayWindows: input.sprayWindows ?? DEFAULT_WORKSPACE_SETTINGS.sprayWindows,
    weeklyDigest: input.weeklyDigest ?? DEFAULT_WORKSPACE_SETTINGS.weeklyDigest,
    units:
      input.units === "imperial"
        ? "imperial"
        : DEFAULT_WORKSPACE_SETTINGS.units,
    tempUnit:
      input.tempUnit === "fahrenheit"
        ? "fahrenheit"
        : DEFAULT_WORKSPACE_SETTINGS.tempUnit,
  };
}
