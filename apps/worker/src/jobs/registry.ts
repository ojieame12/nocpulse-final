import {
  createRegisteredJob,
  runJobPhases,
} from "@fieldpulse/platform-jobs";
import type {
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
import type { WorkerJobContext } from "./contracts/WorkerJobContext";

type LongRunningSmokeInput = {
  durationMs: number;
  stepMs: number;
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

export const jobs = [
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
      const state = await runJobPhases(execution, {
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

      for (const [index, field] of fields.entries()) {
        await execution.throwIfCancellationRequested();
        const dispatch = await context.enqueueJob({
          key: "imagery.record-provider-probe",
          payload: {
            workspaceId: payload.workspaceId,
            fieldId: field.id,
            requestedAt,
          },
        });

        if (
          dispatch.result
          && typeof dispatch.result === "object"
          && dispatch.result
          && "id" in dispatch.result
          && typeof dispatch.result.id === "string"
        ) {
          queuedDispatchIds.push(dispatch.result.id);
        }

        await execution.reportProgress({
          progressPct: Math.min(
            95,
            Math.max(10, Math.round(((index + 1) / fields.length) * 95)),
          ),
          progressMessage: `queued provider probe ${index + 1} of ${fields.length}`,
          phaseKey: "enqueue-field-probes",
          phaseLabel: "enqueue field probes",
        });
      }

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

      for (const [index, field] of fields.entries()) {
        await execution.throwIfCancellationRequested();
        const dispatch = await context.enqueueJob({
          key: "imagery.sync-latest",
          payload: {
            workspaceId: payload.workspaceId,
            fieldId: field.id,
            requestedAt,
            providers: payload.providers,
            dryRun: payload.dryRun,
          },
        });

        if (
          dispatch.result &&
          typeof dispatch.result === "object" &&
          dispatch.result &&
          "id" in dispatch.result &&
          typeof dispatch.result.id === "string"
        ) {
          queuedDispatchIds.push(dispatch.result.id);
        }

        await execution.reportProgress({
          progressPct: Math.min(
            95,
            Math.max(10, Math.round(((index + 1) / fields.length) * 95)),
          ),
          progressMessage: `queued imagery sync ${index + 1} of ${fields.length}`,
          phaseKey: "enqueue-field-syncs",
          phaseLabel: "enqueue field syncs",
        });
      }

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
      const state = await runJobPhases(execution, {
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

      if (!state.result) {
        throw new Error("[worker] imagery job completed without a result");
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

      for (const [index, field] of fields.entries()) {
        await execution.throwIfCancellationRequested();
        const dispatch = await context.enqueueJob({
          key: "intelligence.generate-disease-risk",
          payload: {
            workspaceId: payload.workspaceId,
            fieldId: field.id,
            requestedAt,
          },
        });

        if (
          dispatch.result
          && typeof dispatch.result === "object"
          && dispatch.result
          && "id" in dispatch.result
          && typeof dispatch.result.id === "string"
        ) {
          queuedDispatchIds.push(dispatch.result.id);
        }

        await execution.reportProgress({
          progressPct: Math.min(
            95,
            Math.max(10, Math.round(((index + 1) / fields.length) * 95)),
          ),
          progressMessage: `queued disease risk generation ${index + 1} of ${fields.length}`,
          phaseKey: "enqueue-field-disease-risk",
          phaseLabel: "enqueue field disease risk generation",
        });
      }

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

      for (const [index, field] of fields.entries()) {
        await execution.throwIfCancellationRequested();
        const dispatch = await context.enqueueJob({
          key: "hail.refresh-field",
          payload: {
            workspaceId: payload.workspaceId,
            fieldId: field.id,
            requestedAt,
          },
        });

        if (
          dispatch.result &&
          typeof dispatch.result === "object" &&
          dispatch.result &&
          "id" in dispatch.result &&
          typeof dispatch.result.id === "string"
        ) {
          queuedDispatchIds.push(dispatch.result.id);
        }

        await execution.reportProgress({
          progressPct: Math.min(
            95,
            Math.max(10, Math.round(((index + 1) / fields.length) * 95)),
          ),
          progressMessage: `queued hail refresh ${index + 1} of ${fields.length}`,
          phaseKey: "enqueue-field-refreshes",
          phaseLabel: "enqueue field refreshes",
        });
      }

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

      for (const [index, field] of fields.entries()) {
        await execution.throwIfCancellationRequested();
        const dispatch = await context.enqueueJob({
          key: "weather.refresh-field",
          payload: {
            workspaceId: payload.workspaceId,
            fieldId: field.id,
            requestedAt,
            forecastHours: payload.forecastHours,
          },
        });

        if (
          dispatch.result
          && typeof dispatch.result === "object"
          && dispatch.result
          && "id" in dispatch.result
          && typeof dispatch.result.id === "string"
        ) {
          queuedDispatchIds.push(dispatch.result.id);
        }

        await execution.reportProgress({
          progressPct: Math.min(
            95,
            Math.max(10, Math.round(((index + 1) / fields.length) * 95)),
          ),
          progressMessage: `queued weather refresh ${index + 1} of ${fields.length}`,
          phaseKey: "enqueue-field-refreshes",
          phaseLabel: "enqueue field weather refreshes",
        });
      }

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

      for (const [index, field] of fields.entries()) {
        await execution.throwIfCancellationRequested();
        const dispatch = await context.enqueueJob({
          key: "moisture.rebuild-field-cells",
          payload: {
            workspaceId: payload.workspaceId,
            fieldId: field.id,
          },
        });

        if (
          dispatch.result
          && typeof dispatch.result === "object"
          && dispatch.result
          && "id" in dispatch.result
          && typeof dispatch.result.id === "string"
        ) {
          queuedDispatchIds.push(dispatch.result.id);
        }

        await execution.reportProgress({
          progressPct: Math.min(
            95,
            Math.max(10, Math.round(((index + 1) / fields.length) * 95)),
          ),
          progressMessage: `queued moisture cell backfill ${index + 1} of ${fields.length}`,
          phaseKey: "enqueue-field-backfills",
          phaseLabel: "enqueue field moisture cell backfills",
        });
      }

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
