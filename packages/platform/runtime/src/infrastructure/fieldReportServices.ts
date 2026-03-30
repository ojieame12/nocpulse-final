import {
  buildFieldReportReadModel,
  prepareFieldReportArtifact,
  type ReportArtifactStore,
} from "@fieldpulse/module-reports";
import type { ServerRepositories } from "../contracts/ServerRuntime";

function createFieldReportRepositories(repositories: ServerRepositories) {
  return {
    fields: repositories.fields,
    fieldImportBatches: repositories.fieldImportBatches,
    cropContexts: repositories.fieldCropContexts,
    imageryRasterObservations: repositories.imageryRasterObservations,
    moistureSnapshots: repositories.moistureSnapshots,
    moistureCells: repositories.moistureCellSnapshots,
    weatherObservations: repositories.weatherObservations,
    weatherForecasts: repositories.weatherForecasts,
    weatherSignals: repositories.weatherSignalSets,
    alerts: repositories.alerts,
    findings: repositories.cropIntelligenceFindings,
    zones: repositories.cropIntelligenceZones,
  };
}

export async function buildRuntimeFieldReportReadModel(
  repositories: ServerRepositories,
  input: {
    workspaceId: string;
    fieldId: string;
    field?: Awaited<ReturnType<ServerRepositories["fields"]["getById"]>> | null;
    reportDate: string;
    forecastLimit?: number;
    alertLimit?: number;
    findingLimit?: number;
    zoneLimit?: number;
  },
) {
  return buildFieldReportReadModel({
    repositories: createFieldReportRepositories(repositories),
    workspaceId: input.workspaceId,
    fieldId: input.fieldId,
    field: input.field ?? undefined,
    reportDate: input.reportDate,
    forecastLimit: input.forecastLimit,
    alertLimit: input.alertLimit,
    findingLimit: input.findingLimit,
    zoneLimit: input.zoneLimit,
  });
}

export async function renderRuntimeFieldReportPdf(
  repositories: ServerRepositories,
  input: {
    workspaceId: string;
    fieldId: string;
    reportDate: string;
    dryRun?: boolean;
  },
  options: {
    reportArtifactStore?: ReportArtifactStore;
  } = {},
) {
  const readModel = await buildRuntimeFieldReportReadModel(repositories, {
    workspaceId: input.workspaceId,
    fieldId: input.fieldId,
    reportDate: input.reportDate,
  });

  const prepared = prepareFieldReportArtifact({
    readModel,
    dryRun: input.dryRun,
  });

  if (!input.dryRun && options.reportArtifactStore) {
    const storedArtifact = await options.reportArtifactStore.save({
      artifact: prepared.result.artifact,
      bytes: prepared.bytes,
      contentType: prepared.contentType,
      cacheControl: prepared.cacheControl,
      metadata: {
        document_sha256: prepared.result.document.sha256,
        page_count: String(prepared.result.document.pageCount),
        field_id: prepared.result.summary.fieldId,
        report_date: prepared.result.summary.reportDate.slice(0, 10),
      },
    });

    const activeAlertSummary =
      prepared.result.summary.activeAlertCount == null
        ? "alert data unavailable"
        : `${prepared.result.summary.activeAlertCount} active alerts`;

    return {
      ...prepared.result,
      artifact: storedArtifact,
      note: `Report rendered and stored for ${prepared.result.summary.fieldName} with ${activeAlertSummary}, ${prepared.result.summary.activeFindingCount} active findings, and ${prepared.result.summary.trackedZoneCount} tracked zones.`,
    };
  }

  return prepared.result;
}
