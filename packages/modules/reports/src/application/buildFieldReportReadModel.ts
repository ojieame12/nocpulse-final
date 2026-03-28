import type { AlertRepository, FieldAlert } from "@fieldpulse/module-alerts";
import {
  buildFieldZoneActivityReport,
  type FieldIntelligenceFindingRepository,
  type FieldIntelligenceZoneRepository,
} from "@fieldpulse/module-crop-intelligence";
import type { FieldCropContextRepository } from "@fieldpulse/module-field-crop-context";
import type { FieldRepository } from "@fieldpulse/module-fields";
import type { FieldImportBatchRepository } from "@fieldpulse/module-field-intake";
import type {
  FieldRasterObservation,
  FieldRasterObservationRepository,
} from "@fieldpulse/module-imagery";
import type {
  FieldMoistureCellSnapshot,
  FieldMoistureCellSnapshotRepository,
  FieldMoistureSnapshot,
  FieldMoistureSnapshotRepository,
} from "@fieldpulse/module-moisture";
import {
  loadFieldWeatherProfile,
  type FieldWeatherDerivedSignalSetRepository,
  type FieldWeatherForecastRepository,
  type FieldWeatherObservationRepository,
} from "@fieldpulse/module-weather";
import type { TimestampIso, WorkspaceId } from "@fieldpulse/platform-db";
import type {
  FieldReportMoistureSummary,
  FieldReportReadModel,
} from "../contracts/FieldReportReadModel";

type BuildFieldReportReadModelRepositories = {
  fields: Pick<FieldRepository, "getById">;
  fieldImportBatches: Pick<FieldImportBatchRepository, "getLatestCommittedCandidateByField">;
  cropContexts: Pick<FieldCropContextRepository, "getLatestByField">;
  imageryRasterObservations: Pick<FieldRasterObservationRepository, "getLatestByField">;
  moistureSnapshots: Pick<FieldMoistureSnapshotRepository, "getLatestByField">;
  moistureCells: Pick<FieldMoistureCellSnapshotRepository, "getLatestByField">;
  weatherObservations: Pick<FieldWeatherObservationRepository, "getLatestByField">;
  weatherForecasts: Pick<FieldWeatherForecastRepository, "listByField">;
  weatherSignals: Pick<FieldWeatherDerivedSignalSetRepository, "getLatestByField">;
  alerts: Pick<AlertRepository, "listByField">;
  findings: Pick<FieldIntelligenceFindingRepository, "listByField">;
  zones: Pick<FieldIntelligenceZoneRepository, "listByField">;
};

export type BuildFieldReportReadModelInput = {
  repositories: BuildFieldReportReadModelRepositories;
  workspaceId: WorkspaceId;
  fieldId: string;
  reportDate: TimestampIso;
  forecastLimit?: number;
  alertLimit?: number;
  findingLimit?: number;
  zoneLimit?: number;
  generatedAt?: TimestampIso;
};

function roundTo(value: number, decimals: number) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function average(values: readonly number[]) {
  if (values.length === 0) {
    return null;
  }

  return roundTo(
    values.reduce((sum, value) => sum + value, 0) / values.length,
    3,
  );
}

function minValue(values: readonly number[]) {
  return values.length === 0 ? null : Math.min(...values);
}

function maxValue(values: readonly number[]) {
  return values.length === 0 ? null : Math.max(...values);
}

function buildMoistureSummary(input: {
  latestSnapshot: FieldMoistureSnapshot | null;
  latestCells: readonly FieldMoistureCellSnapshot[];
}): FieldReportMoistureSummary {
  const rootZoneValues = input.latestCells.map((cell) => cell.rootZonePct);
  const surfaceValues = input.latestCells.map((cell) => cell.surfacePct);

  return {
    latestSnapshot: input.latestSnapshot,
    latestCells: input.latestCells,
    latestCellCount: input.latestCells.length,
    lowConfidenceCellCount: input.latestCells.filter(
      (cell) => cell.confidence === "low",
    ).length,
    rootZoneMinPct: minValue(rootZoneValues),
    rootZoneMaxPct: maxValue(rootZoneValues),
    rootZoneAvgPct: average(rootZoneValues),
    surfaceMinPct: minValue(surfaceValues),
    surfaceMaxPct: maxValue(surfaceValues),
    surfaceAvgPct: average(surfaceValues),
  };
}

function buildImagerySummary(input: {
  latestRasterObservation: FieldRasterObservation | null;
}) {
  return {
    latestRasterObservation: input.latestRasterObservation,
    latestCellCount: input.latestRasterObservation?.cells.length ?? 0,
    latestObservedAt: input.latestRasterObservation?.observedAt ?? null,
    latestSourceKey: input.latestRasterObservation?.sourceKey ?? null,
    latestProviderKey: input.latestRasterObservation?.providerKey ?? null,
  };
}

function resolveLegalLandDescription(
  values: readonly string[] | null | undefined,
): string | null {
  if (!values || values.length === 0) {
    return null;
  }

  return values.join(", ");
}

export async function buildFieldReportReadModel(
  input: BuildFieldReportReadModelInput,
): Promise<FieldReportReadModel> {
  const field = await input.repositories.fields.getById(
    input.workspaceId,
    input.fieldId,
  );

  if (!field) {
    throw new Error(
      `[reports] field ${input.fieldId} was not found in workspace ${input.workspaceId}`,
    );
  }

  const [
    latestCommittedCandidate,
    cropContext,
    latestRasterObservation,
    latestSnapshot,
    latestCells,
    weatherProfile,
    weatherSignals,
    activeAlerts,
    resolvedAlerts,
    findings,
    zones,
  ] = await Promise.all([
    input.repositories.fieldImportBatches.getLatestCommittedCandidateByField(
      input.workspaceId,
      input.fieldId,
    ),
    input.repositories.cropContexts.getLatestByField(
      input.workspaceId,
      input.fieldId,
    ),
    input.repositories.imageryRasterObservations.getLatestByField(
      input.workspaceId,
      input.fieldId,
      input.reportDate,
    ),
    input.repositories.moistureSnapshots.getLatestByField(
      input.workspaceId,
      input.fieldId,
    ),
    input.repositories.moistureCells.getLatestByField(
      input.workspaceId,
      input.fieldId,
    ),
    loadFieldWeatherProfile({
      observationRepository: input.repositories.weatherObservations,
      forecastRepository: input.repositories.weatherForecasts,
      workspaceId: input.workspaceId,
      fieldId: input.fieldId,
      validAfter: input.reportDate,
      forecastLimit: input.forecastLimit ?? 24,
    }),
    input.repositories.weatherSignals.getLatestByField(
      input.workspaceId,
      input.fieldId,
    ),
    input.repositories.alerts.listByField(
      input.workspaceId,
      input.fieldId,
      input.alertLimit ?? 20,
      "active",
    ).catch((err) => {
      console.warn("[reports] alerts.listByField(active) failed, returning empty:", err?.message);
      return [] as FieldAlert[];
    }),
    input.repositories.alerts.listByField(
      input.workspaceId,
      input.fieldId,
      input.alertLimit ?? 20,
      "resolved",
    ).catch((err) => {
      console.warn("[reports] alerts.listByField(resolved) failed, returning empty:", err?.message);
      return [] as FieldAlert[];
    }),
    input.repositories.findings.listByField(
      input.workspaceId,
      input.fieldId,
      input.findingLimit ?? 20,
      "active",
    ),
    buildFieldZoneActivityReport({
      repository: input.repositories.zones,
      workspaceId: input.workspaceId,
      fieldId: input.fieldId,
      limit: input.zoneLimit ?? 50,
      generatedAt: input.generatedAt,
    }),
  ]);

  const moisture = buildMoistureSummary({
    latestSnapshot,
    latestCells,
  });
  const imagery = buildImagerySummary({
    latestRasterObservation,
  });

  return {
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    reportDate: input.reportDate,
    field,
    cropContext,
    intake: {
      latestCommittedCandidate: latestCommittedCandidate
        ? {
            id: latestCommittedCandidate.id,
            legalLandDescriptions: latestCommittedCandidate.legalLandDescriptions,
            cropType: latestCommittedCandidate.cropType,
            committedAt: latestCommittedCandidate.committedAt,
          }
        : null,
      legalLandDescription:
        field.legalLandDescription ??
        resolveLegalLandDescription(latestCommittedCandidate?.legalLandDescriptions),
    },
    imagery,
    moisture,
    weather: {
      profile: weatherProfile,
      signals: weatherSignals,
    },
    alerts: activeAlerts,
    resolvedAlerts,
    findings,
    zones,
    summary: {
      cropType: cropContext?.cropType ?? null,
      growthStage: cropContext?.growthStage ?? null,
      activeAlertCount: activeAlerts.filter((alert) => alert.status === "active").length,
      activeFindingCount: findings.filter((finding) => finding.status === "active")
        .length,
      trackedZoneCount: zones.totalZoneCount,
      activeTrackedZoneCount:
        zones.newZoneCount + zones.persistentZoneCount + zones.recoveringZoneCount,
      moistureObservedAt: latestSnapshot?.observedAt ?? null,
      weatherObservedAt:
        weatherSignals?.observedAt ??
        weatherProfile.latestObservation?.observedAt ??
        null,
    },
  };
}
