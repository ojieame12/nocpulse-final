/**
 * Per-workspace feature flag resolution.
 *
 * Flags are stored as free-form JSONB in `workspace_settings.feature_flags`.
 * This module defines the canonical flag keys with safe defaults and merges
 * any persisted overrides on top.
 */

export type FeatureFlags = {
  "moisture.useDepletion": boolean;
  "moisture.dropFakeThermal": boolean;
  "soil.enableRestFallback": boolean;
  "ui.showDepletion": boolean;
  "ui.showDataSources": boolean;
  "ui.showHistorical": boolean;
};

const DEFAULTS: FeatureFlags = {
  "moisture.useDepletion": false,
  "moisture.dropFakeThermal": true,
  "soil.enableRestFallback": false,
  "ui.showDepletion": false,
  "ui.showDataSources": false,
  "ui.showHistorical": false,
};

/**
 * Merge raw persisted flag values on top of built-in defaults.
 *
 * - Returns full defaults when `raw` is null, undefined, or empty.
 * - Only known keys from {@link FeatureFlags} are applied; unknown keys are ignored.
 * - Non-boolean values are coerced: truthy → true, falsy → false.
 */
export function resolveFeatureFlags(
  raw: Record<string, unknown> | null | undefined,
): FeatureFlags {
  const result = { ...DEFAULTS };

  if (raw == null || typeof raw !== "object") {
    return result;
  }

  for (const key of Object.keys(DEFAULTS) as Array<keyof FeatureFlags>) {
    if (key in raw) {
      result[key] = Boolean(raw[key]);
    }
  }

  return result;
}
