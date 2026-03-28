import type { HailEventType, HailSeverity } from "../contracts/HailProvider";

const HAIL_KEYWORDS = [
  /\bhail\b/i,
  /\bgr[êe]le\b/i,
];

const HAIL_SIZE_PATTERNS = [
  {
    pattern: /(\d+(?:\.\d+)?)\s*mm\b/i,
    toMillimetres(value: number) {
      return value;
    },
  },
  {
    pattern: /(\d+(?:\.\d+)?)\s*cm\b/i,
    toMillimetres(value: number) {
      return value * 10;
    },
  },
];

const SIZED_HAIL_TOKENS: Array<[RegExp, number]> = [
  [/\btoonie[-\s]?size(?:d)?\s+hail\b/i, 28],
  [/\bloonie[-\s]?size(?:d)?\s+hail\b/i, 26],
  [/\bnickel[-\s]?size(?:d)?\s+hail\b/i, 21],
  [/\bquarter[-\s]?size(?:d)?\s+hail\b/i, 24],
  [/\blarge\s+hail\b/i, 20],
];

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function looksLikeHailAlert(
  headline: string,
  description: string,
): boolean {
  const content = `${headline}\n${description}`;
  return HAIL_KEYWORDS.some((pattern) => pattern.test(content));
}

export function parseHailSizeMillimetres(
  headline: string,
  description: string,
): number | null {
  const content = normalizeWhitespace(`${headline}\n${description}`);

  for (const [pattern, sizeMm] of SIZED_HAIL_TOKENS) {
    if (pattern.test(content)) {
      return sizeMm;
    }
  }

  for (const entry of HAIL_SIZE_PATTERNS) {
    const match = content.match(entry.pattern);

    if (!match) {
      continue;
    }

    const rawValue = Number.parseFloat(match[1]);

    if (Number.isFinite(rawValue)) {
      return entry.toMillimetres(rawValue);
    }
  }

  return null;
}

export function deriveHailSeverity(
  alertType: string,
  hailSizeMm: number | null,
): HailSeverity {
  const normalizedAlertType = alertType.trim().toLowerCase();

  if (hailSizeMm != null && hailSizeMm >= 20) {
    return "severe";
  }

  switch (normalizedAlertType) {
    case "warning":
      return "warning";
    case "watch":
      return "watch";
    case "advisory":
    default:
      return "advisory";
  }
}

export function deriveHailEventType(): HailEventType {
  return "warning";
}
