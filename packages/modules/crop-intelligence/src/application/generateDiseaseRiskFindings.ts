import type {
  FieldWeatherDerivedSignalSet,
  FieldWeatherForecast,
  FieldWeatherObservation,
} from "@fieldpulse/module-weather";
import type {
  FieldMoistureCellSnapshot,
  FieldMoistureCellSnapshotRepository,
} from "@fieldpulse/module-moisture";
import type { WorkspaceId } from "@fieldpulse/platform-db";
import type { CropContextInput } from "../contracts/CropContext";
import type { CropIntelligenceRun } from "../contracts/CropIntelligenceRun";
import type { FieldIntelligenceFinding } from "../contracts/FieldIntelligenceFinding";
import type { FieldIntelligenceZone } from "../contracts/FieldIntelligenceZone";
import type {
  DiseaseRiskModel,
  RulePack,
} from "../contracts/RulePack";
import type { UpsertFieldIntelligenceZoneInput } from "../contracts/UpsertFieldIntelligenceZoneInput";
import type { UpsertCropIntelligenceRunInput } from "../contracts/UpsertCropIntelligenceRunInput";
import type { UpsertFieldIntelligenceFindingInput } from "../contracts/UpsertFieldIntelligenceFindingInput";
import { buildZoneFeatureCollectionFromCells } from "../domain/geojson/buildZoneFeatureCollectionFromCells";
import { buildTrackedZoneReferences } from "../domain/zones/buildTrackedZoneReferences";
import { clusterGridCells } from "../domain/zones/clusterGridCells";
import { selectDiseaseRiskCells } from "../domain/zones/selectDiseaseRiskCells";
import { resolveCropRuleContext } from "./resolveCropRuleContext";
import { syncFindingZones } from "./syncFindingZones";

const DEFAULT_SOURCE_KEY = "disease-risk-generator";
const DEFAULT_MODEL_KEY = "disease-risk-v1";

type LoadFieldWeatherSignalSetRepository = {
  getLatestByField(
    workspaceId: WorkspaceId,
    fieldId: string,
  ): Promise<FieldWeatherDerivedSignalSet | null>;
};

type LoadFieldWeatherObservationRepository = {
  getLatestByField(
    workspaceId: WorkspaceId,
    fieldId: string,
  ): Promise<FieldWeatherObservation | null>;
};

type LoadFieldWeatherForecastRepository = {
  listByField(input: {
    workspaceId: WorkspaceId;
    fieldId: string;
    validAfter?: string;
    limit?: number;
  }): Promise<readonly FieldWeatherForecast[]>;
};

type LoadFieldMoistureCellSnapshotsRepository = Pick<
  FieldMoistureCellSnapshotRepository,
  "getLatestByField"
>;

type UpsertCropIntelligenceRunRepository = {
  upsertRun(input: UpsertCropIntelligenceRunInput): Promise<CropIntelligenceRun>;
};

type DiseaseRiskFindingRepository = {
  getByDedupeKey(
    workspaceId: string,
    fieldId: string,
    dedupeKey: string,
  ): Promise<FieldIntelligenceFinding | null>;
  upsertFinding(
    input: UpsertFieldIntelligenceFindingInput,
  ): Promise<FieldIntelligenceFinding>;
};
type DiseaseRiskZoneRepository = {
  listByTrackingKey(input: {
    workspaceId: string;
    fieldId: string;
    family: FieldIntelligenceFinding["family"];
    trackingKey: string;
  }): Promise<readonly FieldIntelligenceZone[]>;
  upsertZone(
    input: UpsertFieldIntelligenceZoneInput,
  ): Promise<FieldIntelligenceZone>;
};

export type GenerateDiseaseRiskFindingsInput = {
  workspaceId: WorkspaceId;
  fieldId: string;
  requestedAt: string;
  cropContext?: CropContextInput | null;
};

export type GenerateDiseaseRiskFindingsResult = {
  requestedAt: string;
  run: CropIntelligenceRun;
  findings: readonly FieldIntelligenceFinding[];
  weatherSignalSet: FieldWeatherDerivedSignalSet | null;
  weatherObservation: FieldWeatherObservation | null;
  forecastSampleCount: number;
};

export type GenerateDiseaseRiskFindingsUseCaseInput = {
  weatherSignalSets: LoadFieldWeatherSignalSetRepository;
  weatherObservations: LoadFieldWeatherObservationRepository;
  weatherForecasts: LoadFieldWeatherForecastRepository;
  moistureCells: LoadFieldMoistureCellSnapshotsRepository;
  runs: UpsertCropIntelligenceRunRepository;
  findings: DiseaseRiskFindingRepository;
  zones: DiseaseRiskZoneRepository;
  input: GenerateDiseaseRiskFindingsInput;
  rulePack: RulePack;
};

type DiseaseRiskAssessment = {
  model: DiseaseRiskModel;
  severity: UpsertFieldIntelligenceFindingInput["severity"];
  status: UpsertFieldIntelligenceFindingInput["status"];
  title: string;
  summary: string;
  explanation: string;
  recommendedAction: string;
  confidence: number;
  metadata: Record<string, number | string | null>;
};

function roundTo(value: number, decimals: number) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function averageTemperatureC(forecast: FieldWeatherForecast) {
  return (forecast.airTemperatureMinC + forecast.airTemperatureMaxC) / 2;
}

function isForecastConducive(
  forecast: FieldWeatherForecast,
  model: DiseaseRiskModel,
) {
  const averageTemperature = averageTemperatureC(forecast);
  const humidity = forecast.relativeHumidityPct ?? 0;

  return (
    humidity >= 90 &&
    forecast.precipitationMm >= 0.1 &&
    averageTemperature >= model.minTempC &&
    averageTemperature <= model.maxTempC
  );
}

function sumPrecipitationMm(forecasts: readonly FieldWeatherForecast[]) {
  return roundTo(
    forecasts.reduce((sum, forecast) => sum + forecast.precipitationMm, 0),
    2,
  );
}

function clampConfidence(value: number) {
  return Math.min(0.98, Math.max(0.35, roundTo(value, 3)));
}

function buildConfidence(input: {
  model: DiseaseRiskModel;
  conduciveHours: number;
  forecastSampleCount: number;
}) {
  const thresholdSpan = Math.max(
    1,
    input.model.severeLeafWetHours - input.model.minLeafWetHours,
  );
  const severityRatio = Math.min(
    1,
    Math.max(0, input.conduciveHours - input.model.minLeafWetHours) / thresholdSpan,
  );
  const completenessRatio = Math.min(1, input.forecastSampleCount / 24);

  return clampConfidence(0.64 + severityRatio * 0.16 + completenessRatio * 0.12);
}

function buildAssessment(input: {
  model: DiseaseRiskModel;
  observation: FieldWeatherObservation;
  signalSet: FieldWeatherDerivedSignalSet;
  forecasts: readonly FieldWeatherForecast[];
  existing: FieldIntelligenceFinding | null;
}): DiseaseRiskAssessment | null {
  const conduciveForecasts = input.forecasts.filter((forecast) =>
    isForecastConducive(forecast, input.model),
  );
  const conduciveHours = conduciveForecasts.length;
  const totalPrecipitationMm = sumPrecipitationMm(conduciveForecasts);

  if (conduciveHours < input.model.minLeafWetHours) {
    if (!input.existing || input.existing.status !== "active") {
      return null;
    }

    return {
      model: input.model,
      severity: "low",
      status: "resolved",
      title: `${input.model.label} eased`,
      summary:
        "The next 24-hour forecast no longer supports an active disease-risk finding for this crop stage.",
      explanation: `Only ${conduciveHours} forecast hour${
        conduciveHours === 1 ? "" : "s"
      } currently match the ${input.model.label.toLowerCase()} window, below the ${
        input.model.minLeafWetHours
      }-hour activation threshold.`,
      recommendedAction:
        "Continue normal scouting cadence, but the current disease-risk alert no longer needs to stay active.",
      confidence: clampConfidence(0.66),
      metadata: {
        diseaseModelKey: input.model.key,
        conduciveForecastHours24h: conduciveHours,
        leafWetHours24h: input.signalSet.leafWetHours24h,
        currentAirTemperatureC: input.observation.airTemperatureC,
        totalConducivePrecipitationMm24h: totalPrecipitationMm,
      },
    };
  }

  const severity =
    conduciveHours >= input.model.severeLeafWetHours + 4
      ? "critical"
      : conduciveHours >= input.model.severeLeafWetHours
        ? "high"
        : "medium";

  return {
    model: input.model,
    severity,
    status: "active",
    title:
      severity === "critical"
        ? `${input.model.label} intensifying`
        : severity === "high"
          ? `${input.model.label} elevated`
          : `${input.model.label} building`,
    summary: `The next 24-hour forecast contains ${conduciveHours} disease-conducive wet hour${
      conduciveHours === 1 ? "" : "s"
    } for ${input.model.label.toLowerCase()}.`,
    explanation: `Forecast-driven wet-canopy hours are meeting the ${input.model.label.toLowerCase()} model for this field. ${conduciveHours} hour${
      conduciveHours === 1 ? "" : "s"
    } stay within the ${input.model.minTempC.toFixed(0)}-${input.model.maxTempC.toFixed(
      0,
    )} C range with humidity >= 90% and measurable precipitation, versus an activation threshold of ${
      input.model.minLeafWetHours
    } hour${input.model.minLeafWetHours === 1 ? "" : "s"}.`,
    recommendedAction: input.model.recommendedAction,
    confidence: buildConfidence({
      model: input.model,
      conduciveHours,
      forecastSampleCount: input.forecasts.length,
    }),
    metadata: {
      diseaseModelKey: input.model.key,
      conduciveForecastHours24h: conduciveHours,
      leafWetHours24h: input.signalSet.leafWetHours24h,
      currentAirTemperatureC: input.observation.airTemperatureC,
      totalConducivePrecipitationMm24h: totalPrecipitationMm,
      activationLeafWetHours: input.model.minLeafWetHours,
      severeLeafWetHours: input.model.severeLeafWetHours,
      minTempC: input.model.minTempC,
      maxTempC: input.model.maxTempC,
    },
  };
}

async function upsertAssessmentFinding(input: {
  repository: DiseaseRiskFindingRepository;
  zones: DiseaseRiskZoneRepository;
  workspaceId: WorkspaceId;
  fieldId: string;
  runId: string;
  requestedAt: string;
  observation: FieldWeatherObservation;
  signalSet: FieldWeatherDerivedSignalSet;
  moistureCells: readonly FieldMoistureCellSnapshot[];
  rulePack: RulePack;
  crop: ReturnType<typeof resolveCropRuleContext>["crop"];
  assessment: DiseaseRiskAssessment;
  existing: FieldIntelligenceFinding | null;
}): Promise<FieldIntelligenceFinding> {
  const affectedCells =
    input.assessment.status === "active"
      ? selectDiseaseRiskCells(input.moistureCells)
      : [];
  const zoneClusters = clusterGridCells(affectedCells);
  const zoneGeoJson = buildZoneFeatureCollectionFromCells(zoneClusters);
  const affectedCellKeys = affectedCells.map((cell) => cell.cellKey);
  const moistureSnapshotId = affectedCells[0]?.snapshotId ?? undefined;
  const findingInput: UpsertFieldIntelligenceFindingInput = {
    workspaceId: input.workspaceId,
    fieldId: input.fieldId,
    runId: input.runId,
    family: "disease_risk",
    severity: input.assessment.severity,
    status: input.assessment.status,
    sourceKey: `${DEFAULT_SOURCE_KEY}:${input.assessment.model.key}:${input.signalSet.sourceKey}`,
    dedupeKey: `disease-risk:${input.assessment.model.key}`,
    title: input.assessment.title,
    summary: input.assessment.summary,
    explanation: input.assessment.explanation,
    recommendedAction: input.assessment.recommendedAction,
    confidence: input.assessment.confidence,
    zoneGeoJson,
    affectedCellKeys,
    evidence: {
      weatherObservationId: input.observation.id,
      weatherSignalSetId: input.signalSet.id,
      moistureSnapshotId,
      affectedCellKeys,
      datasetVersion: `${input.rulePack.id}:${input.rulePack.version}`,
      providerKeys: [input.signalSet.providerKey],
      metadata: {
        rulePackId: input.rulePack.id,
        rulePackVersion: input.rulePack.version,
        cropKey: input.crop.cropKey,
        cropLabel: input.crop.cropLabel,
        growthStage: input.crop.growthStage,
        gddBaseC: input.crop.gddBaseC,
        isGenericCrop: input.crop.isGenericCrop,
        moistureCellCount: input.moistureCells.length,
        diseaseZoneCellCount: affectedCells.length,
        zoneClusterCount: zoneClusters.length,
        largestZoneCellCount:
          zoneClusters.length > 0 ? zoneClusters[0]!.cells.length : 0,
        zoneSelectionStrategy: "wettest-quartile-surface-root-blend",
        signalVersion: input.signalSet.signalVersion,
        ...input.assessment.metadata,
      },
    },
    startedAt:
      input.existing && input.existing.status === "active"
        ? input.existing.startedAt
        : input.signalSet.observedAt,
    endedAt:
      input.assessment.status === "active" ? null : input.requestedAt,
  };
  const finding = await input.repository.upsertFinding(findingInput);

  const syncedZones = await syncFindingZones({
    repository: input.zones,
    finding,
    observedAt: input.signalSet.observedAt,
    zones: zoneClusters.map((cluster) => {
      const clusterGeoJson = buildZoneFeatureCollectionFromCells([cluster]);

      if (!clusterGeoJson) {
        throw new Error("[crop-intelligence] zone cluster could not be rendered");
      }

      return {
        zoneGeoJson: clusterGeoJson,
        affectedCellKeys: cluster.cells.map((cell) => cell.cellKey),
        metadata: {
          zoneKey: cluster.zoneKey,
          cellCount: cluster.cells.length,
          rowStart: cluster.rowStart,
          rowEnd: cluster.rowEnd,
          columnStart: cluster.columnStart,
          columnEnd: cluster.columnEnd,
          selectionStrategy: "wettest-quartile-surface-root-blend",
        },
      };
    }),
  });
  const trackedZones = buildTrackedZoneReferences(syncedZones);

  return input.repository.upsertFinding({
    ...findingInput,
    evidence: {
      ...(findingInput.evidence ?? {}),
      trackedZones,
    },
  });
}

export async function generateDiseaseRiskFindings(
  input: GenerateDiseaseRiskFindingsUseCaseInput,
): Promise<GenerateDiseaseRiskFindingsResult> {
  const resolvedRules = resolveCropRuleContext({
    rulePack: input.rulePack,
    cropContext: input.input.cropContext,
  });

  const [signalSet, observation, moistureCells] = await Promise.all([
    input.weatherSignalSets.getLatestByField(
      input.input.workspaceId,
      input.input.fieldId,
    ),
    input.weatherObservations.getLatestByField(
      input.input.workspaceId,
      input.input.fieldId,
    ),
    input.moistureCells.getLatestByField(
      input.input.workspaceId,
      input.input.fieldId,
    ),
  ]);

  const forecasts =
    signalSet == null
      ? []
      : await input.weatherForecasts.listByField({
          workspaceId: input.input.workspaceId,
          fieldId: input.input.fieldId,
          validAfter: signalSet.observedAt,
          limit: 24,
        });

  const run = await input.runs.upsertRun({
    workspaceId: input.input.workspaceId,
    fieldId: input.input.fieldId,
    sourceKey: DEFAULT_SOURCE_KEY,
    modelKey: DEFAULT_MODEL_KEY,
    status: "completed",
    startedAt: input.input.requestedAt,
    completedAt: input.input.requestedAt,
    inputVersion: `${input.rulePack.id}:${input.rulePack.version}`,
    provenance: {
      weatherSignalSetId: signalSet?.id ?? null,
      weatherObservationId: observation?.id ?? null,
      moistureCellCount: moistureCells.length,
      forecastSampleCount: forecasts.length,
      rulePackId: input.rulePack.id,
      rulePackVersion: input.rulePack.version,
      evaluatedDiseaseModelKeys: resolvedRules.diseaseRisk.models.map(
        (model) => model.key,
      ),
      cropKey: resolvedRules.crop.cropKey,
      cropLabel: resolvedRules.crop.cropLabel,
      growthStage: resolvedRules.crop.growthStage,
      gddBaseC: resolvedRules.crop.gddBaseC,
      isGenericCrop: resolvedRules.crop.isGenericCrop,
    },
  });

  if (!signalSet || !observation || resolvedRules.diseaseRisk.models.length === 0) {
    return {
      requestedAt: input.input.requestedAt,
      run,
      findings: [],
      weatherSignalSet: signalSet,
      weatherObservation: observation,
      forecastSampleCount: forecasts.length,
    };
  }

  const existingFindings = await Promise.all(
    resolvedRules.diseaseRisk.models.map((model) =>
      input.findings.getByDedupeKey(
        input.input.workspaceId,
        input.input.fieldId,
        `disease-risk:${model.key}`,
      ),
    ),
  );

  const findings = (
    await Promise.all(
      resolvedRules.diseaseRisk.models.map((model, index) => {
        const existing = existingFindings[index] ?? null;
        const assessment = buildAssessment({
          model,
          observation,
          signalSet,
          forecasts,
          existing,
        });

        if (!assessment) {
          return null;
        }

        return upsertAssessmentFinding({
          repository: input.findings,
          zones: input.zones,
          workspaceId: input.input.workspaceId,
          fieldId: input.input.fieldId,
          runId: run.id,
          requestedAt: input.input.requestedAt,
          observation,
          signalSet,
          moistureCells,
          rulePack: input.rulePack,
          crop: resolvedRules.crop,
          assessment,
          existing,
        });
      }),
    )
  ).filter((finding): finding is FieldIntelligenceFinding => finding != null);

  return {
    requestedAt: input.input.requestedAt,
    run,
    findings,
    weatherSignalSet: signalSet,
    weatherObservation: observation,
    forecastSampleCount: forecasts.length,
  };
}
