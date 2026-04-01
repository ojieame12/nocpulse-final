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
  rebuildFieldMoistureCellSnapshots,
  rebuildFieldMoistureEstimate,
} from "@fieldpulse/module-moisture";
import { ensureWorkspace } from "@fieldpulse/module-workspaces";
import type { ServerJobDispatcher, ServerRepositories } from "../contracts/ServerRuntime";
import type {
  BootstrapDevelopmentDataInput,
  BootstrapDevelopmentDataResult,
  CommitFieldImportBatchInput,
  CommitFieldImportBatchResult,
  SaveSpreadsheetImportPreviewInput,
  SaveSpreadsheetImportPreviewResult,
} from "../contracts/ServerServices";
import { createDefaultMoistureCellDerivationStrategy } from "./createDefaultMoistureCellDerivationStrategy";
import type { FieldHydrationReplay } from "./createSupabaseFieldHydrationReplay";

const HYDRATION_REPLAY_MAX_ATTEMPTS = 4;
const HYDRATION_REPLAY_RETRY_DELAYS_MS = [150, 400, 900] as const;

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
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
  const replayResultsByFieldId = new Map<
    string,
    Awaited<ReturnType<FieldHydrationReplay["replayFromCommittedBatch"]>>[number]
  >();

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
          replayResultsByFieldId.set(replayResult.targetFieldId, replayResult);
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

  for (const candidate of committed.candidates) {
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
    if (candidate.action === "created" && options.hydrationReplay) {
      const batchReplayResult = replayResultsByFieldId.get(candidate.field.id);

      if (batchReplayResult) {
        hydrationReplayAction = batchReplayResult.action;
      } else {
        try {
          const replayResult =
            await replayFieldHydrationWithRetry(options.hydrationReplay, {
              targetWorkspaceId: candidate.field.workspaceId,
              targetFieldId: candidate.field.id,
              fieldName: candidate.field.name,
              cropType: candidate.candidate.cropType,
              legalLandDescriptions: candidate.candidate.legalLandDescriptions,
            });
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
      onboardingDispatches.push({
        fieldId: candidate.field.id,
        action: candidate.action,
        receipts: [],
      });
      continue;
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
              dryRun: input.onboardingDryRun,
            })
          : buildRefreshFieldOnboardingPlan({
              workspaceId: candidate.field.workspaceId,
              fieldId: candidate.field.id,
              dryRun: input.onboardingDryRun,
            }),
    });

    onboardingDispatches.push({
      fieldId: candidate.field.id,
      action: candidate.action,
      receipts,
    });
  }

  return {
    batch: committed.batch,
    candidates: committed.candidates,
    onboardingDispatches,
  };
}
