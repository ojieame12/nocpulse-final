import type { AlertRepository } from "@fieldpulse/module-alerts";
import type {
  CropIntelligenceRunRepository,
  FieldIntelligenceFindingRepository,
  FieldIntelligenceZoneRepository,
} from "@fieldpulse/module-crop-intelligence";
import type { FieldCropContextRepository } from "@fieldpulse/module-field-crop-context";
import type { FieldImportBatchRepository } from "@fieldpulse/module-field-intake";
import type { FieldOverviewRepository, FieldRepository, FieldSummaryRepository } from "@fieldpulse/module-fields";
import type {
  FieldHailEventRepository,
  FieldHailRefreshRunRepository,
} from "@fieldpulse/module-hail";
import type {
  FieldRasterObservationRepository,
  ImageryCaptureRepository,
  ImageryProviderProbeRepository,
} from "@fieldpulse/module-imagery";
import type {
  FieldMoistureCellSnapshotRepository,
  FieldMoistureSnapshotRepository,
  MoistureEstimateStore,
} from "@fieldpulse/module-moisture";
import type {
  FieldWeatherForecastRepository,
  FieldWeatherDerivedSignalSetRepository,
  FieldWeatherObservationRepository,
} from "@fieldpulse/module-weather";
import type { WorkspaceMembershipRepository, WorkspaceRepository } from "@fieldpulse/module-workspaces";
import type { readAppEnv } from "@fieldpulse/platform-config";
import type { ServerServices } from "./ServerServices";

export type RuntimeEnv = ReturnType<typeof readAppEnv>;

export type ServerRepositories = {
  workspaces: WorkspaceRepository;
  workspaceMemberships: WorkspaceMembershipRepository;
  fieldImportBatches: FieldImportBatchRepository;
  fieldCropContexts: FieldCropContextRepository;
  fields: FieldRepository & FieldSummaryRepository & FieldOverviewRepository;
  imageryCaptures: ImageryCaptureRepository;
  imageryProviderProbes: ImageryProviderProbeRepository;
  imageryRasterObservations: FieldRasterObservationRepository;
  moistureSnapshots: FieldMoistureSnapshotRepository;
  moistureCellSnapshots: FieldMoistureCellSnapshotRepository;
  moistureEstimates: MoistureEstimateStore;
  weatherObservations: FieldWeatherObservationRepository;
  weatherForecasts: FieldWeatherForecastRepository;
  weatherSignalSets: FieldWeatherDerivedSignalSetRepository;
  hailEvents: FieldHailEventRepository;
  hailRefreshRuns: FieldHailRefreshRunRepository;
  alerts: AlertRepository;
  cropIntelligenceRuns: CropIntelligenceRunRepository;
  cropIntelligenceFindings: FieldIntelligenceFindingRepository;
  cropIntelligenceZones: FieldIntelligenceZoneRepository;
};

export type ServerJobDispatcher = {
  enqueue(input: {
    key: string;
    payload?: unknown;
    useSamplePayload?: boolean;
  }): Promise<{
    key: string;
    payload: unknown;
    result: unknown;
  }>;
};

export type CreateServerRuntimeOptions = {
  jobDispatcher?: ServerJobDispatcher | "persistent";
};

export type ServerRuntime =
  | {
      mode: "supabase";
      env: RuntimeEnv;
      services: ServerServices;
    }
  | {
      mode: "unconfigured";
      env: RuntimeEnv;
      services: null;
    };
