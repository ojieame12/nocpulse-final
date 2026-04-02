import type { EntityId, WorkspaceScoped } from "@fieldpulse/platform-db";

export type ComputeFieldWeatherDerivedSignalsInput = WorkspaceScoped & {
  fieldId: EntityId;
  signalVersion?: string;
  forecastLimit?: number;
  gddBaseC?: number;
  soilTempThresholdC?: number;
  frostDamageThresholdC?: number;
};
