import type { LldComponents, LldQuarter } from "../../contracts/LldComponents";

export function normalizeSpreadsheetString(value: unknown) {
  return String(value ?? "").trim();
}

export function normalizeImportedCropType(value: unknown) {
  const normalized = normalizeSpreadsheetString(value);
  return normalized || undefined;
}

export function parseSpreadsheetPositiveInteger(
  value: unknown,
  label: string,
) {
  const token = normalizeSpreadsheetString(value);

  if (!/^\d+$/.test(token)) {
    throw new Error(`${label} must be numeric.`);
  }

  return Number.parseInt(token, 10);
}

export function parseSpreadsheetQuarter(value: unknown): LldQuarter {
  const token = normalizeSpreadsheetString(value).toUpperCase();

  if (!["NE", "NW", "SE", "SW"].includes(token)) {
    throw new Error("Quarter must be one of NE, NW, SE, or SW.");
  }

  return token as LldComponents["quarter"];
}

export function parseSpreadsheetMeridian(value: unknown): LldComponents["meridian"] {
  const token = normalizeSpreadsheetString(value).toUpperCase();
  const match = token.match(/^W?([1-6])$/);

  if (!match) {
    throw new Error("Meridian must be W1, W2, W3, W4, W5, or W6.");
  }

  return Number.parseInt(match[1], 10) as LldComponents["meridian"];
}
