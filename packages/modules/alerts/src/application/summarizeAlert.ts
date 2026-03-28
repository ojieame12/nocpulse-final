import type { AlertSummary } from "../contracts/AlertSummary";

export function summarizeAlert(alert: AlertSummary) {
  return `${alert.severity.toUpperCase()} ${alert.family}: ${alert.title}`;
}
