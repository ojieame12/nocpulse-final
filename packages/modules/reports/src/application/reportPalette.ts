import { BRAND, STATUS, SURFACE, type RGB } from "@fieldpulse/pdf";

export const REPORT_GREEN = BRAND.forest900;
export const REPORT_POSITIVE = BRAND.positive;
export const REPORT_RED = STATUS.critical;
export const REPORT_AMBER = STATUS.warning;
export const REPORT_TEAL = STATUS.info;
export const REPORT_SLATE = SURFACE.border;

export function parseReportHexColor(
  hex: string | null | undefined,
): RGB | undefined {
  const value = (hex ?? "").replace("#", "");
  if (value.length !== 6) return undefined;
  const red = Number.parseInt(value.slice(0, 2), 16) / 255;
  const green = Number.parseInt(value.slice(2, 4), 16) / 255;
  const blue = Number.parseInt(value.slice(4, 6), 16) / 255;
  if (Number.isNaN(red) || Number.isNaN(green) || Number.isNaN(blue)) return undefined;
  return [red, green, blue];
}
