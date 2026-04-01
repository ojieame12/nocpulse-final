import { createSupabaseAlertRepository } from "@fieldpulse/module-alerts";
import {
  createSupabaseCropIntelligenceRunRepository,
  createSupabaseFieldIntelligenceFindingRepository,
  createSupabaseFieldIntelligenceZoneRepository,
} from "@fieldpulse/module-crop-intelligence";
import { createSupabaseFieldCropContextRepository } from "@fieldpulse/module-field-crop-context";
import {
  createSupabaseFieldImportBatchRepository,
  createSupabaseLldGeocodeCache,
} from "@fieldpulse/module-field-intake";
import { createSupabaseFieldRepository } from "@fieldpulse/module-fields";
import {
  createSupabaseFieldHailRefreshRunRepository,
  createSupabaseFieldHailEventRepository,
} from "@fieldpulse/module-hail";
import {
  createSupabaseFieldRasterObservationRepository,
  createSupabaseImageryCaptureRepository,
  createSupabaseImageryProviderProbeRepository,
} from "@fieldpulse/module-imagery";
import {
  createSupabaseFieldBasisAssumptionRepository,
  createSupabaseFieldYieldAssumptionRepository,
  createSupabaseGrainPriceSnapshotRepository,
} from "@fieldpulse/module-market";
import {
  createSupabaseFieldMoistureCellSnapshotRepository,
  createSupabaseFieldMoistureSnapshotRepository,
  createSupabaseMoistureEstimateStore,
} from "@fieldpulse/module-moisture";
import { createObjectStoreReportArtifactStore } from "@fieldpulse/module-reports";
import { createSupabaseScoutNoteRepository } from "@fieldpulse/module-scouting";
import {
  createSupabaseFieldWeatherDerivedSignalSetRepository,
  createSupabaseFieldWeatherForecastRepository,
  createSupabaseFieldWeatherObservationRepository,
} from "@fieldpulse/module-weather";
import {
  createSupabaseWorkspaceMembershipRepository,
  createSupabaseWorkspaceRepository,
} from "@fieldpulse/module-workspaces";
import { readAppEnv } from "@fieldpulse/platform-config";
import { createSupabaseDatabaseClient } from "@fieldpulse/platform-db";
import { createR2ObjectStore } from "@fieldpulse/platform-storage";
import type {
  CreateServerRuntimeOptions,
  ServerJobDispatcher,
  ServerRuntime,
} from "../contracts/ServerRuntime";
import { createDefaultImageryProviderClients } from "./createDefaultImageryProviderClients";
import { createDefaultHailProviderClient } from "./createDefaultHailProviderClient";
import { createDefaultWeatherProviderClient } from "./createDefaultWeatherProviderClient";
import { createPersistentServerJobDispatcher } from "./createPersistentServerJobDispatcher";
import { createServerServices } from "./createServerServices";
import { createSupabaseFieldHydrationReplay } from "./createSupabaseFieldHydrationReplay";

export function createServerRuntime(
  source: Record<string, string | undefined>,
  options: CreateServerRuntimeOptions = {},
): ServerRuntime {
  const env = readAppEnv(source);

  if (!env.supabase.enabled || !env.supabase.url || !env.supabase.serviceRoleKey) {
    return {
      mode: "unconfigured",
      env,
      services: null,
    };
  }

  const client = createSupabaseDatabaseClient({
    url: env.supabase.url,
    serviceKey: env.supabase.serviceRoleKey,
  });

  const repositories = {
    workspaces: createSupabaseWorkspaceRepository(client),
    workspaceMemberships: createSupabaseWorkspaceMembershipRepository(client),
    fieldImportBatches: createSupabaseFieldImportBatchRepository(client),
    fieldCropContexts: createSupabaseFieldCropContextRepository(client),
    fields: createSupabaseFieldRepository(client),
    imageryCaptures: createSupabaseImageryCaptureRepository(client),
    imageryProviderProbes: createSupabaseImageryProviderProbeRepository(client),
    imageryRasterObservations: createSupabaseFieldRasterObservationRepository(client),
    grainPriceSnapshots: createSupabaseGrainPriceSnapshotRepository(client),
    fieldBasisAssumptions: createSupabaseFieldBasisAssumptionRepository(client),
    fieldYieldAssumptions: createSupabaseFieldYieldAssumptionRepository(client),
    scoutNotes: createSupabaseScoutNoteRepository(client),
    moistureSnapshots: createSupabaseFieldMoistureSnapshotRepository(client),
    moistureCellSnapshots: createSupabaseFieldMoistureCellSnapshotRepository(client),
    moistureEstimates: createSupabaseMoistureEstimateStore(client),
    weatherObservations: createSupabaseFieldWeatherObservationRepository(client),
    weatherForecasts: createSupabaseFieldWeatherForecastRepository(client),
    weatherSignalSets: createSupabaseFieldWeatherDerivedSignalSetRepository(client),
    hailEvents: createSupabaseFieldHailEventRepository(client),
    hailRefreshRuns: createSupabaseFieldHailRefreshRunRepository(client),
    alerts: createSupabaseAlertRepository(client),
    cropIntelligenceRuns: createSupabaseCropIntelligenceRunRepository(client),
    cropIntelligenceFindings: createSupabaseFieldIntelligenceFindingRepository(
      client,
    ),
    cropIntelligenceZones: createSupabaseFieldIntelligenceZoneRepository(client),
  };

  const jobDispatcher: ServerJobDispatcher | undefined =
    options.jobDispatcher === "persistent"
      ? createPersistentServerJobDispatcher(client)
      : options.jobDispatcher;
  const reportArtifactStore = env.r2.enabled && env.r2.bucket
    ? createObjectStoreReportArtifactStore({
        objectStore: createR2ObjectStore({
          accountId: env.r2.accountId!,
          accessKeyId: env.r2.accessKeyId!,
          secretAccessKey: env.r2.secretAccessKey!,
          endpoint: env.r2.endpoint,
        }),
        bucket: env.r2.bucket,
      })
    : undefined;
  const imageryProviderClients = createDefaultImageryProviderClients(env);
  const hailProviderClient = createDefaultHailProviderClient();
  const weatherProviderClient = createDefaultWeatherProviderClient(env);

  return {
    mode: "supabase",
    env,
    services: createServerServices(repositories, {
      jobDispatcher,
      imageryProviderClients,
      hailProviderClient,
      weatherProviderClient,
      reportArtifactStore,
      lldGeocodeCache: createSupabaseLldGeocodeCache(client),
      hydrationReplay: createSupabaseFieldHydrationReplay(client, repositories),
    }),
  };
}
