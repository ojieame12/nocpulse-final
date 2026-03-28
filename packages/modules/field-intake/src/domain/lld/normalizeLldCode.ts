import type {
  LldComponents,
  LldMeridian,
  LldQuarter,
  ParsedLldCode,
} from "../../contracts/LldComponents";
import { formatLld } from "./formatLld";

const VALID_QUARTERS = new Set<LldQuarter>(["NE", "NW", "SE", "SW"]);

export function normalizeLldCode(input: string): ParsedLldCode {
  const raw = input.trim();

  if (!raw) {
    throw new Error("Enter an LLD code before looking up a boundary.");
  }

  const tokens = raw
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (tokens.length !== 5) {
    throw new Error(
      "Use QUARTER-SECTION-TOWNSHIP-RANGE-WMERIDIAN, for example NW-25-042-04-W4.",
    );
  }

  const [quarterToken, sectionToken, townshipToken, rangeToken, meridianToken] =
    tokens;

  if (!VALID_QUARTERS.has(quarterToken as LldQuarter)) {
    throw new Error("Quarter must be one of NE, NW, SE, or SW.");
  }

  const section = parsePositiveInt(sectionToken, "Section");
  const township = parsePositiveInt(townshipToken, "Township");
  const range = parsePositiveInt(rangeToken, "Range");
  const meridianMatch = meridianToken.match(/^W([1-6])$/);

  if (!meridianMatch) {
    throw new Error("Meridian must be W1, W2, W3, W4, W5, or W6.");
  }

  if (section < 1 || section > 36) {
    throw new Error("Section must be between 1 and 36.");
  }

  if (township < 1 || township > 126) {
    throw new Error("Township must be between 1 and 126.");
  }

  if (range < 1 || range > 34) {
    throw new Error("Range must be between 1 and 34.");
  }

  const components: LldComponents = {
    quarter: quarterToken as LldQuarter,
    section,
    township,
    range,
    meridian: Number.parseInt(meridianMatch[1], 10) as LldMeridian,
  };

  return {
    raw,
    normalized: formatLld(components),
    components,
  };
}

function parsePositiveInt(token: string, label: string) {
  if (!/^\d+$/.test(token)) {
    throw new Error(`${label} must contain digits only.`);
  }

  return Number.parseInt(token, 10);
}
