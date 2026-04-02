import { normalizeLldCode } from "../lld/normalizeLldCode";
import { formatLld } from "../lld/formatLld";
import { getSpreadsheetColumnValue } from "./headerAliases";
import {
  normalizeImportedCropType,
  normalizeSpreadsheetString,
  parseSpreadsheetMeridian,
  parseSpreadsheetPositiveInteger,
} from "./normalizeSpreadsheetValues";
import type { LldComponents, LldQuarter } from "../../contracts/LldComponents";
import type { ParsedSpreadsheetImportRow } from "./types";

export type SpreadsheetParseContext = {
  lastFieldName?: string;
  lastCropType?: string;
};

export type ParsedSpreadsheetRecordResult = {
  rows: readonly ParsedSpreadsheetImportRow[];
  context: SpreadsheetParseContext;
};

type FieldNameResolution = {
  value: string;
  source: "explicit" | "lld" | "context";
};

const SECTION_LEVEL_QUARTERS: readonly LldQuarter[] = [
  "NW",
  "NE",
  "SW",
  "SE",
];

export function parseSpreadsheetRecord(
  record: Record<string, unknown>,
  rowNumber: number,
  context: SpreadsheetParseContext = {},
): ParsedSpreadsheetRecordResult {
  const fieldName = resolveFieldName(record, context);
  const cropType = resolveCropType(record, fieldName, context);
  const lldCode = normalizeSpreadsheetString(
    getSpreadsheetColumnValue(record, "lldCode"),
  );

  const rows = lldCode
    ? buildRowsFromCombinedLldCode({
        fieldName: fieldName.value,
        cropType,
        rowNumber,
        lldCode,
      })
    : buildRowsFromColumns({
        record,
        fieldName: fieldName.value,
        cropType,
        rowNumber,
      });

  return {
    rows,
    context: {
      lastFieldName: fieldName.value,
      lastCropType: cropType,
    },
  };
}

function resolveFieldName(
  record: Record<string, unknown>,
  context: SpreadsheetParseContext,
): FieldNameResolution {
  const explicitFieldName = normalizeSpreadsheetString(
    getSpreadsheetColumnValue(record, "fieldName"),
  );

  if (explicitFieldName) {
    return {
      value: explicitFieldName,
      source: "explicit",
    };
  }

  const lldCode = normalizeSpreadsheetString(
    getSpreadsheetColumnValue(record, "lldCode"),
  );

  if (lldCode) {
    return {
      value: normalizeFieldNameFromLld(lldCode),
      source: "lld",
    };
  }

  if (context.lastFieldName) {
    return {
      value: context.lastFieldName,
      source: "context",
    };
  }

  throw new Error("Field name is required.");
}

function resolveCropType(
  record: Record<string, unknown>,
  fieldName: FieldNameResolution,
  context: SpreadsheetParseContext,
) {
  const explicitCropType = normalizeImportedCropType(
    getSpreadsheetColumnValue(record, "cropType"),
  );

  if (explicitCropType) {
    return explicitCropType;
  }

  const inferredFromFieldName = inferCropTypeFromFieldName(fieldName.value);

  if (inferredFromFieldName) {
    return inferredFromFieldName;
  }

  return fieldName.source === "context" ? context.lastCropType : undefined;
}

function buildRowsFromCombinedLldCode(input: {
  fieldName: string;
  cropType?: string;
  rowNumber: number;
  lldCode: string;
}): readonly ParsedSpreadsheetImportRow[] {
  try {
    const resolved = normalizeLldCode(input.lldCode);

    return [
      {
        rowNumber: input.rowNumber,
        fieldName: input.fieldName,
        cropType: input.cropType,
        legalLandDescription: resolved.normalized,
        lldComponents: resolved.components,
      },
    ];
  } catch (error) {
    const sectionLevel = tryParseSectionLevelLldCode(input.lldCode);

    if (!sectionLevel) {
      throw error;
    }

    return SECTION_LEVEL_QUARTERS.map((quarter) => ({
      rowNumber: input.rowNumber,
      fieldName: input.fieldName,
      cropType: input.cropType,
      legalLandDescription: sectionLevel.normalized,
      lldComponents: {
        quarter,
        section: sectionLevel.section,
        township: sectionLevel.township,
        range: sectionLevel.range,
        meridian: sectionLevel.meridian,
      },
    }));
  }
}

function buildRowsFromColumns(input: {
  record: Record<string, unknown>;
  fieldName: string;
  cropType?: string;
  rowNumber: number;
}) {
  const quarterSelection = parseSpreadsheetQuarterSelection(
    getSpreadsheetColumnValue(input.record, "quarter"),
  );
  const section = parseSpreadsheetPositiveInteger(
    getSpreadsheetColumnValue(input.record, "section"),
    "Section",
  );
  const township = parseSpreadsheetPositiveInteger(
    getSpreadsheetColumnValue(input.record, "township"),
    "Township",
  );
  const range = parseSpreadsheetPositiveInteger(
    getSpreadsheetColumnValue(input.record, "range"),
    "Range",
  );
  const meridian = parseSpreadsheetMeridian(
    getSpreadsheetColumnValue(input.record, "meridian"),
  );

  const sectionLevelLld = formatSectionLld({
    section,
    township,
    range,
    meridian,
  });

  return quarterSelection.quarters.map((quarter) => {
    const components: LldComponents = {
      quarter,
      section,
      township,
      range,
      meridian,
    };

    return {
      rowNumber: input.rowNumber,
      fieldName: input.fieldName,
      cropType: input.cropType,
      legalLandDescription: quarterSelection.sectionLevel
        ? sectionLevelLld
        : formatLld(components),
      lldComponents: components,
    };
  });
}

function normalizeFieldNameFromLld(lldCode: string) {
  const quarterLevel = tryNormalizeQuarterLevelLldCode(lldCode);

  if (quarterLevel) {
    return quarterLevel;
  }

  const sectionLevel = tryParseSectionLevelLldCode(lldCode);

  if (sectionLevel) {
    return sectionLevel.normalized;
  }

  return lldCode;
}

function tryNormalizeQuarterLevelLldCode(lldCode: string) {
  try {
    return normalizeLldCode(lldCode).normalized;
  } catch {
    return null;
  }
}

function inferCropTypeFromFieldName(fieldName: string) {
  const match = fieldName.match(/\(([^)]+)\)\s*$/);
  const cropType = normalizeSpreadsheetString(match?.[1]);

  return cropType || undefined;
}

function parseSpreadsheetQuarterSelection(value: unknown) {
  const raw = normalizeSpreadsheetString(value).toUpperCase();

  if (!raw) {
    return {
      quarters: SECTION_LEVEL_QUARTERS,
      sectionLevel: true,
    };
  }

  const matches = raw.match(/\b(?:NE|NW|SE|SW)\b/g) ?? [];
  const quarters = Array.from(new Set(matches)) as LldQuarter[];

  if (quarters.length === 0) {
    throw new Error("Quarter must be one of NE, NW, SE, or SW.");
  }

  return {
    quarters,
    sectionLevel: false,
  };
}

function tryParseSectionLevelLldCode(input: string) {
  const tokens = input
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (tokens.length !== 4) {
    return null;
  }

  const [sectionToken, townshipToken, rangeToken, meridianToken] = tokens;
  const meridianMatch = meridianToken.match(/^W([1-6])$/);

  if (!meridianMatch) {
    return null;
  }

  const section = parsePositiveInt(sectionToken);
  const township = parsePositiveInt(townshipToken);
  const range = parsePositiveInt(rangeToken);

  if (section == null || township == null || range == null) {
    return null;
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

  return {
    section,
    township,
    range,
    meridian: Number.parseInt(meridianMatch[1], 10) as LldComponents["meridian"],
    normalized: formatSectionLld({
      section,
      township,
      range,
      meridian: Number.parseInt(meridianMatch[1], 10) as LldComponents["meridian"],
    }),
  };
}

function parsePositiveInt(value: string) {
  if (!/^\d+$/.test(value)) {
    return null;
  }

  return Number.parseInt(value, 10);
}

function formatSectionLld(input: {
  section: number;
  township: number;
  range: number;
  meridian: LldComponents["meridian"];
}) {
  return `${String(input.section).padStart(2, "0")}-${String(input.township).padStart(
    3,
    "0",
  )}-${String(input.range).padStart(2, "0")}-W${input.meridian}`;
}
