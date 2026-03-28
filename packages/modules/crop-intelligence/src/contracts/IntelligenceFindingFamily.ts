export type IntelligenceFindingFamily =
  | "hail_risk"
  | "weather_risk"
  | "moisture_stress"
  | "crop_health"
  | "disease_risk"
  | "action_brief";

export type IntelligenceSeverity = "low" | "medium" | "high" | "critical";

export type IntelligenceFindingStatus = "active" | "resolved" | "dismissed";

export type IntelligenceZoneStatus =
  | "new"
  | "persistent"
  | "recovering"
  | "resolved";

export type CropIntelligenceRunStatus =
  | "planned"
  | "running"
  | "completed"
  | "failed";
