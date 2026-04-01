import type { AlertRepository, FieldAlert } from "@fieldpulse/module-alerts";
import {
  buildFieldZoneActivityReport,
  type FieldIntelligenceFindingRepository,
  type FieldIntelligenceZoneRepository,
} from "@fieldpulse/module-crop-intelligence";
import type { FieldCropContextRepository } from "@fieldpulse/module-field-crop-context";
import type { FieldDetail, FieldRepository } from "@fieldpulse/module-fields";
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
  FieldReportDataAvailability,
  FieldReportMoistureSummary,
  FieldReportReadModel,
} from "../contracts/FieldReportReadModel";

type BuildFieldReportReadModelRepositories = {
  fields: Pick<FieldRepository, "getById">;
  fieldImportBatches: Pick<FieldImportBatchRepository, "getLatestCommittedCandidateByField">;
  cropContexts: Pick<FieldCropContextRepository, "getLatestByField">;
  imageryRasterObservations: Pick<FieldRasterObservationRepository, "getLatestByField">;
  moistureSnapshots: Pick<FieldMoistureSnapshotRepository, "getLatestByField" | "listRecentByField">;
  moistureCells: Pick<FieldMoistureCellSnapshotRepository, "getLatestByField">;
  weatherObservations: Pick<FieldWeatherObservationRepository, "getLatestByField" | "listRecentByField">;
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
  field?: FieldDetail;
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
  recentSnapshots: readonly FieldMoistureSnapshot[];
}): FieldReportMoistureSummary {
  const rootZoneValues = input.latestCells.map((cell) => cell.rootZonePct);
  const surfaceValues = input.latestCells.map((cell) => cell.surfacePct);
  const snapshotRootZonePct = input.latestSnapshot?.rootZonePct ?? null;
  const snapshotSurfacePct = input.latestSnapshot?.surfacePct ?? null;

  return {
    latestSnapshot: input.latestSnapshot,
    latestCells: input.latestCells,
    latestCellCount: input.latestCells.length,
    lowConfidenceCellCount: input.latestCells.filter(
      (cell) => cell.confidence === "low",
    ).length,
    rootZoneMinPct: minValue(rootZoneValues) ?? snapshotRootZonePct,
    rootZoneMaxPct: maxValue(rootZoneValues) ?? snapshotRootZonePct,
    rootZoneAvgPct: average(rootZoneValues) ?? snapshotRootZonePct,
    surfaceMinPct: minValue(surfaceValues) ?? snapshotSurfacePct,
    surfaceMaxPct: maxValue(surfaceValues) ?? snapshotSurfacePct,
    surfaceAvgPct: average(surfaceValues) ?? snapshotSurfacePct,
    recentSnapshots: input.recentSnapshots,
  };
}

/**
 * Derive a human-readable status label from the depletion percentage.
 *
 * Thresholds:
 *   0–30  → Adequate
 *  30–50  → Watch
 *  50–75  → Stress
 *   >75   → Critical
 */
function deriveDepletionStatusLabel(depletionPct: number | null | undefined): string | undefined {
  if (depletionPct == null) return undefined;
  if (depletionPct <= 30) return "Adequate";
  if (depletionPct <= 50) return "Watch";
  if (depletionPct <= 75) return "Stress";
  return "Critical";
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

const REPORT_ALERT_STATUSES = ["active", "resolved"] as const;

function splitFieldAlertsByStatus(
  alerts: readonly FieldAlert[],
  limit: number,
): {
  activeAlerts: readonly FieldAlert[];
  resolvedAlerts: readonly FieldAlert[];
} {
  return {
    activeAlerts: alerts.filter((alert) => alert.status === "active").slice(0, limit),
    resolvedAlerts: alerts.filter((alert) => alert.status === "resolved").slice(0, limit),
  };
}

function isReportPerfDebugEnabled() {
  return process.env.NODE_ENV !== "production" && process.env.FIELDPULSE_DEBUG_PERF === "1";
}

function startPerfTimer(enabled: boolean) {
  return enabled ? performance.now() : 0;
}

function finishPerfTimer(startedAt: number, enabled: boolean) {
  if (!enabled) {
    return 0;
  }

  return Math.round((performance.now() - startedAt) * 100) / 100;
}

async function timeAsync<T>(
  enabled: boolean,
  label: string,
  operation: () => Promise<T>,
): Promise<{ label: string; durationMs: number; value: T }> {
  const startedAt = startPerfTimer(enabled);
  const value = await operation();
  return {
    label,
    durationMs: finishPerfTimer(startedAt, enabled),
    value,
  };
}

async function timeAsyncOrFallback<T>(
  enabled: boolean,
  label: string,
  operation: () => Promise<T>,
  fallbackValue: T,
  onError: (error: unknown) => void,
): Promise<{ label: string; durationMs: number; value: T; available: boolean }> {
  const startedAt = startPerfTimer(enabled);

  try {
    const value = await operation();
    return {
      label,
      durationMs: finishPerfTimer(startedAt, enabled),
      value,
      available: true,
    };
  } catch (error: unknown) {
    onError(error);
    return {
      label,
      durationMs: finishPerfTimer(startedAt, enabled),
      value: fallbackValue,
      available: false,
    };
  }
}

export async function buildFieldReportReadModel(
  input: BuildFieldReportReadModelInput,
): Promise<FieldReportReadModel> {
  const debugPerfEnabled = isReportPerfDebugEnabled();
  const requestStartedAt = startPerfTimer(debugPerfEnabled);
  const alertLimit = input.alertLimit ?? 20;
  const fieldPromise =
    input.field != null
      ? Promise.resolve(input.field)
      : input.repositories.fields.getById(
          input.workspaceId,
          input.fieldId,
        );

  const [
    field,
    latestCommittedCandidateResult,
    cropContextResult,
    latestRasterObservationResult,
    latestSnapshotResult,
    latestCellsResult,
    weatherProfileResult,
    weatherSignalsResult,
    fieldAlertsResult,
    findingsResult,
    zonesResult,
    recentSnapshotsResult,
    recentWeatherObservationsResult,
  ] = await Promise.all([
    fieldPromise,
    timeAsync(debugPerfEnabled, "latestCommittedCandidate", () =>
      input.repositories.fieldImportBatches.getLatestCommittedCandidateByField(
        input.workspaceId,
        input.fieldId,
      )),
    timeAsync(debugPerfEnabled, "cropContext", () =>
      input.repositories.cropContexts.getLatestByField(
        input.workspaceId,
        input.fieldId,
      )),
    timeAsync(debugPerfEnabled, "latestRasterObservation", () =>
      input.repositories.imageryRasterObservations.getLatestByField(
        input.workspaceId,
        input.fieldId,
        input.reportDate,
      )),
    timeAsync(debugPerfEnabled, "latestSnapshot", () =>
      input.repositories.moistureSnapshots.getLatestByField(
        input.workspaceId,
        input.fieldId,
      )),
    timeAsync(debugPerfEnabled, "latestCells", () =>
      input.repositories.moistureCells.getLatestByField(
        input.workspaceId,
        input.fieldId,
      )),
    timeAsync(debugPerfEnabled, "weatherProfile", () =>
      loadFieldWeatherProfile({
        observationRepository: input.repositories.weatherObservations,
        forecastRepository: input.repositories.weatherForecasts,
        workspaceId: input.workspaceId,
        fieldId: input.fieldId,
        validAfter: input.reportDate,
        forecastLimit: input.forecastLimit ?? 24,
      })),
    timeAsync(debugPerfEnabled, "weatherSignals", () =>
      input.repositories.weatherSignals.getLatestByField(
        input.workspaceId,
        input.fieldId,
      )),
    timeAsyncOrFallback(
      debugPerfEnabled,
      "fieldAlerts",
      () =>
        input.repositories.alerts.listByField(
          input.workspaceId,
          input.fieldId,
          Math.max(alertLimit * REPORT_ALERT_STATUSES.length * 2, 40),
          REPORT_ALERT_STATUSES,
        ),
      [] as FieldAlert[],
      (error) => {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(
          "[reports] alerts.listByField(active|resolved) failed; marking alert data unavailable:",
          message,
        );
      },
    ),
    timeAsync(debugPerfEnabled, "findings", () =>
      input.repositories.findings.listByField(
        input.workspaceId,
        input.fieldId,
        input.findingLimit ?? 20,
        "active",
      )),
    timeAsync(debugPerfEnabled, "zones", () =>
      buildFieldZoneActivityReport({
        repository: input.repositories.zones,
        workspaceId: input.workspaceId,
        fieldId: input.fieldId,
        limit: input.zoneLimit ?? 50,
        generatedAt: input.generatedAt,
      })),
    timeAsync(debugPerfEnabled, "recentSnapshots", () =>
      input.repositories.moistureSnapshots.listRecentByField(
        input.workspaceId,
        input.fieldId,
        14,
      )),
    timeAsync(debugPerfEnabled, "recentWeatherObservations", () =>
      input.repositories.weatherObservations.listRecentByField(
        input.workspaceId,
        input.fieldId,
        7,
      )),
  ]);

  if (!field) {
    throw new Error(
      `[reports] field ${input.fieldId} was not found in workspace ${input.workspaceId}`,
    );
  }

  const latestCommittedCandidate = latestCommittedCandidateResult.value;
  const cropContext = cropContextResult.value;
  const latestRasterObservation = latestRasterObservationResult.value;
  const latestSnapshot = latestSnapshotResult.value;
  const latestCells = latestCellsResult.value;
  const weatherProfile = weatherProfileResult.value;
  const weatherSignals = weatherSignalsResult.value;
  const { activeAlerts, resolvedAlerts } = splitFieldAlertsByStatus(
    fieldAlertsResult.value,
    alertLimit,
  );
  const dataAvailability: FieldReportDataAvailability = {
    activeAlerts: fieldAlertsResult.available,
    resolvedAlerts: fieldAlertsResult.available,
  };
  const findings = findingsResult.value;
  const zones = zonesResult.value;
  const recentSnapshotsResultValue = recentSnapshotsResult.value;
  const recentWeatherObservationsResultValue = recentWeatherObservationsResult.value;

  const moisture = buildMoistureSummary({
    latestSnapshot,
    latestCells,
    recentSnapshots: recentSnapshotsResultValue ?? [],
  });
  const imagery = buildImagerySummary({
    latestRasterObservation,
  });

  // ── Depletion fields from moisture snapshot inputs ──────────────────
  const snapshotDepletionPct = latestSnapshot?.inputs?.depletionPct ?? null;
  const snapshotAvailableWaterMm = latestSnapshot?.inputs?.availableWaterMm ?? null;
  const statusLabel = deriveDepletionStatusLabel(snapshotDepletionPct);

  const readModel: FieldReportReadModel = {
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
      recentObservations: recentWeatherObservationsResultValue ?? [],
    },
    dataAvailability,
    alerts: activeAlerts,
    resolvedAlerts,
    findings,
    zones,
    summary: {
      cropType: cropContext?.cropType ?? null,
      growthStage: cropContext?.growthStage ?? null,
      activeAlertCount: dataAvailability.activeAlerts
        ? activeAlerts.filter((alert) => alert.status === "active").length
        : null,
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
    depletionPct: snapshotDepletionPct,
    availableWaterMm: snapshotAvailableWaterMm,
    statusLabel,
    // Historical anomaly fields are left undefined here — they are populated
    // by the worker's overview_rebuild phase when Open-Meteo archive data has
    // been fetched. If the worker has not yet run, these remain absent.
    // TODO: Wire historical anomaly fetch into the worker overview_rebuild
    // phase so that historicalAnomalyPercentile, historicalAnomalyDescription,
    // and historicalAnomalyClass are populated from the archive API response.
  };

  if (debugPerfEnabled) {
    console.debug("[stability][field-report-read-model] build", {
      fieldId: input.fieldId,
      workspaceId: input.workspaceId,
      durationMs: finishPerfTimer(requestStartedAt, debugPerfEnabled),
      stages: [
        latestCommittedCandidateResult,
        cropContextResult,
        latestRasterObservationResult,
        latestSnapshotResult,
        latestCellsResult,
        weatherProfileResult,
        weatherSignalsResult,
        fieldAlertsResult,
        findingsResult,
        zonesResult,
        recentSnapshotsResult,
        recentWeatherObservationsResult,
      ].map((entry) => ({
        label: entry.label,
        durationMs: entry.durationMs,
      })),
    });
  }

  return readModel;
}
