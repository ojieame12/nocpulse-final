export type ReportSeverity = "critical" | "warning" | "info";

export function normalizeReportSeverity(
  severity: string | null | undefined,
): ReportSeverity {
  const value = severity?.toLowerCase();
  if (value === "high" || value === "critical") return "critical";
  if (value === "medium" || value === "med" || value === "warning") return "warning";
  return "info";
}

export function inferCropDiseaseRiskSeverity(
  percentLabel: string,
): ReportSeverity {
  const percent = Number.parseFloat(percentLabel);
  if (!Number.isNaN(percent) && percent >= 60) return "critical";
  if (!Number.isNaN(percent) && percent >= 30) return "warning";
  return "info";
}

export function inferCropAlertSeverity(
  iconKey: string,
): ReportSeverity {
  if (iconKey === "disease" || iconKey === "temperature") return "critical";
  if (iconKey === "moisture") return "warning";
  return "info";
}
