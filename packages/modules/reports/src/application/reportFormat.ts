export function formatReportNumber(
  value: number | null | undefined,
  digits = 1,
): string {
  if (value == null || Number.isNaN(value)) return "—";
  return value.toFixed(digits);
}

export function formatReportPercent(
  value: number | null | undefined,
  digits = 1,
): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value.toFixed(digits)}%`;
}

export function formatReportDate(
  value: string | null | undefined,
): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString("en-CA", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return value.slice(0, 10);
  }
}

export function formatReportDateTime(
  value: string | null | undefined,
): string {
  if (!value) return "—";
  try {
    const date = new Date(value);
    return date.toLocaleDateString("en-CA", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value.replace("T", " ").slice(0, 16);
  }
}

export function formatReportDateStamp(
  value: string | null | undefined,
): string {
  if (!value) return "—";
  return value.slice(0, 10);
}
