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
import type { FieldHydrationReplay } from "./createSupabaseFieldHydrationReplay";

const HYDRATION_REPLAY_MAX_ATTEMPTS = 4;
const HYDRATION_REPLAY_RETRY_DELAYS_MS = [150, 400, 900] as const;
const FIELD_IMPORT_PARALLELISM = 8;
const LIGHTWEIGHT_FIELD_HYDRATION_SUMMARY_THRESHOLD = 4;
const HYDRATION_STAGE_LABELS = {
  soil: "Soil properties",
  weather: "Weather observations",
  imagery: "Satellite imagery",
  moisture: "Moisture model",
} as const;

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function mapWithConcurrency<T, TResult>(
  items: readonly T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<TResult>,
) {
  if (items.length === 0) {
    return [] as TResult[];
  }

  const results = new Array<TResult>(items.length);
  let nextIndex = 0;

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (nextIndex < items.length) {
        const index = nextIndex;
        nextIndex += 1;
        results[index] = await mapper(items[index]!, index);
      }
    }),
  );

  return results;
}

async function replayFieldHydrationWithRetry(
  hydrationReplay: FieldHydrationReplay,
  input: Parameters<FieldHydrationReplay["replayFromImportCandidate"]>[0],
) {
  let lastError: unknown = null;

  for (let attempt = 0; attempt < HYDRATION_REPLAY_MAX_ATTEMPTS; attempt += 1) {
    try {
      return await hydrationReplay.replayFromImportCandidate(input);
    } catch (error) {
      lastError = error;
      if (attempt >= HYDRATION_REPLAY_RETRY_DELAYS_MS.length) {
        break;
      }
      await delay(HYDRATION_REPLAY_RETRY_DELAYS_MS[attempt]!);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(String(lastError ?? "Unknown hydration replay error"));
}

async function replayFieldHydrationBatchWithRetry(
  hydrationReplay: FieldHydrationReplay,
  input: Parameters<FieldHydrationReplay["replayFromCommittedBatch"]>[0],
) {
  let lastError: unknown = null;

  for (let attempt = 0; attempt < HYDRATION_REPLAY_MAX_ATTEMPTS; attempt += 1) {
    try {
      return await hydrationReplay.replayFromCommittedBatch(input);
    } catch (error) {
      lastError = error;
      if (attempt >= HYDRATION_REPLAY_RETRY_DELAYS_MS.length) {
        break;
      }
      await delay(HYDRATION_REPLAY_RETRY_DELAYS_MS[attempt]!);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(String(lastError ?? "Unknown hydration replay batch error"));
}

type HydrationReplayOutcome = Awaited<
  ReturnType<FieldHydrationReplay["replayFromImportCandidate"]>
>;

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
    replayResult: HydrationReplayOutcome | null;
  },
): Promise<FieldHydrationSummary> {
  const hydrationMode: FieldHydrationSummary["hydrationMode"] =
    input.replayResult?.action === "replayed"
      ? "inline-replay"
      : input.receipts.some((receipt) => receipt.key === "field.refresh-intake")
        ? "refresh"
        : input.receipts.some((receipt) => receipt.key === "field.bootstrap-initial")
          ? "cold-bootstrap"
          : input.action === "reused"
            ? "existing"
            : "cold-bootstrap";

  if (hydrationMode === "cold-bootstrap" || hydrationMode === "refresh") {
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
      sourceFieldId: input.replayResult?.sourceFieldId,
      sourceWorkspaceId: input.replayResult?.sourceWorkspaceId,
      sourceWorkspaceSlug: input.replayResult?.sourceWorkspaceSlug ?? null,
      stages: buildQueuedStages(phaseLabel),
      coverage: {
        hasSoilContext: false,
        hasWeatherObservation: false,
        hasWeatherForecast: false,
        hasRasterObservation: false,
        hasMoistureSnapshot: false,
        weatherObservationCount: input.replayResult?.copied?.weatherObservationCount ?? null,
        weatherForecastCount: input.replayResult?.copied?.weatherForecastCount ?? null,
        moistureSnapshotCount: input.replayResult?.copied?.moistureSnapshotCount ?? null,
        moistureCellCount: input.replayResult?.copied?.moistureCellCount ?? null,
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
    phaseLabel:
      hydrationMode === "inline-replay"
        ? "Hydration replay completed"
        : "Field data available",
    sourceFieldId: input.replayResult?.sourceFieldId,
    sourceWorkspaceId: input.replayResult?.sourceWorkspaceId,
    sourceWorkspaceSlug: input.replayResult?.sourceWorkspaceSlug ?? null,
    stages: buildCompletedStages({
      hasSoilContext: soilReady,
      hasWeatherObservation: weatherReady,
      hasRasterObservation: imageryReady,
      hasMoistureSnapshot: moistureReady,
      replayed: hydrationMode === "inline-replay",
    }),
    coverage: {
      hasSoilContext: soilReady,
      hasWeatherObservation: weatherReady,
      hasWeatherForecast: forecasts.length > 0,
      hasRasterObservation: imageryReady,
      hasMoistureSnapshot: moistureReady,
      weatherObservationCount: input.replayResult?.copied?.weatherObservationCount ?? null,
      weatherForecastCount:
        input.replayResult?.copied?.weatherForecastCount ?? forecasts.length,
      moistureSnapshotCount: input.replayResult?.copied?.moistureSnapshotCount ?? null,
      moistureCellCount: input.replayResult?.copied?.moistureCellCount ?? null,
    },
    moistureConfidence: buildMoistureConfidenceSummary(latestMoistureSnapshot),
  };
}

function buildLightweightFieldHydrationSummary(input: {
  fieldId: string;
  fieldName: string;
  action: "created" | "reused";
  receipts: CommitFieldImportBatchResult["onboardingDispatches"][number]["receipts"];
  replayResult: HydrationReplayOutcome | null;
}): FieldHydrationSummary {
  const hydrationMode: FieldHydrationSummary["hydrationMode"] =
    input.replayResult?.action === "replayed"
      ? "inline-replay"
      : input.receipts.some((receipt) => receipt.key === "field.refresh-intake")
        ? "refresh"
        : input.receipts.some((receipt) => receipt.key === "field.bootstrap-initial")
          ? "cold-bootstrap"
          : input.action === "reused"
            ? "existing"
            : "cold-bootstrap";

  if (hydrationMode === "cold-bootstrap" || hydrationMode === "refresh") {
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
      sourceFieldId: input.replayResult?.sourceFieldId,
      sourceWorkspaceId: input.replayResult?.sourceWorkspaceId,
      sourceWorkspaceSlug: input.replayResult?.sourceWorkspaceSlug ?? null,
      stages: buildQueuedStages(phaseLabel),
      coverage: {
        hasSoilContext: false,
        hasWeatherObservation: false,
        hasWeatherForecast: false,
        hasRasterObservation: false,
        hasMoistureSnapshot: false,
        weatherObservationCount: input.replayResult?.copied?.weatherObservationCount ?? null,
        weatherForecastCount: input.replayResult?.copied?.weatherForecastCount ?? null,
        moistureSnapshotCount: input.replayResult?.copied?.moistureSnapshotCount ?? null,
        moistureCellCount: input.replayResult?.copied?.moistureCellCount ?? null,
      },
      moistureConfidence: null,
    };
  }

  return {
    fieldId: input.fieldId,
    fieldName: input.fieldName,
    action: input.action,
    hydrationMode,
    status: "completed",
    progressPct: 100,
    phaseLabel:
      hydrationMode === "inline-replay"
        ? "Hydration replay completed"
        : "Field data available",
    sourceFieldId: input.replayResult?.sourceFieldId,
    sourceWorkspaceId: input.replayResult?.sourceWorkspaceId,
    sourceWorkspaceSlug: input.replayResult?.sourceWorkspaceSlug ?? null,
    stages: buildCompletedStages({
      hasSoilContext: true,
      hasWeatherObservation: true,
      hasRasterObservation: true,
      hasMoistureSnapshot: true,
      replayed: hydrationMode === "inline-replay",
    }),
    coverage: {
      hasSoilContext: false,
      hasWeatherObservation: false,
      hasWeatherForecast: false,
      hasRasterObservation: false,
      hasMoistureSnapshot: false,
      weatherObservationCount: input.replayResult?.copied?.weatherObservationCount ?? null,
      weatherForecastCount: input.replayResult?.copied?.weatherForecastCount ?? null,
      moistureSnapshotCount: input.replayResult?.copied?.moistureSnapshotCount ?? null,
      moistureCellCount: input.replayResult?.copied?.moistureCellCount ?? null,
    },
    moistureConfidence: null,
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
  const reusableBatch = await repositories.fieldImportBatches.findReusableSpreadsheetImportBatch?.(
    {
      workspaceId: input.workspaceId,
      preview: input.preview,
    },
    input.actorUserId,
  );

  if (reusableBatch) {
    return reusableBatch;
  }

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
    hydrationReplay?: FieldHydrationReplay;
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
  const replayResultsByFieldId = new Map<string, HydrationReplayOutcome>();
  const useLightweightHydrationSummaries =
    committed.candidates.length >= LIGHTWEIGHT_FIELD_HYDRATION_SUMMARY_THRESHOLD;

  if (options.hydrationReplay) {
    const createdCandidates = committed.candidates.filter(
      (candidate) => candidate.action === "created",
    );

    if (createdCandidates.length > 0) {
      try {
        const replayResults = await replayFieldHydrationBatchWithRetry(
          options.hydrationReplay,
          {
            targetWorkspaceId: input.workspaceId,
            batchId: input.batchId,
          },
        );

        for (const replayResult of replayResults) {
          replayResultsByFieldId.set(replayResult.targetFieldId, {
            action: replayResult.action,
            reason: replayResult.reason,
            sourceFieldId: replayResult.sourceFieldId,
            sourceWorkspaceId: replayResult.sourceWorkspaceId,
            sourceWorkspaceSlug: replayResult.sourceWorkspaceSlug,
            copied: replayResult.copied,
          });
        }
      } catch (error) {
        console.warn(
          `[field-intake] hydration replay batch skipped for batch ${input.batchId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
  }

  const onboardingDispatchEntries = await mapWithConcurrency(
    committed.candidates,
    FIELD_IMPORT_PARALLELISM,
    async (candidate) => {
      if (candidate.candidate.cropType) {
        await repositories.fieldCropContexts.upsertContext({
          workspaceId: candidate.field.workspaceId,
          fieldId: candidate.field.id,
          seasonYear: new Date(candidate.candidate.createdAt).getUTCFullYear(),
          cropType: candidate.candidate.cropType,
          growthStage: null,
          growthStageSource: "imported",
          accumulatedGdd: 0,
          sourceKey: "field-intake:spreadsheet-commit",
          metadata: {
            batchId: committed.batch.id,
            candidateId: candidate.candidate.id,
            commitAction: candidate.action,
            sourceType: committed.batch.sourceType,
          },
        });
      }

      let hydrationReplayAction: "replayed" | "skipped" = "skipped";
      let replayResult = replayResultsByFieldId.get(candidate.field.id) ?? null;

      if (candidate.action === "created" && options.hydrationReplay) {
        if (replayResult) {
          hydrationReplayAction = replayResult.action;
        } else {
          try {
            replayResult = await replayFieldHydrationWithRetry(
              options.hydrationReplay,
              {
                targetWorkspaceId: candidate.field.workspaceId,
                targetFieldId: candidate.field.id,
                fieldName: candidate.field.name,
                cropType: candidate.candidate.cropType,
                legalLandDescriptions: candidate.candidate.legalLandDescriptions,
              },
            );
            replayResultsByFieldId.set(candidate.field.id, replayResult);
            hydrationReplayAction = replayResult.action;
          } catch (error) {
            console.warn(
              `[field-intake] hydration replay skipped for field ${candidate.field.id}: ${
                error instanceof Error ? error.message : String(error)
              }`,
            );
          }
        }
      }

      if (!options.jobDispatcher) {
        return {
          fieldId: candidate.field.id,
          action: candidate.action,
          receipts: [],
        } satisfies CommitFieldImportBatchResult["onboardingDispatches"][number];
      }

      const receipts = await dispatchFieldOnboardingPlan({
        dispatcher: {
          enqueue(job: FieldOnboardingJobRequest) {
            return options.jobDispatcher!.enqueue(job);
          },
        },
        plan:
          candidate.action === "created" && hydrationReplayAction !== "replayed"
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
              }),
      });

      return {
        fieldId: candidate.field.id,
        action: candidate.action,
        receipts,
      } satisfies CommitFieldImportBatchResult["onboardingDispatches"][number];
    },
  );

  onboardingDispatches.push(...onboardingDispatchEntries);
  const onboardingDispatchByFieldId = new Map(
    onboardingDispatches.map((entry) => [entry.fieldId, entry] as const),
  );

  const fieldHydrationSummaries = await Promise.all(
    committed.candidates.map(async (candidate) => {
      const dispatchEntry = onboardingDispatchByFieldId.get(candidate.field.id);
      const replayResult = replayResultsByFieldId.get(candidate.field.id) ?? null;

      if (useLightweightHydrationSummaries) {
        return buildLightweightFieldHydrationSummary({
          fieldId: candidate.field.id,
          fieldName: candidate.field.name,
          action: candidate.action,
          receipts: dispatchEntry?.receipts ?? [],
          replayResult,
        });
      }

      return buildFieldHydrationSummary(repositories, {
        fieldId: candidate.field.id,
        fieldName: candidate.field.name,
        workspaceId: candidate.field.workspaceId,
        action: candidate.action,
        receipts: dispatchEntry?.receipts ?? [],
        replayResult,
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
