import {
  acknowledgeFieldAlert,
  listActiveWorkspaceAlerts,
  listFieldAlerts,
  resolveFieldAlert,
  upsertFieldAlert,
} from "@fieldpulse/module-alerts";
import { resolveAuthenticatedActor } from "@fieldpulse/module-auth";
import {
  buildFieldZoneActivityReport,
  buildDiseaseRiskReport,
  buildAlertFromIntelligenceFinding,
  generateDiseaseRiskFindings,
  generateHailRiskFindings,
  generateMoistureStressFindings,
  generateWeatherRiskFindings,
  listFieldIntelligenceFindings,
  listFieldIntelligenceZones,
  listWorkspaceIntelligenceFindings,
  prairieDefaultRulePack,
  resolveCropRuleContext,
  upsertCropIntelligenceRun,
  upsertFieldIntelligenceFinding,
} from "@fieldpulse/module-crop-intelligence";
import {
  clearFieldCropContext,
  clearFieldGrowthStageOverride,
  loadFieldCropContext,
  refreshFieldCropStage,
  setFieldGrowthStageOverride,
  upsertFieldCropContext,
} from "@fieldpulse/module-field-crop-context";
import {
  commitSpreadsheetImportBatch,
  createSpreadsheetImportBatch,
  createDefaultFieldBoundaryFileParser,
  createDefaultSpreadsheetWorkbookReader,
  lookupLldBoundary,
  parseFieldBoundaryFile,
  previewSpreadsheetImportFile,
  type LldGeocodeCache,
} from "@fieldpulse/module-field-intake";
import {
  buildInitialFieldOnboardingPlan,
  dispatchFieldOnboardingPlan,
  type FieldOnboardingJobRequest,
} from "@fieldpulse/module-field-onboarding";
import {
  ensureWorkspaceField,
  listWorkspaceFieldOverview,
} from "@fieldpulse/module-fields";
import {
  buildHailRefreshReport,
  listFieldHailEvents,
  listWorkspaceHailEvents,
  refreshFieldHailEvents,
  type HailProviderClient,
  upsertFieldHailEvent,
} from "@fieldpulse/module-hail";
import {
  buildImagerySyncReport,
  buildImageryProviderProbeFallbackReport,
  diagnoseImageryProviders,
  type ImageryProviderClient,
  createSyntheticRasterFieldObservationProvider,
  listImageryProviderProbeHistory,
  listRecentImageryProviderProbeHistory,
  probeImageryProvidersForField,
  recordImageryProviderProbeForField,
  refreshFieldRasterObservation,
  syncLatestImagery,
} from "@fieldpulse/module-imagery";
import {
  rebuildFieldMoistureCellSnapshots,
  rebuildFieldMoistureEstimate,
} from "@fieldpulse/module-moisture";
import {
  buildFieldReportReadModel,
  prepareFieldReportArtifact,
  type ReportArtifactStore,
} from "@fieldpulse/module-reports";
import {
  buildWeatherRefreshReport,
  computeFieldWeatherDerivedSignals,
  loadFieldWeatherProfile,
  refreshFieldWeather,
  type WeatherProviderClient,
  replaceFieldWeatherForecastSet,
  upsertFieldWeatherObservation,
} from "@fieldpulse/module-weather";
import {
  ensureWorkspace,
  listAllWorkspaces,
  listUserWorkspaces,
  resolveWorkspaceSelection,
} from "@fieldpulse/module-workspaces";
import type {
  ServerJobDispatcher,
  ServerRepositories,
} from "../contracts/ServerRuntime";
import type {
  BootstrapDevelopmentDataInput,
  BootstrapDevelopmentDataResult,
  CommitFieldImportBatchInput,
  CommitFieldImportBatchResult,
  LoadWorkspaceFieldDetailInput,
  LoadWorkspaceFieldOverviewInput,
  SaveSpreadsheetImportPreviewInput,
  SaveSpreadsheetImportPreviewResult,
  ServerServices,
  WorkspaceFieldDetailSelection,
  WorkspaceFieldOverviewSelection,
} from "../contracts/ServerServices";
import { createDefaultMoistureCellDerivationStrategy } from "./createDefaultMoistureCellDerivationStrategy";

const DISEASE_RISK_SOURCE_KEY = "disease-risk-generator";

async function requireFieldDetail(
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

function toSeasonYear(requestedAt: string) {
  return new Date(requestedAt).getUTCFullYear();
}

async function resolveCanonicalCropContext(
  repositories: ServerRepositories,
  workspaceId: string,
  fieldId: string,
  override?: {
    cropType?: string | null;
    growthStage?: string | null;
  } | null,
) {
  if (override?.cropType || override?.growthStage) {
    return {
      cropType: override.cropType ?? null,
      growthStage: override.growthStage ?? null,
    };
  }

  const persisted = await loadFieldCropContext({
    repository: repositories.fieldCropContexts,
    workspaceId,
    fieldId,
  });

  if (!persisted) {
    return null;
  }

  return {
    cropType: persisted.cropType,
    growthStage: persisted.growthStage,
  };
}

async function refreshCanonicalFieldCropStage(
  repositories: ServerRepositories,
  input: {
    workspaceId: string;
    fieldId: string;
    requestedAt: string;
    weatherSignalSet: {
      id: string;
      observedAt: string;
      gdd24h: number | null;
    };
    cropContext?: {
      cropType?: string | null;
      growthStage?: string | null;
    } | null;
  },
) {
  const current = await loadFieldCropContext({
    repository: repositories.fieldCropContexts,
    workspaceId: input.workspaceId,
    fieldId: input.fieldId,
  });

  if (!current) {
    return null;
  }

  const resolvedRules = resolveCropRuleContext({
    rulePack: prairieDefaultRulePack,
    cropContext: input.cropContext ?? {
      cropType: current.cropType,
      growthStage: current.growthStage,
    },
  });

  return refreshFieldCropStage({
    repository: repositories.fieldCropContexts,
    input: {
      workspaceId: input.workspaceId,
      fieldId: input.fieldId,
      requestedAt: input.requestedAt,
      weatherSignalSet: input.weatherSignalSet,
      thresholds: resolvedRules.crop.stageProgression,
    },
  });
}

async function loadWorkspaceFieldOverview(
  repositories: ServerRepositories,
  input: LoadWorkspaceFieldOverviewInput,
): Promise<WorkspaceFieldOverviewSelection> {
  const selection = await resolveWorkspaceSelection({
    repository: repositories.workspaces,
    actorUserId: input.actorUserId,
    preferredWorkspaceId: input.preferredWorkspaceId,
  });

  const fields = selection.selectedWorkspace
    ? await listWorkspaceFieldOverview({
        repository: repositories.fields,
        workspaceId: selection.selectedWorkspace.id,
      })
    : [];

  return {
    ...selection,
    fields,
    primaryField: fields[0] ?? null,
  };
}

async function loadWorkspaceFieldDetail(
  repositories: ServerRepositories,
  input: LoadWorkspaceFieldDetailInput,
): Promise<WorkspaceFieldDetailSelection> {
  const selection = await resolveWorkspaceSelection({
    repository: repositories.workspaces,
    actorUserId: input.actorUserId,
    preferredWorkspaceId: input.preferredWorkspaceId,
  });

  const fields = selection.selectedWorkspace
    ? await listWorkspaceFieldOverview({
        repository: repositories.fields,
        workspaceId: selection.selectedWorkspace.id,
      })
    : [];

  if (!selection.selectedWorkspace) {
    return {
      ...selection,
      fields,
      field: null,
    };
  }

  const detail = await repositories.fields.getById(
    selection.selectedWorkspace.id,
    input.fieldId,
  );

  if (!detail) {
    return {
      ...selection,
      fields,
      field: null,
    };
  }

  return {
    ...selection,
    fields,
    field: {
      detail,
      overview: fields.find((field) => field.id === detail.id) ?? null,
      readModel: await buildFieldReportReadModel({
        repositories: {
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
        },
        workspaceId: selection.selectedWorkspace.id,
        fieldId: detail.id,
        reportDate: new Date().toISOString(),
      }),
    },
  };
}

async function buildRecentImageryProviderProbeFallbackReport(
  repositories: ServerRepositories,
  input: {
    createdAfter?: string;
    limit?: number;
  } = {},
) {
  const records = await listRecentImageryProviderProbeHistory(
    repositories.imageryProviderProbes,
    input,
  );

  const relevantWorkspaceIds = Array.from(
    new Set(records.map((record) => record.workspaceId)),
  );
  const workspaces = await repositories.workspaces.listAll();
  const workspaceLabels = new Map(
    workspaces
      .filter((workspace) => relevantWorkspaceIds.includes(workspace.id))
      .map((workspace) => [
        workspace.id,
        {
          workspaceName: workspace.name,
          workspaceSlug: workspace.slug,
        },
      ]),
  );
  const fieldLabelsById: Record<
    string,
    {
      workspaceName?: string | null;
      workspaceSlug?: string | null;
      fieldName?: string | null;
    }
  > = {};

  for (const workspaceId of relevantWorkspaceIds) {
    const fields = await listWorkspaceFieldOverview({
      repository: repositories.fields,
      workspaceId,
    });
    const workspaceLabel = workspaceLabels.get(workspaceId);

    for (const field of fields) {
      fieldLabelsById[field.id] = {
        workspaceName: workspaceLabel?.workspaceName ?? null,
        workspaceSlug: workspaceLabel?.workspaceSlug ?? null,
        fieldName: field.name,
      };
    }
  }

  return buildImageryProviderProbeFallbackReport({
    createdAfter: input.createdAfter ?? null,
    records,
    fieldLabelsById,
  });
}

async function buildRecentImagerySyncReport(
  repositories: ServerRepositories,
  input: {
    workspaceId?: string;
    createdAfter?: string;
    staleAfterHours?: number;
    limit?: number;
  } = {},
) {
  const staleAfterHours = input.staleAfterHours ?? 24;
  const staleBefore = new Date(
    Date.now() - staleAfterHours * 60 * 60 * 1000,
  ).toISOString();
  const recentCaptures = await repositories.imageryCaptures.listRecent({
    workspaceId: input.workspaceId,
    createdAfter: input.createdAfter,
    limit: input.limit,
  });

  const scopedWorkspaces = input.workspaceId
    ? (await repositories.workspaces.listAll()).filter(
        (workspace) => workspace.id === input.workspaceId,
      )
    : await repositories.workspaces.listAll();
  const fields = [];
  const fieldLabelsById: Record<
    string,
    {
      workspaceName?: string | null;
      workspaceSlug?: string | null;
      fieldName?: string | null;
    }
  > = {};
  const latestCaptures = [];

  for (const workspace of scopedWorkspaces) {
    const workspaceFields = await listWorkspaceFieldOverview({
      repository: repositories.fields,
      workspaceId: workspace.id,
    });

    for (const field of workspaceFields) {
      fields.push({
        workspaceId: workspace.id,
        fieldId: field.id,
      });
      fieldLabelsById[field.id] = {
        workspaceName: workspace.name,
        workspaceSlug: workspace.slug,
        fieldName: field.name,
      };
      const latestCapture = await repositories.imageryCaptures.getLatestByField(
        workspace.id,
        field.id,
      );
      if (latestCapture) {
        latestCaptures.push(latestCapture);
      }
    }
  }

  return buildImagerySyncReport({
    createdAfter: input.createdAfter ?? null,
    staleBefore,
    recentCaptures,
    latestCaptures,
    fields,
    fieldLabelsById,
  });
}

async function buildRecentWeatherRefreshReport(
  repositories: ServerRepositories,
  input: {
    workspaceId?: string;
    updatedAfter?: string;
    staleAfterHours?: number;
    limit?: number;
  } = {},
) {
  const staleAfterHours = input.staleAfterHours ?? 12;

  if (staleAfterHours < 0) {
    throw new Error("[runtime] staleAfterHours must be non-negative");
  }

  const staleBefore = new Date(
    Date.now() - staleAfterHours * 60 * 60 * 1000,
  ).toISOString();
  const workspaces = input.workspaceId
    ? await repositories.workspaces.listAll().then((available) => {
        const selected = available.find((workspace) => workspace.id === input.workspaceId);

        if (!selected) {
          throw new Error(
            `[runtime] workspace ${input.workspaceId} was not found for weather reporting`,
          );
        }

        return [selected];
      })
    : await repositories.workspaces.listAll();
  const workspaceIds = new Set(workspaces.map((workspace) => workspace.id));
  const fieldLabelsById: Record<
    string,
    {
      workspaceName?: string | null;
      workspaceSlug?: string | null;
      fieldName?: string | null;
    }
  > = {};
  const fields: Array<{ workspaceId: string; fieldId: string }> = [];
  const latestObservations = [];

  for (const workspace of workspaces) {
    const overview = await listWorkspaceFieldOverview({
      repository: repositories.fields,
      workspaceId: workspace.id,
    });

    for (const field of overview) {
      fieldLabelsById[field.id] = {
        workspaceName: workspace.name,
        workspaceSlug: workspace.slug,
        fieldName: field.name,
      };
      fields.push({
        workspaceId: workspace.id,
        fieldId: field.id,
      });
    }

    latestObservations.push(
      ...(await repositories.weatherObservations.listLatestByWorkspace(workspace.id)),
    );
  }

  const recentObservations = (await repositories.weatherObservations.listRecentObservations({
    workspaceId: input.workspaceId,
    updatedAfter: input.updatedAfter,
    limit: input.limit,
  })).filter((observation) => workspaceIds.has(observation.workspaceId));

  return buildWeatherRefreshReport({
    updatedAfter: input.updatedAfter ?? null,
    staleBefore,
    recentObservations,
    latestObservations,
    fields,
    fieldLabelsById,
  });
}

async function buildRecentHailRefreshReport(
  repositories: ServerRepositories,
  input: {
    workspaceId?: string;
    requestedAfter?: string;
    staleAfterHours?: number;
    limit?: number;
  } = {},
) {
  const staleAfterHours = input.staleAfterHours ?? 24;

  if (staleAfterHours < 0) {
    throw new Error("[runtime] staleAfterHours must be non-negative");
  }

  const staleBefore = new Date(
    Date.now() - staleAfterHours * 60 * 60 * 1000,
  ).toISOString();
  const workspaces = input.workspaceId
    ? await repositories.workspaces.listAll().then((available) => {
        const selected = available.find((workspace) => workspace.id === input.workspaceId);

        if (!selected) {
          throw new Error(
            `[runtime] workspace ${input.workspaceId} was not found for hail reporting`,
          );
        }

        return [selected];
      })
    : await repositories.workspaces.listAll();
  const workspaceIds = new Set(workspaces.map((workspace) => workspace.id));
  const fieldLabelsById: Record<
    string,
    {
      workspaceName?: string | null;
      workspaceSlug?: string | null;
      fieldName?: string | null;
    }
  > = {};
  const fields: Array<{ workspaceId: string; fieldId: string }> = [];
  const latestRuns = [];

  for (const workspace of workspaces) {
    const overview = await listWorkspaceFieldOverview({
      repository: repositories.fields,
      workspaceId: workspace.id,
    });

    for (const field of overview) {
      fieldLabelsById[field.id] = {
        workspaceName: workspace.name,
        workspaceSlug: workspace.slug,
        fieldName: field.name,
      };
      fields.push({
        workspaceId: workspace.id,
        fieldId: field.id,
      });
    }

    latestRuns.push(
      ...(await repositories.hailRefreshRuns.listLatestByWorkspace(workspace.id)),
    );
  }

  const recentRuns = (await repositories.hailRefreshRuns.listRecentRuns({
    workspaceId: input.workspaceId,
    requestedAfter: input.requestedAfter,
    limit: input.limit,
  })).filter((run) => workspaceIds.has(run.workspaceId));

  return buildHailRefreshReport({
    requestedAfter: input.requestedAfter ?? null,
    staleBefore,
    recentRuns,
    latestRuns,
    fields,
    fieldLabelsById,
  });
}

async function buildRecentDiseaseRiskReport(
  repositories: ServerRepositories,
  input: {
    workspaceId?: string;
    startedAfter?: string;
    staleAfterHours?: number;
    limit?: number;
  } = {},
) {
  const staleAfterHours = input.staleAfterHours ?? 24;

  if (staleAfterHours < 0) {
    throw new Error("[runtime] staleAfterHours must be non-negative");
  }

  const staleBefore = new Date(
    Date.now() - staleAfterHours * 60 * 60 * 1000,
  ).toISOString();
  const workspaces = input.workspaceId
    ? await repositories.workspaces.listAll().then((available) => {
        const selected = available.find((workspace) => workspace.id === input.workspaceId);

        if (!selected) {
          throw new Error(
            `[runtime] workspace ${input.workspaceId} was not found for disease risk reporting`,
          );
        }

        return [selected];
      })
    : await repositories.workspaces.listAll();
  const fieldLabelsById: Record<
    string,
    {
      workspaceName?: string | null;
      workspaceSlug?: string | null;
      fieldName?: string | null;
    }
  > = {};
  const fields: Array<{ workspaceId: string; fieldId: string }> = [];
  const latestRuns = [];
  const recentRuns = [];
  const activeFindings = [];

  for (const workspace of workspaces) {
    const overview = await listWorkspaceFieldOverview({
      repository: repositories.fields,
      workspaceId: workspace.id,
    });

    for (const field of overview) {
      fieldLabelsById[field.id] = {
        workspaceName: workspace.name,
        workspaceSlug: workspace.slug,
        fieldName: field.name,
      };
      fields.push({
        workspaceId: workspace.id,
        fieldId: field.id,
      });
    }

    latestRuns.push(
      ...(await repositories.cropIntelligenceRuns.listLatestByWorkspace(
        workspace.id,
        DISEASE_RISK_SOURCE_KEY,
      )),
    );
    recentRuns.push(
      ...(await repositories.cropIntelligenceRuns.listRecentRuns({
        workspaceId: workspace.id,
        startedAfter: input.startedAfter,
        limit: input.limit,
        sourceKey: DISEASE_RISK_SOURCE_KEY,
      })),
    );
    activeFindings.push(
      ...(await repositories.cropIntelligenceFindings.listRecentByWorkspace({
        workspaceId: workspace.id,
        limit: input.limit,
        status: "active",
        family: "disease_risk",
        updatedAfter: input.startedAfter,
      })),
    );
  }

  return buildDiseaseRiskReport({
    startedAfter: input.startedAfter ?? null,
    staleBefore,
    recentRuns,
    latestRuns,
    activeFindings,
    fields,
    fieldLabelsById,
  });
}

async function bootstrapDevelopmentData(
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

async function saveSpreadsheetImportPreview(
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

async function commitFieldImportBatch(
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

  for (const candidate of committed.candidates) {
    if (candidate.candidate.cropType) {
      await upsertFieldCropContext({
        repository: repositories.fieldCropContexts,
        context: {
          workspaceId: candidate.field.workspaceId,
          fieldId: candidate.field.id,
          seasonYear: toSeasonYear(candidate.candidate.createdAt),
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
        },
      });
    }

    if (candidate.action !== "created") {
      onboardingDispatches.push({
        fieldId: candidate.field.id,
        action: candidate.action,
        receipts: [],
      });
      continue;
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
      plan: buildInitialFieldOnboardingPlan({
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

export function createServerServices(
  repositories: ServerRepositories,
  options: {
    jobDispatcher?: ServerJobDispatcher;
    imageryProviderClients?: readonly ImageryProviderClient[];
    hailProviderClient?: HailProviderClient;
    weatherProviderClient?: WeatherProviderClient;
    reportArtifactStore?: ReportArtifactStore;
    lldGeocodeCache?: LldGeocodeCache;
  } = {},
): ServerServices {
  const fieldBoundaryFileParser = createDefaultFieldBoundaryFileParser();
  const spreadsheetWorkbookReader = createDefaultSpreadsheetWorkbookReader();
  const imageryProviderClients = options.imageryProviderClients ?? [];
  const hailProviderClient = options.hailProviderClient;
  const weatherProviderClient = options.weatherProviderClient;
  const moistureCellDerivationStrategy =
    createDefaultMoistureCellDerivationStrategy({
      imageryRasterObservations: repositories.imageryRasterObservations,
    });

  return {
    auth: {
      resolveActor(input) {
        return resolveAuthenticatedActor({
          workspaceMemberships: repositories.workspaceMemberships,
          workspaces: repositories.workspaces,
          userId: input.userId,
          preferredWorkspaceId: input.preferredWorkspaceId,
        });
      },
    },
    fieldIntake: {
      async lookupLldBoundary(input) {
        return lookupLldBoundary(input, {
          geocodeCache: options.lldGeocodeCache,
        });
      },
      async parseBoundaryFile(input) {
        return parseFieldBoundaryFile({
          parser: fieldBoundaryFileParser,
          file: input,
        });
      },
      async previewSpreadsheetImport(input) {
        return previewSpreadsheetImportFile({
          reader: spreadsheetWorkbookReader,
          file: input,
        });
      },
      saveSpreadsheetImportPreview(input) {
        return saveSpreadsheetImportPreview(repositories, input);
      },
      commitSpreadsheetImportBatch(input) {
        return commitFieldImportBatch(repositories, options, input);
      },
    },
    fieldOnboarding: {
      async buildInitialPlan(input) {
        return buildInitialFieldOnboardingPlan(input);
      },
      async dispatchInitialPlan(input) {
        if (!options.jobDispatcher) {
          throw new Error(
            "[runtime] field onboarding dispatch requested without a job dispatcher",
          );
        }

        const plan = buildInitialFieldOnboardingPlan(input);

        return dispatchFieldOnboardingPlan({
          dispatcher: {
            enqueue(job: FieldOnboardingJobRequest) {
              return options.jobDispatcher!.enqueue(job);
            },
          },
          plan,
        });
      },
    },
    fieldCropContext: {
      async loadFieldContext(input) {
        await requireFieldDetail(repositories, input.workspaceId, input.fieldId);

        return loadFieldCropContext({
          repository: repositories.fieldCropContexts,
          workspaceId: input.workspaceId,
          fieldId: input.fieldId,
        });
      },
      async upsertFieldContext(input) {
        await requireFieldDetail(repositories, input.workspaceId, input.fieldId);

        return upsertFieldCropContext({
          repository: repositories.fieldCropContexts,
          context: input,
        });
      },
      async clearFieldContext(input) {
        await requireFieldDetail(repositories, input.workspaceId, input.fieldId);

        return clearFieldCropContext({
          repository: repositories.fieldCropContexts,
          workspaceId: input.workspaceId,
          fieldId: input.fieldId,
          seasonYear: input.seasonYear,
        });
      },
      async refreshGrowthStage(input) {
        await requireFieldDetail(repositories, input.workspaceId, input.fieldId);
        const current = await loadFieldCropContext({
          repository: repositories.fieldCropContexts,
          workspaceId: input.workspaceId,
          fieldId: input.fieldId,
        });

        if (!current) {
          return null;
        }

        const signalSet = await repositories.weatherSignalSets.getLatestByField(
          input.workspaceId,
          input.fieldId,
        );

        if (!signalSet) {
          return current;
        }

        const resolvedRules = resolveCropRuleContext({
          rulePack: prairieDefaultRulePack,
          cropContext: {
            cropType: current.cropType,
            growthStage: current.growthStage,
          },
        });

        const refreshed = await refreshFieldCropStage({
          repository: repositories.fieldCropContexts,
          input: {
            workspaceId: input.workspaceId,
            fieldId: input.fieldId,
            requestedAt: input.requestedAt ?? new Date().toISOString(),
            weatherSignalSet: {
              id: signalSet.id,
              observedAt: signalSet.observedAt,
              gdd24h: signalSet.gdd24h,
            },
            thresholds: resolvedRules.crop.stageProgression,
          },
        });

        return refreshed?.context ?? null;
      },
      async setGrowthStageOverride(input) {
        await requireFieldDetail(repositories, input.workspaceId, input.fieldId);

        return setFieldGrowthStageOverride({
          repository: repositories.fieldCropContexts,
          workspaceId: input.workspaceId,
          fieldId: input.fieldId,
          growthStage: input.growthStage,
          requestedAt: input.requestedAt ?? new Date().toISOString(),
        });
      },
      async clearGrowthStageOverride(input) {
        await requireFieldDetail(repositories, input.workspaceId, input.fieldId);
        const current = await loadFieldCropContext({
          repository: repositories.fieldCropContexts,
          workspaceId: input.workspaceId,
          fieldId: input.fieldId,
        });

        if (!current) {
          return null;
        }

        const resolvedRules = resolveCropRuleContext({
          rulePack: prairieDefaultRulePack,
          cropContext: {
            cropType: current.cropType,
            growthStage: current.growthStage,
          },
        });

        return clearFieldGrowthStageOverride({
          repository: repositories.fieldCropContexts,
          workspaceId: input.workspaceId,
          fieldId: input.fieldId,
          requestedAt: input.requestedAt ?? new Date().toISOString(),
          thresholds: resolvedRules.crop.stageProgression,
        });
      },
    },
    workspaces: {
      listAll() {
        return listAllWorkspaces({
          repository: repositories.workspaces,
        });
      },
      listForUser(userId) {
        return listUserWorkspaces({
          repository: repositories.workspaces,
          userId,
        });
      },
      resolveSelection(input) {
        return resolveWorkspaceSelection({
          repository: repositories.workspaces,
          actorUserId: input.actorUserId,
          preferredWorkspaceId: input.preferredWorkspaceId,
        });
      },
    },
    catalog: {
      loadWorkspaceFieldOverview(input) {
        return loadWorkspaceFieldOverview(repositories, input);
      },
      loadWorkspaceFieldDetail(input) {
        return loadWorkspaceFieldDetail(repositories, input);
      },
    },
    imagery: {
      async inspectProviders() {
        return diagnoseImageryProviders(imageryProviderClients);
      },
      async inspectProvidersForField(input) {
        const field = await requireFieldDetail(
          repositories,
          input.workspaceId,
          input.fieldId,
        );

        return probeImageryProvidersForField(imageryProviderClients, {
          workspaceId: input.workspaceId,
          fieldId: input.fieldId,
          boundary: field.boundary,
          requestedAt: input.requestedAt ?? new Date().toISOString(),
        });
      },
      async recordProviderProbeForField(input) {
        const field = await requireFieldDetail(
          repositories,
          input.workspaceId,
          input.fieldId,
        );
        const recorded = await recordImageryProviderProbeForField(
          repositories.imageryProviderProbes,
          imageryProviderClients,
          {
            workspaceId: input.workspaceId,
            fieldId: input.fieldId,
            boundary: field.boundary,
            requestedAt: input.requestedAt ?? new Date().toISOString(),
          },
        );

        return recorded.records;
      },
      async listProviderProbeHistoryForField(input) {
        await requireFieldDetail(repositories, input.workspaceId, input.fieldId);

        return listImageryProviderProbeHistory(
          repositories.imageryProviderProbes,
          input,
        );
      },
      async buildRecentProbeFallbackReport(input = {}) {
        return buildRecentImageryProviderProbeFallbackReport(repositories, input);
      },
      async buildRecentSyncReport(input = {}) {
        return buildRecentImagerySyncReport(repositories, input);
      },
      async syncLatestFieldImagery(input) {
        const field = await requireFieldDetail(
          repositories,
          input.workspaceId,
          input.fieldId,
        );

        return syncLatestImagery(
          {
            captureRepository: repositories.imageryCaptures,
            observationRepository: repositories.imageryRasterObservations,
            providerClients: imageryProviderClients,
          },
          {
          ...input,
          boundary: field.boundary,
          requestedAt: input.requestedAt ?? new Date().toISOString(),
          },
        );
      },
    },
    moisture: {
      async rebuildFieldEstimate(input) {
        const field = await requireFieldDetail(
          repositories,
          input.workspaceId,
          input.fieldId,
        );
        const [latestRasterObservation, latestWeatherObservation] =
          await Promise.all([
            repositories.imageryRasterObservations.getLatestByField(
              input.workspaceId,
              input.fieldId,
            ),
            repositories.weatherObservations.getLatestByField(
              input.workspaceId,
              input.fieldId,
            ),
          ]);
        const hasSourceBackedInputs =
          latestRasterObservation !== null || latestWeatherObservation !== null;
        const latestRasterSourceKey = latestRasterObservation?.sourceKey ?? null;
        const latestRasterIsSar =
          typeof latestRasterSourceKey === "string" &&
          /sentinel-1|sar/i.test(latestRasterSourceKey);

        const rebuilt = await rebuildFieldMoistureEstimate({
          repository: repositories.moistureSnapshots,
          estimate: {
            workspaceId: input.workspaceId,
            fieldId: input.fieldId,
            observedAt: input.observedAt ?? new Date().toISOString(),
            sourceKey:
              input.sourceKey ??
              (hasSourceBackedInputs
                ? "imagery-weather-derived-v1"
                : "worker.rebuild-field-estimate"),
            inputs: input.inputs ?? {
              forecastModel:
                latestWeatherObservation?.sourceKey ?? "worker-rebuild",
              soilDataset:
                latestRasterObservation?.sourceKey ??
                latestWeatherObservation?.sourceKey ??
                "worker-rebuild",
              sarDataset: latestRasterIsSar ? latestRasterSourceKey : undefined,
            },
          },
          sources: {
            rasterObservation: latestRasterObservation,
            weatherObservation: latestWeatherObservation,
          },
        });

        await rebuildFieldMoistureCellSnapshots({
          repository: repositories.moistureCellSnapshots,
          derivationStrategy: moistureCellDerivationStrategy,
          field: {
            workspaceId: field.workspaceId,
            fieldId: field.id,
            boundary: field.boundary,
          },
          snapshot: rebuilt.snapshot,
        });

        return rebuilt;
      },
      async rebuildFieldCells(input) {
        const field = await requireFieldDetail(
          repositories,
          input.workspaceId,
          input.fieldId,
        );

        const latestSnapshot = await repositories.moistureSnapshots.getLatestByField(
          input.workspaceId,
          input.fieldId,
        );

        if (!latestSnapshot) {
          return {
            workspaceId: input.workspaceId,
            fieldId: input.fieldId,
            action: "skipped" as const,
            reason: "missing-snapshot" as const,
            snapshotId: null,
            snapshotObservedAt: null,
            snapshotSourceKey: null,
            strategyKey: null,
            cellCount: 0,
          };
        }

        const rebuilt = await rebuildFieldMoistureCellSnapshots({
          repository: repositories.moistureCellSnapshots,
          derivationStrategy: moistureCellDerivationStrategy,
          field: {
            workspaceId: field.workspaceId,
            fieldId: field.id,
            boundary: field.boundary,
          },
          snapshot: latestSnapshot,
        });

        return {
          workspaceId: input.workspaceId,
          fieldId: input.fieldId,
          action: rebuilt.action,
          snapshotId: latestSnapshot.id,
          snapshotObservedAt: latestSnapshot.observedAt,
          snapshotSourceKey: latestSnapshot.sourceKey,
          strategyKey: rebuilt.strategyKey,
          cellCount: rebuilt.cells.length,
        };
      },
    },
    weather: {
      async loadFieldWeather(input) {
        await requireFieldDetail(repositories, input.workspaceId, input.fieldId);

        return loadFieldWeatherProfile({
          observationRepository: repositories.weatherObservations,
          forecastRepository: repositories.weatherForecasts,
          workspaceId: input.workspaceId,
          fieldId: input.fieldId,
          validAfter: input.validAfter,
          forecastLimit: input.forecastLimit,
        });
      },
      async loadFieldDerivedSignals(input) {
        await requireFieldDetail(repositories, input.workspaceId, input.fieldId);

        return repositories.weatherSignalSets.getLatestByField(
          input.workspaceId,
          input.fieldId,
        );
      },
      async refreshFieldWeather(input) {
        const field = await requireFieldDetail(
          repositories,
          input.workspaceId,
          input.fieldId,
        );
        const cropContext = await resolveCanonicalCropContext(
          repositories,
          input.workspaceId,
          input.fieldId,
        );
        const resolvedRules = resolveCropRuleContext({
          rulePack: prairieDefaultRulePack,
          cropContext,
        });

        if (!weatherProviderClient) {
          throw new Error("[runtime] no weather provider client is configured.");
        }

        const refreshed = await refreshFieldWeather({
          provider: weatherProviderClient,
          observationRepository: repositories.weatherObservations,
          forecastRepository: repositories.weatherForecasts,
          signalRepository: repositories.weatherSignalSets,
          weather: {
            workspaceId: field.workspaceId,
            fieldId: field.id,
            latitude: field.labelPoint[1],
            longitude: field.labelPoint[0],
            requestedAt: input.requestedAt,
            forecastHours: input.forecastHours,
            gddBaseC: resolvedRules.crop.gddBaseC,
          },
        });
        await refreshCanonicalFieldCropStage(repositories, {
          workspaceId: input.workspaceId,
          fieldId: input.fieldId,
          requestedAt: input.requestedAt ?? new Date().toISOString(),
          weatherSignalSet: {
            id: refreshed.derivedSignals.id,
            observedAt: refreshed.derivedSignals.observedAt,
            gdd24h: refreshed.derivedSignals.gdd24h,
          },
          cropContext,
        });

        return refreshed;
      },
      async computeFieldDerivedSignals(input) {
        await requireFieldDetail(repositories, input.workspaceId, input.fieldId);
        const cropContext = await resolveCanonicalCropContext(
          repositories,
          input.workspaceId,
          input.fieldId,
        );
        const resolvedRules = resolveCropRuleContext({
          rulePack: prairieDefaultRulePack,
          cropContext,
        });

        const signalSet = await computeFieldWeatherDerivedSignals({
          observations: repositories.weatherObservations,
          forecasts: repositories.weatherForecasts,
          signalSets: repositories.weatherSignalSets,
          input: {
            ...input,
            gddBaseC: input.gddBaseC ?? resolvedRules.crop.gddBaseC,
          },
        });
        if (signalSet) {
          await refreshCanonicalFieldCropStage(repositories, {
            workspaceId: input.workspaceId,
            fieldId: input.fieldId,
            requestedAt: new Date().toISOString(),
            weatherSignalSet: {
              id: signalSet.id,
              observedAt: signalSet.observedAt,
              gdd24h: signalSet.gdd24h,
            },
            cropContext,
          });
        }

        return signalSet;
      },
      async buildRecentRefreshReport(input = {}) {
        return buildRecentWeatherRefreshReport(repositories, input);
      },
      async upsertFieldObservation(input) {
        await requireFieldDetail(repositories, input.workspaceId, input.fieldId);

        return upsertFieldWeatherObservation({
          repository: repositories.weatherObservations,
          observation: input,
        });
      },
      async replaceFieldForecastSet(input) {
        await requireFieldDetail(repositories, input.workspaceId, input.fieldId);

        return replaceFieldWeatherForecastSet({
          repository: repositories.weatherForecasts,
          forecastSet: input,
        });
      },
    },
    hail: {
      async loadFieldEvents(input) {
        await requireFieldDetail(repositories, input.workspaceId, input.fieldId);

        return listFieldHailEvents({
          repository: repositories.hailEvents,
          workspaceId: input.workspaceId,
          fieldId: input.fieldId,
          limit: input.limit,
          reportedAfter: input.reportedAfter,
        });
      },
      async loadWorkspaceEvents(input) {
        const workspace = await repositories.workspaces.getById(input.workspaceId);

        if (!workspace) {
          throw new Error(
            `[runtime] workspace ${input.workspaceId} was not found for hail events`,
          );
        }

        return listWorkspaceHailEvents({
          repository: repositories.hailEvents,
          workspaceId: input.workspaceId,
          limit: input.limit,
          reportedAfter: input.reportedAfter,
        });
      },
      async refreshFieldEvents(input) {
        if (!hailProviderClient) {
          throw new Error("[runtime] hail provider client is not configured.");
        }

        const field = await requireFieldDetail(repositories, input.workspaceId, input.fieldId);

        return refreshFieldHailEvents({
          provider: hailProviderClient,
          repository: repositories.hailEvents,
          refreshRuns: repositories.hailRefreshRuns,
          field: {
            workspaceId: field.workspaceId,
            fieldId: field.id,
            boundary: field.boundary,
          },
          requestedAt: input.requestedAt,
          limit: input.limit,
        });
      },
      async buildRecentRefreshReport(input = {}) {
        return buildRecentHailRefreshReport(repositories, input);
      },
      async upsertFieldEvent(input) {
        await requireFieldDetail(repositories, input.workspaceId, input.fieldId);

        return upsertFieldHailEvent({
          repository: repositories.hailEvents,
          event: input,
        });
      },
    },
    alerts: {
      async loadActiveWorkspaceAlerts(input) {
        const workspace = await repositories.workspaces.getById(input.workspaceId);

        if (!workspace) {
          throw new Error(
            `[runtime] workspace ${input.workspaceId} was not found for alerts`,
          );
        }

        return listActiveWorkspaceAlerts({
          repository: repositories.alerts,
          workspaceId: input.workspaceId,
          limit: input.limit,
        });
      },
      async loadFieldAlerts(input) {
        await requireFieldDetail(repositories, input.workspaceId, input.fieldId);

        return listFieldAlerts({
          repository: repositories.alerts,
          workspaceId: input.workspaceId,
          fieldId: input.fieldId,
          limit: input.limit,
          status: input.status,
        });
      },
      async upsertFieldAlert(input) {
        await requireFieldDetail(repositories, input.workspaceId, input.fieldId);

        return upsertFieldAlert({
          repository: repositories.alerts,
          alert: input,
        });
      },
      async acknowledgeFieldAlert(input) {
        return acknowledgeFieldAlert({
          repository: repositories.alerts,
          acknowledgement: input,
        });
      },
      async resolveFieldAlert(input) {
        return resolveFieldAlert({
          repository: repositories.alerts,
          resolution: input,
        });
      },
    },
    intelligence: {
      async loadFieldFindings(input) {
        await requireFieldDetail(repositories, input.workspaceId, input.fieldId);

        return listFieldIntelligenceFindings({
          repository: repositories.cropIntelligenceFindings,
          workspaceId: input.workspaceId,
          fieldId: input.fieldId,
          limit: input.limit,
          status: input.status,
        });
      },
      async loadFieldZones(input) {
        await requireFieldDetail(repositories, input.workspaceId, input.fieldId);

        return listFieldIntelligenceZones({
          repository: repositories.cropIntelligenceZones,
          workspaceId: input.workspaceId,
          fieldId: input.fieldId,
          family: input.family,
          trackingKey: input.trackingKey,
          status: input.status,
          limit: input.limit,
        });
      },
      async buildFieldZoneActivityReport(input) {
        await requireFieldDetail(repositories, input.workspaceId, input.fieldId);

        return buildFieldZoneActivityReport({
          repository: repositories.cropIntelligenceZones,
          workspaceId: input.workspaceId,
          fieldId: input.fieldId,
          family: input.family,
          status: input.status,
          limit: input.limit,
        });
      },
      async loadWorkspaceFindings(input) {
        const workspace = await repositories.workspaces.getById(input.workspaceId);

        if (!workspace) {
          throw new Error(
            `[runtime] workspace ${input.workspaceId} was not found for intelligence findings`,
          );
        }

        return listWorkspaceIntelligenceFindings({
          repository: repositories.cropIntelligenceFindings,
          workspaceId: input.workspaceId,
          limit: input.limit,
          status: input.status,
        });
      },
      async upsertRun(input) {
        await requireFieldDetail(repositories, input.workspaceId, input.fieldId);

        return upsertCropIntelligenceRun({
          repository: repositories.cropIntelligenceRuns,
          run: input,
        });
      },
      async upsertFinding(input) {
        await requireFieldDetail(repositories, input.workspaceId, input.fieldId);

        return upsertFieldIntelligenceFinding({
          repository: repositories.cropIntelligenceFindings,
          finding: input,
        });
      },
      async generateHailRiskFindings(input) {
        await requireFieldDetail(repositories, input.workspaceId, input.fieldId);
        const requestedAt = input.requestedAt ?? new Date().toISOString();
        const result = await generateHailRiskFindings({
          hailEvents: repositories.hailEvents,
          moistureCells: repositories.moistureCellSnapshots,
          runs: repositories.cropIntelligenceRuns,
          findings: repositories.cropIntelligenceFindings,
          input: {
            workspaceId: input.workspaceId,
            fieldId: input.fieldId,
            requestedAt,
            reportedAfter: input.reportedAfter,
            limit: input.limit,
          },
        });
        const alerts = await Promise.all(
          result.findings.map((finding) =>
            upsertFieldAlert({
              repository: repositories.alerts,
              alert: buildAlertFromIntelligenceFinding({
                finding,
              }),
            }),
          ),
        );

        return {
          ...result,
          requestedAt,
          alerts,
        };
      },
      async generateMoistureStressFindings(input) {
        await requireFieldDetail(repositories, input.workspaceId, input.fieldId);
        const requestedAt = input.requestedAt ?? new Date().toISOString();
        const cropContext = await resolveCanonicalCropContext(
          repositories,
          input.workspaceId,
          input.fieldId,
          {
            cropType: input.cropType,
            growthStage: input.growthStage,
          },
        );
        const result = await generateMoistureStressFindings({
          moistureSnapshots: repositories.moistureSnapshots,
          moistureCells: repositories.moistureCellSnapshots,
          weatherSignalSets: repositories.weatherSignalSets,
          runs: repositories.cropIntelligenceRuns,
          findings: repositories.cropIntelligenceFindings,
          zones: repositories.cropIntelligenceZones,
          input: {
            workspaceId: input.workspaceId,
            fieldId: input.fieldId,
            requestedAt,
            cropContext,
          },
          rulePack: prairieDefaultRulePack,
        });
        const alerts = await Promise.all(
          result.findings.map((finding) =>
            upsertFieldAlert({
              repository: repositories.alerts,
              alert: buildAlertFromIntelligenceFinding({
                finding,
              }),
            }),
          ),
        );

        return {
          ...result,
          alerts,
        };
      },
      async generateWeatherRiskFindings(input) {
        await requireFieldDetail(repositories, input.workspaceId, input.fieldId);
        const requestedAt = input.requestedAt ?? new Date().toISOString();
        const cropContext = await resolveCanonicalCropContext(
          repositories,
          input.workspaceId,
          input.fieldId,
          {
            cropType: input.cropType,
            growthStage: input.growthStage,
          },
        );
        const result = await generateWeatherRiskFindings({
          weatherSignalSets: repositories.weatherSignalSets,
          runs: repositories.cropIntelligenceRuns,
          findings: repositories.cropIntelligenceFindings,
          input: {
            workspaceId: input.workspaceId,
            fieldId: input.fieldId,
            requestedAt,
            cropContext,
          },
          rulePack: prairieDefaultRulePack,
        });
        const alerts = await Promise.all(
          result.findings.map((finding) =>
            upsertFieldAlert({
              repository: repositories.alerts,
              alert: buildAlertFromIntelligenceFinding({
                finding,
              }),
            }),
          ),
        );

        return {
          ...result,
          alerts,
        };
      },
      async generateDiseaseRiskFindings(input) {
        await requireFieldDetail(repositories, input.workspaceId, input.fieldId);
        const requestedAt = input.requestedAt ?? new Date().toISOString();
        const cropContext = await resolveCanonicalCropContext(
          repositories,
          input.workspaceId,
          input.fieldId,
          {
            cropType: input.cropType,
            growthStage: input.growthStage,
          },
        );
        const result = await generateDiseaseRiskFindings({
          weatherSignalSets: repositories.weatherSignalSets,
          weatherObservations: repositories.weatherObservations,
          weatherForecasts: repositories.weatherForecasts,
          moistureCells: repositories.moistureCellSnapshots,
          runs: repositories.cropIntelligenceRuns,
          findings: repositories.cropIntelligenceFindings,
          zones: repositories.cropIntelligenceZones,
          input: {
            workspaceId: input.workspaceId,
            fieldId: input.fieldId,
            requestedAt,
            cropContext,
          },
          rulePack: prairieDefaultRulePack,
        });
        const alerts = await Promise.all(
          result.findings.map((finding) =>
            upsertFieldAlert({
              repository: repositories.alerts,
              alert: buildAlertFromIntelligenceFinding({
                finding,
              }),
            }),
          ),
        );

        return {
          ...result,
          alerts,
        };
      },
      async buildRecentDiseaseRiskReport(input = {}) {
        return buildRecentDiseaseRiskReport(repositories, input);
      },
      async syncFindingAlert(input) {
        const finding = await repositories.cropIntelligenceFindings.getById(
          input.workspaceId,
          input.findingId,
        );

        if (!finding) {
          return null;
        }

        const alert = buildAlertFromIntelligenceFinding({
          finding,
          sourceKeyPrefix: input.sourceKeyPrefix,
        });

        return upsertFieldAlert({
          repository: repositories.alerts,
          alert,
        });
      },
    },
    reports: {
      async buildFieldReadModel(input) {
        await requireFieldDetail(repositories, input.workspaceId, input.fieldId);

        return buildFieldReportReadModel({
          repositories: {
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
          },
          workspaceId: input.workspaceId,
          fieldId: input.fieldId,
          reportDate: input.reportDate ?? new Date().toISOString(),
          forecastLimit: input.forecastLimit,
          alertLimit: input.alertLimit,
          findingLimit: input.findingLimit,
          zoneLimit: input.zoneLimit,
        });
      },
      async renderFieldPdf(input) {
        const readModel = await buildFieldReportReadModel({
          repositories: {
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
          },
          workspaceId: input.workspaceId,
          fieldId: input.fieldId,
          reportDate: input.reportDate ?? new Date().toISOString(),
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

          return {
            ...prepared.result,
            artifact: storedArtifact,
            note: `Report rendered and stored for ${prepared.result.summary.fieldName} with ${prepared.result.summary.activeAlertCount} active alerts, ${prepared.result.summary.activeFindingCount} active findings, and ${prepared.result.summary.trackedZoneCount} tracked zones.`,
          };
        }

        return prepared.result;
      },
    },
    development: {
      bootstrapDevelopmentData(input) {
        return bootstrapDevelopmentData(repositories, input);
      },
    },
  };
}
