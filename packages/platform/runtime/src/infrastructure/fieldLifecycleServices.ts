import {
  commitSpreadsheetImportBatch,
  createSpreadsheetImportBatch,
} from "@fieldpulse/module-field-intake";
import {
  buildInitialFieldOnboardingPlan,
  buildRefreshFieldOnboardingPlan,
  dispatchFieldOnboardingPlan,
  type FieldOnboardingJobRequest,
} from "@fieldpulse/module-field-onboarding";
import { ensureWorkspaceField } from "@fieldpulse/module-fields";
import {
  createSyntheticRasterFieldObservationProvider,
  refreshFieldRasterObservation,
} from "@fieldpulse/module-imagery";
import {
  type FieldMoistureSnapshot,
  rebuildFieldMoistureCellSnapshots,
  rebuildFieldMoistureEstimate,
} from "@fieldpulse/module-moisture";
import { ensureWorkspace } from "@fieldpulse/module-workspaces";
import type { ServerJobDispatcher, ServerRepositories } from "../contracts/ServerRuntime";
import type {
  BatchHydrationSummary,
  BootstrapDevelopmentDataInput,
  BootstrapDevelopmentDataResult,
  CommitFieldImportBatchInput,
  CommitFieldImportBatchResult,
  FieldHydrationSummary,
  SaveSpreadsheetImportPreviewInput,
  SaveSpreadsheetImportPreviewResult,
} from "../contracts/ServerServices";
import { createDefaultMoistureCellDerivationStrategy } from "./createDefaultMoistureCellDerivationStrategy";
const HYDRATION_STAGE_LABELS = {
  soil: "Soil properties",
  weather: "Weather observations",
  imagery: "Satellite imagery",
  moisture: "Moisture model",
} as const;

function hasSoilContext(snapshot: FieldMoistureSnapshot | null) {
  const inputs = snapshot?.inputs;
  if (!inputs) {
    return false;
  }

  return Boolean(
    inputs.soilDataset ||
      inputs.baselineDataset ||
      inputs.availableWaterMm != null ||
      inputs.fieldCapacityPct != null ||
      inputs.wiltingPointPct != null ||
      inputs.rootZoneDepthCm != null,
  );
}

function buildMoistureConfidenceSummary(snapshot: FieldMoistureSnapshot | null) {
  if (!snapshot) {
    return null;
  }

  return {
    level: snapshot.confidence ?? "unknown",
    score: snapshot.inputs.confidenceScore ?? null,
    reason: snapshot.inputs.confidenceReason ?? null,
    observedAt: snapshot.observedAt ?? null,
    sourceKey: snapshot.sourceKey ?? null,
    derivationMode: snapshot.inputs.derivationMode ?? null,
    rasterMode: snapshot.inputs.rasterMode ?? null,
    signalBlend: snapshot.inputs.signalBlend ?? null,
    baselineDataset: snapshot.inputs.baselineDataset ?? null,
    soilDataset: snapshot.inputs.soilDataset ?? null,
    weatherSourceKey: snapshot.inputs.weatherSourceKey ?? null,
    rasterSourceKey: snapshot.inputs.rasterSourceKey ?? null,
    usedOptical: snapshot.inputs.usedOptical === true,
    usedSar: snapshot.inputs.usedSar === true,
    usedWeather: snapshot.inputs.usedWeather === true,
    usedWeatherSoilMoisture: snapshot.inputs.usedWeatherSoilMoisture === true,
  } satisfies FieldHydrationSummary["moistureConfidence"];
}

function buildQueuedStages(
  phaseLabel: string,
): FieldHydrationSummary["stages"] {
  return [
    {
      key: "soil",
      label: HYDRATION_STAGE_LABELS.soil,
      state: "pending",
      statusText: phaseLabel,
    },
    {
      key: "weather",
      label: HYDRATION_STAGE_LABELS.weather,
      state: "pending",
      statusText: "Queued",
    },
    {
      key: "imagery",
      label: HYDRATION_STAGE_LABELS.imagery,
      state: "pending",
      statusText: "Queued",
    },
    {
      key: "moisture",
      label: HYDRATION_STAGE_LABELS.moisture,
      state: "pending",
      statusText: "Queued",
    },
  ];
}

function buildCompletedStages(input: {
  hasSoilContext: boolean;
  hasWeatherObservation: boolean;
  hasRasterObservation: boolean;
  hasMoistureSnapshot: boolean;
  replayed: boolean;
}): FieldHydrationSummary["stages"] {
  const completedText = input.replayed ? "Ready" : "Available";

  return [
    {
      key: "soil",
      label: HYDRATION_STAGE_LABELS.soil,
      state: input.hasSoilContext ? "completed" : "pending",
      statusText: input.hasSoilContext ? completedText : "Pending",
    },
    {
      key: "weather",
      label: HYDRATION_STAGE_LABELS.weather,
      state: input.hasWeatherObservation ? "completed" : "pending",
      statusText: input.hasWeatherObservation ? completedText : "Pending",
    },
    {
      key: "imagery",
      label: HYDRATION_STAGE_LABELS.imagery,
      state: input.hasRasterObservation ? "completed" : "pending",
      statusText: input.hasRasterObservation ? completedText : "Pending",
    },
    {
      key: "moisture",
      label: HYDRATION_STAGE_LABELS.moisture,
      state: input.hasMoistureSnapshot ? "completed" : "pending",
      statusText: input.hasMoistureSnapshot ? completedText : "Pending",
    },
  ];
}

async function buildFieldHydrationSummary(
  repositories: ServerRepositories,
  input: {
    fieldId: string;
    fieldName: string;
    workspaceId: string;
    action: "created" | "reused";
    receipts: CommitFieldImportBatchResult["onboardingDispatches"][number]["receipts"];
  },
): Promise<FieldHydrationSummary> {
  const hydrationMode: FieldHydrationSummary["hydrationMode"] =
    input.receipts.some((receipt) => receipt.key === "field.refresh-intake")
      ? "refresh"
      : input.receipts.some((receipt) => receipt.key === "field.bootstrap-initial")
        ? "cold-bootstrap"
        : input.action === "reused"
          ? "existing"
          : "cold-bootstrap";

  if (hydrationMode !== "existing") {
    const phaseLabel =
      hydrationMode === "refresh"
        ? "Queued for refresh"
        : "Queued for hydration";

    return {
      fieldId: input.fieldId,
      fieldName: input.fieldName,
      action: input.action,
      hydrationMode,
      status: "queued",
      progressPct: 0,
      phaseLabel,
      stages: buildQueuedStages(phaseLabel),
      coverage: {
        hasSoilContext: false,
        hasWeatherObservation: false,
        hasWeatherForecast: false,
        hasRasterObservation: false,
        hasMoistureSnapshot: false,
        weatherObservationCount: null,
        weatherForecastCount: null,
        moistureSnapshotCount: null,
        moistureCellCount: null,
      },
      moistureConfidence: null,
    };
  }

  const [latestMoistureSnapshot, latestWeatherObservation, latestRasterObservation, forecasts] =
    await Promise.all([
      repositories.moistureSnapshots.getLatestByField(
        input.workspaceId,
        input.fieldId,
      ),
      repositories.weatherObservations.getLatestByField(
        input.workspaceId,
        input.fieldId,
      ),
      repositories.imageryRasterObservations.getLatestByField(
        input.workspaceId,
        input.fieldId,
      ),
      repositories.weatherForecasts.listByField({
        workspaceId: input.workspaceId,
        fieldId: input.fieldId,
        limit: 1,
      }),
    ]);

  const soilReady = hasSoilContext(latestMoistureSnapshot);
  const weatherReady = latestWeatherObservation != null;
  const imageryReady = latestRasterObservation != null;
  const moistureReady = latestMoistureSnapshot != null;

  return {
    fieldId: input.fieldId,
    fieldName: input.fieldName,
    action: input.action,
    hydrationMode,
    status: "completed",
    progressPct: 100,
    phaseLabel: "Field data available",
    stages: buildCompletedStages({
      hasSoilContext: soilReady,
      hasWeatherObservation: weatherReady,
      hasRasterObservation: imageryReady,
      hasMoistureSnapshot: moistureReady,
      replayed: false,
    }),
    coverage: {
      hasSoilContext: soilReady,
      hasWeatherObservation: weatherReady,
      hasWeatherForecast: forecasts.length > 0,
      hasRasterObservation: imageryReady,
      hasMoistureSnapshot: moistureReady,
      weatherObservationCount: null,
      weatherForecastCount: forecasts.length,
      moistureSnapshotCount: null,
      moistureCellCount: null,
    },
    moistureConfidence: buildMoistureConfidenceSummary(latestMoistureSnapshot),
  };
}

function buildBatchHydrationSummary(
  summaries: readonly FieldHydrationSummary[],
): BatchHydrationSummary {
  return {
    totalFields: summaries.length,
    createdFields: summaries.filter((summary) => summary.action === "created").length,
    reusedFields: summaries.filter((summary) => summary.action === "reused").length,
    queuedFields: summaries.filter((summary) => summary.status === "queued").length,
    completedFields: summaries.filter((summary) => summary.status === "completed").length,
    replayedFields: summaries.filter(
      (summary) => summary.hydrationMode === "inline-replay",
    ).length,
    existingFields: summaries.filter(
      (summary) => summary.hydrationMode === "existing",
    ).length,
    highConfidenceFields: summaries.filter(
      (summary) => summary.moistureConfidence?.level === "high",
    ).length,
    mediumConfidenceFields: summaries.filter(
      (summary) => summary.moistureConfidence?.level === "medium",
    ).length,
    lowConfidenceFields: summaries.filter(
      (summary) => summary.moistureConfidence?.level === "low",
    ).length,
    unknownConfidenceFields: summaries.filter(
      (summary) =>
        !summary.moistureConfidence ||
        summary.moistureConfidence.level === "unknown",
    ).length,
  };
}

export async function requireFieldDetail(
  repositories: ServerRepositories,
  workspaceId: string,
  fieldId: string,
) {
  const field = await repositories.fields.getById(workspaceId, fieldId);

  if (!field) {
    throw new Error(
      `[runtime] field ${fieldId} was not found in workspace ${workspaceId}`,
    );
  }

  return field;
}

export async function bootstrapDevelopmentData(
  repositories: ServerRepositories,
  input: BootstrapDevelopmentDataInput,
): Promise<BootstrapDevelopmentDataResult> {
  const moistureCellDerivationStrategy =
    createDefaultMoistureCellDerivationStrategy({
      imageryRasterObservations: repositories.imageryRasterObservations,
    });
  const workspace = await ensureWorkspace({
    repository: repositories.workspaces,
    actorUserId: input.actorUserId,
    workspace: input.workspace,
  });

  const field = await ensureWorkspaceField({
    repository: repositories.fields,
    actorUserId: input.actorUserId,
    field: {
      workspaceId: workspace.workspace.id,
      ...input.field,
    },
  });

  const moistureSnapshot = await rebuildFieldMoistureEstimate({
    repository: repositories.moistureSnapshots,
    estimate: {
      workspaceId: workspace.workspace.id,
      fieldId: field.field.id,
      observedAt: input.moistureSnapshot.observedAt,
      sourceKey: input.moistureSnapshot.sourceKey,
      inputs: input.moistureSnapshot.inputs,
    },
  });
  const imageryObservation = await refreshFieldRasterObservation({
    repository: repositories.imageryRasterObservations,
    provider: createSyntheticRasterFieldObservationProvider(),
    workspaceId: workspace.workspace.id,
    fieldId: field.field.id,
    boundary: field.field.boundary,
    observedAt: moistureSnapshot.snapshot.observedAt,
  });
  const moistureCells = await rebuildFieldMoistureCellSnapshots({
    repository: repositories.moistureCellSnapshots,
    derivationStrategy: moistureCellDerivationStrategy,
    field: {
      workspaceId: workspace.workspace.id,
      fieldId: field.field.id,
      boundary: field.field.boundary,
    },
    snapshot: moistureSnapshot.snapshot,
  });

  return {
    actorUserId: input.actorUserId,
    workspace,
    field,
    moistureSnapshot,
    imageryObservation: {
      observationId: imageryObservation.observation.id,
      sourceKey: imageryObservation.observation.sourceKey,
      cellCount: imageryObservation.observation.cells.length,
      action: imageryObservation.action,
    },
    moistureCells: {
      count: moistureCells.cells.length,
      action: moistureCells.action,
    },
  };
}

export async function saveSpreadsheetImportPreview(
  repositories: ServerRepositories,
  input: SaveSpreadsheetImportPreviewInput,
): Promise<SaveSpreadsheetImportPreviewResult> {
  return createSpreadsheetImportBatch({
    repository: repositories.fieldImportBatches,
    actorUserId: input.actorUserId,
    workspaceId: input.workspaceId,
    preview: input.preview,
  });
}

export async function commitFieldImportBatch(
  repositories: ServerRepositories,
  options: {
    jobDispatcher?: ServerJobDispatcher;
  },
  input: CommitFieldImportBatchInput,
): Promise<CommitFieldImportBatchResult> {
  const committed = await commitSpreadsheetImportBatch({
    repository: repositories.fieldImportBatches,
    fieldRepository: repositories.fields,
    actorUserId: input.actorUserId,
    workspaceId: input.workspaceId,
    batchId: input.batchId,
  });

  const onboardingDispatches: Array<
    CommitFieldImportBatchResult["onboardingDispatches"][number]
  > = [];
  const dispatchedEntries = await Promise.all(
    committed.candidates.map(async (candidate) => {
      if (!options.jobDispatcher) {
        return {
          fieldId: candidate.field.id,
          action: candidate.action,
          receipts: [],
        } satisfies CommitFieldImportBatchResult["onboardingDispatches"][number];
      }

      const plan =
        candidate.action === "created"
          ? buildInitialFieldOnboardingPlan({
              workspaceId: candidate.field.workspaceId,
              fieldId: candidate.field.id,
              fieldName: candidate.field.name,
              dryRun: input.onboardingDryRun,
              cropType: candidate.candidate.cropType,
              legalLandDescriptions: candidate.candidate.legalLandDescriptions,
              importBatchId: committed.batch.id,
              importCandidateId: candidate.candidate.id,
              importSourceType: committed.batch.sourceType,
              importAction: candidate.action,
            })
          : buildRefreshFieldOnboardingPlan({
              workspaceId: candidate.field.workspaceId,
              fieldId: candidate.field.id,
              fieldName: candidate.field.name,
              dryRun: input.onboardingDryRun,
              cropType: candidate.candidate.cropType,
              legalLandDescriptions: candidate.candidate.legalLandDescriptions,
              importBatchId: committed.batch.id,
              importCandidateId: candidate.candidate.id,
              importSourceType: committed.batch.sourceType,
              importAction: candidate.action,
            });

      const receipts = await dispatchFieldOnboardingPlan({
        dispatcher: {
          enqueue(job: FieldOnboardingJobRequest) {
            return options.jobDispatcher!.enqueue(job);
          },
        },
        plan,
      });

      return {
        fieldId: candidate.field.id,
        action: candidate.action,
        receipts,
      } satisfies CommitFieldImportBatchResult["onboardingDispatches"][number];
    }),
  );

  onboardingDispatches.push(...dispatchedEntries);

  const fieldHydrationSummaries = await Promise.all(
    committed.candidates.map(async (candidate) => {
      const dispatchEntry = onboardingDispatches.find(
        (entry) => entry.fieldId === candidate.field.id,
      );

      return buildFieldHydrationSummary(repositories, {
        fieldId: candidate.field.id,
        fieldName: candidate.field.name,
        workspaceId: candidate.field.workspaceId,
        action: candidate.action,
        receipts: dispatchEntry?.receipts ?? [],
      });
    }),
  );

  return {
    batch: committed.batch,
    candidates: committed.candidates,
    onboardingDispatches,
    fieldHydrationSummaries,
    batchHydrationSummary: buildBatchHydrationSummary(fieldHydrationSummaries),
  };
}
