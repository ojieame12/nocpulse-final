import type { PdfRenderInput, PdfTextBlock } from "@fieldpulse/pdf";
import type { FieldAlert } from "@fieldpulse/module-alerts";
import type { FieldIntelligenceFinding } from "@fieldpulse/module-crop-intelligence";
import type { FieldZoneActivityItem } from "@fieldpulse/module-crop-intelligence";
import type { FieldWeatherForecast } from "@fieldpulse/module-weather";
import type { FieldReportReadModel } from "../contracts/FieldReportReadModel";

type BuildFieldReportPdfRenderInput = {
  artifactKey: string;
  readModel: FieldReportReadModel;
};

function formatNumber(value: number | null, digits = 1) {
  if (value === null || Number.isNaN(value)) {
    return "n/a";
  }

  return value.toFixed(digits);
}

function formatPercent(value: number | null, digits = 1) {
  if (value === null || Number.isNaN(value)) {
    return "n/a";
  }

  return `${value.toFixed(digits)}%`;
}

function formatTimestamp(value: string | null) {
  if (!value) {
    return "n/a";
  }

  return value.replace("T", " ").replace(".000Z", "Z");
}

function pushBlock(blocks: PdfTextBlock[], style: PdfTextBlock["style"], text: string) {
  if (text.trim().length === 0) {
    return;
  }

  blocks.push({ style, text });
}

function pushAlertSection(
  blocks: PdfTextBlock[],
  alerts: readonly FieldAlert[],
  activeAlertsAvailable: boolean,
) {
  pushBlock(blocks, "heading", "Active alerts");

  if (!activeAlertsAvailable) {
    pushBlock(
      blocks,
      "body",
      "Active alert data was unavailable when this report was built. Re-run the report before treating this field as all clear.",
    );
    return;
  }

  if (alerts.length === 0) {
    pushBlock(blocks, "body", "No active alerts.");
    return;
  }

  for (const [index, alert] of alerts.slice(0, 8).entries()) {
    pushBlock(
      blocks,
      "subheading",
      `${index + 1}. [${alert.severity.toUpperCase()}] ${alert.title}`,
    );

    if (alert.summary) {
      pushBlock(blocks, "body", alert.summary);
    }

    if (alert.explanation) {
      pushBlock(blocks, "body", `Why it matters: ${alert.explanation}`);
    }

    if (alert.recommendedAction) {
      pushBlock(blocks, "body", `Action: ${alert.recommendedAction}`);
    }
  }
}

function pushFindingSection(
  blocks: PdfTextBlock[],
  findings: readonly FieldIntelligenceFinding[],
) {
  pushBlock(blocks, "heading", "Active findings");

  if (findings.length === 0) {
    pushBlock(blocks, "body", "No active findings.");
    return;
  }

  for (const [index, finding] of findings.slice(0, 8).entries()) {
    pushBlock(
      blocks,
      "subheading",
      `${index + 1}. [${finding.severity.toUpperCase()}] ${finding.title}`,
    );

    if (finding.summary) {
      pushBlock(blocks, "body", finding.summary);
    }

    if (finding.explanation) {
      pushBlock(blocks, "body", `Reason: ${finding.explanation}`);
    }

    if (finding.recommendedAction) {
      pushBlock(blocks, "body", `Action: ${finding.recommendedAction}`);
    }

    if (finding.affectedCellKeys.length > 0) {
      pushBlock(
        blocks,
        "body",
        `Affected cells: ${finding.affectedCellKeys.length} (${finding.affectedCellKeys.slice(0, 8).join(", ")})`,
      );
    }
  }
}

function buildForecastSummaryLine(forecast: FieldWeatherForecast) {
  const parts = [
    formatTimestamp(forecast.validAt),
    `min ${formatNumber(forecast.airTemperatureMinC)} C`,
    `max ${formatNumber(forecast.airTemperatureMaxC)} C`,
    `precip ${formatNumber(forecast.precipitationMm)} mm`,
    `wind ${formatNumber(forecast.windSpeedKph)} kph`,
  ];

  if (forecast.precipitationProbabilityPct !== null) {
    parts.push(`precip prob ${formatNumber(forecast.precipitationProbabilityPct)}%`);
  }

  return parts.join(" | ");
}

function pushZoneSection(
  blocks: PdfTextBlock[],
  zones: readonly FieldZoneActivityItem[],
  reportTotal: number,
  reportNew: number,
  reportPersistent: number,
  reportRecovering: number,
  reportResolved: number,
) {
  pushBlock(blocks, "heading", "Tracked zones");
  pushBlock(
    blocks,
    "body",
    `Tracked zones: ${reportTotal} total, ${reportNew} new, ${reportPersistent} persistent, ${reportRecovering} recovering, ${reportResolved} resolved.`,
  );

  if (zones.length === 0) {
    pushBlock(blocks, "body", "No tracked zones for this report window.");
    return;
  }

  for (const zone of zones.slice(0, 8)) {
    pushBlock(
      blocks,
      "subheading",
      `[${zone.status.toUpperCase()}] ${zone.family} / ${zone.latestSeverity ?? "unknown"}`,
    );
    pushBlock(
      blocks,
      "body",
      `Cells ${zone.affectedCellCount}, detections ${zone.detectionCount}, first seen ${formatTimestamp(zone.firstSeenAt)}, last seen ${formatTimestamp(zone.lastSeenAt)}.`,
    );
  }
}

export function buildFieldReportPdfRenderInput({
  artifactKey,
  readModel,
}: BuildFieldReportPdfRenderInput): PdfRenderInput {
  const blocks: PdfTextBlock[] = [];
  const weatherObservation = readModel.weather.profile.latestObservation;
  const weatherSignals = readModel.weather.signals;
  const latestMoistureSnapshot = readModel.moisture.latestSnapshot;

  pushBlock(blocks, "title", `Field report: ${readModel.field.name}`);
  pushBlock(
    blocks,
    "caption",
    `Generated ${formatTimestamp(readModel.generatedAt)} for report date ${readModel.reportDate.slice(0, 10)}.`,
  );

  pushBlock(blocks, "heading", "Field overview");
  pushBlock(blocks, "body", `Field id: ${readModel.field.id}`);
  pushBlock(blocks, "body", `Area: ${formatNumber(readModel.field.areaHa, 2)} ha`);
  pushBlock(
    blocks,
    "body",
    `Crop: ${readModel.cropContext?.cropType ?? readModel.summary.cropType ?? "n/a"}`,
  );
  pushBlock(
    blocks,
    "body",
    `Growth stage: ${readModel.cropContext?.growthStage ?? readModel.summary.growthStage ?? "n/a"}`,
  );
  pushBlock(
    blocks,
    "body",
    `Label point: ${formatNumber(readModel.field.labelPoint[1], 5)}, ${formatNumber(readModel.field.labelPoint[0], 5)}`,
  );

  pushBlock(blocks, "heading", "Operational summary");
  pushBlock(
    blocks,
    "body",
    `Active alerts ${
      readModel.summary.activeAlertCount == null
        ? "unavailable"
        : readModel.summary.activeAlertCount
    }, active findings ${readModel.summary.activeFindingCount}, tracked zones ${readModel.summary.trackedZoneCount}, active tracked zones ${readModel.summary.activeTrackedZoneCount}.`,
  );
  pushBlock(
    blocks,
    "body",
    `Moisture observed ${formatTimestamp(readModel.summary.moistureObservedAt)}, weather observed ${formatTimestamp(readModel.summary.weatherObservedAt)}.`,
  );

  pushBlock(blocks, "heading", "Moisture");
  if (!latestMoistureSnapshot) {
    pushBlock(blocks, "body", "No moisture snapshot available.");
  } else {
    pushBlock(
      blocks,
      "body",
      `Observed ${formatTimestamp(latestMoistureSnapshot.observedAt)} from ${latestMoistureSnapshot.sourceKey}. Root zone ${formatPercent(latestMoistureSnapshot.rootZonePct)}, surface ${formatPercent(latestMoistureSnapshot.surfacePct)}, confidence ${latestMoistureSnapshot.confidence}.`,
    );
    pushBlock(
      blocks,
      "body",
      `Cells ${readModel.moisture.latestCellCount}, low confidence ${readModel.moisture.lowConfidenceCellCount}, root zone range ${formatPercent(readModel.moisture.rootZoneMinPct)} to ${formatPercent(readModel.moisture.rootZoneMaxPct)} (avg ${formatPercent(readModel.moisture.rootZoneAvgPct)}).`,
    );
    pushBlock(
      blocks,
      "body",
      `Surface range ${formatPercent(readModel.moisture.surfaceMinPct)} to ${formatPercent(readModel.moisture.surfaceMaxPct)} (avg ${formatPercent(readModel.moisture.surfaceAvgPct)}).`,
    );
  }

  pushBlock(blocks, "heading", "Weather");
  if (!readModel.weather.profile.dataAvailability.latestObservation) {
    pushBlock(
      blocks,
      "body",
      "Weather observation data was unavailable when this report was built.",
    );
  } else if (!weatherObservation) {
    pushBlock(blocks, "body", "No weather observation available.");
  } else {
    pushBlock(
      blocks,
      "body",
      `Observed ${formatTimestamp(weatherObservation.observedAt)} from ${weatherObservation.providerKey}. Air ${formatNumber(weatherObservation.airTemperatureC)} C, precip ${formatNumber(weatherObservation.precipitationMm)} mm, wind ${formatNumber(weatherObservation.windSpeedKph)} kph, humidity ${formatNumber(weatherObservation.relativeHumidityPct)}%, soil moisture ${formatPercent(weatherObservation.soilMoisturePct)}.`,
    );
  }

  if (!weatherSignals) {
    pushBlock(blocks, "body", "No derived weather signal set available.");
  } else {
    pushBlock(
      blocks,
      "body",
      `Signals at ${formatTimestamp(weatherSignals.observedAt)}: VPD now ${formatNumber(weatherSignals.currentVpdKpa, 3)} kPa, peak VPD 24h ${formatNumber(weatherSignals.peakForecastVpdKpa24h, 3)} kPa, net water balance 24h ${formatNumber(weatherSignals.netWaterBalance24hMm, 2)} mm, net water balance 72h ${formatNumber(weatherSignals.netWaterBalance72hMm, 2)} mm.`,
    );
    pushBlock(
      blocks,
      "body",
      `Leaf wet hours 24h ${weatherSignals.leafWetHours24h}, spray windows 24h ${weatherSignals.sprayWindowCount24h}, frost minimum ${formatNumber(weatherSignals.frostRiskMinTempC, 1)} C, GDD 24h ${formatNumber(weatherSignals.gdd24h, 2)}, GDD 72h ${formatNumber(weatherSignals.gdd72h, 2)}, GDD base ${formatNumber(weatherSignals.gddBaseC, 1)} C.`,
    );
  }

  pushBlock(blocks, "subheading", "Forecast sample");
  if (!readModel.weather.profile.dataAvailability.forecasts) {
    pushBlock(
      blocks,
      "body",
      "Forecast data was unavailable when this report was built.",
    );
  } else if (readModel.weather.profile.forecasts.length === 0) {
    pushBlock(blocks, "body", "No forecast rows available.");
  } else {
    for (const forecast of readModel.weather.profile.forecasts.slice(0, 8)) {
      pushBlock(blocks, "body", buildForecastSummaryLine(forecast));
    }
  }

  pushAlertSection(
    blocks,
    readModel.alerts,
    readModel.dataAvailability.activeAlerts,
  );
  pushFindingSection(blocks, readModel.findings);
  pushZoneSection(
    blocks,
    readModel.zones.zones,
    readModel.zones.totalZoneCount,
    readModel.zones.newZoneCount,
    readModel.zones.persistentZoneCount,
    readModel.zones.recoveringZoneCount,
    readModel.zones.resolvedZoneCount,
  );

  return {
    artifactKey,
    title: `Field report: ${readModel.field.name}`,
    subject: `Operational report for ${readModel.field.name} on ${readModel.reportDate.slice(0, 10)}`,
    author: "FieldPulse",
    blocks,
  };
}
