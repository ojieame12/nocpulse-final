import { formatAgronomicSourceBasisLabel } from "@fieldpulse/module-crop-intelligence";

export function titleCaseStage(stage: string) {
  return stage
    .split("-")
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");
}

export type CropStagePresentation = {
  displayStageLabel: string;
  ruleStage: string | null;
  thresholdStageLabel: string;
  accumulatedGddLabel: string;
  gddUnitLabel: string;
  stageSourceLabel: string;
  hasCredibleAccumulatedGdd: boolean;
};

export type OpticalSeasonality = {
  status: "in-season" | "context-only";
  label: string;
  detail: string;
  renderConfidence: "low" | "medium" | "high" | null;
};

export type CanopySignalPresentation = {
  cropTitle: string;
  cropValue: string;
  cropSubLabel: string;
  reportHealthStatus: string;
  reportVegetationSubtitle: string;
  diseaseClearDescription: string;
  actionConfidenceLabel: string;
};

export function resolveCropStagePresentation(input: {
  cropContext:
    | {
        growthStage?: string | null;
        growthStageSource?: string | null;
        accumulatedGdd?: number | null;
      }
    | null
    | undefined;
  fallbackGrowthStage?: string | null;
  defaultGrowthStage: string;
  gddBaseC: number;
}): CropStagePresentation {
  const rawStage =
    input.cropContext?.growthStage ?? input.fallbackGrowthStage ?? null;
  const source = input.cropContext?.growthStageSource ?? null;
  const accumulatedGdd =
    typeof input.cropContext?.accumulatedGdd === "number" &&
    Number.isFinite(input.cropContext.accumulatedGdd)
      ? input.cropContext.accumulatedGdd
      : null;
  const hasCredibleAccumulatedGdd =
    accumulatedGdd != null && accumulatedGdd > 0;
  const hasManualStage = source === "manual" && typeof rawStage === "string";
  const hasImportedStage = source === "imported" && typeof rawStage === "string";
  const hasDerivedStage =
    source === "derived" &&
    typeof rawStage === "string" &&
    hasCredibleAccumulatedGdd;
  const hasFallbackStage =
    source == null && typeof rawStage === "string" && rawStage.length > 0;
  const hasTrustedStage =
    hasManualStage || hasImportedStage || hasDerivedStage || hasFallbackStage;
  const displayStageLabel =
    typeof rawStage === "string" && rawStage.length > 0
      ? hasTrustedStage
        ? titleCaseStage(rawStage)
        : "Stage unverified"
      : "Stage unavailable";
  const ruleStage = hasTrustedStage
    ? rawStage
    : input.defaultGrowthStage;
  const thresholdStageLabel = ruleStage
    ? hasTrustedStage
      ? `${titleCaseStage(ruleStage)} stage`
      : `${titleCaseStage(ruleStage)} default stage`
    : "Stage unavailable";
  const gddUnitLabel = hasCredibleAccumulatedGdd
    ? `Heat units accumulated (base ${input.gddBaseC}°C)`
    : `Season heat units unavailable (base ${input.gddBaseC}°C)`;

  let stageSourceLabel = "Stage unavailable";
  if (hasManualStage) {
    stageSourceLabel = "Manual stage override";
  } else if (hasImportedStage) {
    stageSourceLabel = "Imported crop stage";
  } else if (hasDerivedStage) {
    stageSourceLabel = "Weather-derived crop stage";
  } else if (source === "derived" && typeof rawStage === "string") {
    stageSourceLabel = "Weather-derived stage still initializing";
  } else if (hasFallbackStage) {
    stageSourceLabel = "Field summary stage";
  }

  return {
    displayStageLabel,
    ruleStage,
    thresholdStageLabel,
    accumulatedGddLabel:
      hasCredibleAccumulatedGdd && accumulatedGdd != null
        ? accumulatedGdd.toFixed(0)
        : "—",
    gddUnitLabel,
    stageSourceLabel,
    hasCredibleAccumulatedGdd,
  };
}

export function resolveOpticalSeasonality(input: {
  cropStagePresentation: CropStagePresentation;
  latestOpticalCaptureAt?: string | null;
  ndviAvg?: number | null;
  ndreAvg?: number | null;
}): OpticalSeasonality {
  const capturedAt = input.latestOpticalCaptureAt ?? null;
  const capturedMonth =
    capturedAt != null && !Number.isNaN(Date.parse(capturedAt))
      ? new Date(capturedAt).getUTCMonth() + 1
      : null;
  const stageUnverified =
    input.cropStagePresentation.displayStageLabel === "Stage unverified" ||
    input.cropStagePresentation.stageSourceLabel === "Weather-derived stage still initializing";
  const lowCanopySignal =
    (input.ndviAvg == null || input.ndviAvg < 0.2) &&
    (input.ndreAvg == null || input.ndreAvg < 0.08);
  const preseasonWindow = capturedMonth != null && capturedMonth <= 4;

  if (!stageUnverified) {
    return {
      status: "in-season",
      label: "Optical canopy signal",
      detail: "Optical canopy values are seasonally valid for interpretation.",
      renderConfidence: null,
    };
  }

  if (preseasonWindow || lowCanopySignal) {
    return {
      status: "context-only",
      label: preseasonWindow
        ? "Preseason optical context"
        : "Unverified optical context",
      detail:
        preseasonWindow
          ? "Late-winter optical capture is being shown for context only until season GDD and crop stage are verified."
          : "Optical canopy values are being shown for context only until season GDD and crop stage are verified.",
      renderConfidence: "low",
    };
  }

  return {
    status: "in-season",
    label: "Seasonally interpretable",
    detail: "Optical canopy values are seasonally valid for agronomic interpretation.",
    renderConfidence: null,
  };
}

export function resolveCanopySignalPresentation(input: {
  cropStagePresentation: CropStagePresentation;
  opticalSeasonality: OpticalSeasonality;
  ndviAvg?: number | null;
  ndreAvg?: number | null;
  hasOpticalRaster: boolean;
}): CanopySignalPresentation {
  const stageLabel =
    input.cropStagePresentation.displayStageLabel === "Stage unavailable" ||
    input.cropStagePresentation.displayStageLabel === "Stage unverified"
      ? "In-season"
      : input.cropStagePresentation.displayStageLabel;
  const normalizedStageLabel = stageLabel.toLowerCase();
  const stressed =
    (input.ndviAvg != null && input.ndviAvg < 0.45) ||
    (input.ndreAvg != null && input.ndreAvg < 0.18);
  const strong =
    (input.ndviAvg != null && input.ndviAvg >= 0.65) ||
    (input.ndreAvg != null && input.ndreAvg >= 0.3);

  if (input.opticalSeasonality.status === "context-only") {
    return {
      cropTitle: "CANOPY CONTEXT",
      cropValue: "Context only",
      cropSubLabel: input.opticalSeasonality.label,
      reportHealthStatus: "Context Only",
      reportVegetationSubtitle: input.opticalSeasonality.label,
      diseaseClearDescription:
        "Optical canopy layers are being shown for preseason context only while crop stage is still being verified.",
      actionConfidenceLabel: `${formatAgronomicSourceBasisLabel("context-only")} imagery`,
    };
  }

  if (!input.hasOpticalRaster) {
    return {
      cropTitle: "CROP HEALTH INDEX",
      cropValue: "Awaiting imagery",
      cropSubLabel:
        "Satellite imagery requires a cloud-free optical pass over this field. " +
        "Sentinel-2 revisits every 5 days — the first usable image is typically available " +
        "within 5–10 days of field registration, depending on cloud cover and orbit timing.",
      reportHealthStatus: "Imagery Pending",
      reportVegetationSubtitle:
        "Waiting for first cloud-free Sentinel-2 pass. Crop health, vigor, and vegetation indices (NDVI, NDRE, NDMI) will populate automatically once imagery is processed.",
      diseaseClearDescription:
        "No usable optical pass is available yet. Crop-health and vigor interpretation will begin automatically " +
        "once a cloud-free satellite image is processed for this field. This usually takes 5–10 days after registration.",
      actionConfidenceLabel: `${formatAgronomicSourceBasisLabel("pending")} imagery`,
    };
  }

  return {
    cropTitle: `${stageLabel.toUpperCase()} CANOPY SIGNAL`,
    cropValue: strong ? "On track" : stressed ? "Watch" : "Developing",
    cropSubLabel: `${stageLabel} stage`,
    reportHealthStatus: strong
      ? `${stageLabel} On Track`
      : stressed
        ? `${stageLabel} Watch`
        : `${stageLabel} Developing`,
    reportVegetationSubtitle: `${stageLabel} canopy history`,
    diseaseClearDescription: `No in-season disease findings are being flagged in the ${normalizedStageLabel} canopy signal.`,
    actionConfidenceLabel: `${formatAgronomicSourceBasisLabel("source-backed")} imagery`,
  };
}
