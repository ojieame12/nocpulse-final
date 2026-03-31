import type {
  AcknowledgeFieldAlertInput,
  AlertSummary,
  FieldAlert,
  ResolveFieldAlertInput,
  UpsertFieldAlertInput,
} from "@fieldpulse/module-alerts";
import type { AuthenticatedActor } from "@fieldpulse/module-auth";
import type {
  BuildFieldZoneActivityReportInput,
  CropIntelligenceRun,
  FieldActionCuration,
  DiseaseRiskReport,
  GenerateDiseaseRiskFindingsResult,
  FieldIntelligenceFinding,
  FieldZoneActivityReport,
  FieldIntelligenceZone,
  GenerateHailRiskFindingsResult,
  GenerateMoistureStressFindingsResult,
  GenerateWeatherRiskFindingsResult,
  IntelligenceFindingStatus,
  IntelligenceFindingFamily,
  IntelligenceZoneStatus,
  UpsertCropIntelligenceRunInput,
  UpsertFieldIntelligenceFindingInput,
} from "@fieldpulse/module-crop-intelligence";
import type {
  FieldCropContext,
  UpsertFieldCropContextInput,
} from "@fieldpulse/module-field-crop-context";
import type {
  CommitSpreadsheetImportBatchResult,
  CreateSpreadsheetImportBatchResult,
  FieldImportBatch,
  FieldImportCandidate,
  ParseFieldBoundaryFileInput,
  ParsedFieldBoundaryFile,
  LookupLldBoundaryInput,
  LldLookupResult,
  PreviewSpreadsheetImportFileInput,
  SpreadsheetImportPreview,
} from "@fieldpulse/module-field-intake";
import type {
  BuildInitialFieldOnboardingPlanInput,
  FieldOnboardingDispatchReceipt,
  FieldOnboardingPlan,
} from "@fieldpulse/module-field-onboarding";
import type {
  CreateFieldInput,
  FieldDetail,
  FieldOverview,
} from "@fieldpulse/module-fields";
import type {
  RefreshFieldHailEventsInput,
  RefreshFieldHailEventsResult,
  HailRefreshReport,
  FieldHailEvent,
  UpsertFieldHailEventInput,
} from "@fieldpulse/module-hail";
import type {
  ImageryProviderProbeFallbackReport,
  ImageryProviderDiagnostics,
  ImageryProviderFieldDiagnostics,
  ImageryProviderProbeRecord,
  ImagerySyncReport,
  SyncLatestImageryInput,
  SyncLatestImageryResult,
} from "@fieldpulse/module-imagery";
import type {
  FieldBasisAssumption,
  FieldYieldAssumption,
  GrainPriceSnapshot,
  UpsertFieldBasisAssumptionInput,
  UpsertFieldYieldAssumptionInput,
  UpsertGrainPriceSnapshotInput,
} from "@fieldpulse/module-market";
import type {
  FieldMoistureCellSnapshot,
  FieldMoistureSnapshot,
  RebuildFieldMoistureEstimateInput,
  RebuildFieldMoistureEstimateResult,
  UpsertFieldMoistureSnapshotInput,
} from "@fieldpulse/module-moisture";
import type {
  CreateScoutNoteInput,
  ScoutNote,
} from "@fieldpulse/module-scouting";
import type {
  ComputeFieldWeatherDerivedSignalsInput,
  FieldWeatherDerivedSignalSet,
  FieldWeatherForecast,
  FieldWeatherObservation,
  FieldWeatherProfile,
  RefreshFieldWeatherResult,
  ReplaceFieldWeatherForecastSetInput,
  UpsertFieldWeatherObservationInput,
  WeatherRefreshReport,
} from "@fieldpulse/module-weather";
import type {
  BuildFieldReportReadModelInput,
  FieldReportReadModel,
  RenderFieldReportInput,
  RenderFieldReportResult,
} from "@fieldpulse/module-reports";
import type {
  CreateWorkspaceInput,
  ResolvedWorkspaceSelection,
  Workspace,
} from "@fieldpulse/module-workspaces";
import type { UserId, WorkspaceId } from "@fieldpulse/platform-db";

export type {
  CommitSpreadsheetImportBatchResult,
  ComputeFieldWeatherDerivedSignalsInput,
  CreateSpreadsheetImportBatchResult,
  FieldImportBatch,
  FieldImportCandidate,
  BuildInitialFieldOnboardingPlanInput,
  FieldOnboardingDispatchReceipt,
  FieldOnboardingPlan,
  LookupLldBoundaryInput,
  LldLookupResult,
  ParseFieldBoundaryFileInput,
  ParsedFieldBoundaryFile,
  PreviewSpreadsheetImportFileInput,
  SpreadsheetImportPreview,
};

export type LoadWorkspaceFieldOverviewInput = {
  actorUserId?: UserId;
  preferredWorkspaceId?: WorkspaceId;
};

export type WorkspaceFieldOverviewSelection = ResolvedWorkspaceSelection & {
  fields: readonly FieldOverview[];
  primaryField: FieldOverview | null;
};

export type LoadWorkspaceFieldDetailInput = LoadWorkspaceFieldOverviewInput & {
  fieldId: string;
};

export type RenameFieldInput = {
  workspaceId: WorkspaceId;
  fieldId: string;
  name: string;
};

export type UpdateFieldLegalLandDescriptionInput = {
  workspaceId: WorkspaceId;
  fieldId: string;
  legalLandDescription: string | null;
};

export type DeleteFieldInput = {
  workspaceId: WorkspaceId;
  fieldId: string;
};

export type LoadFieldDetailByWorkspaceInput = {
  workspaceId: WorkspaceId;
  fieldId: string;
};

export type WorkspaceFieldDetailSelection = ResolvedWorkspaceSelection & {
  fields: readonly FieldOverview[];
  field: {
    detail: FieldDetail;
    overview: FieldOverview | null;
    readModel: FieldReportReadModel;
  } | null;
};

export type DirectWorkspaceFieldDetailSelection = {
  selectedWorkspace: Workspace | null;
  fields: readonly FieldOverview[];
  field: {
    detail: FieldDetail;
    overview: FieldOverview | null;
    readModel: FieldReportReadModel;
  } | null;
};

export type BootstrapDevelopmentDataInput = {
  actorUserId: UserId;
  workspace: CreateWorkspaceInput;
  field: Omit<CreateFieldInput, "workspaceId">;
  moistureSnapshot: Omit<UpsertFieldMoistureSnapshotInput, "workspaceId" | "fieldId">;
};

export type BootstrapDevelopmentDataResult = {
  actorUserId: UserId;
  workspace: {
    workspace: Workspace;
    action: "created" | "reused";
  };
  field: {
    field: FieldDetail;
    action: "created" | "reused";
  };
  moistureSnapshot: {
    snapshot: FieldMoistureSnapshot;
    action: "created" | "reused";
  };
  imageryObservation: {
    observationId: string;
    sourceKey: string;
    cellCount: number;
    action: "replaced";
  };
  moistureCells: {
    count: number;
    action: "replaced";
  };
};

export type SyncLatestFieldImageryInput = Omit<SyncLatestImageryInput, "requestedAt"> & {
  requestedAt?: string;
};

export type ProbeFieldImageryProvidersInput = {
  workspaceId: WorkspaceId;
  fieldId: string;
  requestedAt?: string;
};

export type ListFieldImageryProviderProbeHistoryInput = {
  workspaceId: WorkspaceId;
  fieldId: string;
  limit?: number;
};

export type BuildRecentImageryProviderProbeFallbackReportInput = {
  createdAfter?: string;
  limit?: number;
};

export type BuildRecentImagerySyncReportInput = {
  workspaceId?: WorkspaceId;
  createdAfter?: string;
  staleAfterHours?: number;
  limit?: number;
};

export type LoadLatestMarketPriceInput = {
  cropSymbol: string;
};

export type LoadRecentMarketPricesInput = {
  cropSymbol: string;
  limit?: number;
};

export type UpsertLatestMarketPriceInput = UpsertGrainPriceSnapshotInput;
export type LoadLatestFieldBasisAssumptionInput = {
  workspaceId: WorkspaceId;
  fieldId: string;
  seasonYear?: number | null;
  cropSymbol?: string | null;
};
export type UpsertLatestFieldBasisAssumptionInput = UpsertFieldBasisAssumptionInput;
export type LoadLatestFieldYieldAssumptionInput = {
  workspaceId: WorkspaceId;
  fieldId: string;
  seasonYear?: number | null;
  cropSymbol?: string | null;
};
export type UpsertLatestFieldYieldAssumptionInput = UpsertFieldYieldAssumptionInput;

export type RebuildFieldEstimateInput = Omit<
  RebuildFieldMoistureEstimateInput,
  "observedAt" | "sourceKey" | "inputs"
> & {
  observedAt?: string;
  sourceKey?: string;
  inputs?: RebuildFieldMoistureEstimateInput["inputs"];
};

export type RebuildFieldCellsInput = Pick<
  RebuildFieldEstimateInput,
  "workspaceId" | "fieldId"
>;

export type RebuildFieldCellsResult = {
  workspaceId: WorkspaceId;
  fieldId: string;
  action: "replaced" | "skipped";
  reason?: "missing-snapshot";
  snapshotId: string | null;
  snapshotObservedAt: string | null;
  snapshotSourceKey: string | null;
  strategyKey: string | null;
  cellCount: number;
};

export type RenderFieldPdfInput = {
  workspaceId: WorkspaceId;
  fieldId: string;
  reportDate?: string;
  dryRun?: boolean;
};

export type BuildFieldReportReadModelServiceInput = Omit<
  BuildFieldReportReadModelInput,
  "repositories" | "reportDate" | "generatedAt"
> & {
  reportDate?: string;
};

export type LoadFieldWeatherInput = {
  workspaceId: WorkspaceId;
  fieldId: string;
  validAfter?: string;
  forecastLimit?: number;
};

export type LoadFieldScoutNotesInput = {
  workspaceId: WorkspaceId;
  fieldId: string;
  limit?: number;
};

export type CreateFieldScoutNoteServiceInput = CreateScoutNoteInput;

export type LoadFieldCropContextInput = {
  workspaceId: WorkspaceId;
  fieldId: string;
};

export type RefreshFieldCropStageInput = {
  workspaceId: WorkspaceId;
  fieldId: string;
  requestedAt?: string;
};

export type SetFieldGrowthStageOverrideInput = {
  workspaceId: WorkspaceId;
  fieldId: string;
  growthStage: string;
  requestedAt?: string;
};

export type ClearFieldGrowthStageOverrideInput = {
  workspaceId: WorkspaceId;
  fieldId: string;
  requestedAt?: string;
};

export type RefreshFieldWeatherInput = {
  workspaceId: WorkspaceId;
  fieldId: string;
  requestedAt?: string;
  forecastHours?: number;
};

export type LoadFieldWeatherDerivedSignalsInput = {
  workspaceId: WorkspaceId;
  fieldId: string;
};

export type LoadFieldHailInput = {
  workspaceId: WorkspaceId;
  fieldId: string;
  limit?: number;
  reportedAfter?: string;
};

export type LoadWorkspaceHailInput = {
  workspaceId: WorkspaceId;
  limit?: number;
  reportedAfter?: string;
};

export type RefreshFieldHailInput = RefreshFieldHailEventsInput;

export type BuildRecentHailRefreshReportInput = {
  workspaceId?: WorkspaceId;
  requestedAfter?: string;
  staleAfterHours?: number;
  limit?: number;
};

export type LoadFieldAlertsInput = {
  workspaceId: WorkspaceId;
  fieldId: string;
  limit?: number;
  status?: FieldAlert["status"];
};

export type LoadWorkspaceAlertsInput = {
  workspaceId: WorkspaceId;
  limit?: number;
};

export type LoadFieldIntelligenceFindingsInput = {
  workspaceId: WorkspaceId;
  fieldId: string;
  limit?: number;
  status?: IntelligenceFindingStatus;
};

export type LoadFieldIntelligenceZonesInput = {
  workspaceId: WorkspaceId;
  fieldId: string;
  family?: IntelligenceFindingFamily;
  trackingKey?: string;
  status?: IntelligenceZoneStatus;
  limit?: number;
};

export type BuildFieldIntelligenceZoneActivityReportInput = Omit<
  BuildFieldZoneActivityReportInput,
  "repository" | "generatedAt"
>;

export type LoadWorkspaceIntelligenceFindingsInput = {
  workspaceId: WorkspaceId;
  limit?: number;
  status?: IntelligenceFindingStatus;
  family?: IntelligenceFindingFamily;
  updatedAfter?: string;
};

export type SyncIntelligenceFindingAlertInput = {
  workspaceId: WorkspaceId;
  findingId: string;
  sourceKeyPrefix?: string;
};

export type GenerateFieldHailRiskFindingsInput = {
  workspaceId: WorkspaceId;
  fieldId: string;
  requestedAt?: string;
  reportedAfter?: string;
  limit?: number;
};

export type IntelligenceAlertSyncFailure = {
  findingId: string;
  sourceKey: string;
  message: string;
};

export type IntelligenceAlertSyncSummary = {
  attemptedCount: number;
  syncedCount: number;
  failedCount: number;
  failures: readonly IntelligenceAlertSyncFailure[];
};

export type GenerateFieldHailRiskFindingsResult = GenerateHailRiskFindingsResult & {
  requestedAt: string;
  alerts: readonly FieldAlert[];
  alertSync: IntelligenceAlertSyncSummary;
};

export type GenerateFieldMoistureStressFindingsInput = {
  workspaceId: WorkspaceId;
  fieldId: string;
  requestedAt?: string;
  cropType?: string;
  growthStage?: string;
};

export type GenerateFieldMoistureStressFindingsResult =
  GenerateMoistureStressFindingsResult & {
    alerts: readonly FieldAlert[];
    alertSync: IntelligenceAlertSyncSummary;
  };

export type GenerateFieldWeatherRiskFindingsInput = {
  workspaceId: WorkspaceId;
  fieldId: string;
  requestedAt?: string;
  cropType?: string;
  growthStage?: string;
};

export type GenerateFieldWeatherRiskFindingsResult =
  GenerateWeatherRiskFindingsResult & {
    alerts: readonly FieldAlert[];
    alertSync: IntelligenceAlertSyncSummary;
  };

export type GenerateFieldDiseaseRiskFindingsInput = {
  workspaceId: WorkspaceId;
  fieldId: string;
  requestedAt?: string;
  cropType?: string;
  growthStage?: string;
};

export type GenerateFieldDiseaseRiskFindingsResult =
  GenerateDiseaseRiskFindingsResult & {
    alerts: readonly FieldAlert[];
    alertSync: IntelligenceAlertSyncSummary;
  };

export type LoadLatestFieldActionCurationInput = {
  workspaceId: WorkspaceId;
  fieldId: string;
};

export type CurateFieldActionInput = {
  workspaceId: WorkspaceId;
  fieldId: string;
  requestedAt?: string;
  force?: boolean;
};

export type BuildRecentDiseaseRiskReportInput = {
  workspaceId?: WorkspaceId;
  startedAfter?: string;
  staleAfterHours?: number;
  limit?: number;
};

export type BuildRecentWeatherRefreshReportInput = {
  workspaceId?: WorkspaceId;
  updatedAfter?: string;
  staleAfterHours?: number;
  limit?: number;
};

export type SaveSpreadsheetImportPreviewInput = {
  actorUserId: UserId;
  workspaceId: WorkspaceId;
  preview: SpreadsheetImportPreview;
};

export type SaveSpreadsheetImportPreviewResult = CreateSpreadsheetImportBatchResult;

export type CommitFieldImportBatchInput = {
  actorUserId: UserId;
  workspaceId: WorkspaceId;
  batchId: string;
  onboardingDryRun?: boolean;
};

export type CommitFieldImportBatchResult = {
  batch: FieldImportBatch;
  candidates: CommitSpreadsheetImportBatchResult["candidates"];
  onboardingDispatches: readonly {
    fieldId: string;
    action: "created" | "reused";
    receipts: readonly FieldOnboardingDispatchReceipt[];
  }[];
};

export type ServerServices = {
  auth: {
    resolveActor(input: {
      userId: UserId;
      preferredWorkspaceId?: WorkspaceId;
    }): Promise<AuthenticatedActor | null>;
  };
  fields: {
    renameField(input: RenameFieldInput): Promise<FieldDetail>;
    setLegalLandDescription(
      input: UpdateFieldLegalLandDescriptionInput,
    ): Promise<FieldDetail>;
    deleteField(input: DeleteFieldInput): Promise<void>;
  };
  fieldIntake: {
    lookupLldBoundary(
      input: LookupLldBoundaryInput,
    ): Promise<LldLookupResult>;
    parseBoundaryFile(
      input: ParseFieldBoundaryFileInput,
    ): Promise<ParsedFieldBoundaryFile>;
    previewSpreadsheetImport(
      input: PreviewSpreadsheetImportFileInput,
    ): Promise<SpreadsheetImportPreview>;
    saveSpreadsheetImportPreview(
      input: SaveSpreadsheetImportPreviewInput,
    ): Promise<SaveSpreadsheetImportPreviewResult>;
    commitSpreadsheetImportBatch(
      input: CommitFieldImportBatchInput,
    ): Promise<CommitFieldImportBatchResult>;
  };
  fieldOnboarding: {
    buildInitialPlan(
      input: BuildInitialFieldOnboardingPlanInput,
    ): Promise<FieldOnboardingPlan>;
    buildRefreshPlan(
      input: BuildInitialFieldOnboardingPlanInput,
    ): Promise<FieldOnboardingPlan>;
    dispatchInitialPlan(
      input: BuildInitialFieldOnboardingPlanInput,
    ): Promise<readonly FieldOnboardingDispatchReceipt[]>;
    dispatchRefreshPlan(
      input: BuildInitialFieldOnboardingPlanInput,
    ): Promise<readonly FieldOnboardingDispatchReceipt[]>;
  };
  fieldCropContext: {
    loadFieldContext(
      input: LoadFieldCropContextInput,
    ): Promise<FieldCropContext | null>;
    listWorkspaceCropContexts(
      workspaceId: WorkspaceId,
    ): Promise<readonly FieldCropContext[]>;
    upsertFieldContext(
      input: UpsertFieldCropContextInput,
    ): Promise<FieldCropContext>;
    clearFieldContext(input: {
      workspaceId: WorkspaceId;
      fieldId: string;
      seasonYear: number;
    }): Promise<void>;
    refreshGrowthStage(
      input: RefreshFieldCropStageInput,
    ): Promise<FieldCropContext | null>;
    setGrowthStageOverride(
      input: SetFieldGrowthStageOverrideInput,
    ): Promise<FieldCropContext>;
    clearGrowthStageOverride(
      input: ClearFieldGrowthStageOverrideInput,
    ): Promise<FieldCropContext | null>;
  };
  scouting: {
    listFieldNotes(
      input: LoadFieldScoutNotesInput,
    ): Promise<readonly ScoutNote[]>;
    createFieldNote(
      input: CreateFieldScoutNoteServiceInput,
    ): Promise<ScoutNote>;
  };
  market: {
    latestPrice(
      input: LoadLatestMarketPriceInput,
    ): Promise<GrainPriceSnapshot | null>;
    recentPrices(
      input: LoadRecentMarketPricesInput,
    ): Promise<readonly GrainPriceSnapshot[]>;
    upsertPrice(
      input: UpsertLatestMarketPriceInput,
    ): Promise<GrainPriceSnapshot>;
    latestFieldBasisAssumption(
      input: LoadLatestFieldBasisAssumptionInput,
    ): Promise<FieldBasisAssumption | null>;
    upsertFieldBasisAssumption(
      input: UpsertLatestFieldBasisAssumptionInput,
    ): Promise<FieldBasisAssumption>;
    latestFieldYieldAssumption(
      input: LoadLatestFieldYieldAssumptionInput,
    ): Promise<FieldYieldAssumption | null>;
    upsertFieldYieldAssumption(
      input: UpsertLatestFieldYieldAssumptionInput,
    ): Promise<FieldYieldAssumption>;
  };
  workspaces: {
    listAll(): Promise<readonly Workspace[]>;
    listForUser(userId: UserId): Promise<readonly Workspace[]>;
    resolveSelection(
      input: LoadWorkspaceFieldOverviewInput,
    ): Promise<ResolvedWorkspaceSelection>;
  };
  catalog: {
    loadWorkspaceFieldOverview(
      input: LoadWorkspaceFieldOverviewInput,
    ): Promise<WorkspaceFieldOverviewSelection>;
    loadWorkspaceFieldDetail(
      input: LoadWorkspaceFieldDetailInput,
    ): Promise<WorkspaceFieldDetailSelection>;
    loadFieldDetailByWorkspace(
      input: LoadFieldDetailByWorkspaceInput,
    ): Promise<DirectWorkspaceFieldDetailSelection>;
  };
  imagery: {
    inspectProviders(): Promise<readonly ImageryProviderDiagnostics[]>;
    inspectProvidersForField(
      input: ProbeFieldImageryProvidersInput,
    ): Promise<readonly ImageryProviderFieldDiagnostics[]>;
    recordProviderProbeForField(
      input: ProbeFieldImageryProvidersInput,
    ): Promise<readonly ImageryProviderProbeRecord[]>;
    listProviderProbeHistoryForField(
      input: ListFieldImageryProviderProbeHistoryInput,
    ): Promise<readonly ImageryProviderProbeRecord[]>;
    buildRecentProbeFallbackReport(
      input?: BuildRecentImageryProviderProbeFallbackReportInput,
    ): Promise<ImageryProviderProbeFallbackReport>;
    buildRecentSyncReport(
      input?: BuildRecentImagerySyncReportInput,
    ): Promise<ImagerySyncReport>;
    syncLatestFieldImagery(
      input: SyncLatestFieldImageryInput,
    ): Promise<SyncLatestImageryResult>;
  };
  moisture: {
    rebuildFieldEstimate(
      input: RebuildFieldEstimateInput,
    ): Promise<RebuildFieldMoistureEstimateResult>;
    rebuildFieldCells(
      input: RebuildFieldCellsInput,
    ): Promise<RebuildFieldCellsResult>;
  };
  weather: {
    loadFieldWeather(
      input: LoadFieldWeatherInput,
    ): Promise<FieldWeatherProfile>;
    loadFieldDerivedSignals(
      input: LoadFieldWeatherDerivedSignalsInput,
    ): Promise<FieldWeatherDerivedSignalSet | null>;
    refreshFieldWeather(
      input: RefreshFieldWeatherInput,
    ): Promise<RefreshFieldWeatherResult>;
    computeFieldDerivedSignals(
      input: ComputeFieldWeatherDerivedSignalsInput,
    ): Promise<FieldWeatherDerivedSignalSet | null>;
    buildRecentRefreshReport(
      input?: BuildRecentWeatherRefreshReportInput,
    ): Promise<WeatherRefreshReport>;
    upsertFieldObservation(
      input: UpsertFieldWeatherObservationInput,
    ): Promise<FieldWeatherObservation>;
    replaceFieldForecastSet(
      input: ReplaceFieldWeatherForecastSetInput,
    ): Promise<readonly FieldWeatherForecast[]>;
  };
  hail: {
    loadFieldEvents(
      input: LoadFieldHailInput,
    ): Promise<readonly FieldHailEvent[]>;
    loadWorkspaceEvents(
      input: LoadWorkspaceHailInput,
    ): Promise<readonly FieldHailEvent[]>;
    refreshFieldEvents(
      input: RefreshFieldHailInput,
    ): Promise<RefreshFieldHailEventsResult>;
    buildRecentRefreshReport(
      input?: BuildRecentHailRefreshReportInput,
    ): Promise<HailRefreshReport>;
    upsertFieldEvent(
      input: UpsertFieldHailEventInput,
    ): Promise<FieldHailEvent>;
  };
  alerts: {
    loadActiveWorkspaceAlerts(
      input: LoadWorkspaceAlertsInput,
    ): Promise<readonly AlertSummary[]>;
    loadFieldAlerts(
      input: LoadFieldAlertsInput,
    ): Promise<readonly FieldAlert[]>;
    upsertFieldAlert(
      input: UpsertFieldAlertInput,
    ): Promise<FieldAlert>;
    acknowledgeFieldAlert(
      input: AcknowledgeFieldAlertInput,
    ): Promise<FieldAlert | null>;
    resolveFieldAlert(
      input: ResolveFieldAlertInput,
    ): Promise<FieldAlert | null>;
  };
  intelligence: {
    loadFieldFindings(
      input: LoadFieldIntelligenceFindingsInput,
    ): Promise<readonly FieldIntelligenceFinding[]>;
    loadFieldZones(
      input: LoadFieldIntelligenceZonesInput,
    ): Promise<readonly FieldIntelligenceZone[]>;
    buildFieldZoneActivityReport(
      input: BuildFieldIntelligenceZoneActivityReportInput,
    ): Promise<FieldZoneActivityReport>;
    loadWorkspaceFindings(
      input: LoadWorkspaceIntelligenceFindingsInput,
    ): Promise<readonly FieldIntelligenceFinding[]>;
    upsertRun(
      input: UpsertCropIntelligenceRunInput,
    ): Promise<CropIntelligenceRun>;
    upsertFinding(
      input: UpsertFieldIntelligenceFindingInput,
    ): Promise<FieldIntelligenceFinding>;
    generateHailRiskFindings(
      input: GenerateFieldHailRiskFindingsInput,
    ): Promise<GenerateFieldHailRiskFindingsResult>;
    generateMoistureStressFindings(
      input: GenerateFieldMoistureStressFindingsInput,
    ): Promise<GenerateFieldMoistureStressFindingsResult>;
    generateWeatherRiskFindings(
      input: GenerateFieldWeatherRiskFindingsInput,
    ): Promise<GenerateFieldWeatherRiskFindingsResult>;
    generateDiseaseRiskFindings(
      input: GenerateFieldDiseaseRiskFindingsInput,
    ): Promise<GenerateFieldDiseaseRiskFindingsResult>;
    loadLatestFieldActionCuration(
      input: LoadLatestFieldActionCurationInput,
    ): Promise<FieldActionCuration | null>;
    curateFieldAction(
      input: CurateFieldActionInput,
    ): Promise<FieldActionCuration | null>;
    buildRecentDiseaseRiskReport(
      input?: BuildRecentDiseaseRiskReportInput,
    ): Promise<DiseaseRiskReport>;
    syncFindingAlert(
      input: SyncIntelligenceFindingAlertInput,
    ): Promise<FieldAlert | null>;
  };
  reports: {
    buildFieldReadModel(
      input: BuildFieldReportReadModelServiceInput,
    ): Promise<FieldReportReadModel>;
    renderFieldPdf(
      input: RenderFieldPdfInput,
    ): Promise<RenderFieldReportResult>;
  };
  development: {
    bootstrapDevelopmentData(
      input: BootstrapDevelopmentDataInput,
    ): Promise<BootstrapDevelopmentDataResult>;
  };
};
