import type { AlertSummary } from "../../contracts/AlertSummary";

export function isCriticalAlert(alert: AlertSummary) {
  return alert.severity === "critical";
}
