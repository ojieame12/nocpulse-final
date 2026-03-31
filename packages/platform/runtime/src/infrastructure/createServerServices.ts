import {
  acknowledgeFieldAlert,
  listActiveWorkspaceAlerts,
  listFieldAlerts,
  resolveFieldAlert,
  upsertFieldAlert,
} from "@fieldpulse/module-alerts";
import type { FieldAlert } from "@fieldpulse/module-alerts";
import { resolveAuthenticatedActor } from "@fieldpulse/module-auth";
import {
  FIELD_ACTION_CURATION_SOURCE_KEY,
  buildFieldActionCurationVersion,
  parseFieldActionCuration,
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
  type FieldActionCuration,
  type FieldIntelligenceFinding,
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
  buildRefreshFieldOnboardingPlan,
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
  upsertFieldBasisAssumption,
  upsertFieldYieldAssumption,
  upsertGrainPriceSnapshot,
} from "@fieldpulse/module-market";
import {
  createScoutNote,
  listFieldScoutNotes,
} from "@fieldpulse/module-scouting";
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
  type ResolvedWorkspaceSelection,
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
  IntelligenceAlertSyncFailure,
  IntelligenceAlertSyncSummary,
  WorkspaceFieldDetailSelection,
  WorkspaceFieldOverviewSelection,
} from "../contracts/ServerServices";
import { createDefaultMoistureCellDerivationStrategy } from "./createDefaultMoistureCellDerivationStrategy";
import {
  loadFieldDetailByWorkspace,
  loadWorkspaceFieldDetail,
  loadWorkspaceFieldOverview,
  resolvePreferredWorkspaceSelection,
} from "./fieldSelectionServices";
import {
  bootstrapDevelopmentData,
  commitFieldImportBatch,
  requireFieldDetail,
  saveSpreadsheetImportPreview,
} from "./fieldLifecycleServices";
import {
  buildRecentDiseaseRiskReport,
  buildRecentHailRefreshReport,
  buildRecentImageryProviderProbeFallbackReport,
  buildRecentImagerySyncReport,
  buildRecentWeatherRefreshReport,
} from "./reportAggregationServices";
import {
  buildRuntimeFieldReportReadModel,
  renderRuntimeFieldReportPdf,
} from "./fieldReportServices";
import { curateFieldActionWithGemini } from "./curateFieldActionWithGemini";

const REPORT_FIELD_CONCURRENCY = 12;

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

type WorkspaceFieldLabel = {
  workspaceName?: string | null;
  workspaceSlug?: string | null;
  fieldName?: string | null;
};

type WorkspaceFieldCatalog = {
  fields: Array<{ workspaceId: string; fieldId: string }>;
  fieldLabelsById: Record<string, WorkspaceFieldLabel>;
};

async function syncGeneratedFindingAlerts(
  repository: Pick<ServerRepositories["alerts"], "upsertAlert">,
  findings: readonly FieldIntelligenceFinding[],
): Promise<{
  alerts: readonly FieldAlert[];
  alertSync: IntelligenceAlertSyncSummary;
}> {
  const alerts: FieldAlert[] = [];
  const failures: IntelligenceAlertSyncFailure[] = [];
  const pendingWrites: Array<{
    findingId: string;
    sourceKey: string;
    promise: Promise<FieldAlert>;
  }> = [];

  for (const finding of findings) {
    try {
      const alert = buildAlertFromIntelligenceFinding({ finding });
      pendingWrites.push({
        findingId: finding.id,
        sourceKey: alert.sourceKey,
        promise: upsertFieldAlert({
          repository,
          alert,
        }),
      });
    } catch (error) {
      failures.push({
        findingId: finding.id,
        sourceKey: finding.sourceKey,
        message: toErrorMessage(error),
      });
    }
  }

  const settledWrites = await Promise.allSettled(
    pendingWrites.map((write) => write.promise),
  );

  settledWrites.forEach((result, index) => {
    const pendingWrite = pendingWrites[index];

    if (!pendingWrite) {
      return;
    }

    if (result.status === "fulfilled") {
      alerts.push(result.value);
      return;
    }

    failures.push({
      findingId: pendingWrite.findingId,
      sourceKey: pendingWrite.sourceKey,
      message: toErrorMessage(result.reason),
    });
  });

  return {
    alerts,
    alertSync: {
      attemptedCount: findings.length,
      syncedCount: alerts.length,
      failedCount: failures.length,
      failures,
    },
  };
}

function toSeasonYear(requestedAt: string) {
  return new Date(requestedAt).getUTCFullYear();
}

type RankedIntelligenceEntry = {
  kind: "finding" | "alert";
  family: string;
  severityRank: number;
  trackedZoneCount: number;
  updatedAt: string | null;
  familyPriority: number;
  record: any;
};

function severityRank(value: string | null | undefined) {
  switch (value) {
    case "critical":
      return 4;
    case "high":
      return 3;
    case "medium":
      return 2;
    case "low":
      return 1;
    default:
      return 0;
  }
}

function familyPriority(value: string | null | undefined) {
  switch (value) {
    case "hail_risk":
      return 5;
    case "moisture_stress":
      return 4;
    case "disease_risk":
      return 3;
    case "weather_risk":
      return 2;
    case "crop_health":
      return 1;
    default:
      return 0;
  }
}

function toTimestamp(value: string | null | undefined) {
  if (!value) {
    return 0;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function countTrackedZones(value: any) {
  const trackedZones = value?.evidence?.trackedZones;
  if (Array.isArray(trackedZones)) {
    return trackedZones.length;
  }

  const trackedZoneIds = value?.evidence?.trackedZoneIds;
  if (Array.isArray(trackedZoneIds)) {
    return trackedZoneIds.length;
  }

  return 0;
}

function rankActiveIntelligenceEntries(entries: readonly RankedIntelligenceEntry[]) {
  return [...entries].sort((left, right) => {
    if (right.severityRank !== left.severityRank) {
      return right.severityRank - left.severityRank;
    }

    if (right.trackedZoneCount !== left.trackedZoneCount) {
      return right.trackedZoneCount - left.trackedZoneCount;
    }

    if (right.familyPriority !== left.familyPriority) {
      return right.familyPriority - left.familyPriority;
    }

    const updatedDelta = toTimestamp(right.updatedAt) - toTimestamp(left.updatedAt);
    if (updatedDelta !== 0) {
      return updatedDelta;
    }

    if (left.kind !== right.kind) {
      return left.kind === "finding" ? -1 : 1;
    }

    return 0;
  });
}

function dueDateLabel(value: string | null | undefined) {
  switch (value) {
    case "critical":
    case "high":
      return "Within 24h";
    case "medium":
      return "Within 48h";
    case "low":
      return "This week";
    default:
      return "As available";
  }
}

function stripWrappedEnvValue(value: string | undefined) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (
    (trimmed.startsWith("\"") && trimmed.endsWith("\"")) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim() || null;
  }

  return trimmed || null;
}

function resolveFieldActionCurationConfig() {
  const enabled = process.env.FIELD_ACTION_CURATION_ENABLED?.trim() !== "0";
  if (!enabled) {
    return null;
  }

  const apiKey =
    stripWrappedEnvValue(process.env.GOOGLE_AI_API_KEY) ??
    stripWrappedEnvValue(process.env.GEMINI_API_KEY) ??
    stripWrappedEnvValue(process.env.VITE_GOOGLE_AI_API_KEY);

  if (!apiKey) {
    return null;
  }

  return {
    apiKey,
    modelKey:
      stripWrappedEnvValue(process.env.FIELD_ACTION_CURATION_MODEL) ??
      stripWrappedEnvValue(process.env.GEMINI_MODEL) ??
      "gemini-2.5-flash",
  };
}

function buildFieldActionCurationContext(input: {
  field: { name: string; legalLandDescription?: string | null };
  readModel: any;
}): {
  inputVersion: string;
  facts: Record<string, unknown>;
  basis: {
    state: "active";
    source: "findings" | "alerts";
    topRiskTitle: string;
    topRiskSeverity: "low" | "medium" | "high" | "critical" | null;
    dueDate: string;
    activeFindingCount: number;
    activeZoneCount: number;
    activeAlertCount: number;
  };
} | null {
  const findings = (input.readModel.findings ?? []).filter(
    (finding: any) => finding.status === "active",
  );
  const alerts = (input.readModel.alerts ?? []).filter(
    (alert: any) => alert.status === "active",
  );

  const ranked = rankActiveIntelligenceEntries([
    ...findings.map(
      (finding: any): RankedIntelligenceEntry => ({
        kind: "finding",
        family: finding.family,
        severityRank: severityRank(finding.severity),
        trackedZoneCount: countTrackedZones(finding),
        updatedAt: finding.updatedAt ?? finding.startedAt ?? null,
        familyPriority: familyPriority(finding.family),
        record: finding,
      }),
    ),
    ...alerts.map(
      (alert: any): RankedIntelligenceEntry => ({
        kind: "alert",
        family: alert.family,
        severityRank: severityRank(alert.severity),
        trackedZoneCount: countTrackedZones(alert),
        updatedAt: alert.updatedAt ?? alert.startedAt ?? null,
        familyPriority: familyPriority(alert.family),
        record: alert,
      }),
    ),
  ]);

  const primary = ranked[0];
  if (!primary) {
    return null;
  }

  const activeFindingCount =
    input.readModel.summary?.activeFindingCount ??
    findings.length;
  const activeZoneCount =
    input.readModel.summary?.activeTrackedZoneCount ??
    ((input.readModel.zones?.newZoneCount ?? 0) +
      (input.readModel.zones?.persistentZoneCount ?? 0) +
      (input.readModel.zones?.recoveringZoneCount ?? 0));
  const activeAlertCount =
    input.readModel.summary?.activeAlertCount ??
    alerts.length;
  const topRiskSeverity = (primary.record?.severity ?? null) as
    | "low"
    | "medium"
    | "high"
    | "critical"
    | null;
  const dueDate = dueDateLabel(topRiskSeverity);
  const basis = {
    state: "active" as const,
    source: primary.kind === "finding" ? "findings" as const : "alerts" as const,
    topRiskTitle: primary.record?.title ?? "Active field intelligence",
    topRiskSeverity,
    dueDate,
    activeFindingCount,
    activeZoneCount,
    activeAlertCount,
  };
  const inputVersion = buildFieldActionCurationVersion(basis);
  const moisture = input.readModel.moisture?.latestSnapshot ?? null;
  const weatherSignals = input.readModel.weather?.signals ?? null;

  return {
    inputVersion,
    basis,
    facts: {
      field: {
        name: input.field.name,
        lld: input.field.legalLandDescription ?? null,
        cropType:
          input.readModel.cropContext?.cropType ??
          input.readModel.summary?.cropType ??
          null,
        growthStage:
          input.readModel.cropContext?.growthStage ??
          input.readModel.summary?.growthStage ??
          null,
      },
      intelligence: {
        state: "active",
        source: basis.source,
        topRiskTitle: basis.topRiskTitle,
        topRiskSeverity: basis.topRiskSeverity,
        dueDate: basis.dueDate,
        activeFindingCount,
        activeZoneCount,
        activeAlertCount,
        trackedZoneCount: primary.trackedZoneCount,
        primaryFamily: primary.family,
        primarySummary: primary.record?.summary ?? null,
        primaryExplanation: primary.record?.explanation ?? null,
        primaryRecommendedAction: primary.record?.recommendedAction ?? null,
        additionalActiveItems: ranked.slice(1, 3).map((entry) => ({
          kind: entry.kind,
          family: entry.family,
          title: entry.record?.title ?? null,
          severity: entry.record?.severity ?? null,
        })),
      },
      moisture: moisture
        ? {
            observedAt: moisture.observedAt ?? null,
            sourceKey: moisture.sourceKey ?? null,
            rootZonePct: moisture.rootZonePct ?? null,
            surfacePct: moisture.surfacePct ?? null,
            confidence: moisture.confidence ?? null,
          }
        : null,
      weather: weatherSignals
        ? {
            observedAt: weatherSignals.observedAt ?? null,
            updatedAt: weatherSignals.updatedAt ?? null,
            sourceKey: weatherSignals.sourceKey ?? null,
            frostRiskMinTempC: weatherSignals.frostRiskMinTempC ?? null,
            peakForecastVpdKpa24h: weatherSignals.peakForecastVpdKpa24h ?? null,
            netWaterBalance72hMm: weatherSignals.netWaterBalance72hMm ?? null,
          }
        : null,
    },
  };
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
          userId: input.userId,
          preferredWorkspaceId: input.preferredWorkspaceId,
        });
      },
    },
    fields: {
      async renameField(input) {
        await requireFieldDetail(repositories, input.workspaceId, input.fieldId);

        return repositories.fields.renameField(
          input.workspaceId,
          input.fieldId,
          input.name,
        );
      },
      async setLegalLandDescription(input) {
        await requireFieldDetail(repositories, input.workspaceId, input.fieldId);

        return repositories.fields.setLegalLandDescription(
          input.workspaceId,
          input.fieldId,
          input.legalLandDescription,
        );
      },
      async deleteField(input) {
        await requireFieldDetail(repositories, input.workspaceId, input.fieldId);

        await repositories.fields.deleteField(input.workspaceId, input.fieldId);
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
      async buildRefreshPlan(input) {
        return buildRefreshFieldOnboardingPlan(input);
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
      async dispatchRefreshPlan(input) {
        if (!options.jobDispatcher) {
          throw new Error(
            "[runtime] field onboarding dispatch requested without a job dispatcher",
          );
        }

        const plan = buildRefreshFieldOnboardingPlan(input);

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
      async listWorkspaceCropContexts(workspaceId) {
        return repositories.fieldCropContexts.listLatestByWorkspace(workspaceId);
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
    scouting: {
      async listFieldNotes(input) {
        await requireFieldDetail(repositories, input.workspaceId, input.fieldId);

        return listFieldScoutNotes({
          repository: repositories.scoutNotes,
          workspaceId: input.workspaceId,
          fieldId: input.fieldId,
          limit: input.limit,
        });
      },
      async createFieldNote(input) {
        await requireFieldDetail(repositories, input.workspaceId, input.fieldId);

        return createScoutNote({
          repository: repositories.scoutNotes,
          input,
        });
      },
    },
    market: {
      latestPrice(input) {
        return repositories.grainPriceSnapshots.latest(input.cropSymbol);
      },
      recentPrices(input) {
        return repositories.grainPriceSnapshots.recent(
          input.cropSymbol,
          input.limit ?? 8,
        );
      },
      upsertPrice(input) {
        return upsertGrainPriceSnapshot({
          repository: repositories.grainPriceSnapshots,
          input,
        });
      },
      latestFieldBasisAssumption(input) {
        return repositories.fieldBasisAssumptions.latest(
          input.workspaceId,
          input.fieldId,
          input.seasonYear,
          input.cropSymbol,
        );
      },
      async upsertFieldBasisAssumption(input) {
        await requireFieldDetail(repositories, input.workspaceId, input.fieldId);

        return upsertFieldBasisAssumption({
          repository: repositories.fieldBasisAssumptions,
          input,
        });
      },
      latestFieldYieldAssumption(input) {
        return repositories.fieldYieldAssumptions.latest(
          input.workspaceId,
          input.fieldId,
          input.seasonYear,
          input.cropSymbol,
        );
      },
      async upsertFieldYieldAssumption(input) {
        await requireFieldDetail(repositories, input.workspaceId, input.fieldId);

        return upsertFieldYieldAssumption({
          repository: repositories.fieldYieldAssumptions,
          input,
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
      loadFieldDetailByWorkspace(input) {
        return loadFieldDetailByWorkspace(repositories, input);
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
        const fieldPromise = requireFieldDetail(
          repositories,
          input.workspaceId,
          input.fieldId,
        );
        const [field, latestRasterObservation, latestWeatherObservation] =
          await Promise.all([
            fieldPromise,
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
        const fieldPromise = requireFieldDetail(
          repositories,
          input.workspaceId,
          input.fieldId,
        );
        const [field, latestSnapshot] = await Promise.all([
          fieldPromise,
          repositories.moistureSnapshots.getLatestByField(
            input.workspaceId,
            input.fieldId,
          ),
        ]);

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
          family: input.family,
          updatedAfter: input.updatedAfter,
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
          zones: repositories.cropIntelligenceZones,
          input: {
            workspaceId: input.workspaceId,
            fieldId: input.fieldId,
            requestedAt,
            reportedAfter: input.reportedAfter,
            limit: input.limit,
          },
        });
        const { alerts, alertSync } = await syncGeneratedFindingAlerts(
          repositories.alerts,
          result.findings,
        );

        return {
          ...result,
          requestedAt,
          alerts,
          alertSync,
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
        const { alerts, alertSync } = await syncGeneratedFindingAlerts(
          repositories.alerts,
          result.findings,
        );

        return {
          ...result,
          alerts,
          alertSync,
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
        const { alerts, alertSync } = await syncGeneratedFindingAlerts(
          repositories.alerts,
          result.findings,
        );

        return {
          ...result,
          alerts,
          alertSync,
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
        const { alerts, alertSync } = await syncGeneratedFindingAlerts(
          repositories.alerts,
          result.findings,
        );

        return {
          ...result,
          alerts,
          alertSync,
        };
      },
      async loadLatestFieldActionCuration(input) {
        const [run] = await repositories.cropIntelligenceRuns.listRecentRuns({
          workspaceId: input.workspaceId,
          fieldId: input.fieldId,
          sourceKey: FIELD_ACTION_CURATION_SOURCE_KEY,
          status: "completed",
          limit: 1,
        });

        if (!run) {
          return null;
        }

        return parseFieldActionCuration(run.provenance, run.inputVersion);
      },
      async curateFieldAction(input) {
        const config = resolveFieldActionCurationConfig();
        if (!config) {
          return null;
        }

        const requestedAt = input.requestedAt ?? new Date().toISOString();
        const field = await requireFieldDetail(
          repositories,
          input.workspaceId,
          input.fieldId,
        );
        const readModel = await buildRuntimeFieldReportReadModel(repositories, {
          workspaceId: input.workspaceId,
          fieldId: input.fieldId,
          field,
          reportDate: requestedAt,
        });
        const context = buildFieldActionCurationContext({
          field,
          readModel,
        });

        if (!context) {
          return null;
        }

        const [latestRun] = await repositories.cropIntelligenceRuns.listRecentRuns({
          workspaceId: input.workspaceId,
          fieldId: input.fieldId,
          sourceKey: FIELD_ACTION_CURATION_SOURCE_KEY,
          status: "completed",
          limit: 1,
        });
        const latestCuration = latestRun
          ? parseFieldActionCuration(latestRun.provenance, latestRun.inputVersion)
          : null;

        if (
          !input.force &&
          latestCuration &&
          latestCuration.inputVersion === context.inputVersion
        ) {
          return latestCuration;
        }

        try {
          const generated = await curateFieldActionWithGemini({
            apiKey: config.apiKey,
            modelKey: config.modelKey,
            facts: context.facts,
          });
          const completedAt = new Date().toISOString();
          const curation: FieldActionCuration = {
            inputVersion: context.inputVersion,
            generatedAt: completedAt,
            ...generated,
          };

          await repositories.cropIntelligenceRuns.upsertRun({
            workspaceId: input.workspaceId,
            fieldId: input.fieldId,
            sourceKey: FIELD_ACTION_CURATION_SOURCE_KEY,
            modelKey: config.modelKey,
            status: "completed",
            startedAt: requestedAt,
            completedAt,
            inputVersion: context.inputVersion,
            provenance: {
              kind: FIELD_ACTION_CURATION_SOURCE_KEY,
              provider: curation.provider,
              modelKey: curation.modelKey,
              generatedAt: curation.generatedAt,
              recommendation: curation.recommendation,
              explanation: curation.explanation,
              inspectFirst: curation.inspectFirst,
              whyNow: curation.whyNow,
              supportingContext: curation.supportingContext,
              confidence: curation.confidence,
            },
          });

          return curation;
        } catch (error) {
          await repositories.cropIntelligenceRuns.upsertRun({
            workspaceId: input.workspaceId,
            fieldId: input.fieldId,
            sourceKey: FIELD_ACTION_CURATION_SOURCE_KEY,
            modelKey: config.modelKey,
            status: "failed",
            startedAt: requestedAt,
            completedAt: new Date().toISOString(),
            inputVersion: context.inputVersion,
            provenance: {
              kind: `${FIELD_ACTION_CURATION_SOURCE_KEY}-error`,
              message: toErrorMessage(error),
            },
          });

          return null;
        }
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
        const field = await requireFieldDetail(
          repositories,
          input.workspaceId,
          input.fieldId,
        );

        return buildRuntimeFieldReportReadModel(repositories, {
          workspaceId: input.workspaceId,
          fieldId: input.fieldId,
          field,
          reportDate: input.reportDate ?? new Date().toISOString(),
          forecastLimit: input.forecastLimit,
          alertLimit: input.alertLimit,
          findingLimit: input.findingLimit,
          zoneLimit: input.zoneLimit,
        });
      },
      async renderFieldPdf(input) {
        return renderRuntimeFieldReportPdf(
          repositories,
          {
            workspaceId: input.workspaceId,
            fieldId: input.fieldId,
            reportDate: input.reportDate ?? new Date().toISOString(),
            dryRun: input.dryRun,
          },
          {
            reportArtifactStore: options.reportArtifactStore,
          },
        );
      },
    },
    development: {
      bootstrapDevelopmentData(input) {
        return bootstrapDevelopmentData(repositories, input);
      },
    },
  };
}
