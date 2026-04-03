export type AgronomicSourceBasis =
  | "source-backed"
  | "modeled"
  | "pending"
  | "context-only"
  | "unavailable";

export type ResolvedAgronomicSourceBasis = {
  basis: AgronomicSourceBasis;
  badgeShort: string;
  badgeLong: string;
  validityLabel: string | null;
};

function normalize(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function joinParts(parts: Array<string | null | undefined>, separator = " · ") {
  const compact = parts.map((part) => part?.trim()).filter((part): part is string => Boolean(part));
  return compact.length > 0 ? compact.join(separator) : undefined;
}

function stripLegacyBasisPrefix(value: string, basis: AgronomicSourceBasis) {
  let next = value.trim();

  if (basis === "modeled") {
    next = next.replace(/^model(?:ed)?(?:\s+estimate)?\s*(?:·|-)?\s*/i, "");
  } else if (basis === "source-backed") {
    next = next
      .replace(/^source-backed\s*(?:·|-)?\s*/i, "")
      .replace(/^satellite-derived\s*(?:·|-)?\s*/i, "");
  }

  return next.trim();
}

function cleanDetail(value: string | null | undefined) {
  const normalized = normalize(value);
  if (!normalized || normalized === "no source" || normalized === "unknown") {
    return undefined;
  }

  return value?.trim();
}

export function formatAgronomicSourceBasisLabel(
  basis: AgronomicSourceBasis,
): string {
  switch (basis) {
    case "source-backed":
      return "Source-backed";
    case "modeled":
      return "Modeled";
    case "pending":
      return "Pending";
    case "context-only":
      return "Context-only";
    case "unavailable":
    default:
      return "Unavailable";
  }
}

export function resolveAgronomicSourceBasis(
  sourceLabel?: string | null,
): ResolvedAgronomicSourceBasis {
  const normalized = normalize(sourceLabel);

  if (!normalized) {
    return {
      basis: "unavailable",
      badgeShort: "N/A",
      badgeLong: "Unavailable",
      validityLabel: null,
    };
  }

  if (
    normalized.includes("pending") ||
    normalized.includes("processing") ||
    normalized.includes("awaiting")
  ) {
    return {
      basis: "pending",
      badgeShort: "PND",
      badgeLong: "Pending",
      validityLabel: "Pending",
    };
  }

  if (
    normalized.includes("preseason-optical-context") ||
    normalized.includes("preseason optical context") ||
    normalized.includes("context-only") ||
    normalized.includes("context only")
  ) {
    return {
      basis: "context-only",
      badgeShort: "CTX",
      badgeLong: "Context-only",
      validityLabel: "Context-only",
    };
  }

  if (normalized.includes("synthetic") || normalized.includes("model") || normalized.includes("twi")) {
    return {
      basis: "modeled",
      badgeShort: "EST",
      badgeLong: "Modeled",
      validityLabel: "Modeled estimate",
    };
  }

  if (normalized.includes("sentinel-1") || normalized.includes("sar")) {
    return {
      basis: "source-backed",
      badgeShort: "SAR",
      badgeLong: "Source-backed (SAR)",
      validityLabel: "Source-backed surface",
    };
  }

  if (
    normalized.includes("sentinel-2") ||
    normalized.includes("planet") ||
    normalized.includes("optical")
  ) {
    return {
      basis: "source-backed",
      badgeShort: "OPT",
      badgeLong: "Source-backed (Optical)",
      validityLabel: "Seasonally interpretable",
    };
  }

  return {
    basis: "source-backed",
    badgeShort: "SRC",
    badgeLong: "Source-backed",
    validityLabel: "Source-backed",
  };
}

export function describeAgronomicTruthBasis(input: {
  sourceTagExtended?: string | null;
  derivationMode?: string | null;
  confidenceSub?: string | null;
}): string | undefined {
  const derivationMode = normalize(input.derivationMode);
  const basis: AgronomicSourceBasis =
    derivationMode === "source-backed"
      ? "source-backed"
      : derivationMode && derivationMode !== "unknown"
        ? "modeled"
        : "unavailable";

  if (basis === "unavailable") {
    return undefined;
  }

  const basisLabel = formatAgronomicSourceBasisLabel(basis);
  const sourceTag = cleanDetail(input.sourceTagExtended);
  if (sourceTag) {
    const stripped = stripLegacyBasisPrefix(sourceTag, basis);
    return joinParts([basisLabel, stripped.length > 0 ? stripped : undefined]);
  }

  return joinParts([basisLabel, cleanDetail(input.confidenceSub)]);
}
