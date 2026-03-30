import type { JsonValue, TimestampIso } from "@fieldpulse/platform-db";

export const FIELD_ACTION_CURATION_SOURCE_KEY = "field_action_curation";

export type FieldActionCurationVersionInput = {
  state: "active";
  source: "findings" | "alerts";
  topRiskTitle: string;
  topRiskSeverity: "low" | "medium" | "high" | "critical" | null;
  dueDate: string;
  activeFindingCount: number;
  activeZoneCount: number;
  activeAlertCount: number;
};

export type FieldActionCuration = {
  inputVersion: string | null;
  generatedAt: TimestampIso;
  provider: string;
  modelKey: string;
  recommendation: string;
  explanation: string;
  inspectFirst: string;
  whyNow: string;
  supportingContext: string;
  confidence: string | null;
};

function normalizeSegment(value: string | null | undefined) {
  return (value ?? "")
    .replace(/\s+/g, " ")
    .replace(/[|:]/g, "/")
    .trim();
}

function isJsonObject(value: JsonValue): value is Record<string, JsonValue> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: JsonValue | undefined): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export function buildFieldActionCurationVersion(
  input: FieldActionCurationVersionInput,
) {
  return [
    "field-action-curation@1",
    input.state,
    input.source,
    normalizeSegment(input.topRiskTitle),
    normalizeSegment(input.topRiskSeverity),
    normalizeSegment(input.dueDate),
    String(input.activeFindingCount),
    String(input.activeZoneCount),
    String(input.activeAlertCount),
  ].join("|");
}

export function parseFieldActionCuration(
  provenance: JsonValue,
  inputVersion: string | null | undefined,
): FieldActionCuration | null {
  if (!isJsonObject(provenance)) {
    return null;
  }

  const kind = readString(provenance.kind);
  if (kind !== FIELD_ACTION_CURATION_SOURCE_KEY) {
    return null;
  }

  const generatedAt = readString(provenance.generatedAt);
  const provider = readString(provenance.provider);
  const modelKey = readString(provenance.modelKey);
  const recommendation = readString(provenance.recommendation);
  const explanation = readString(provenance.explanation);
  const inspectFirst = readString(provenance.inspectFirst);
  const whyNow = readString(provenance.whyNow);
  const supportingContext = readString(provenance.supportingContext);
  const confidence = readString(provenance.confidence);

  if (
    !generatedAt ||
    !provider ||
    !modelKey ||
    !recommendation ||
    !explanation ||
    !inspectFirst ||
    !whyNow ||
    !supportingContext
  ) {
    return null;
  }

  return {
    inputVersion: inputVersion ?? null,
    generatedAt,
    provider,
    modelKey,
    recommendation,
    explanation,
    inspectFirst,
    whyNow,
    supportingContext,
    confidence,
  };
}
