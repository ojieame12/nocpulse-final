import test from "node:test";
import assert from "node:assert/strict";
import { generateWeatherRiskFindings } from "./generateWeatherRiskFindings";
import { prairieDefaultRulePack } from "../domain/rulePacks/prairieDefaultRulePack";
import type { CropIntelligenceRun } from "../contracts/CropIntelligenceRun";
import type { FieldIntelligenceFinding } from "../contracts/FieldIntelligenceFinding";
import type { UpsertCropIntelligenceRunInput } from "../contracts/UpsertCropIntelligenceRunInput";
import type { UpsertFieldIntelligenceFindingInput } from "../contracts/UpsertFieldIntelligenceFindingInput";
import type { FieldWeatherDerivedSignalSet } from "@fieldpulse/module-weather";
import type { JsonValue } from "@fieldpulse/platform-db";

const WORKSPACE_ID = "workspace-1";
const FIELD_ID = "field-1";
const OBSERVED_AT = "2026-03-28T05:00:00.000Z";
const REQUESTED_AT = "2026-03-28T06:00:00.000Z";

function createRun(input: UpsertCropIntelligenceRunInput): CropIntelligenceRun {
  return {
    id: "run-1",
    workspaceId: input.workspaceId,
    fieldId: input.fieldId,
    sourceKey: input.sourceKey,
    modelKey: input.modelKey,
    status: input.status,
    startedAt: input.startedAt,
    completedAt: input.completedAt ?? null,
    inputVersion: input.inputVersion ?? null,
    provenance: input.provenance ?? {},
    createdAt: input.startedAt,
    updatedAt: input.completedAt ?? input.startedAt,
  };
}

function createWeatherSignalSet(
  overrides: Partial<FieldWeatherDerivedSignalSet> = {},
): FieldWeatherDerivedSignalSet {
  return {
    id: "signal-1",
    workspaceId: WORKSPACE_ID,
    fieldId: FIELD_ID,
    weatherObservationId: "weather-1",
    observedAt: OBSERVED_AT,
    forecastRunAt: OBSERVED_AT,
    sourceKey: "signal-v1",
    providerKey: "open-meteo",
    signalVersion: "v1",
    currentVpdKpa: 1.2,
    peakForecastVpdKpa24h: 1.1,
    netWaterBalance24hMm: 0.4,
    netWaterBalance72hMm: 0.9,
    leafWetHours24h: 2,
    sprayWindowCount24h: 6,
    frostRiskMinTempC: 2.5,
    frostRiskMinTempC7d: 1.2,
    frostRiskNights7d: 2,
    frostProbabilityPct7d: null,
    recentPrecipTotal72hMm: 3.4,
    freezeThawCycles7d: 1,
    soilTemp6cmCurrentC: 6.8,
    soilTemp6cmSustainedDays: 2,
    gdd24h: 8,
    gdd72h: 23,
    gddBaseC: 5,
    provenance: {},
    createdAt: OBSERVED_AT,
    updatedAt: OBSERVED_AT,
    ...overrides,
  };
}

function createFindingRecord(
  input: UpsertFieldIntelligenceFindingInput,
  existingId?: string,
): FieldIntelligenceFinding {
  return {
    id: existingId ?? `finding-${input.dedupeKey}`,
    workspaceId: input.workspaceId,
    fieldId: input.fieldId,
    runId: input.runId ?? null,
    family: input.family,
    severity: input.severity,
    status: input.status ?? "active",
    sourceKey: input.sourceKey,
    dedupeKey: input.dedupeKey,
    title: input.title,
    summary: input.summary ?? null,
    explanation: input.explanation ?? null,
    recommendedAction: input.recommendedAction ?? null,
    confidence: input.confidence ?? null,
    zoneGeoJson: input.zoneGeoJson ?? null,
    affectedCellKeys: input.affectedCellKeys ?? [],
    evidence: input.evidence ?? {},
    startedAt: input.startedAt,
    endedAt: input.endedAt ?? null,
    createdAt: input.startedAt,
    updatedAt: input.endedAt ?? input.startedAt,
  };
}

function readMetadataRecord(value: JsonValue | undefined) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, JsonValue>;
}

class InMemoryRunRepository {
  lastInput: UpsertCropIntelligenceRunInput | null = null;

  async upsertRun(input: UpsertCropIntelligenceRunInput): Promise<CropIntelligenceRun> {
    this.lastInput = input;
    return createRun(input);
  }
}

class InMemoryFindingRepository {
  private readonly byDedupeKey = new Map<string, FieldIntelligenceFinding>();
  readonly upsertInputs: UpsertFieldIntelligenceFindingInput[] = [];

  constructor(existing: readonly FieldIntelligenceFinding[] = []) {
    for (const finding of existing) {
      this.byDedupeKey.set(`${finding.workspaceId}:${finding.fieldId}:${finding.dedupeKey}`, finding);
    }
  }

  async getByDedupeKey(
    workspaceId: string,
    fieldId: string,
    dedupeKey: string,
  ): Promise<FieldIntelligenceFinding | null> {
    return this.byDedupeKey.get(`${workspaceId}:${fieldId}:${dedupeKey}`) ?? null;
  }

  async upsertFinding(
    input: UpsertFieldIntelligenceFindingInput,
  ): Promise<FieldIntelligenceFinding> {
    this.upsertInputs.push(input);
    const key = `${input.workspaceId}:${input.fieldId}:${input.dedupeKey}`;
    const existing = this.byDedupeKey.get(key);
    const record = createFindingRecord(input, existing?.id);
    this.byDedupeKey.set(key, record);
    return record;
  }
}

test("generateWeatherRiskFindings creates an active critical frost finding for frost-sensitive corn", async () => {
  const runs = new InMemoryRunRepository();
  const findings = new InMemoryFindingRepository();

  const result = await generateWeatherRiskFindings({
    weatherSignalSets: {
      async getLatestByField() {
        return createWeatherSignalSet({
          frostRiskMinTempC: -2,
          peakForecastVpdKpa24h: 1.0,
          netWaterBalance24hMm: 0.2,
          netWaterBalance72hMm: 0.5,
        });
      },
    },
    runs,
    findings,
    input: {
      workspaceId: WORKSPACE_ID,
      fieldId: FIELD_ID,
      requestedAt: REQUESTED_AT,
      cropContext: {
        cropType: "maize",
        growthStage: "veg",
      },
    },
    rulePack: prairieDefaultRulePack,
  });

  assert.equal(result.run.status, "completed");
  assert.equal(result.findings.length, 1);
  const finding = result.findings[0]!;
  const metadata = readMetadataRecord(finding.evidence.metadata);

  assert.equal(finding.family, "weather_risk");
  assert.equal(finding.status, "active");
  assert.equal(finding.severity, "critical");
  assert.equal(finding.dedupeKey, "weather-risk:frost:prairie-default-frost");
  assert.equal(finding.startedAt, OBSERVED_AT);
  assert.equal(finding.endedAt, null);
  assert.equal(metadata.cropKey, "corn");
  assert.equal(metadata.growthStage, "vegetative");
  assert.equal(metadata.riskType, "frost");
  assert.equal(metadata.frostRiskMinTempC, -2);
  assert.equal(metadata.damageTempC, 0);
  assert.equal(metadata.killTempC, -1.5);
  assert.equal(readMetadataRecord(runs.lastInput?.provenance).cropKey, "corn");
});

test("generateWeatherRiskFindings resolves an existing atmospheric-demand finding when demand eases", async () => {
  const existingFinding = createFindingRecord({
    workspaceId: WORKSPACE_ID,
    fieldId: FIELD_ID,
    runId: "previous-run",
    family: "weather_risk",
    severity: "high",
    status: "active",
    sourceKey: "weather-risk-generator:atmospheric-demand:signal-v1",
    dedupeKey: "weather-risk:atmospheric-demand:prairie-default-atmospheric-demand",
    title: "Atmospheric drying risk intensifying",
    summary: "Existing atmospheric-demand finding",
    explanation: "Existing explanation",
    recommendedAction: "Existing action",
    confidence: 0.8,
    evidence: {
      metadata: {
        riskType: "atmospheric-demand",
      },
    },
    startedAt: "2026-03-27T05:00:00.000Z",
    endedAt: null,
  }, "finding-existing");

  const findings = new InMemoryFindingRepository([existingFinding]);

  const result = await generateWeatherRiskFindings({
    weatherSignalSets: {
      async getLatestByField() {
        return createWeatherSignalSet({
          peakForecastVpdKpa24h: 1.1,
          netWaterBalance24hMm: 0.8,
          netWaterBalance72hMm: 1.3,
          frostRiskMinTempC: 3,
        });
      },
    },
    runs: new InMemoryRunRepository(),
    findings,
    input: {
      workspaceId: WORKSPACE_ID,
      fieldId: FIELD_ID,
      requestedAt: REQUESTED_AT,
      cropContext: {
        cropType: "lentil",
        growthStage: "reproductive",
      },
    },
    rulePack: prairieDefaultRulePack,
  });

  assert.equal(result.findings.length, 1);
  const finding = result.findings[0]!;
  const metadata = readMetadataRecord(finding.evidence.metadata);

  assert.equal(finding.status, "resolved");
  assert.equal(finding.severity, "low");
  assert.equal(
    finding.dedupeKey,
    "weather-risk:atmospheric-demand:prairie-default-atmospheric-demand",
  );
  assert.equal(finding.startedAt, "2026-03-27T05:00:00.000Z");
  assert.equal(finding.endedAt, REQUESTED_AT);
  assert.equal(metadata.cropKey, "lentils");
  assert.equal(metadata.growthStage, "flowering");
  assert.equal(metadata.riskType, "atmospheric-demand");
  assert.equal(metadata.peakForecastVpdKpa24h, 1.1);
  assert.equal(metadata.netWaterBalance24hMm, 0.8);
});
