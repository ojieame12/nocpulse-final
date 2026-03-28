const HEADER_ALIASES = {
  fieldName: [
    "nameoffield",
    "fieldname",
    "field",
    "name",
  ],
  quarter: [
    "lsdquarter",
    "lldquarter",
    "quarter",
    "lsd",
  ],
  section: ["sections", "section"],
  township: ["townships", "township"],
  range: ["ranges", "range"],
  meridian: ["meridians", "meridian"],
  cropType: ["crops", "crop", "croptype"],
} as const;

export type SpreadsheetHeaderKey = keyof typeof HEADER_ALIASES;

export function getSpreadsheetColumnValue(
  record: Record<string, unknown>,
  key: SpreadsheetHeaderKey,
) {
  const aliases = HEADER_ALIASES[key];

  for (const [header, value] of Object.entries(record)) {
    if (aliases.includes(normalizeHeader(header) as never)) {
      return value;
    }
  }

  return undefined;
}

function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}
