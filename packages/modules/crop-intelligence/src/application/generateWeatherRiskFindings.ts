import type { FieldWeatherDerivedSignalSet } from "@fieldpulse/module-weather";
import type { WorkspaceId } from "@fieldpulse/platform-db";
import type { CropContextInput, ResolvedCropContext } from "../contracts/CropContext";
import type { CropIntelligenceRun } from "../contracts/CropIntelligenceRun";
import type { FieldIntelligenceFinding } from "../contracts/FieldIntelligenceFinding";
import type { RulePack } from "../contracts/RulePack";
import type { UpsertCropIntelligenceRunInput } from "../contracts/UpsertCropIntelligenceRunInput";
import type { UpsertFieldIntelligenceFindingInput } from "../contracts/UpsertFieldIntelligenceFindingInput";
import { resolveCropRuleContext } from "./resolveCropRuleContext";

const DEFAULT_SOURCE_KEY = "weather-risk-generator";
const DEFAULT_MODEL_KEY = "weather-risk-v1";

type LoadFieldWeatherSignalSetRepository = {
  getLatestByField(
    workspaceId: WorkspaceId,
    fieldId: string,
  ): Promise<FieldWeatherDerivedSignalSet | null>;
};

type UpsertCropIntelligenceRunRepository = {
  upsertRun(input: UpsertCropIntelligenceRunInput): Promise<CropIntelligenceRun>;
};

type WeatherRiskFindingRepository = {
  getByDedupeKey(
    workspaceId: string,
    fieldId: string,
    dedupeKey: string,
  ): Promise<FieldIntelligenceFinding | null>;
  upsertFinding(
    input: UpsertFieldIntelligenceFindingInput,
  ): Promise<FieldIntelligenceFinding>;
};

export type GenerateWeatherRiskFindingsInput = {
  workspaceId: WorkspaceId;
  fieldId: string;
  requestedAt: string;
  cropContext?: CropContextInput | null;
};

export type GenerateWeatherRiskFindingsResult = {
  requestedAt: string;
  run: CropIntelligenceRun;
  findings: readonly FieldIntelligenceFinding[];
  weatherSignalSet: FieldWeatherDerivedSignalSet | null;
};

export type GenerateWeatherRiskFindingsUseCaseInput = {
  weatherSignalSets: LoadFieldWeatherSignalSetRepository;
  runs: UpsertCropIntelligenceRunRepository;
  findings: WeatherRiskFindingRepository;
  input: GenerateWeatherRiskFindingsInput;
  rulePack: RulePack;
};

type RiskKind = "frost" | "atmospheric-demand";

type WeatherRiskAssessment = {
  kind: RiskKind;
  reasonCode:
    | "frost-risk-eased"
    | "frost-damage-threshold"
    | "frost-kill-threshold"
    | "atmospheric-demand-eased"
    | "atmospheric-demand-elevated"
    | "atmospheric-demand-severe";
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

function clampConfidence(value: number) {
  return Math.min(0.98, Math.max(0.35, roundTo(value, 3)));
}

function buildFrostAssessment(input: {
  signalSet: FieldWeatherDerivedSignalSet;
  existing: FieldIntelligenceFinding | null;
  rulePack: RulePack["weatherRisk"]["frost"];
}): WeatherRiskAssessment | null {
  const minimum = input.signalSet.frostRiskMinTempC;

  if (minimum == null) {
    return null;
  }

  if (minimum > input.rulePack.damageTempC) {
    if (!input.existing || input.existing.status !== "active") {
      return null;
    }

    return {
      kind: "frost",
      reasonCode: "frost-risk-eased",
      severity: "low",
      status: "resolved",
      title: "Frost risk eased",
      summary: "The next 24-hour minimum is now above the active frost-risk threshold.",
      explanation: `Forecast minimum recovered to ${minimum.toFixed(1)} C, above the ${input.rulePack.damageTempC.toFixed(1)} C damage threshold in ${input.rulePack.label}.`,
      recommendedAction:
        "Keep monitoring overnight lows, but the current frost-risk alert no longer needs to stay active.",
      confidence: clampConfidence(0.72),
      metadata: {
        riskType: "frost",
        frostRiskMinTempC: minimum,
        damageTempC: input.rulePack.damageTempC,
        killTempC: input.rulePack.killTempC,
      },
    };
  }

  const severity =
    minimum <= input.rulePack.killTempC ? "critical" : "high";
  const confidenceBoost =
    severity === "critical"
      ? 0.14
      : Math.min(
          0.12,
          Math.abs(input.rulePack.damageTempC - minimum) * 0.04,
        );

  return {
    kind: "frost",
    reasonCode: severity === "critical" ? "frost-kill-threshold" : "frost-damage-threshold",
    severity,
    status: "active",
    title:
      severity === "critical"
        ? "Critical frost risk next 24h"
        : "Frost risk building next 24h",
    summary: `Forecast minimum of ${minimum.toFixed(1)} C breaches the ${input.rulePack.label.toLowerCase()} threshold for this field.`,
    explanation: `The latest derived weather signals show a 24-hour minimum of ${minimum.toFixed(1)} C. ${severity === "critical" ? `This is at or below the ${input.rulePack.killTempC.toFixed(1)} C kill threshold.` : `This is at or below the ${input.rulePack.damageTempC.toFixed(1)} C damage threshold.`}`,
    recommendedAction:
      "Check crop stage sensitivity before the overnight low, hold damage-sensitive operations, and plan an early follow-up inspection if temperatures verify.",
    confidence: clampConfidence(0.76 + confidenceBoost),
    metadata: {
      riskType: "frost",
      frostRiskMinTempC: minimum,
      damageTempC: input.rulePack.damageTempC,
      killTempC: input.rulePack.killTempC,
    },
  };
}

function buildAtmosphericDemandAssessment(input: {
  signalSet: FieldWeatherDerivedSignalSet;
  existing: FieldIntelligenceFinding | null;
  rulePack: RulePack["weatherRisk"]["atmosphericDemand"];
}): WeatherRiskAssessment | null {
  const peakVpd = input.signalSet.peakForecastVpdKpa24h;
  const waterBalance24h = input.signalSet.netWaterBalance24hMm;
  const waterBalance72h = input.signalSet.netWaterBalance72hMm;

  const demandActive =
    peakVpd != null &&
    waterBalance24h != null &&
    peakVpd >= input.rulePack.elevatedVpdKpa &&
    waterBalance24h <= input.rulePack.monitorWaterBalance24hMm;

  if (!demandActive) {
    if (!input.existing || input.existing.status !== "active") {
      return null;
    }

    return {
      kind: "atmospheric-demand",
      reasonCode: "atmospheric-demand-eased",
      severity: "low",
      status: "resolved",
      title: "Atmospheric demand eased",
      summary:
        "The current forecast no longer supports an active atmospheric-demand risk finding.",
      explanation: `Peak 24-hour VPD is ${
        peakVpd != null ? `${peakVpd.toFixed(2)} kPa` : "unavailable"
      } and 24-hour water balance is ${
        waterBalance24h != null ? `${waterBalance24h.toFixed(1)} mm` : "unavailable"
      }, which is back above the active threshold for ${input.rulePack.label}.`,
      recommendedAction:
        "Continue monitoring drying conditions, but the elevated atmospheric-demand alert no longer needs to stay active.",
      confidence: clampConfidence(0.68),
      metadata: {
        riskType: "atmospheric-demand",
        peakForecastVpdKpa24h: peakVpd,
        netWaterBalance24hMm: waterBalance24h,
        netWaterBalance72hMm: waterBalance72h,
      },
    };
  }

  const critical =
    peakVpd >= input.rulePack.severeVpdKpa &&
    ((waterBalance24h ?? 0) <= input.rulePack.severeWaterBalance24hMm ||
      (waterBalance72h ?? 0) <= input.rulePack.severeWaterBalance72hMm);
  const severity = critical ? "high" : "medium";
  const vpdWeight = peakVpd != null ? Math.min(0.1, peakVpd * 0.04) : 0;
  const balanceWeight =
    waterBalance24h != null ? Math.min(0.08, Math.abs(waterBalance24h) * 0.01) : 0;

  return {
    kind: "atmospheric-demand",
    reasonCode: critical ? "atmospheric-demand-severe" : "atmospheric-demand-elevated",
    severity,
    status: "active",
    title:
      severity === "high"
        ? "Atmospheric drying risk intensifying"
        : "Atmospheric drying risk building",
    summary: `Forecast atmospheric demand is elevated with peak VPD ${
      peakVpd != null ? `${peakVpd.toFixed(2)} kPa` : "unavailable"
    } and 24-hour water balance ${
      waterBalance24h != null ? `${waterBalance24h.toFixed(1)} mm` : "unavailable"
    }.`,
    explanation: `The latest derived signal set indicates elevated evaporative demand relative to the ${input.rulePack.label.toLowerCase()} thresholds. Peak 24-hour VPD is ${
      peakVpd != null ? `${peakVpd.toFixed(2)} kPa` : "unavailable"
    }, 24-hour net water balance is ${
      waterBalance24h != null ? `${waterBalance24h.toFixed(1)} mm` : "unavailable"
    }, and 72-hour net water balance is ${
      waterBalance72h != null ? `${waterBalance72h.toFixed(1)} mm` : "unavailable"
    }.`,
    recommendedAction:
      "Watch exposed or lighter-ground areas for fast drying, and compare the next moisture refresh against the forecast-driven demand before adjusting field operations.",
    confidence: clampConfidence(0.71 + vpdWeight + balanceWeight),
    metadata: {
      riskType: "atmospheric-demand",
      peakForecastVpdKpa24h: peakVpd,
      netWaterBalance24hMm: waterBalance24h,
      netWaterBalance72hMm: waterBalance72h,
      elevatedVpdKpa: input.rulePack.elevatedVpdKpa,
      severeVpdKpa: input.rulePack.severeVpdKpa,
    },
  };
}

async function upsertAssessmentFinding(input: {
  repository: WeatherRiskFindingRepository;
  workspaceId: WorkspaceId;
  fieldId: string;
  runId: string;
  requestedAt: string;
  signalSet: FieldWeatherDerivedSignalSet;
  rulePack: RulePack;
  crop: ResolvedCropContext;
  assessment: WeatherRiskAssessment;
  existing: FieldIntelligenceFinding | null;
}) {
  const sourceSuffix = input.assessment.kind === "frost" ? "frost" : "atmospheric-demand";
  const dedupeSuffix =
    input.assessment.kind === "frost"
      ? input.rulePack.weatherRisk.frost.dedupeKey
      : input.rulePack.weatherRisk.atmosphericDemand.dedupeKey;

  return input.repository.upsertFinding({
    workspaceId: input.workspaceId,
    fieldId: input.fieldId,
    runId: input.runId,
    family: "weather_risk",
    severity: input.assessment.severity,
    status: input.assessment.status,
    sourceKey: `${DEFAULT_SOURCE_KEY}:${sourceSuffix}:${input.signalSet.sourceKey}`,
    dedupeKey: `weather-risk:${sourceSuffix}:${dedupeSuffix}`,
    title: input.assessment.title,
    summary: input.assessment.summary,
    explanation: input.assessment.explanation,
    recommendedAction: input.assessment.recommendedAction,
    confidence: input.assessment.confidence,
    zoneGeoJson: null,
    affectedCellKeys: [],
    evidence: {
      weatherObservationId: input.signalSet.weatherObservationId ?? undefined,
      weatherSignalSetId: input.signalSet.id,
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
        signalVersion: input.signalSet.signalVersion,
        reasonCode: input.assessment.reasonCode,
        ...input.assessment.metadata,
      },
    },
    startedAt:
      input.existing && input.existing.status === "active"
        ? input.existing.startedAt
        : input.signalSet.observedAt,
    endedAt:
      input.assessment.status === "active" ? null : input.requestedAt,
  });
}

export async function generateWeatherRiskFindings(
  input: GenerateWeatherRiskFindingsUseCaseInput,
): Promise<GenerateWeatherRiskFindingsResult> {
  const resolvedRules = resolveCropRuleContext({
    rulePack: input.rulePack,
    cropContext: input.input.cropContext,
  });
  const signalSet = await input.weatherSignalSets.getLatestByField(
    input.input.workspaceId,
    input.input.fieldId,
  );

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
      rulePackId: input.rulePack.id,
      rulePackVersion: input.rulePack.version,
      evaluatedRiskKinds: ["frost", "atmospheric-demand"],
      cropKey: resolvedRules.crop.cropKey,
      cropLabel: resolvedRules.crop.cropLabel,
      growthStage: resolvedRules.crop.growthStage,
      gddBaseC: resolvedRules.crop.gddBaseC,
      isGenericCrop: resolvedRules.crop.isGenericCrop,
    },
  });

  if (!signalSet) {
    return {
      requestedAt: input.input.requestedAt,
      run,
      findings: [],
      weatherSignalSet: null,
    };
  }

  const [existingFrost, existingAtmosphericDemand] = await Promise.all([
    input.findings.getByDedupeKey(
      input.input.workspaceId,
      input.input.fieldId,
      `weather-risk:frost:${input.rulePack.weatherRisk.frost.dedupeKey}`,
    ),
    input.findings.getByDedupeKey(
      input.input.workspaceId,
      input.input.fieldId,
      `weather-risk:atmospheric-demand:${input.rulePack.weatherRisk.atmosphericDemand.dedupeKey}`,
    ),
  ]);

  const frostAssessment = buildFrostAssessment({
    signalSet,
    existing: existingFrost,
    rulePack: resolvedRules.weatherRisk.frost,
  });
  const atmosphericDemandAssessment = buildAtmosphericDemandAssessment({
    signalSet,
    existing: existingAtmosphericDemand,
    rulePack: resolvedRules.weatherRisk.atmosphericDemand,
  });

  const findings = (
    await Promise.all(
      [
        frostAssessment
          ? upsertAssessmentFinding({
              repository: input.findings,
              workspaceId: input.input.workspaceId,
              fieldId: input.input.fieldId,
              runId: run.id,
              requestedAt: input.input.requestedAt,
              signalSet,
              rulePack: {
                ...input.rulePack,
                weatherRisk: resolvedRules.weatherRisk,
              },
              crop: resolvedRules.crop,
              assessment: frostAssessment,
              existing: existingFrost,
            })
          : null,
        atmosphericDemandAssessment
          ? upsertAssessmentFinding({
              repository: input.findings,
              workspaceId: input.input.workspaceId,
              fieldId: input.input.fieldId,
              runId: run.id,
              requestedAt: input.input.requestedAt,
              signalSet,
              rulePack: {
                ...input.rulePack,
                weatherRisk: resolvedRules.weatherRisk,
              },
              crop: resolvedRules.crop,
              assessment: atmosphericDemandAssessment,
              existing: existingAtmosphericDemand,
            })
          : null,
      ].filter((promise): promise is Promise<FieldIntelligenceFinding> => promise != null),
    )
  ).filter((finding) => finding.status === "active" || finding.status === "resolved");

  return {
    requestedAt: input.input.requestedAt,
    run,
    findings,
    weatherSignalSet: signalSet,
  };
}
