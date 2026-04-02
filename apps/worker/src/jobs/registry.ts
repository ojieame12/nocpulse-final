import {
  createRegisteredJob,
  runJobPhases,
  type JobDispatchResult,
  type JobExecutionControls,
} from "@fieldpulse/platform-jobs";
import type {
  FieldHydrationReplayResult,
  GenerateFieldDiseaseRiskFindingsInput,
  GenerateFieldHailRiskFindingsInput,
  GenerateFieldMoistureStressFindingsInput,
  GenerateFieldWeatherRiskFindingsInput,
  ProbeFieldImageryProvidersInput,
  RefreshFieldHailInput,
  RefreshFieldWeatherInput,
  RebuildFieldCellsInput,
  RebuildFieldEstimateInput,
  RebuildFieldCellsResult,
  RenderFieldPdfInput,
  SyncLatestFieldImageryInput,
} from "@fieldpulse/platform-runtime";
import type { ImageryProviderProbeRecord } from "@fieldpulse/module-imagery";
import type { FieldAlert } from "@fieldpulse/module-alerts";
import type { WorkerJobContext } from "./contracts/WorkerJobContext";
import { prepareImportedFieldOnboarding } from "./intakeFieldPreparation";
import { refreshMarketQuotes } from "../marketRefreshQuotes";
import { enrichFieldSoilProperties, type SoilEnrichResult } from "../soilEnrich";
import { notifyFieldAlerts } from "../notifyFieldAlerts";

type LongRunningSmokeInput = {
  durationMs: number;
  stepMs: number;
};

type IntakeFieldOnboardingJobInput = {
  workspaceId: string;
  fieldId: string;
  fieldName?: string;
  requestedAt?: string;
  providers?: SyncLatestFieldImageryInput["providers"];
  dryRun?: boolean;
  cropType?: string;
  legalLandDescriptions?: readonly string[];
  importBatchId?: string;
  importCandidateId?: string;
  importSourceType?: "spreadsheet";
  importAction?: "created" | "reused";
};

type IntakeFieldOnboardingJobResult = {
  workspaceId: string;
  fieldId: string;
  requestedAt: string;
  mode: "bootstrap-initial" | "refresh-intake";
  probeRecords: readonly ImageryProviderProbeRecord[];
  imagery:
    | Awaited<
        ReturnType<WorkerJobContext["runtime"]["services"]["imagery"]["syncLatestFieldImagery"]>
      >
    | null;
  weather:
    | Awaited<
        ReturnType<WorkerJobContext["runtime"]["services"]["weather"]["refreshFieldWeather"]>
      >
    | null;
  hail: RefreshFieldHailJobResult | null;
  soilEnrich: SoilEnrichResult | null;
  moistureEstimate:
    | Awaited<
        ReturnType<WorkerJobContext["runtime"]["services"]["moisture"]["rebuildFieldEstimate"]>
      >
    | null;
  moistureCells: RebuildFieldCellsResult | null;
  moistureStress:
    | Awaited<
        ReturnType<
          WorkerJobContext["runtime"]["services"]["intelligence"]["generateMoistureStressFindings"]
        >
      >
    | null;
  weatherRisk:
    | Awaited<
        ReturnType<
          WorkerJobContext["runtime"]["services"]["intelligence"]["generateWeatherRiskFindings"]
        >
      >
    | null;
  diseaseRisk:
    | Awaited<
        ReturnType<
          WorkerJobContext["runtime"]["services"]["intelligence"]["generateDiseaseRiskFindings"]
        >
      >
    | null;
  actionCuration:
    | Awaited<
        ReturnType<
          WorkerJobContext["runtime"]["services"]["intelligence"]["curateFieldAction"]
        >
      >
    | null;
  replayResult: FieldHydrationReplayResult | null;
};

function isMissingFieldRuntimeError(
  error: unknown,
  payload: Pick<IntakeFieldOnboardingJobInput, "workspaceId" | "fieldId">,
) {
  if (!(error instanceof Error)) {
    return false;
  }

  const exactMessage = `[runtime] field ${payload.fieldId} was not found in workspace ${payload.workspaceId}`;
  return error.message === exactMessage;
}

function buildSkippedIntakeFieldOnboardingJobResult(input: {
  payload: IntakeFieldOnboardingJobInput;
  requestedAt: string;
  mode: "bootstrap-initial" | "refresh-intake";
}): IntakeFieldOnboardingJobResult {
  return {
    workspaceId: input.payload.workspaceId,
    fieldId: input.payload.fieldId,
    requestedAt: input.requestedAt,
    mode: input.mode,
    probeRecords: [],
    imagery: null,
    weather: null,
    hail: null,
    soilEnrich: null,
    moistureEstimate: null,
    moistureCells: null,
    moistureStress: null,
    weatherRisk: null,
    diseaseRisk: null,
  actionCuration: null,
  replayResult: null,
  };
}

function logSkippedDeletedFieldJob(input: {
  context: WorkerJobContext;
  jobKey: string;
  payload: Pick<IntakeFieldOnboardingJobInput, "workspaceId" | "fieldId">;
}) {
  input.context.logger.warn(
    `[worker] skipping ${input.jobKey} for deleted field ${input.payload.fieldId} in workspace ${input.payload.workspaceId}`,
  );
}

type IntakeFieldOnboardingJobState = {
  probeRecords: readonly ImageryProviderProbeRecord[];
  imagery: IntakeFieldOnboardingJobResult["imagery"] | null;
  weather: IntakeFieldOnboardingJobResult["weather"];
  hail: IntakeFieldOnboardingJobResult["hail"];
  soilEnrich: IntakeFieldOnboardingJobResult["soilEnrich"];
  moistureEstimate: IntakeFieldOnboardingJobResult["moistureEstimate"];
  moistureCells: IntakeFieldOnboardingJobResult["moistureCells"];
  moistureStress: IntakeFieldOnboardingJobResult["moistureStress"];
  weatherRisk: IntakeFieldOnboardingJobResult["weatherRisk"];
  diseaseRisk: IntakeFieldOnboardingJobResult["diseaseRisk"];
  actionCuration: IntakeFieldOnboardingJobResult["actionCuration"];
  replayResult: IntakeFieldOnboardingJobResult["replayResult"];
};

type ScheduleWorkspaceImageryProviderProbesInput = {
  workspaceId: string;
  fieldIds?: readonly string[];
  limit?: number;
  requestedAt?: string;
};

type RecordFieldImageryProviderProbeResult = {
  workspaceId: string;
  fieldId: string;
  requestedAt: string;
  records: readonly ImageryProviderProbeRecord[];
};

type ScheduleWorkspaceImageryProviderProbesResult = {
  workspaceId: string;
  requestedAt: string;
  fieldCount: number;
  queuedCount: number;
  queuedDispatchIds: readonly string[];
};

type ScheduleWorkspaceImagerySyncInput = {
  workspaceId: string;
  fieldIds?: readonly string[];
  limit?: number;
  requestedAt?: string;
  providers?: SyncLatestFieldImageryInput["providers"];
  dryRun?: boolean;
};

type ScheduleWorkspaceImagerySyncResult = {
  workspaceId: string;
  requestedAt: string;
  fieldCount: number;
  queuedCount: number;
  queuedDispatchIds: readonly string[];
};

type ScheduleWorkspaceWeatherRefreshInput = {
  workspaceId: string;
  fieldIds?: readonly string[];
  limit?: number;
  requestedAt?: string;
  forecastHours?: number;
};

type ScheduleWorkspaceWeatherRefreshResult = {
  workspaceId: string;
  requestedAt: string;
  fieldCount: number;
  queuedCount: number;
  queuedDispatchIds: readonly string[];
};

type ScheduleWorkspaceMoistureEstimateRebuildInput = {
  workspaceId: string;
  fieldIds?: readonly string[];
  limit?: number;
  requestedAt?: string;
};

type ScheduleWorkspaceMoistureEstimateRebuildResult = {
  workspaceId: string;
  requestedAt: string;
  fieldCount: number;
  queuedCount: number;
  queuedDispatchIds: readonly string[];
};

type ScheduleWorkspaceMoistureCellBackfillInput = {
  workspaceId: string;
  fieldIds?: readonly string[];
  limit?: number;
  requestedAt?: string;
};

type ScheduleWorkspaceMoistureCellBackfillResult = {
  workspaceId: string;
  requestedAt: string;
  fieldCount: number;
  queuedCount: number;
  queuedDispatchIds: readonly string[];
};

type ScheduleWorkspaceHailRefreshInput = {
  workspaceId: string;
  fieldIds?: readonly string[];
  limit?: number;
  requestedAt?: string;
};

type ScheduleWorkspaceHailRefreshResult = {
  workspaceId: string;
  requestedAt: string;
  fieldCount: number;
  queuedCount: number;
  queuedDispatchIds: readonly string[];
};

type ScheduleWorkspaceDiseaseRiskInput = {
  workspaceId: string;
  fieldIds?: readonly string[];
  limit?: number;
  requestedAt?: string;
};

type ScheduleWorkspaceDiseaseRiskResult = {
  workspaceId: string;
  requestedAt: string;
  fieldCount: number;
  queuedCount: number;
  queuedDispatchIds: readonly string[];
};

type ScheduleWorkspaceMoistureStressInput = {
  workspaceId: string;
  fieldIds?: readonly string[];
  limit?: number;
  requestedAt?: string;
};

type ScheduleWorkspaceMoistureStressResult = {
  workspaceId: string;
  requestedAt: string;
  fieldCount: number;
  queuedCount: number;
  queuedDispatchIds: readonly string[];
};

type ScheduleWorkspaceWeatherRiskInput = {
  workspaceId: string;
  fieldIds?: readonly string[];
  limit?: number;
  requestedAt?: string;
};

type ScheduleWorkspaceWeatherRiskResult = {
  workspaceId: string;
  requestedAt: string;
  fieldCount: number;
  queuedCount: number;
  queuedDispatchIds: readonly string[];
};

type RefreshMarketPricesInput = {
  requestedAt?: string;
  cropSymbols?: readonly string[];
  dryRun?: boolean;
};

type RefreshFieldHailJobResult = {
  hail: Awaited<
    ReturnType<WorkerJobContext["runtime"]["services"]["hail"]["refreshFieldEvents"]>
  >;
  intelligence:
    | Awaited<
        ReturnType<
          WorkerJobContext["runtime"]["services"]["intelligence"]["generateHailRiskFindings"]
        >
      >
    | null;
};

function sleep(durationMs: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, durationMs);
  });
}

export const WORKSPACE_FIELD_SCHEDULE_CONCURRENCY = 6;

function resolveQueuedDispatchId(dispatch: JobDispatchResult): string | null {
  if (
    dispatch.result
    && typeof dispatch.result === "object"
    && dispatch.result
    && "id" in dispatch.result
    && typeof dispatch.result.id === "string"
  ) {
    return dispatch.result.id;
  }

  return null;
}

// Keep workspace schedulers from serially blocking on dispatch I/O while avoiding a full fan-out.
async function enqueueWorkspaceFieldJobs(input: {
  execution: JobExecutionControls;
  fields: readonly { id: string }[];
  phaseKey: string;
  phaseLabel: string;
  progressMessage: (completedCount: number, totalCount: number) => string;
  enqueue: (field: { id: string }, index: number) => Promise<JobDispatchResult>;
}): Promise<readonly string[]> {
  const queuedDispatchIds = new Array<string | null>(input.fields.length).fill(null);
  const workerCount = Math.min(WORKSPACE_FIELD_SCHEDULE_CONCURRENCY, input.fields.length);
  let nextIndex = 0;
  let completedCount = 0;
  let failure: unknown = null;

  async function runWorker() {
    while (true) {
      if (failure) {
        return;
      }

      const index = nextIndex;
      nextIndex += 1;

      if (index >= input.fields.length) {
        return;
      }

      try {
        await input.execution.throwIfCancellationRequested();
        const dispatch = await input.enqueue(input.fields[index], index);
        const dispatchId = resolveQueuedDispatchId(dispatch);

        if (dispatchId) {
          queuedDispatchIds[index] = dispatchId;
        }

        completedCount += 1;
        const completed = completedCount;

        await input.execution.reportProgress({
          progressPct: Math.min(
            95,
            Math.max(10, Math.round((completed / input.fields.length) * 95)),
          ),
          progressMessage: input.progressMessage(completed, input.fields.length),
          phaseKey: input.phaseKey,
          phaseLabel: input.phaseLabel,
        });
      } catch (error) {
        failure ??= error;
        return;
      }
    }
  }

  await Promise.all(
    Array.from({ length: workerCount }, () => runWorker()),
  );

  if (failure) {
    throw failure;
  }

  return queuedDispatchIds.filter((dispatchId): dispatchId is string => dispatchId !== null);
}

async function runIntakeFieldOnboardingJob(input: {
  context: WorkerJobContext;
  payload: IntakeFieldOnboardingJobInput;
  execution: JobExecutionControls;
  mode: "bootstrap-initial" | "refresh-intake";
  includeProbe: boolean;
}): Promise<IntakeFieldOnboardingJobResult> {
  const requestedAt = input.payload.requestedAt ?? new Date().toISOString();

  let state: IntakeFieldOnboardingJobState;

  try {
    state = await runJobPhases(input.execution, {
      initialState: {
        probeRecords: [] as readonly ImageryProviderProbeRecord[],
        imagery: null as IntakeFieldOnboardingJobResult["imagery"] | null,
        weather: null as IntakeFieldOnboardingJobResult["weather"],
        hail: null as IntakeFieldOnboardingJobResult["hail"],
        soilEnrich: null as IntakeFieldOnboardingJobResult["soilEnrich"],
        moistureEstimate: null as IntakeFieldOnboardingJobResult["moistureEstimate"],
        moistureCells: null as IntakeFieldOnboardingJobResult["moistureCells"],
        moistureStress: null as IntakeFieldOnboardingJobResult["moistureStress"],
        weatherRisk: null as IntakeFieldOnboardingJobResult["weatherRisk"],
        diseaseRisk: null as IntakeFieldOnboardingJobResult["diseaseRisk"],
        actionCuration: null as IntakeFieldOnboardingJobResult["actionCuration"],
        replayResult: null as IntakeFieldOnboardingJobResult["replayResult"],
      } satisfies IntakeFieldOnboardingJobState,
      phases: [
      {
        key: "validate-request",
        progressPct: 5,
        progressMessage: `validating ${input.mode} request`,
        run(currentState: IntakeFieldOnboardingJobState) {
          return currentState;
        },
      },
      ...(input.payload.dryRun
        ? []
        : [{
            key: "prepare-import-context",
            progressPct: 12,
            progressMessage: "applying import context and hydration replay",
            async run(currentState: IntakeFieldOnboardingJobState) {
              const preparation = await prepareImportedFieldOnboarding({
                services: input.context.runtime.services,
                payload: input.payload,
                requestedAt,
                mode: input.mode,
              });

              return {
                ...currentState,
                replayResult: preparation.replayResult,
              };
            },
          }]),
      ...(input.includeProbe && !input.payload.dryRun
        ? [{
            key: "record-provider-probe",
            progressPct: 15,
            progressMessage: "recording imagery provider probe",
            async run(currentState: IntakeFieldOnboardingJobState) {
              return {
                ...currentState,
                probeRecords:
                  await input.context.runtime.services.imagery.recordProviderProbeForField({
                    workspaceId: input.payload.workspaceId,
                    fieldId: input.payload.fieldId,
                    requestedAt,
                  }),
              };
            },
          }]
        : []),
      {
        key: "sync-imagery",
        progressPct: 30,
        progressMessage: "syncing latest field imagery",
        async run(currentState: IntakeFieldOnboardingJobState) {
          return {
            ...currentState,
            imagery: await input.context.runtime.services.imagery.syncLatestFieldImagery({
              workspaceId: input.payload.workspaceId,
              fieldId: input.payload.fieldId,
              requestedAt,
              providers: input.payload.providers,
              dryRun: input.payload.dryRun,
            }),
          };
        },
      },
      ...(input.payload.dryRun
        ? []
        : [
            {
              key: "refresh-weather",
              progressPct: 45,
              progressMessage: "refreshing field weather",
              async run(currentState: IntakeFieldOnboardingJobState) {
                return {
                  ...currentState,
                  weather:
                    await input.context.runtime.services.weather.refreshFieldWeather({
                      workspaceId: input.payload.workspaceId,
                      fieldId: input.payload.fieldId,
                      requestedAt,
                    }),
                };
              },
            },
            {
              key: "refresh-hail",
              progressPct: 58,
              progressMessage: "refreshing hail and hail-risk findings",
              async run(currentState: IntakeFieldOnboardingJobState) {
                const hail = await input.context.runtime.services.hail.refreshFieldEvents({
                  workspaceId: input.payload.workspaceId,
                  fieldId: input.payload.fieldId,
                  requestedAt,
                });

                const intelligence =
                  hail.events.length > 0
                    ? await input.context.runtime.services.intelligence.generateHailRiskFindings({
                        workspaceId: input.payload.workspaceId,
                        fieldId: input.payload.fieldId,
                        requestedAt,
                        reportedAfter: hail.events.reduce(
                          (earliest, event) =>
                            event.reportedAt < earliest ? event.reportedAt : earliest,
                          hail.events[0].reportedAt,
                        ),
                        limit: hail.events.length,
                      })
                    : null;

                return {
                  ...currentState,
                  hail: {
                    hail,
                    intelligence,
                  },
                };
              },
            },
            {
              key: "enrich-soil-properties",
              progressPct: 65,
              progressMessage: "enriching field soil properties",
              async run(currentState: IntakeFieldOnboardingJobState) {
                try {
                  const fieldDetail =
                    await input.context.runtime.services.catalog.loadFieldDetailByWorkspace(
                      {
                        workspaceId: input.payload.workspaceId,
                        fieldId: input.payload.fieldId,
                      },
                    );

                  if (!fieldDetail.field) {
                    input.context.logger.warn(
                      `[soil-enrich] field ${input.payload.fieldId} not found — skipping soil enrichment`,
                    );
                    return currentState;
                  }

                  const { createSoilPropertiesProvider } = await import(
                    "@fieldpulse/module-soil"
                  );
                  const { createSupabaseDatabaseClient } = await import(
                    "@fieldpulse/platform-db"
                  );

                  const db = createSupabaseDatabaseClient({
                    url: input.context.runtime.env.supabase.url!,
                    serviceKey: input.context.runtime.env.supabase.serviceRoleKey!,
                  });

                  const soilProvider = createSoilPropertiesProvider({
                    enableRestFallback: true,
                    restBaseUrl: input.context.runtime.env.soil.soilGridsBaseUrl,
                  });

                  const labelPoint = fieldDetail.field.detail.labelPoint;

                  const result = await enrichFieldSoilProperties(
                    {
                      fieldId: input.payload.fieldId,
                      centroidLat: labelPoint[1],
                      centroidLng: labelPoint[0],
                    },
                    {
                      db,
                      soilProvider,
                      logger: input.context.logger,
                    },
                  );

                  return { ...currentState, soilEnrich: result };
                } catch (error) {
                  const message =
                    error instanceof Error ? error.message : String(error);
                  input.context.logger.warn(
                    `[soil-enrich] soil enrichment failed for field ${input.payload.fieldId}: ${message} — continuing`,
                  );
                  return currentState;
                }
              },
            },
            {
              key: "rebuild-moisture-estimate",
              progressPct: 72,
              progressMessage: "rebuilding field moisture estimate",
              async run(currentState: IntakeFieldOnboardingJobState) {
                return {
                  ...currentState,
                  moistureEstimate:
                    await input.context.runtime.services.moisture.rebuildFieldEstimate({
                      workspaceId: input.payload.workspaceId,
                      fieldId: input.payload.fieldId,
                      observedAt: requestedAt,
                    }),
                };
              },
            },
            {
              key: "rebuild-moisture-cells",
              progressPct: 80,
              progressMessage: "rebuilding field moisture cells",
              async run(currentState: IntakeFieldOnboardingJobState) {
                return {
                  ...currentState,
                  moistureCells:
                    await input.context.runtime.services.moisture.rebuildFieldCells({
                      workspaceId: input.payload.workspaceId,
                      fieldId: input.payload.fieldId,
                    }),
                };
              },
            },
            {
              key: "generate-moisture-stress",
              progressPct: 88,
              progressMessage: "generating moisture stress findings",
              async run(currentState: IntakeFieldOnboardingJobState) {
                return {
                  ...currentState,
                  moistureStress:
                    await input.context.runtime.services.intelligence.generateMoistureStressFindings(
                      {
                        workspaceId: input.payload.workspaceId,
                        fieldId: input.payload.fieldId,
                        requestedAt,
                      },
                    ),
                };
              },
            },
            {
              key: "generate-weather-risk",
              progressPct: 94,
              progressMessage: "generating weather risk findings",
              async run(currentState: IntakeFieldOnboardingJobState) {
                return {
                  ...currentState,
                  weatherRisk:
                    await input.context.runtime.services.intelligence.generateWeatherRiskFindings(
                      {
                        workspaceId: input.payload.workspaceId,
                        fieldId: input.payload.fieldId,
                        requestedAt,
                      },
                    ),
                };
              },
            },
            {
              key: "generate-disease-risk",
              progressPct: 98,
              progressMessage: "generating disease risk findings",
              async run(currentState: IntakeFieldOnboardingJobState) {
                return {
                  ...currentState,
                  diseaseRisk:
                    await input.context.runtime.services.intelligence.generateDiseaseRiskFindings(
                      {
                        workspaceId: input.payload.workspaceId,
                        fieldId: input.payload.fieldId,
                        requestedAt,
                      },
                    ),
                };
              },
            },
            {
              key: "curate-field-action",
              progressPct: 99,
              progressMessage: "curating field action summary",
              async run(currentState: IntakeFieldOnboardingJobState) {
                return {
                  ...currentState,
                  actionCuration:
                    await input.context.runtime.services.intelligence.curateFieldAction({
                      workspaceId: input.payload.workspaceId,
                      fieldId: input.payload.fieldId,
                      requestedAt,
                    }),
                };
              },
            },
          ]),
      {
        key: "finalize-result",
        progressPct: 100,
        progressMessage: `finalizing ${input.mode} result`,
        run(currentState: IntakeFieldOnboardingJobState) {
          return currentState;
        },
      },
      ],
    });
  } catch (error) {
    if (isMissingFieldRuntimeError(error, input.payload)) {
      input.context.logger.warn(
        `[worker] skipping ${input.mode} for deleted field ${input.payload.fieldId} in workspace ${input.payload.workspaceId}`,
      );
      return buildSkippedIntakeFieldOnboardingJobResult({
        payload: input.payload,
        requestedAt,
        mode: input.mode,
      });
    }

    throw error;
  }

  if (!state.imagery) {
    throw new Error(`[worker] ${input.mode} completed without an imagery result`);
  }

  // --- Dispatch alert email notifications ---
  // Collect newly created/escalated alerts from all intelligence results
  const allAlerts: FieldAlert[] = [
    ...(state.moistureStress?.alerts ?? []),
    ...(state.weatherRisk?.alerts ?? []),
    ...(state.diseaseRisk?.alerts ?? []),
  ];

  if (allAlerts.length > 0) {
    try {
      // Build fieldNames map — single field in this job
      const fieldNames: Record<string, string> = {};

      // Resolve field name from the catalog
      try {
        const fieldDetail =
          await input.context.runtime.services.catalog.loadFieldDetailByWorkspace({
            workspaceId: input.payload.workspaceId,
            fieldId: input.payload.fieldId,
          });
        fieldNames[input.payload.fieldId] =
          fieldDetail.field?.detail.name ?? "Unnamed Field";
      } catch {
        fieldNames[input.payload.fieldId] = "Unnamed Field";
      }

      const notifyResult = await notifyFieldAlerts({
        context: input.context,
        workspaceId: input.payload.workspaceId,
        alerts: allAlerts,
        fieldNames,
      });

      if (notifyResult.skipped) {
        input.context.logger.info(
          `[worker] alert notifications skipped: ${notifyResult.reason}`,
        );
      } else {
        input.context.logger.info(
          `[worker] alert notifications dispatched: ${notifyResult.emailsSent} sent, ${notifyResult.emailsFailed} failed`,
        );
      }
    } catch (notifyError) {
      // Notification failures should not fail the onboarding job
      input.context.logger.warn(
        `[worker] alert notification dispatch failed (non-fatal): ${notifyError instanceof Error ? notifyError.message : String(notifyError)}`,
      );
    }
  }

  return {
    workspaceId: input.payload.workspaceId,
    fieldId: input.payload.fieldId,
    requestedAt,
    mode: input.mode,
    probeRecords: state.probeRecords,
    imagery: state.imagery,
    weather: state.weather,
    hail: state.hail,
    soilEnrich: state.soilEnrich,
    moistureEstimate: state.moistureEstimate,
    moistureCells: state.moistureCells,
    moistureStress: state.moistureStress,
    weatherRisk: state.weatherRisk,
    diseaseRisk: state.diseaseRisk,
    actionCuration: state.actionCuration,
    replayResult: state.replayResult,
  };
}

export const jobs = [
  createRegisteredJob<
    WorkerJobContext,
    IntakeFieldOnboardingJobInput,
    IntakeFieldOnboardingJobResult
  >({
    key: "field.bootstrap-initial",
    description:
      "Run the ordered initial bootstrap for a newly created intake field.",
    async samplePayload(context: WorkerJobContext) {
      const target = await context.resolveDefaultFieldTarget();
      return {
        ...target,
        dryRun: true,
      };
    },
    async run(context, payload, execution) {
      return runIntakeFieldOnboardingJob({
        context,
        payload,
        execution,
        mode: "bootstrap-initial",
        includeProbe: true,
      });
    },
  }),
  createRegisteredJob<
    WorkerJobContext,
    IntakeFieldOnboardingJobInput,
    IntakeFieldOnboardingJobResult
  >({
    key: "field.refresh-intake",
    description:
      "Run the ordered intake refresh for a reused field matched during add-field intake.",
    async samplePayload(context: WorkerJobContext) {
      const target = await context.resolveDefaultFieldTarget();
      return {
        ...target,
        dryRun: true,
      };
    },
    async run(context, payload, execution) {
      return runIntakeFieldOnboardingJob({
        context,
        payload,
        execution,
        mode: "refresh-intake",
        includeProbe: false,
      });
    },
  }),
  createRegisteredJob<
    WorkerJobContext,
    ProbeFieldImageryProvidersInput,
    RecordFieldImageryProviderProbeResult
  >({
    key: "imagery.record-provider-probe",
    description: "Probe and persist current imagery provider availability for a field.",
    async samplePayload(context: WorkerJobContext) {
      const target = await context.resolveDefaultFieldTarget();
      return {
        ...target,
      };
    },
    async run(context: WorkerJobContext, payload, execution) {
      const requestedAt = payload.requestedAt ?? new Date().toISOString();
      let state: { result: RecordFieldImageryProviderProbeResult | null };

      try {
        state = await runJobPhases(execution, {
          initialState: {
            result: null as RecordFieldImageryProviderProbeResult | null,
          },
          phases: [
            {
              key: "validate-request",
              progressPct: 10,
              progressMessage: "validating provider probe request",
              run(currentState) {
                return currentState;
              },
            },
            {
              key: "record-probes",
              progressPct: 70,
              progressMessage: "recording imagery provider probes",
              async run(currentState) {
                return {
                  ...currentState,
                  result: {
                    workspaceId: payload.workspaceId,
                    fieldId: payload.fieldId,
                    requestedAt,
                    records:
                      await context.runtime.services.imagery.recordProviderProbeForField({
                        workspaceId: payload.workspaceId,
                        fieldId: payload.fieldId,
                        requestedAt,
                      }),
                  },
                };
              },
            },
            {
              key: "finalize-result",
              progressPct: 90,
              progressMessage: "finalizing imagery provider probe result",
              run(currentState) {
                return currentState;
              },
            },
          ],
        });
      } catch (error) {
        if (isMissingFieldRuntimeError(error, payload)) {
          logSkippedDeletedFieldJob({
            context,
            jobKey: "imagery.record-provider-probe",
            payload,
          });

          return {
            workspaceId: payload.workspaceId,
            fieldId: payload.fieldId,
            requestedAt,
            records: [],
          };
        }

        throw error;
      }

      if (!state.result) {
        throw new Error("[worker] imagery provider probe job completed without a result");
      }

      return state.result;
    },
  }),
  createRegisteredJob<
    WorkerJobContext,
    ScheduleWorkspaceImageryProviderProbesInput,
    ScheduleWorkspaceImageryProviderProbesResult
  >({
    key: "imagery.schedule-workspace-provider-probes",
    description:
      "Enumerate workspace fields and enqueue one provider probe job per field.",
    async samplePayload(context: WorkerJobContext) {
      const target = await context.resolveDefaultFieldTarget();
      return {
        workspaceId: target.workspaceId,
        limit: 1,
      };
    },
    async run(context: WorkerJobContext, payload, execution) {
      const requestedAt = payload.requestedAt ?? new Date().toISOString();
      const overview = await context.runtime.services.catalog.loadWorkspaceFieldOverview({
        preferredWorkspaceId: payload.workspaceId,
      });

      if (!overview.selectedWorkspace || overview.selectedWorkspace.id !== payload.workspaceId) {
        throw new Error(
          `[worker] workspace ${payload.workspaceId} could not be resolved for probe scheduling`,
        );
      }

      const selectedFields = payload.fieldIds?.length
        ? overview.fields.filter((field) => payload.fieldIds!.includes(field.id))
        : overview.fields;
      const fields = payload.limit
        ? selectedFields.slice(0, Math.max(0, payload.limit))
        : selectedFields;
      const queuedDispatchIds: string[] = [];

      await execution.reportProgress({
        progressPct: 10,
        progressMessage: "loaded workspace fields for provider probe scheduling",
        phaseKey: "load-workspace-fields",
        phaseLabel: "load workspace fields",
      });

      if (fields.length === 0) {
        await execution.reportProgress({
          progressPct: 100,
          progressMessage: "no workspace fields matched provider probe schedule",
          phaseKey: null,
          phaseLabel: null,
        });

        return {
          workspaceId: payload.workspaceId,
          requestedAt,
          fieldCount: 0,
          queuedCount: 0,
          queuedDispatchIds,
        };
      }

      queuedDispatchIds.push(
        ...await enqueueWorkspaceFieldJobs({
          execution,
          fields,
          phaseKey: "enqueue-field-probes",
          phaseLabel: "enqueue field probes",
          progressMessage: (completedCount, totalCount) =>
            `queued provider probe ${completedCount} of ${totalCount}`,
          enqueue: (field) =>
            context.enqueueJob({
              key: "imagery.record-provider-probe",
              payload: {
                workspaceId: payload.workspaceId,
                fieldId: field.id,
                requestedAt,
              },
            }),
        }),
      );

      await execution.reportProgress({
        progressPct: 100,
        progressMessage: "workspace provider probes scheduled",
        phaseKey: null,
        phaseLabel: null,
      });

      return {
        workspaceId: payload.workspaceId,
        requestedAt,
        fieldCount: selectedFields.length,
        queuedCount: fields.length,
        queuedDispatchIds,
      };
    },
  }),
  createRegisteredJob<
    WorkerJobContext,
    ScheduleWorkspaceImagerySyncInput,
    ScheduleWorkspaceImagerySyncResult
  >({
    key: "imagery.schedule-workspace-sync",
    description: "Enumerate workspace fields and enqueue one imagery sync job per field.",
    async samplePayload(context: WorkerJobContext) {
      const target = await context.resolveDefaultFieldTarget();
      return {
        workspaceId: target.workspaceId,
        limit: 1,
        dryRun: true,
      };
    },
    async run(context: WorkerJobContext, payload, execution) {
      const requestedAt = payload.requestedAt ?? new Date().toISOString();
      const overview = await context.runtime.services.catalog.loadWorkspaceFieldOverview({
        preferredWorkspaceId: payload.workspaceId,
      });

      if (!overview.selectedWorkspace || overview.selectedWorkspace.id !== payload.workspaceId) {
        throw new Error(
          `[worker] workspace ${payload.workspaceId} could not be resolved for imagery sync scheduling`,
        );
      }

      const selectedFields = payload.fieldIds?.length
        ? overview.fields.filter((field) => payload.fieldIds!.includes(field.id))
        : overview.fields;
      const fields = payload.limit
        ? selectedFields.slice(0, Math.max(0, payload.limit))
        : selectedFields;
      const queuedDispatchIds: string[] = [];

      await execution.reportProgress({
        progressPct: 10,
        progressMessage: "loaded workspace fields for imagery sync scheduling",
        phaseKey: "load-workspace-fields",
        phaseLabel: "load workspace fields",
      });

      if (fields.length === 0) {
        await execution.reportProgress({
          progressPct: 100,
          progressMessage: "no workspace fields matched imagery sync schedule",
          phaseKey: null,
          phaseLabel: null,
        });

        return {
          workspaceId: payload.workspaceId,
          requestedAt,
          fieldCount: 0,
          queuedCount: 0,
          queuedDispatchIds,
        };
      }

      queuedDispatchIds.push(
        ...await enqueueWorkspaceFieldJobs({
          execution,
          fields,
          phaseKey: "enqueue-field-syncs",
          phaseLabel: "enqueue field syncs",
          progressMessage: (completedCount, totalCount) =>
            `queued imagery sync ${completedCount} of ${totalCount}`,
          enqueue: (field) =>
            context.enqueueJob({
              key: "imagery.sync-latest",
              payload: {
                workspaceId: payload.workspaceId,
                fieldId: field.id,
                requestedAt,
                providers: payload.providers,
                dryRun: payload.dryRun,
              },
            }),
        }),
      );

      await execution.reportProgress({
        progressPct: 100,
        progressMessage: "workspace imagery sync scheduled",
        phaseKey: null,
        phaseLabel: null,
      });

      return {
        workspaceId: payload.workspaceId,
        requestedAt,
        fieldCount: selectedFields.length,
        queuedCount: fields.length,
        queuedDispatchIds,
      };
    },
  }),
  createRegisteredJob<WorkerJobContext, SyncLatestFieldImageryInput, unknown>({
    key: "imagery.sync-latest",
    description: "Discover and materialize the latest imagery assets for a field.",
    async samplePayload(context: WorkerJobContext) {
      const target = await context.resolveDefaultFieldTarget();
      return {
        ...target,
        dryRun: true,
      };
    },
    async run(context: WorkerJobContext, payload, execution) {
      let state: {
        result: Awaited<
          ReturnType<WorkerJobContext["runtime"]["services"]["imagery"]["syncLatestFieldImagery"]>
        > | null;
      };

      try {
        state = await runJobPhases(execution, {
          initialState: {
            result: null as Awaited<
              ReturnType<WorkerJobContext["runtime"]["services"]["imagery"]["syncLatestFieldImagery"]>
            > | null,
          },
          phases: [
            {
              key: "validate-request",
              progressPct: 10,
              progressMessage: "validating imagery sync request",
              run(currentState) {
                return currentState;
              },
            },
            {
              key: "sync-imagery",
              progressPct: 70,
              progressMessage: "syncing imagery for field",
              async run(currentState) {
                return {
                  ...currentState,
                  result: await context.runtime.services.imagery.syncLatestFieldImagery(
                    payload,
                  ),
                };
              },
            },
            {
              key: "finalize-result",
              progressPct: 90,
              progressMessage: "finalizing imagery sync result",
              run(currentState) {
                return currentState;
              },
            },
          ],
        });
      } catch (error) {
        if (isMissingFieldRuntimeError(error, payload)) {
          logSkippedDeletedFieldJob({
            context,
            jobKey: "imagery.sync-latest",
            payload,
          });
          return null;
        }

        throw error;
      }

      if (!state.result) {
        throw new Error("[worker] imagery job completed without a result");
      }

      return state.result;
    },
  }),
  createRegisteredJob<WorkerJobContext, RefreshMarketPricesInput, unknown>({
    key: "market.refresh-prices",
    description:
      "Fetch and persist the latest supported market quotes for configured crop symbols.",
    async samplePayload() {
      return {
        cropSymbols: ["CANOLA", "WHEAT", "CORN", "RYE", "SOYBEAN"],
        dryRun: true,
      };
    },
    async run(context: WorkerJobContext, payload, execution) {
      const requestedAt = payload.requestedAt ?? new Date().toISOString();
      const state = await runJobPhases(execution, {
        initialState: {
          result: null as Awaited<ReturnType<typeof refreshMarketQuotes>> | null,
        },
        phases: [
          {
            key: "validate-request",
            progressPct: 10,
            progressMessage: "validating market refresh request",
            run(currentState) {
              return currentState;
            },
          },
          {
            key: "fetch-and-upsert-prices",
            progressPct: 75,
            progressMessage: "refreshing market prices",
            async run(currentState) {
              return {
                ...currentState,
                result: await refreshMarketQuotes({
                  runtime: context.runtime,
                  requestedAt,
                  cropSymbols: payload.cropSymbols,
                  dryRun: payload.dryRun,
                }),
              };
            },
          },
          {
            key: "finalize-result",
            progressPct: 95,
            progressMessage: "finalizing market refresh result",
            run(currentState) {
              return currentState;
            },
          },
        ],
      });

      if (!state.result) {
        throw new Error("[worker] market refresh job completed without a result");
      }

      return state.result;
    },
  }),
  createRegisteredJob<WorkerJobContext, RefreshFieldWeatherInput, unknown>({
    key: "weather.refresh-field",
    description: "Fetch and persist field weather observations and forecasts.",
    async samplePayload(context: WorkerJobContext) {
      const target = await context.resolveDefaultFieldTarget();
      return {
        ...target,
        forecastHours: 48,
      };
    },
    async run(context: WorkerJobContext, payload, execution) {
      const state = await runJobPhases(execution, {
        initialState: {
          result: null as Awaited<
            ReturnType<WorkerJobContext["runtime"]["services"]["weather"]["refreshFieldWeather"]>
          > | null,
        },
        phases: [
          {
            key: "validate-request",
            progressPct: 10,
            progressMessage: "validating weather refresh request",
            run(currentState) {
              return currentState;
            },
          },
          {
            key: "refresh-weather",
            progressPct: 70,
            progressMessage: "refreshing field weather",
            async run(currentState) {
              return {
                ...currentState,
                result: await context.runtime.services.weather.refreshFieldWeather(
                  payload,
                ),
              };
            },
          },
          {
            key: "finalize-result",
            progressPct: 90,
            progressMessage: "finalizing weather refresh result",
            run(currentState) {
              return currentState;
            },
          },
        ],
      });

      if (!state.result) {
        throw new Error("[worker] weather refresh job completed without a result");
      }

      return state.result;
    },
  }),
  createRegisteredJob<WorkerJobContext, RefreshFieldHailInput, RefreshFieldHailJobResult>({
    key: "hail.refresh-field",
    description:
      "Fetch and persist provider-backed hail events for a field, then generate hail-risk findings.",
    async samplePayload(context: WorkerJobContext) {
      const target = await context.resolveDefaultFieldTarget();
      return {
        ...target,
        limit: 25,
      };
    },
    async run(context: WorkerJobContext, payload, execution) {
      const state = await runJobPhases(execution, {
        initialState: {
          result: null as RefreshFieldHailJobResult | null,
        },
        phases: [
          {
            key: "validate-request",
            progressPct: 10,
            progressMessage: "validating hail refresh request",
            run(currentState) {
              return currentState;
            },
          },
          {
            key: "refresh-hail-events",
            progressPct: 55,
            progressMessage: "refreshing field hail events",
            async run(currentState) {
              const hail = await context.runtime.services.hail.refreshFieldEvents(
                payload,
              );

              return {
                ...currentState,
                result: {
                  hail,
                  intelligence: null,
                },
              };
            },
          },
          {
            key: "generate-findings",
            progressPct: 80,
            progressMessage: "generating hail-risk findings from refreshed events",
            async run(currentState) {
              if (!currentState.result) {
                throw new Error("[worker] hail refresh completed without a result");
              }

              if (currentState.result.hail.events.length === 0) {
                return currentState;
              }

              const earliestReportedAt = currentState.result.hail.events.reduce(
                (earliest, event) =>
                  event.reportedAt < earliest ? event.reportedAt : earliest,
                currentState.result.hail.events[0].reportedAt,
              );

              return {
                ...currentState,
                result: {
                  ...currentState.result,
                  intelligence:
                    await context.runtime.services.intelligence.generateHailRiskFindings(
                      {
                        workspaceId: payload.workspaceId,
                        fieldId: payload.fieldId,
                        requestedAt:
                          payload.requestedAt ?? currentState.result.hail.requestedAt,
                        reportedAfter: earliestReportedAt,
                        limit: currentState.result.hail.events.length,
                      },
                    ),
                },
              };
            },
          },
          {
            key: "finalize-result",
            progressPct: 95,
            progressMessage: "finalizing hail refresh result",
            run(currentState) {
              return currentState;
            },
          },
        ],
      });

      if (!state.result) {
        throw new Error("[worker] hail refresh job completed without a result");
      }

      return state.result;
    },
  }),
  createRegisteredJob<WorkerJobContext, GenerateFieldHailRiskFindingsInput, unknown>({
    key: "intelligence.generate-hail-risk",
    description:
      "Generate hail-risk intelligence findings from stored hail events and sync alerts.",
    async samplePayload(context: WorkerJobContext) {
      const target = await context.resolveDefaultFieldTarget();
      return {
        ...target,
        limit: 10,
      };
    },
    async run(context: WorkerJobContext, payload, execution) {
      const state = await runJobPhases(execution, {
        initialState: {
          result: null as Awaited<
            ReturnType<
              WorkerJobContext["runtime"]["services"]["intelligence"]["generateHailRiskFindings"]
            >
          > | null,
        },
        phases: [
          {
            key: "validate-request",
            progressPct: 10,
            progressMessage: "validating hail intelligence request",
            run(currentState) {
              return currentState;
            },
          },
          {
            key: "generate-findings",
            progressPct: 70,
            progressMessage: "generating hail-risk findings",
            async run(currentState) {
              return {
                ...currentState,
                result:
                  await context.runtime.services.intelligence.generateHailRiskFindings(
                    payload,
                  ),
                };
              },
            },
          {
            key: "curate-field-action",
            progressPct: 82,
            progressMessage: "curating field action summary",
            async run(currentState) {
              await context.runtime.services.intelligence.curateFieldAction({
                workspaceId: payload.workspaceId,
                fieldId: payload.fieldId,
                requestedAt: payload.requestedAt,
              });

              return currentState;
            },
          },
          {
            key: "finalize-result",
            progressPct: 90,
            progressMessage: "finalizing hail intelligence result",
            run(currentState) {
              return currentState;
            },
          },
        ],
      });

      if (!state.result) {
        throw new Error("[worker] hail intelligence job completed without a result");
      }

      return state.result;
    },
  }),
  createRegisteredJob<
    WorkerJobContext,
    GenerateFieldMoistureStressFindingsInput,
    {
      weatherSignals: Awaited<
        ReturnType<
          WorkerJobContext["runtime"]["services"]["weather"]["computeFieldDerivedSignals"]
        >
      >;
      intelligence: Awaited<
        ReturnType<
          WorkerJobContext["runtime"]["services"]["intelligence"]["generateMoistureStressFindings"]
        >
      >;
    }
  >({
    key: "intelligence.generate-moisture-stress",
    description:
      "Materialize weather-derived signals, then generate moisture-stress findings and synced alerts.",
    async samplePayload(context: WorkerJobContext) {
      const target = await context.resolveDefaultFieldTarget();
      return {
        ...target,
      };
    },
    async run(context: WorkerJobContext, payload, execution) {
      const state = await runJobPhases(execution, {
        initialState: {
          weatherSignals: null as Awaited<
            ReturnType<
              WorkerJobContext["runtime"]["services"]["weather"]["computeFieldDerivedSignals"]
            >
          > | null,
          intelligence: null as Awaited<
            ReturnType<
              WorkerJobContext["runtime"]["services"]["intelligence"]["generateMoistureStressFindings"]
            >
          > | null,
        },
        phases: [
          {
            key: "validate-request",
            progressPct: 10,
            progressMessage: "validating moisture stress intelligence request",
            run(currentState) {
              return currentState;
            },
          },
          {
            key: "compute-weather-signals",
            progressPct: 40,
            progressMessage: "computing weather-derived stress signals",
            async run(currentState) {
              return {
                ...currentState,
                weatherSignals:
                  await context.runtime.services.weather.computeFieldDerivedSignals({
                    workspaceId: payload.workspaceId,
                    fieldId: payload.fieldId,
                  }),
              };
            },
          },
          {
            key: "generate-findings",
            progressPct: 75,
            progressMessage: "generating moisture stress findings",
            async run(currentState) {
              return {
                ...currentState,
                intelligence:
                  await context.runtime.services.intelligence.generateMoistureStressFindings(
                    payload,
                  ),
                };
              },
            },
          {
            key: "curate-field-action",
            progressPct: 86,
            progressMessage: "curating field action summary",
            async run(currentState) {
              await context.runtime.services.intelligence.curateFieldAction({
                workspaceId: payload.workspaceId,
                fieldId: payload.fieldId,
                requestedAt: payload.requestedAt,
              });

              return currentState;
            },
          },
          {
            key: "finalize-result",
            progressPct: 95,
            progressMessage: "finalizing moisture stress intelligence result",
            run(currentState) {
              return currentState;
            },
          },
        ],
      });

      if (!state.intelligence) {
        throw new Error(
          "[worker] moisture stress intelligence job completed without a result",
        );
      }

      return {
        weatherSignals: state.weatherSignals,
        intelligence: state.intelligence,
      };
    },
  }),
  createRegisteredJob<
    WorkerJobContext,
    GenerateFieldWeatherRiskFindingsInput,
    {
      weatherSignals: Awaited<
        ReturnType<
          WorkerJobContext["runtime"]["services"]["weather"]["computeFieldDerivedSignals"]
        >
      >;
      intelligence: Awaited<
        ReturnType<
          WorkerJobContext["runtime"]["services"]["intelligence"]["generateWeatherRiskFindings"]
        >
      >;
    }
  >({
    key: "intelligence.generate-weather-risk",
    description:
      "Materialize weather-derived signals, then generate weather-risk findings and synced alerts.",
    async samplePayload(context: WorkerJobContext) {
      const target = await context.resolveDefaultFieldTarget();
      return {
        ...target,
      };
    },
    async run(context: WorkerJobContext, payload, execution) {
      const state = await runJobPhases(execution, {
        initialState: {
          weatherSignals: null as Awaited<
            ReturnType<
              WorkerJobContext["runtime"]["services"]["weather"]["computeFieldDerivedSignals"]
            >
          > | null,
          intelligence: null as Awaited<
            ReturnType<
              WorkerJobContext["runtime"]["services"]["intelligence"]["generateWeatherRiskFindings"]
            >
          > | null,
        },
        phases: [
          {
            key: "validate-request",
            progressPct: 10,
            progressMessage: "validating weather risk intelligence request",
            run(currentState) {
              return currentState;
            },
          },
          {
            key: "compute-weather-signals",
            progressPct: 40,
            progressMessage: "computing weather-derived risk signals",
            async run(currentState) {
              return {
                ...currentState,
                weatherSignals:
                  await context.runtime.services.weather.computeFieldDerivedSignals({
                    workspaceId: payload.workspaceId,
                    fieldId: payload.fieldId,
                  }),
              };
            },
          },
          {
            key: "generate-findings",
            progressPct: 75,
            progressMessage: "generating weather risk findings",
            async run(currentState) {
              return {
                ...currentState,
                intelligence:
                  await context.runtime.services.intelligence.generateWeatherRiskFindings(
                    payload,
                  ),
                };
              },
            },
          {
            key: "curate-field-action",
            progressPct: 86,
            progressMessage: "curating field action summary",
            async run(currentState) {
              await context.runtime.services.intelligence.curateFieldAction({
                workspaceId: payload.workspaceId,
                fieldId: payload.fieldId,
                requestedAt: payload.requestedAt,
              });

              return currentState;
            },
          },
          {
            key: "finalize-result",
            progressPct: 95,
            progressMessage: "finalizing weather risk intelligence result",
            run(currentState) {
              return currentState;
            },
          },
        ],
      });

      if (!state.intelligence) {
        throw new Error(
          "[worker] weather risk intelligence job completed without a result",
        );
      }

      return {
        weatherSignals: state.weatherSignals,
        intelligence: state.intelligence,
      };
    },
  }),
  createRegisteredJob<
    WorkerJobContext,
    ScheduleWorkspaceMoistureStressInput,
    ScheduleWorkspaceMoistureStressResult
  >({
    key: "intelligence.schedule-workspace-moisture-stress",
    description:
      "Enumerate workspace fields and enqueue one moisture-stress generation job per field.",
    async samplePayload(context: WorkerJobContext) {
      const target = await context.resolveDefaultFieldTarget();
      return {
        workspaceId: target.workspaceId,
        limit: 1,
      };
    },
    async run(context: WorkerJobContext, payload, execution) {
      const requestedAt = payload.requestedAt ?? new Date().toISOString();
      const overview = await context.runtime.services.catalog.loadWorkspaceFieldOverview({
        preferredWorkspaceId: payload.workspaceId,
      });

      if (!overview.selectedWorkspace || overview.selectedWorkspace.id !== payload.workspaceId) {
        throw new Error(
          `[worker] workspace ${payload.workspaceId} could not be resolved for moisture stress scheduling`,
        );
      }

      const selectedFields = payload.fieldIds?.length
        ? overview.fields.filter((field) => payload.fieldIds!.includes(field.id))
        : overview.fields;
      const fields = payload.limit
        ? selectedFields.slice(0, Math.max(0, payload.limit))
        : selectedFields;
      const queuedDispatchIds: string[] = [];

      await execution.reportProgress({
        progressPct: 10,
        progressMessage: "loaded workspace fields for moisture stress scheduling",
        phaseKey: "load-workspace-fields",
        phaseLabel: "load workspace fields",
      });

      if (fields.length === 0) {
        await execution.reportProgress({
          progressPct: 100,
          progressMessage: "no workspace fields matched moisture stress schedule",
          phaseKey: null,
          phaseLabel: null,
        });

        return {
          workspaceId: payload.workspaceId,
          requestedAt,
          fieldCount: 0,
          queuedCount: 0,
          queuedDispatchIds,
        };
      }

      queuedDispatchIds.push(
        ...await enqueueWorkspaceFieldJobs({
          execution,
          fields,
          phaseKey: "enqueue-field-moisture-stress",
          phaseLabel: "enqueue field moisture stress generation",
          progressMessage: (completedCount, totalCount) =>
            `queued moisture stress generation ${completedCount} of ${totalCount}`,
          enqueue: (field) =>
            context.enqueueJob({
              key: "intelligence.generate-moisture-stress",
              payload: {
                workspaceId: payload.workspaceId,
                fieldId: field.id,
                requestedAt,
              },
            }),
        }),
      );

      await execution.reportProgress({
        progressPct: 100,
        progressMessage: "workspace moisture stress generation jobs scheduled",
        phaseKey: null,
        phaseLabel: null,
      });

      return {
        workspaceId: payload.workspaceId,
        requestedAt,
        fieldCount: selectedFields.length,
        queuedCount: fields.length,
        queuedDispatchIds,
      };
    },
  }),
  createRegisteredJob<
    WorkerJobContext,
    ScheduleWorkspaceWeatherRiskInput,
    ScheduleWorkspaceWeatherRiskResult
  >({
    key: "intelligence.schedule-workspace-weather-risk",
    description:
      "Enumerate workspace fields and enqueue one weather-risk generation job per field.",
    async samplePayload(context: WorkerJobContext) {
      const target = await context.resolveDefaultFieldTarget();
      return {
        workspaceId: target.workspaceId,
        limit: 1,
      };
    },
    async run(context: WorkerJobContext, payload, execution) {
      const requestedAt = payload.requestedAt ?? new Date().toISOString();
      const overview = await context.runtime.services.catalog.loadWorkspaceFieldOverview({
        preferredWorkspaceId: payload.workspaceId,
      });

      if (!overview.selectedWorkspace || overview.selectedWorkspace.id !== payload.workspaceId) {
        throw new Error(
          `[worker] workspace ${payload.workspaceId} could not be resolved for weather risk scheduling`,
        );
      }

      const selectedFields = payload.fieldIds?.length
        ? overview.fields.filter((field) => payload.fieldIds!.includes(field.id))
        : overview.fields;
      const fields = payload.limit
        ? selectedFields.slice(0, Math.max(0, payload.limit))
        : selectedFields;
      const queuedDispatchIds: string[] = [];

      await execution.reportProgress({
        progressPct: 10,
        progressMessage: "loaded workspace fields for weather risk scheduling",
        phaseKey: "load-workspace-fields",
        phaseLabel: "load workspace fields",
      });

      if (fields.length === 0) {
        await execution.reportProgress({
          progressPct: 100,
          progressMessage: "no workspace fields matched weather risk schedule",
          phaseKey: null,
          phaseLabel: null,
        });

        return {
          workspaceId: payload.workspaceId,
          requestedAt,
          fieldCount: 0,
          queuedCount: 0,
          queuedDispatchIds,
        };
      }

      queuedDispatchIds.push(
        ...await enqueueWorkspaceFieldJobs({
          execution,
          fields,
          phaseKey: "enqueue-field-weather-risk",
          phaseLabel: "enqueue field weather risk generation",
          progressMessage: (completedCount, totalCount) =>
            `queued weather risk generation ${completedCount} of ${totalCount}`,
          enqueue: (field) =>
            context.enqueueJob({
              key: "intelligence.generate-weather-risk",
              payload: {
                workspaceId: payload.workspaceId,
                fieldId: field.id,
                requestedAt,
              },
            }),
        }),
      );

      await execution.reportProgress({
        progressPct: 100,
        progressMessage: "workspace weather risk generation jobs scheduled",
        phaseKey: null,
        phaseLabel: null,
      });

      return {
        workspaceId: payload.workspaceId,
        requestedAt,
        fieldCount: selectedFields.length,
        queuedCount: fields.length,
        queuedDispatchIds,
      };
    },
  }),
  createRegisteredJob<
    WorkerJobContext,
    GenerateFieldDiseaseRiskFindingsInput,
    {
      weatherSignals: Awaited<
        ReturnType<
          WorkerJobContext["runtime"]["services"]["weather"]["computeFieldDerivedSignals"]
        >
      >;
      intelligence: Awaited<
        ReturnType<
          WorkerJobContext["runtime"]["services"]["intelligence"]["generateDiseaseRiskFindings"]
        >
      >;
    }
  >({
    key: "intelligence.generate-disease-risk",
    description:
      "Materialize weather-derived signals, then generate stage-aware disease-risk findings and synced alerts.",
    async samplePayload(context: WorkerJobContext) {
      const target = await context.resolveDefaultFieldTarget();
      return {
        ...target,
      };
    },
    async run(context: WorkerJobContext, payload, execution) {
      const state = await runJobPhases(execution, {
        initialState: {
          weatherSignals: null as Awaited<
            ReturnType<
              WorkerJobContext["runtime"]["services"]["weather"]["computeFieldDerivedSignals"]
            >
          > | null,
          intelligence: null as Awaited<
            ReturnType<
              WorkerJobContext["runtime"]["services"]["intelligence"]["generateDiseaseRiskFindings"]
            >
          > | null,
        },
        phases: [
          {
            key: "validate-request",
            progressPct: 10,
            progressMessage: "validating disease risk intelligence request",
            run(currentState) {
              return currentState;
            },
          },
          {
            key: "compute-weather-signals",
            progressPct: 40,
            progressMessage: "computing weather-derived disease signals",
            async run(currentState) {
              return {
                ...currentState,
                weatherSignals:
                  await context.runtime.services.weather.computeFieldDerivedSignals({
                    workspaceId: payload.workspaceId,
                    fieldId: payload.fieldId,
                  }),
              };
            },
          },
          {
            key: "generate-findings",
            progressPct: 75,
            progressMessage: "generating disease risk findings",
            async run(currentState) {
              return {
                ...currentState,
                intelligence:
                  await context.runtime.services.intelligence.generateDiseaseRiskFindings(
                    payload,
                  ),
                };
              },
            },
          {
            key: "curate-field-action",
            progressPct: 86,
            progressMessage: "curating field action summary",
            async run(currentState) {
              await context.runtime.services.intelligence.curateFieldAction({
                workspaceId: payload.workspaceId,
                fieldId: payload.fieldId,
                requestedAt: payload.requestedAt,
              });

              return currentState;
            },
          },
          {
            key: "finalize-result",
            progressPct: 95,
            progressMessage: "finalizing disease risk intelligence result",
            run(currentState) {
              return currentState;
            },
          },
        ],
      });

      if (!state.intelligence) {
        throw new Error(
          "[worker] disease risk intelligence job completed without a result",
        );
      }

      return {
        weatherSignals: state.weatherSignals,
        intelligence: state.intelligence,
      };
    },
  }),
  createRegisteredJob<
    WorkerJobContext,
    ScheduleWorkspaceDiseaseRiskInput,
    ScheduleWorkspaceDiseaseRiskResult
  >({
    key: "intelligence.schedule-workspace-disease-risk",
    description:
      "Enumerate workspace fields and enqueue one disease-risk generation job per field.",
    async samplePayload(context: WorkerJobContext) {
      const target = await context.resolveDefaultFieldTarget();
      return {
        workspaceId: target.workspaceId,
        limit: 1,
      };
    },
    async run(context: WorkerJobContext, payload, execution) {
      const requestedAt = payload.requestedAt ?? new Date().toISOString();
      const overview = await context.runtime.services.catalog.loadWorkspaceFieldOverview({
        preferredWorkspaceId: payload.workspaceId,
      });

      if (!overview.selectedWorkspace || overview.selectedWorkspace.id !== payload.workspaceId) {
        throw new Error(
          `[worker] workspace ${payload.workspaceId} could not be resolved for disease risk scheduling`,
        );
      }

      const selectedFields = payload.fieldIds?.length
        ? overview.fields.filter((field) => payload.fieldIds!.includes(field.id))
        : overview.fields;
      const fields = payload.limit
        ? selectedFields.slice(0, Math.max(0, payload.limit))
        : selectedFields;
      const queuedDispatchIds: string[] = [];

      await execution.reportProgress({
        progressPct: 10,
        progressMessage: "loaded workspace fields for disease risk scheduling",
        phaseKey: "load-workspace-fields",
        phaseLabel: "load workspace fields",
      });

      if (fields.length === 0) {
        await execution.reportProgress({
          progressPct: 100,
          progressMessage: "no workspace fields matched disease risk schedule",
          phaseKey: null,
          phaseLabel: null,
        });

        return {
          workspaceId: payload.workspaceId,
          requestedAt,
          fieldCount: 0,
          queuedCount: 0,
          queuedDispatchIds,
        };
      }

      queuedDispatchIds.push(
        ...await enqueueWorkspaceFieldJobs({
          execution,
          fields,
          phaseKey: "enqueue-field-disease-risk",
          phaseLabel: "enqueue field disease risk generation",
          progressMessage: (completedCount, totalCount) =>
            `queued disease risk generation ${completedCount} of ${totalCount}`,
          enqueue: (field) =>
            context.enqueueJob({
              key: "intelligence.generate-disease-risk",
              payload: {
                workspaceId: payload.workspaceId,
                fieldId: field.id,
                requestedAt,
              },
            }),
        }),
      );

      await execution.reportProgress({
        progressPct: 100,
        progressMessage: "workspace disease risk generation jobs scheduled",
        phaseKey: null,
        phaseLabel: null,
      });

      return {
        workspaceId: payload.workspaceId,
        requestedAt,
        fieldCount: selectedFields.length,
        queuedCount: fields.length,
        queuedDispatchIds,
      };
    },
  }),
  createRegisteredJob<
    WorkerJobContext,
    ScheduleWorkspaceHailRefreshInput,
    ScheduleWorkspaceHailRefreshResult
  >({
    key: "hail.schedule-workspace-refresh",
    description:
      "Enumerate workspace fields and enqueue one hail refresh job per field.",
    async samplePayload(context: WorkerJobContext) {
      const target = await context.resolveDefaultFieldTarget();
      return {
        workspaceId: target.workspaceId,
        limit: 1,
      };
    },
    async run(context: WorkerJobContext, payload, execution) {
      const requestedAt = payload.requestedAt ?? new Date().toISOString();
      const overview = await context.runtime.services.catalog.loadWorkspaceFieldOverview({
        preferredWorkspaceId: payload.workspaceId,
      });

      if (!overview.selectedWorkspace || overview.selectedWorkspace.id !== payload.workspaceId) {
        throw new Error(
          `[worker] workspace ${payload.workspaceId} could not be resolved for hail refresh scheduling`,
        );
      }

      const selectedFields = payload.fieldIds?.length
        ? overview.fields.filter((field) => payload.fieldIds!.includes(field.id))
        : overview.fields;
      const fields = payload.limit
        ? selectedFields.slice(0, Math.max(0, payload.limit))
        : selectedFields;
      const queuedDispatchIds: string[] = [];

      await execution.reportProgress({
        progressPct: 10,
        progressMessage: "loaded workspace fields for hail refresh scheduling",
        phaseKey: "load-workspace-fields",
        phaseLabel: "load workspace fields",
      });

      if (fields.length === 0) {
        await execution.reportProgress({
          progressPct: 100,
          progressMessage: "no workspace fields matched hail refresh schedule",
          phaseKey: null,
          phaseLabel: null,
        });

        return {
          workspaceId: payload.workspaceId,
          requestedAt,
          fieldCount: 0,
          queuedCount: 0,
          queuedDispatchIds,
        };
      }

      queuedDispatchIds.push(
        ...await enqueueWorkspaceFieldJobs({
          execution,
          fields,
          phaseKey: "enqueue-field-refreshes",
          phaseLabel: "enqueue field refreshes",
          progressMessage: (completedCount, totalCount) =>
            `queued hail refresh ${completedCount} of ${totalCount}`,
          enqueue: (field) =>
            context.enqueueJob({
              key: "hail.refresh-field",
              payload: {
                workspaceId: payload.workspaceId,
                fieldId: field.id,
                requestedAt,
              },
            }),
        }),
      );

      await execution.reportProgress({
        progressPct: 100,
        progressMessage: "workspace hail refresh scheduled",
        phaseKey: null,
        phaseLabel: null,
      });

      return {
        workspaceId: payload.workspaceId,
        requestedAt,
        fieldCount: selectedFields.length,
        queuedCount: fields.length,
        queuedDispatchIds,
      };
    },
  }),
  createRegisteredJob<
    WorkerJobContext,
    ScheduleWorkspaceWeatherRefreshInput,
    ScheduleWorkspaceWeatherRefreshResult
  >({
    key: "weather.schedule-workspace-refresh",
    description:
      "Enumerate workspace fields and enqueue one weather refresh job per field.",
    async samplePayload(context: WorkerJobContext) {
      const target = await context.resolveDefaultFieldTarget();
      return {
        workspaceId: target.workspaceId,
        limit: 1,
        forecastHours: 48,
      };
    },
    async run(context: WorkerJobContext, payload, execution) {
      const requestedAt = payload.requestedAt ?? new Date().toISOString();
      const overview = await context.runtime.services.catalog.loadWorkspaceFieldOverview({
        preferredWorkspaceId: payload.workspaceId,
      });

      if (!overview.selectedWorkspace || overview.selectedWorkspace.id !== payload.workspaceId) {
        throw new Error(
          `[worker] workspace ${payload.workspaceId} could not be resolved for weather refresh scheduling`,
        );
      }

      const selectedFields = payload.fieldIds?.length
        ? overview.fields.filter((field) => payload.fieldIds!.includes(field.id))
        : overview.fields;
      const fields = payload.limit
        ? selectedFields.slice(0, Math.max(0, payload.limit))
        : selectedFields;
      const queuedDispatchIds: string[] = [];

      await execution.reportProgress({
        progressPct: 10,
        progressMessage: "loaded workspace fields for weather refresh scheduling",
        phaseKey: "load-workspace-fields",
        phaseLabel: "load workspace fields",
      });

      if (fields.length === 0) {
        await execution.reportProgress({
          progressPct: 100,
          progressMessage: "no workspace fields matched weather refresh schedule",
          phaseKey: null,
          phaseLabel: null,
        });

        return {
          workspaceId: payload.workspaceId,
          requestedAt,
          fieldCount: 0,
          queuedCount: 0,
          queuedDispatchIds,
        };
      }

      queuedDispatchIds.push(
        ...await enqueueWorkspaceFieldJobs({
          execution,
          fields,
          phaseKey: "enqueue-field-refreshes",
          phaseLabel: "enqueue field weather refreshes",
          progressMessage: (completedCount, totalCount) =>
            `queued weather refresh ${completedCount} of ${totalCount}`,
          enqueue: (field) =>
            context.enqueueJob({
              key: "weather.refresh-field",
              payload: {
                workspaceId: payload.workspaceId,
                fieldId: field.id,
                requestedAt,
                forecastHours: payload.forecastHours,
              },
            }),
        }),
      );

      await execution.reportProgress({
        progressPct: 100,
        progressMessage: "workspace weather refresh jobs scheduled",
        phaseKey: null,
        phaseLabel: null,
      });

      return {
        workspaceId: payload.workspaceId,
        requestedAt,
        fieldCount: selectedFields.length,
        queuedCount: fields.length,
        queuedDispatchIds,
      };
    },
  }),
  createRegisteredJob<
    WorkerJobContext,
    ScheduleWorkspaceMoistureEstimateRebuildInput,
    ScheduleWorkspaceMoistureEstimateRebuildResult
  >({
    key: "moisture.schedule-workspace-estimate-rebuild",
    description:
      "Enumerate workspace fields and enqueue one moisture estimate rebuild job per field.",
    async samplePayload(context: WorkerJobContext) {
      const target = await context.resolveDefaultFieldTarget();
      return {
        workspaceId: target.workspaceId,
        limit: 1,
      };
    },
    async run(context: WorkerJobContext, payload, execution) {
      const requestedAt = payload.requestedAt ?? new Date().toISOString();
      const overview = await context.runtime.services.catalog.loadWorkspaceFieldOverview({
        preferredWorkspaceId: payload.workspaceId,
      });

      if (!overview.selectedWorkspace || overview.selectedWorkspace.id !== payload.workspaceId) {
        throw new Error(
          `[worker] workspace ${payload.workspaceId} could not be resolved for moisture estimate scheduling`,
        );
      }

      const selectedFields = payload.fieldIds?.length
        ? overview.fields.filter((field) => payload.fieldIds!.includes(field.id))
        : overview.fields;
      const fields = payload.limit
        ? selectedFields.slice(0, Math.max(0, payload.limit))
        : selectedFields;
      const queuedDispatchIds: string[] = [];

      await execution.reportProgress({
        progressPct: 10,
        progressMessage: "loaded workspace fields for moisture estimate scheduling",
        phaseKey: "load-workspace-fields",
        phaseLabel: "load workspace fields",
      });

      if (fields.length === 0) {
        await execution.reportProgress({
          progressPct: 100,
          progressMessage: "no workspace fields matched moisture estimate schedule",
          phaseKey: null,
          phaseLabel: null,
        });

        return {
          workspaceId: payload.workspaceId,
          requestedAt,
          fieldCount: 0,
          queuedCount: 0,
          queuedDispatchIds,
        };
      }

      queuedDispatchIds.push(
        ...await enqueueWorkspaceFieldJobs({
          execution,
          fields,
          phaseKey: "enqueue-field-estimate-rebuilds",
          phaseLabel: "enqueue field moisture estimate rebuilds",
          progressMessage: (completedCount, totalCount) =>
            `queued moisture estimate rebuild ${completedCount} of ${totalCount}`,
          enqueue: (field) =>
            context.enqueueJob({
              key: "moisture.rebuild-field-estimate",
              payload: {
                workspaceId: payload.workspaceId,
                fieldId: field.id,
                observedAt: requestedAt,
              },
            }),
        }),
      );

      await execution.reportProgress({
        progressPct: 100,
        progressMessage: "workspace moisture estimate rebuild jobs scheduled",
        phaseKey: null,
        phaseLabel: null,
      });

      return {
        workspaceId: payload.workspaceId,
        requestedAt,
        fieldCount: selectedFields.length,
        queuedCount: fields.length,
        queuedDispatchIds,
      };
    },
  }),
  createRegisteredJob<
    WorkerJobContext,
    ScheduleWorkspaceMoistureCellBackfillInput,
    ScheduleWorkspaceMoistureCellBackfillResult
  >({
    key: "moisture.schedule-workspace-cell-backfill",
    description:
      "Enumerate workspace fields and enqueue one moisture cell rebuild job per field.",
    async samplePayload(context: WorkerJobContext) {
      const target = await context.resolveDefaultFieldTarget();
      return {
        workspaceId: target.workspaceId,
        limit: 1,
      };
    },
    async run(context: WorkerJobContext, payload, execution) {
      const requestedAt = payload.requestedAt ?? new Date().toISOString();
      const overview = await context.runtime.services.catalog.loadWorkspaceFieldOverview({
        preferredWorkspaceId: payload.workspaceId,
      });

      if (!overview.selectedWorkspace || overview.selectedWorkspace.id !== payload.workspaceId) {
        throw new Error(
          `[worker] workspace ${payload.workspaceId} could not be resolved for moisture cell backfill scheduling`,
        );
      }

      const selectedFields = payload.fieldIds?.length
        ? overview.fields.filter((field) => payload.fieldIds!.includes(field.id))
        : overview.fields;
      const fields = payload.limit
        ? selectedFields.slice(0, Math.max(0, payload.limit))
        : selectedFields;
      const queuedDispatchIds: string[] = [];

      await execution.reportProgress({
        progressPct: 10,
        progressMessage: "loaded workspace fields for moisture cell backfill scheduling",
        phaseKey: "load-workspace-fields",
        phaseLabel: "load workspace fields",
      });

      if (fields.length === 0) {
        await execution.reportProgress({
          progressPct: 100,
          progressMessage: "no workspace fields matched moisture cell backfill schedule",
          phaseKey: null,
          phaseLabel: null,
        });

        return {
          workspaceId: payload.workspaceId,
          requestedAt,
          fieldCount: 0,
          queuedCount: 0,
          queuedDispatchIds,
        };
      }

      queuedDispatchIds.push(
        ...await enqueueWorkspaceFieldJobs({
          execution,
          fields,
          phaseKey: "enqueue-field-backfills",
          phaseLabel: "enqueue field moisture cell backfills",
          progressMessage: (completedCount, totalCount) =>
            `queued moisture cell backfill ${completedCount} of ${totalCount}`,
          enqueue: (field) =>
            context.enqueueJob({
              key: "moisture.rebuild-field-cells",
              payload: {
                workspaceId: payload.workspaceId,
                fieldId: field.id,
              },
            }),
        }),
      );

      await execution.reportProgress({
        progressPct: 100,
        progressMessage: "workspace moisture cell backfill jobs scheduled",
        phaseKey: null,
        phaseLabel: null,
      });

      return {
        workspaceId: payload.workspaceId,
        requestedAt,
        fieldCount: selectedFields.length,
        queuedCount: fields.length,
        queuedDispatchIds,
      };
    },
  }),
  createRegisteredJob<WorkerJobContext, RebuildFieldEstimateInput, unknown>({
    key: "moisture.rebuild-field-estimate",
    description: "Recompute field and cell moisture estimates from the latest inputs.",
    async samplePayload(context: WorkerJobContext) {
      const target = await context.resolveDefaultFieldTarget();
      return {
        ...target,
        sourceKey: "worker.smoke",
        observedAt: "2026-03-27T00:00:00.000Z",
        inputs: {
          forecastModel: "worker-smoke",
          soilDataset: "worker-smoke",
        },
      };
    },
    async run(context: WorkerJobContext, payload, execution) {
      const state = await runJobPhases(execution, {
        initialState: {
          result: null as Awaited<
            ReturnType<WorkerJobContext["runtime"]["services"]["moisture"]["rebuildFieldEstimate"]>
          > | null,
        },
        phases: [
          {
            key: "prepare-inputs",
            progressPct: 10,
            progressMessage: "preparing moisture rebuild inputs",
            run(currentState) {
              return currentState;
            },
          },
          {
            key: "rebuild-estimate",
            progressPct: 70,
            progressMessage: "rebuilding field moisture estimate",
            async run(currentState) {
              return {
                ...currentState,
                result: await context.runtime.services.moisture.rebuildFieldEstimate(
                  payload,
                ),
              };
            },
          },
          {
            key: "finalize-result",
            progressPct: 90,
            progressMessage: "finalizing moisture rebuild result",
            run(currentState) {
              return currentState;
            },
          },
        ],
      });

      if (!state.result) {
        throw new Error("[worker] moisture job completed without a result");
      }

      return state.result;
    },
  }),
  createRegisteredJob<
    WorkerJobContext,
    RebuildFieldCellsInput,
    RebuildFieldCellsResult
  >({
    key: "moisture.rebuild-field-cells",
    description:
      "Rebuild the latest field moisture cells from the latest stored moisture snapshot.",
    async samplePayload(context: WorkerJobContext) {
      const target = await context.resolveDefaultFieldTarget();
      return {
        ...target,
      };
    },
    async run(context: WorkerJobContext, payload, execution) {
      const state = await runJobPhases(execution, {
        initialState: {
          result: null as RebuildFieldCellsResult | null,
        },
        phases: [
          {
            key: "prepare-inputs",
            progressPct: 10,
            progressMessage: "preparing moisture cell rebuild inputs",
            run(currentState) {
              return currentState;
            },
          },
          {
            key: "rebuild-cells",
            progressPct: 70,
            progressMessage: "rebuilding field moisture cells",
            async run(currentState) {
              return {
                ...currentState,
                result: await context.runtime.services.moisture.rebuildFieldCells(
                  payload,
                ),
              };
            },
          },
          {
            key: "finalize-result",
            progressPct: 90,
            progressMessage: "finalizing moisture cell rebuild result",
            run(currentState) {
              return currentState;
            },
          },
        ],
      });

      if (!state.result) {
        throw new Error("[worker] moisture cell rebuild job completed without a result");
      }

      return state.result;
    },
  }),
  createRegisteredJob<WorkerJobContext, RenderFieldPdfInput, unknown>({
    key: "reports.render-field-pdf",
    description: "Render and persist a server-side PDF artifact.",
    async samplePayload(context: WorkerJobContext) {
      const target = await context.resolveDefaultFieldTarget();
      return {
        ...target,
        reportDate: "2026-03-27T00:00:00.000Z",
        dryRun: true,
      };
    },
    async run(context: WorkerJobContext, payload, execution) {
      const state = await runJobPhases(execution, {
        initialState: {
          result: null as Awaited<
            ReturnType<WorkerJobContext["runtime"]["services"]["reports"]["renderFieldPdf"]>
          > | null,
        },
        phases: [
          {
            key: "prepare-render",
            progressPct: 10,
            progressMessage: "preparing field pdf render",
            run(currentState) {
              return currentState;
            },
          },
          {
            key: "render-pdf",
            progressPct: 70,
            progressMessage: "rendering field pdf artifact",
            async run(currentState) {
              return {
                ...currentState,
                result: await context.runtime.services.reports.renderFieldPdf(
                  payload,
                ),
              };
            },
          },
          {
            key: "finalize-result",
            progressPct: 90,
            progressMessage: "finalizing field pdf result",
            run(currentState) {
              return currentState;
            },
          },
        ],
      });

      if (!state.result) {
        throw new Error("[worker] report job completed without a result");
      }

      return state.result;
    },
  }),
  createRegisteredJob<WorkerJobContext, LongRunningSmokeInput, unknown>({
    key: "ops.long-running-smoke",
    description: "Run a cooperative long-running worker job for cancellation testing.",
    samplePayload() {
      return {
        durationMs: 10_000,
        stepMs: 1_000,
      };
    },
    async run(context: WorkerJobContext, payload, execution) {
      const totalSteps = Math.max(1, Math.ceil(payload.durationMs / payload.stepMs));

      for (let index = 0; index < totalSteps; index += 1) {
        await execution.throwIfCancellationRequested();

        const progressPct = Math.min(
          95,
          Math.max(5, Math.round(((index + 1) / totalSteps) * 95)),
        );

        await execution.reportProgress({
          phaseKey: "sleep-loop",
          phaseLabel: "long-running smoke loop",
          progressPct,
          progressMessage: `long-running smoke step ${index + 1}/${totalSteps}`,
        });

        context.logger.info("job.long-running-smoke.step", {
          dispatchId: execution.dispatchId,
          step: index + 1,
          totalSteps,
          progressPct,
        });

        await sleep(payload.stepMs);
      }

      return {
        status: "completed",
        durationMs: payload.durationMs,
        stepMs: payload.stepMs,
        totalSteps,
      };
    },
  }),
] as const;
