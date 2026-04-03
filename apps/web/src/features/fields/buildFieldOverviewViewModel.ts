import {
  buildFieldAgronomicSurfaceRenderModel,
  buildFieldBoundaryPreviewRenderModel,
  resolveMetricModeContract,
  type FieldAgronomicSurfaceMetricKey,
  type FieldAgronomicSurfaceRenderModel,
  type MapMultiPolygon,
} from "@fieldpulse/map/server";
import {
  deriveRasterCellMoisture,
  deriveSourceBackedMoistureEstimate,
  type FieldRasterObservation,
} from "@fieldpulse/module-imagery";
import {
  resolveCropRuleContext,
  prairieDefaultRulePack,
} from "@fieldpulse/module-crop-intelligence";
import { resolveFieldTimeZone, summarizeForecastDays } from "@fieldpulse/module-weather";
import {
  RequestContextError,
} from "../../server/runtime/resolveRequestContext";
import type { ResolvedGuestShareSession } from "../../server/auth/guestShareSession";
import { getWebServerRuntime } from "../../server/runtime/getWebServerRuntime";
import { resolveServerComponentActorContext } from "../../server/runtime/resolveServerComponentActorContext";
import type { SidebarFieldItem } from "../../components/layout/Sidebar";
import type {
  FieldDataQualitySummary,
  FieldSummaryProps,
} from "../../components/panels/SummaryTab";
import type { FieldNotesProps } from "../../components/panels/NotesTab";
import type { FieldMarketProps } from "../../components/panels/MarketTab";
import type { AlertsPanelProps, AlertItem, ResolvedAlertItem } from "../../components/panels/AlertsPanel";
import type { FieldActionProps } from "../../components/panels/ActionTab";
import type {
  FieldReportProps,
  ReportCropParam,
  ReportReadingCell,
  ReportAlertItem,
  ReportFindingItem,
  ReportZoneItem,
  ReadingIconKey,
} from "../../components/panels/ReportTab";
import type { FieldCellInspectorModel } from "./CellInspectorModel";
import type { FieldCropProps } from "./tabs/CropTab";
import type {
  FieldActivityPanelModel,
  FieldActivityFindingItem,
  FieldActivityZoneItem,
  FieldActivityFamilySummary,
} from "./FieldActivityPanelModel";
import {
  averageNumbers,
  buildObservationHistoryLabels,
  chooseLatestObservation,
  deriveSidebarStatus,
  estimateJsonSize,
  extractTrackedZoneIds,
  filterFieldQualityDependentAlertRecords,
  finishPerfTimer,
  formatHistoryLabel,
  formatMediumDateTime,
  formatSignedPercentDelta,
  isStabilityDebugEnabled,
  maxNumber,
  minNumber,
  shortProviderLabel,
  startPerfTimer,
  toCapturePercentLabel,
  toEarlierTimestamp,
  resolveHistoricalAnomalyFromReadModel,
  toPrimitiveMetadata,
  toTimestampMillis,
} from "./buildFieldOverviewViewModel.shared";
import {
  averageAgronomicMeasurement,
  averageMeasurement,
  deriveObservationRootMoisturePct,
  deriveObservationSurfaceMoisturePct,
  loadMetricFamilyRasterObservations,
} from "./buildFieldOverviewViewModel.raster";
import {
  buildActivityPanelModel,
  buildNotesProps,
} from "./buildFieldOverviewViewModel.panels";
import {
  resolveCanopySignalPresentation,
  resolveCropStagePresentation,
  resolveOpticalSeasonality,
  titleCaseStage,
  type OpticalSeasonality,
} from "./buildFieldOverviewViewModel.cropSignals";
import { buildActionProps } from "./buildFieldOverviewViewModel.action";
import { buildCropProps } from "./buildFieldOverviewViewModel.crop";
import {
  buildMarketProps,
  resolveMarketCropSymbol,
} from "./buildFieldOverviewViewModel.market";
import { buildReportProps } from "./buildFieldOverviewViewModel.report";
import { buildAlternateSurfaceCellDictionary } from "./alternateSurfaceCells.shared";
import { toMapZoneMultiPolygon } from "./zoneGeometry";

export {
  resolveCanopySignalPresentation,
  resolveCropStagePresentation,
  resolveOpticalSeasonality,
} from "./buildFieldOverviewViewModel.cropSignals";
export { buildMarketProps } from "./buildFieldOverviewViewModel.market";
export { buildReportProps } from "./buildFieldOverviewViewModel.report";

function hasObservationMetric(
  observation: FieldRasterObservation | null | undefined,
  metricKey: FieldAgronomicSurfaceMetricKey,
) {
  if (!observation || !Array.isArray(observation.cells) || observation.cells.length === 0) {
    return false;
  }

  return averageAgronomicMeasurement(observation.cells, metricKey) != null;
}

function countUsableObservations(
  observations: readonly (FieldRasterObservation | null | undefined)[],
) {
  const keys = new Set<string>();

  for (const observation of observations) {
    if (!observation || !Array.isArray(observation.cells) || observation.cells.length === 0) {
      continue;
    }

    keys.add(`${observation.sourceKey}:${observation.observedAt}`);
  }

  return keys.size;
}

export function buildEffectiveMoistureSummary(rm: any) {
  const moisture = rm.moisture ?? {};
  const latestSnapshot = moisture.latestSnapshot ?? null;
  const latestCells = Array.isArray(moisture.latestCells) ? moisture.latestCells : [];
  const latestRaster =
    rm.imagery?.latestSarRasterObservation ??
    rm.imagery?.latestRasterObservation ??
    null;
  const rasterEstimate =
    latestRaster && Array.isArray(latestRaster.cells) && latestRaster.cells.length > 0
      ? deriveSourceBackedMoistureEstimate({
          rasterObservation: latestRaster,
        })
      : null;

  const baseSnapshot =
    latestSnapshot ??
    (rasterEstimate && latestRaster
      ? {
          observedAt: latestRaster.observedAt,
          sourceKey: `imagery-raster-derived-v1:${latestRaster.sourceKey}`,
          rootZonePct: rasterEstimate.rootZonePct,
          surfacePct: rasterEstimate.surfacePct,
          confidence: rasterEstimate.confidence,
        }
      : null);

  const derivedCells =
    latestCells.length === 0 &&
    latestRaster &&
    Array.isArray(latestRaster.cells) &&
    latestRaster.cells.length > 0 &&
    baseSnapshot
      ? latestRaster.cells.map((cell: any) => ({
          cellKey: cell.cellKey,
          rowIndex: cell.rowIndex,
          columnIndex: cell.columnIndex,
          centroid: cell.centroid,
          boundary: cell.boundary,
          observedAt: latestRaster.observedAt,
          sourceKey: `imagery-raster-derived-v1:${latestRaster.sourceKey}`,
          confidence: baseSnapshot.confidence,
          ...deriveRasterCellMoisture(cell, {
            rootZonePct: baseSnapshot.rootZonePct,
            surfacePct: baseSnapshot.surfacePct,
          }),
        }))
      : [];

  const effectiveCells = latestCells.length > 0 ? latestCells : derivedCells;
  const rootZoneValues = effectiveCells
    .map((cell: any) => cell.rootZonePct)
    .filter((value: unknown): value is number => typeof value === "number");
  const surfaceValues = effectiveCells
    .map((cell: any) => cell.surfacePct)
    .filter((value: unknown): value is number => typeof value === "number");
  const effectiveSnapshot =
    latestSnapshot ??
    (baseSnapshot
      ? {
          ...baseSnapshot,
          rootZonePct: averageNumbers(rootZoneValues) ?? baseSnapshot.rootZonePct,
          surfacePct: averageNumbers(surfaceValues) ?? baseSnapshot.surfacePct,
        }
      : null);

  return {
    ...moisture,
    latestSnapshot: effectiveSnapshot,
    latestCells: effectiveCells,
    latestCellCount: effectiveCells.length,
    lowConfidenceCellCount: effectiveCells.filter((cell: any) => cell.confidence === "low").length,
    rootZoneMinPct:
      minNumber(rootZoneValues) ??
      moisture.rootZoneMinPct ??
      effectiveSnapshot?.rootZonePct ??
      null,
    rootZoneMaxPct:
      maxNumber(rootZoneValues) ??
      moisture.rootZoneMaxPct ??
      effectiveSnapshot?.rootZonePct ??
      null,
    rootZoneAvgPct:
      averageNumbers(rootZoneValues) ??
      moisture.rootZoneAvgPct ??
      effectiveSnapshot?.rootZonePct ??
      null,
    surfaceMinPct:
      minNumber(surfaceValues) ??
      moisture.surfaceMinPct ??
      effectiveSnapshot?.surfacePct ??
      null,
    surfaceMaxPct:
      maxNumber(surfaceValues) ??
      moisture.surfaceMaxPct ??
      effectiveSnapshot?.surfacePct ??
      null,
    surfaceAvgPct:
      averageNumbers(surfaceValues) ??
      moisture.surfaceAvgPct ??
      effectiveSnapshot?.surfacePct ??
      null,
  };
}

function mergeBoundingBoxes(
  boxes: readonly [number, number, number, number][],
): [number, number, number, number] | null {
  if (boxes.length === 0) {
    return null;
  }

  let west = Number.POSITIVE_INFINITY;
  let south = Number.POSITIVE_INFINITY;
  let east = Number.NEGATIVE_INFINITY;
  let north = Number.NEGATIVE_INFINITY;

  for (const [boxWest, boxSouth, boxEast, boxNorth] of boxes) {
    west = Math.min(west, boxWest);
    south = Math.min(south, boxSouth);
    east = Math.max(east, boxEast);
    north = Math.max(north, boxNorth);
  }

  return [west, south, east, north];
}

function deriveMultiPolygonBbox(
  geometry: MapMultiPolygon,
): [number, number, number, number] | null {
  const boxes: [number, number, number, number][] = [];

  for (const polygon of geometry.coordinates) {
    let west = Number.POSITIVE_INFINITY;
    let south = Number.POSITIVE_INFINITY;
    let east = Number.NEGATIVE_INFINITY;
    let north = Number.NEGATIVE_INFINITY;

    for (const ring of polygon) {
      for (const [longitude, latitude] of ring) {
        west = Math.min(west, longitude);
        south = Math.min(south, latitude);
        east = Math.max(east, longitude);
        north = Math.max(north, latitude);
      }
    }

    if (
      Number.isFinite(west) &&
      Number.isFinite(south) &&
      Number.isFinite(east) &&
      Number.isFinite(north)
    ) {
      boxes.push([west, south, east, north]);
    }
  }

  return mergeBoundingBoxes(boxes);
}

export async function buildFieldOverviewViewModel(
  fieldId: string,
  options: {
    preferredWorkspaceId?: string | null;
    request?: Request;
    guestShareSession?: ResolvedGuestShareSession | null;
  } = {},
) {
  const debugPerfEnabled = isStabilityDebugEnabled();
  const requestStartTime = startPerfTimer(debugPerfEnabled);
  const runtime = getWebServerRuntime();

  if (runtime.mode !== "supabase") {
    return {
      status: "unauthenticated" as const,
      fieldId,
      authMessage: "Supabase runtime is not configured for this request.",
    };
  }

  const guestShareSession = options.guestShareSession ?? null;

  if (guestShareSession && guestShareSession.fieldId !== fieldId) {
    return {
      status: "not-found" as const,
      fieldId,
      workspaceLabel: "Shared guest access is limited to a single field.",
    };
  }

  let authStatusLabel = "Shared guest access";
  let actorContextDurationMs = 0;
  const selectionStartedAt = startPerfTimer(debugPerfEnabled);
  let selection:
    | Awaited<ReturnType<typeof runtime.services.catalog.loadFieldDetailByWorkspace>>
    | Awaited<ReturnType<typeof runtime.services.catalog.loadWorkspaceFieldDetail>>;

  if (guestShareSession) {
    selection = await runtime.services.catalog.loadFieldDetailByWorkspace({
      workspaceId: guestShareSession.workspaceId,
      fieldId,
    });
  } else {
    const actorContextStartedAt = startPerfTimer(debugPerfEnabled);
    const actorContext = await resolveServerComponentActorContext(runtime, {
      preferredWorkspaceId: options.preferredWorkspaceId,
      request: options.request,
    }).catch(
      (error: unknown) => {
        if (error instanceof RequestContextError) {
          return {
            actor: null,
            authMode: "none" as const,
            authModeLabel:
              error.status === 401
                ? "No Supabase session available"
                : "Authenticated actor access denied",
            actorErrorMessage: error.message,
          };
        }

        throw error;
      },
    );

    if (!actorContext.actor) {
      return {
        status: "unauthenticated" as const,
        fieldId,
        authMessage:
          actorContext.actorErrorMessage ??
          "A valid actor is required to load this field.",
      };
    }

    authStatusLabel = actorContext.authModeLabel;
    actorContextDurationMs = finishPerfTimer(
      actorContextStartedAt,
      debugPerfEnabled,
    );

    selection = await runtime.services.catalog.loadWorkspaceFieldDetail({
      actorUserId: actorContext.actor.userId,
      preferredWorkspaceId:
        options.preferredWorkspaceId ?? actorContext.actor.workspaceId,
      fieldId,
    });
  }
  const selectionDurationMs = finishPerfTimer(
    selectionStartedAt,
    debugPerfEnabled,
  );

  if (!selection.selectedWorkspace || !selection.field) {
    return {
      status: "not-found" as const,
      fieldId,
      workspaceLabel: selection.selectedWorkspace
        ? `${selection.selectedWorkspace.name} · ${selection.selectedWorkspace.slug}`
        : "No workspace selected",
    };
  }

  const field = selection.field.detail;
  const overview = selection.field.overview;
  const readModel = selection.field.readModel;
  const workspaceId = selection.selectedWorkspace.id;
  const marketCropSymbol = resolveMarketCropSymbol(
    readModel.cropContext?.cropType ?? readModel.summary?.cropType,
  );
  const existingImagery = (readModel.imagery ?? null) as Record<string, any> | null;
  const rasterFamilyStartedAt = startPerfTimer(debugPerfEnabled);
  const rasterFamilyPromise = loadMetricFamilyRasterObservations({
    runtime,
    workspaceId,
    fieldId: field.id,
    observedAt: readModel.generatedAt,
  });
  const serviceReadsStartedAt = startPerfTimer(debugPerfEnabled);
  const serviceReadsPromise = Promise.all([
    runtime.services.scouting.listFieldNotes({
      workspaceId,
      fieldId,
      limit: 20,
    }).catch((err) => {
      console.error("[buildFieldOverviewViewModel] failed to load scout notes:", err);
      return [];
    }),
    marketCropSymbol
      ? runtime.services.market.recentPrices({
          cropSymbol: marketCropSymbol,
          limit: 8,
        }).catch((err) => {
          console.error("[buildFieldOverviewViewModel] failed to load market history:", err);
          return [];
        })
      : Promise.resolve([]),
    runtime.services.market.latestFieldBasisAssumption({
      workspaceId,
      fieldId,
      seasonYear: readModel.cropContext?.seasonYear ?? null,
      cropSymbol: marketCropSymbol,
    }).catch((err) => {
      console.error(
        "[buildFieldOverviewViewModel] failed to load field basis assumption:",
        err,
      );
      return null;
    }),
    runtime.services.market.latestFieldYieldAssumption({
      workspaceId,
      fieldId,
      seasonYear: readModel.cropContext?.seasonYear ?? null,
      cropSymbol: marketCropSymbol,
    }).catch((err) => {
      console.error(
        "[buildFieldOverviewViewModel] failed to load field yield assumption:",
        err,
      );
      return null;
    }),
  ]);
  const allCropContextsPromise = runtime.services.fieldCropContext
    .listWorkspaceCropContexts(selection.selectedWorkspace.id)
    .catch((err) => {
      console.error("[buildFieldOverviewViewModel] failed to load crop contexts:", err);
      return [];
    });
  const rasterFamilyObservations = await rasterFamilyPromise;
  const rasterFamilyDurationMs = finishPerfTimer(
    rasterFamilyStartedAt,
    debugPerfEnabled,
  );
  const imageryWithFamilyObservations = {
    ...readModel.imagery,
    latestSarRasterObservation:
      rasterFamilyObservations.latestSarObservation ??
      existingImagery?.latestSarRasterObservation ??
      null,
    latestOpticalRasterObservation:
      rasterFamilyObservations.latestOpticalObservation ??
      existingImagery?.latestOpticalRasterObservation ??
      null,
    latestNdmiRasterObservation:
      rasterFamilyObservations.latestNdmiObservation ??
      (hasObservationMetric(existingImagery?.latestNdmiRasterObservation, "ndmi")
        ? existingImagery?.latestNdmiRasterObservation
        : null) ??
      null,
    previousSarRasterObservation:
      rasterFamilyObservations.previousSarObservation ??
      existingImagery?.previousSarRasterObservation ??
      null,
    previousOpticalRasterObservation:
      rasterFamilyObservations.previousOpticalObservation ??
      existingImagery?.previousOpticalRasterObservation ??
      null,
    latestOpticalCapture:
      rasterFamilyObservations.latestOpticalCapture ??
      existingImagery?.latestOpticalCapture ??
      null,
    latestSarCapture:
      rasterFamilyObservations.latestSarCapture ??
      existingImagery?.latestSarCapture ??
      null,
    opticalRasterHistory:
      rasterFamilyObservations.opticalHistory ??
      existingImagery?.opticalRasterHistory ??
      [],
    sarRasterHistory:
      rasterFamilyObservations.sarHistory ??
      existingImagery?.sarRasterHistory ??
      [],
  };
  const effectiveMoisture = buildEffectiveMoistureSummary({
    ...readModel,
    imagery: imageryWithFamilyObservations,
  });
  const effectiveReadModel = {
    ...readModel,
    fieldTimeZone: readModel.fieldTimeZone ?? resolveFieldTimeZone(field.labelPoint),
    moisture: effectiveMoisture,
    imagery: imageryWithFamilyObservations,
  };
  const defaultCropRules = resolveCropRuleContext({
    rulePack: prairieDefaultRulePack,
    cropContext: {
      cropType: readModel.cropContext?.cropType ?? readModel.summary?.cropType ?? null,
      growthStage: null,
    },
  });
  const cropStagePresentation = resolveCropStagePresentation({
    cropContext: readModel.cropContext,
    fallbackGrowthStage: readModel.summary?.growthStage ?? null,
    defaultGrowthStage: defaultCropRules.crop.growthStage,
    gddBaseC: defaultCropRules.crop.gddBaseC,
  });
  const cropContextMetadata = readModel.cropContext
    ? toPrimitiveMetadata(readModel.cropContext.metadata)
    : {};
  const opticalSeasonality = resolveOpticalSeasonality({
    cropStagePresentation,
    latestOpticalCaptureAt:
      effectiveReadModel.imagery?.latestOpticalCapture?.capturedAt ??
      effectiveReadModel.imagery?.latestOpticalRasterObservation?.observedAt ??
      null,
    ndviAvg: averageMeasurement(
      effectiveReadModel.imagery?.latestOpticalRasterObservation?.cells ?? [],
      "ndvi",
    ),
    ndreAvg: averageMeasurement(
      effectiveReadModel.imagery?.latestOpticalRasterObservation?.cells ?? [],
      "ndre",
    ),
  });
  const boundary = field.boundary;
  const polygonCount = boundary.coordinates.length;
  const ringCount = boundary.coordinates.reduce(
    (sum, polygon) => sum + polygon.length,
    0,
  );
  const vertexCount = boundary.coordinates.reduce(
    (sum, polygon) =>
      sum +
      polygon.reduce((polygonSum, ring) => polygonSum + ring.length, 0),
    0,
  );
  const mapPreview = buildFieldBoundaryPreviewRenderModel({
    fieldId: field.id,
    fieldName: field.name,
    boundary,
    labelPoint: field.labelPoint,
    lightingPresetId: "relief-review",
    terrainContextMode: "contextual-relief",
    moistureSurface: effectiveMoisture.latestSnapshot
      ? {
          rootZonePct: effectiveMoisture.latestSnapshot.rootZonePct,
          surfacePct: effectiveMoisture.latestSnapshot.surfacePct,
          confidence: effectiveMoisture.latestSnapshot.confidence,
          sourceLabel: effectiveMoisture.latestSnapshot.sourceKey,
          cells: effectiveMoisture.latestCells.map((cell: any) => ({
            cellKey: cell.cellKey,
            centroid: cell.centroid,
            boundary: cell.boundary,
            rootZonePct: cell.rootZonePct,
            surfacePct: cell.surfacePct,
            sourceKey: cell.sourceKey,
          })),
          provenance: effectiveMoisture.latestSnapshot.inputs
            ? {
                depletionPct: effectiveMoisture.latestSnapshot.inputs.depletionPct ?? undefined,
                freshnessFactor: effectiveMoisture.latestSnapshot.inputs.freshnessFactor ?? undefined,
                rasterAgeHours: effectiveMoisture.latestSnapshot.inputs.rasterAgeHours ?? undefined,
                agreementFlag: effectiveMoisture.latestSnapshot.inputs.agreementFlag ?? undefined,
                resolutionTier: effectiveMoisture.latestSnapshot.inputs.resolutionTier ?? undefined,
                availableWaterMm: effectiveMoisture.latestSnapshot.inputs.availableWaterMm ?? undefined,
                rootZoneDepthCm: effectiveMoisture.latestSnapshot.inputs.rootZoneDepthCm ?? undefined,
              }
            : undefined,
        }
      : {
          // Synthetic fallback: always render cells even without real data
          rootZonePct: 42,
          surfacePct: 28,
          confidence: "low" as const,
          sourceLabel: "synthetic-preview",
        },
  });
  mapPreview.alternateAgronomicSurfaces = buildAlternateAgronomicSurfaces({
    fieldId: field.id,
    mapPreview,
    latestOpticalObservation:
      effectiveReadModel.imagery?.latestOpticalRasterObservation ?? null,
    latestSarObservation:
      effectiveReadModel.imagery?.latestSarRasterObservation ?? null,
    opticalSeasonality,
  });

  function formatTimeAgo(isoDate: string): string {
    const diff = Date.now() - new Date(isoDate).getTime();
    const hours = Math.floor(diff / 3_600_000);
    if (hours < 1) return "just now";
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  const rawAlertRecords = readModel.alerts ?? [];
  const rawResolvedAlertRecords = readModel.resolvedAlerts ?? [];
  const activeAlertsAvailable = readModel.dataAvailability?.activeAlerts !== false;
  const resolvedAlertsAvailable = readModel.dataAvailability?.resolvedAlerts !== false;
  const allCropContexts = await allCropContextsPromise;

  const resolvePanels = async () => {
    const reportPanel: FieldReportProps = buildReportProps(
      effectiveReadModel,
      field.name,
      formatTimeAgo,
    );
    const [
      scoutNotes,
      recentMarketPrices,
      fieldBasisAssumption,
      fieldYieldAssumption,
    ] = await serviceReadsPromise;
    const serviceReadsDurationMs = finishPerfTimer(
      serviceReadsStartedAt,
      debugPerfEnabled,
    );
    const notesPanel: FieldNotesProps = buildNotesProps(
      effectiveReadModel,
      field.workspaceId,
      field.id,
      field.name,
      scoutNotes,
    );
    const marketPanel: FieldMarketProps = buildMarketProps(
      effectiveReadModel,
      field.id,
      field.name,
      field.areaHa,
      null,
      recentMarketPrices,
      fieldBasisAssumption,
      fieldYieldAssumption,
    );
    const actionPanel: FieldActionProps = buildActionProps(effectiveReadModel, field.name);
    const cropPanel: FieldCropProps = buildCropProps(effectiveReadModel);
    const activityPanel: FieldActivityPanelModel = buildActivityPanelModel(effectiveReadModel);

    return {
      reportPanel,
      actionPanel,
      notesPanel,
      marketPanel,
      cropPanel,
      activityPanel,
      serviceReadsDurationMs,
    };
  };

  const zoneAssignments = new Map<string, string>();
  for (const zone of readModel.zones.zones) {
    if (zone.status === "resolved") continue;
    for (const cellKey of zone.affectedCellKeys) {
      if (!zoneAssignments.has(cellKey)) {
        zoneAssignments.set(cellKey, zone.id);
      }
    }
  }

  mapPreview.zones = readModel.zones.zones
    .map((zone) => {
      const geometry = toMapZoneMultiPolygon(zone.zoneGeoJson);
      if (!geometry || !deriveMultiPolygonBbox(geometry)) {
        return null;
      }

      return {
        id: zone.id,
        family: zone.family,
        status: zone.status,
        latestSeverity: zone.latestSeverity,
        geometry,
      };
    })
    .filter((zone): zone is NonNullable<typeof zone> => zone != null);

  if (mapPreview.agronomicSurface) {
    mapPreview.agronomicSurface = {
      ...mapPreview.agronomicSurface,
      cells: mapPreview.agronomicSurface.cells.map((cell) => ({
        ...cell,
        zoneId: zoneAssignments.get(cell.id) ?? cell.zoneId,
      })),
    };
  }

  if (mapPreview.alternateAgronomicSurfaces) {
    mapPreview.alternateAgronomicSurfaces = Object.fromEntries(
      Object.entries(mapPreview.alternateAgronomicSurfaces).map(([metricKey, surface]) => [
        metricKey,
        surface
          ? {
              ...surface,
              cells: Object.fromEntries(
                Object.entries(surface.cells).map(([id, cell]) => [
                  id,
                  {
                    ...cell,
                    zoneId: zoneAssignments.get(id) ?? cell.zoneId,
                  },
                ]),
              ),
            }
          : surface,
      ]),
    );
  }

  const cellInspector: FieldCellInspectorModel = {
    cells: effectiveMoisture.latestCells.map((cell: any) => ({
      id: cell.cellKey,
      rowIndex: cell.rowIndex,
      columnIndex: cell.columnIndex,
      observedAt: cell.observedAt,
      sourceKey: cell.sourceKey,
      rootZonePct: cell.rootZonePct,
      surfacePct: cell.surfacePct,
      confidence: cell.confidence,
    })),
    findings: readModel.findings.map((finding) => ({
      id: finding.id,
      family: finding.family,
      severity: finding.severity,
      status: finding.status,
      title: finding.title,
      summary: finding.summary,
      recommendedAction: finding.recommendedAction,
      startedAt: finding.startedAt,
      affectedCellKeys: finding.affectedCellKeys,
      trackedZoneIds:
        finding.evidence.trackedZones?.map((zone) => zone.zoneId) ?? [],
    })),
    zones: readModel.zones.zones.map((zone) => ({
      id: zone.id,
      family: zone.family,
      trackingKey: zone.trackingKey,
      status: zone.status,
      latestSeverity: zone.latestSeverity,
      affectedCellKeys: zone.affectedCellKeys,
      detectionCount: zone.detectionCount,
      lastSeenAt: zone.lastSeenAt,
    })),
  };

  const latestMoisture = effectiveMoisture.latestSnapshot;
  const rootPct = effectiveMoisture.rootZoneAvgPct;
  const surfPct = effectiveMoisture.surfaceAvgPct;
  const hasRootPct = rootPct != null && Number.isFinite(rootPct);
  const hasSurfPct = surfPct != null && Number.isFinite(surfPct);
  const confidence = latestMoisture?.confidence ?? "unknown";
  const opticalObservationCount = countUsableObservations([
    ...(effectiveReadModel.imagery?.opticalRasterHistory ?? []),
    effectiveReadModel.imagery?.latestOpticalRasterObservation ?? null,
    effectiveReadModel.imagery?.previousOpticalRasterObservation ?? null,
  ]);
  const latestOpticalCapture =
    effectiveReadModel.imagery?.latestOpticalCapture ?? null;
  const latestSarCapture =
    effectiveReadModel.imagery?.latestSarCapture ?? null;
  const latestPrimaryCapture =
    latestMoisture?.sourceKey?.includes("sentinel-1")
      ? latestSarCapture
      : latestOpticalCapture ?? latestSarCapture;
  const currentMoistureObservation =
    latestMoisture?.sourceKey?.includes("sentinel-1")
      ? rasterFamilyObservations.latestSarObservation
      : rasterFamilyObservations.latestOpticalObservation ??
        rasterFamilyObservations.latestSarObservation;
  const previousMoistureObservation =
    latestMoisture?.sourceKey?.includes("sentinel-1")
      ? rasterFamilyObservations.previousSarObservation
      : rasterFamilyObservations.previousOpticalObservation ??
        rasterFamilyObservations.latestSarObservation ??
        rasterFamilyObservations.previousSarObservation;
  const currentMoistureBaseline =
    deriveObservationRootMoisturePct(currentMoistureObservation) ??
    latestMoisture?.rootZonePct ??
    null;
  const previousMoistureBaseline =
    deriveObservationRootMoisturePct(previousMoistureObservation);
  const moistureTrendDelta =
    currentMoistureBaseline != null && previousMoistureBaseline != null
      ? currentMoistureBaseline - previousMoistureBaseline
      : null;
  const latestObservation = readModel.weather.profile.latestObservation;
  const forecastPeriods = readModel.weather.profile.forecasts;
  const forecastDays = summarizeForecastDays(forecastPeriods, {
    fieldTimeZone: effectiveReadModel.fieldTimeZone,
    fieldLabelPoint: field.labelPoint,
    limitDays: 7,
  });
  const weatherDataAvailability = readModel.weather.profile.dataAvailability ?? {
    latestObservation: true,
    forecasts: true,
  };
  const nextRainForecast =
    forecastPeriods.find(
      (entry) =>
        (entry.precipitationProbabilityPct ?? 0) >= 40 ||
        entry.precipitationMm > 0.5,
    ) ?? null;
  const summaryDataQuality = deriveSummaryDataQuality({
    snapshot: latestMoisture,
    confidence,
    weatherAvailability: weatherDataAvailability,
    opticalObservationCount,
  });
  const presentedAlertRecords = filterFieldQualityDependentAlertRecords(
    rawAlertRecords,
    summaryDataQuality?.label,
  );
  const presentedResolvedAlertRecords = filterFieldQualityDependentAlertRecords(
    rawResolvedAlertRecords,
    summaryDataQuality?.label,
  );
  const alertItems: AlertItem[] = presentedAlertRecords.map((a) => ({
    id: a.id,
    title: a.title,
    severity: a.severity === "high" ? "critical" : a.severity,
    subtitle: a.summary ?? a.family.replace(/_/g, " "),
    time: formatTimeAgo(a.startedAt),
    trackedZoneIds: extractTrackedZoneIds(a.evidence),
    acknowledgedAt: a.acknowledgedAt ?? null,
  }));
  const resolvedItems: ResolvedAlertItem[] = presentedResolvedAlertRecords.map((a) => ({
    id: a.id,
    title: a.title,
    subtitle: a.summary ?? a.family.replace(/_/g, " "),
    time: a.resolvedAt ? formatTimeAgo(a.resolvedAt) : "—",
    trackedZoneIds: extractTrackedZoneIds(a.evidence),
    status: a.status === "dismissed" ? "dismissed" : "resolved",
  }));
  const alertsPanel: AlertsPanelProps = {
    activeAlerts: alertItems,
    resolvedAlerts: resolvedItems,
    activeCount: alertItems.length,
    criticalCount: alertItems.filter((a) => a.severity === "critical").length,
    weekCount: alertItems.length + resolvedItems.length,
    emptyStateTitle:
      !activeAlertsAvailable
        ? "Alert data unavailable"
        : !resolvedAlertsAvailable
          ? "Alert history incomplete"
          : undefined,
    emptyStateDescription:
      !activeAlertsAvailable
        ? "Active alerts could not be loaded for this field. Refresh before treating this field as all clear."
        : !resolvedAlertsAvailable
          ? "Resolved alert history could not be loaded. Active alerts are current, but recent resolution history may be incomplete."
          : undefined,
  };

  /* ── Sidebar field items (with crop types for all fields) ── */
  const cropByFieldId = new Map(
    allCropContexts.map((ctx) => [ctx.fieldId, ctx.cropType]),
  );

  // If we have crop data, only show fields with crops (seeded Hope Creek fields).
  // If crop data is unavailable, fall back to showing all fields.
  const filteredFields = cropByFieldId.size > 0
    ? selection.fields.filter(
        (entry) => cropByFieldId.has(entry.id) || entry.id === field.id,
      )
    : selection.fields;

  const sidebarFields: SidebarFieldItem[] = filteredFields.map((entry) => ({
    id: entry.id,
    name: entry.name,
    area: `${entry.areaHa.toFixed(1)} ha`,
    legalLandDescription: entry.legalLandDescription,
    crop: cropByFieldId.get(entry.id),
    alertCount:
      entry.id === field.id && activeAlertsAvailable
        ? alertItems.length
        : undefined,
    status:
      entry.id === field.id
        ? deriveSidebarStatus({
            rootZonePct: effectiveMoisture.latestSnapshot?.rootZonePct ?? null,
            confidence: effectiveMoisture.latestSnapshot?.confidence ?? null,
            activeAlertCount: activeAlertsAvailable
              ? alertItems.length
              : undefined,
          })
        : deriveSidebarStatus({
            rootZonePct: entry.latestMoisture?.rootZonePct ?? null,
            confidence: entry.latestMoisture?.confidence ?? null,
          }),
  }));

  /* ── Summary panel data (from whatever the catalog provides) ── */
  const summary = buildSummaryProps({
    field,
    readModel,
    cropStagePresentation,
    latestPrimaryCapture,
    hasRootPct,
    rootPct,
    hasSurfPct,
    surfPct,
    moistureTrendDelta,
    previousMoistureObservation,
    effectiveMoisture,
    confidence,
    latestMoisture,
    latestObservation,
    weatherDataAvailability,
    nextRainForecast,
    forecastDays,
    alertItems,
    summaryDataQuality,
    formatTimeAgo,
  });

  const viewModel = {
    status: "ready" as const,
    fieldId,
    workspaceId,
    workspaceLabel: `${selection.selectedWorkspace.name} · ${selection.selectedWorkspace.slug}`,
    authStatusLabel,
    fieldName: field.name,
    areaHaLabel: `${field.areaHa.toFixed(1)} ha`,
    cropContext: readModel.cropContext
      ? {
          seedingDate:
            typeof cropContextMetadata.seedingDate === "string"
              ? cropContextMetadata.seedingDate
              : null,
          cropType: readModel.cropContext.cropType ?? null,
          growthStage: readModel.cropContext.growthStage ?? null,
          growthStageSource: readModel.cropContext.growthStageSource ?? null,
        }
      : null,
    createdAtLabel: new Date(field.createdAt).toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }),
    labelPointLabel: `${field.labelPoint[1].toFixed(5)}, ${field.labelPoint[0].toFixed(5)}`,
    moistureLabel: latestMoisture
      ? `Root ${latestMoisture.rootZonePct.toFixed(1)}%, surface ${latestMoisture.surfacePct.toFixed(1)}%, ${latestMoisture.confidence}`
      : "No moisture snapshot yet",
    sourceKeyLabel: latestMoisture?.sourceKey ?? "No moisture source",
    boundaryStats: {
      polygonCount,
      ringCount,
      vertexCount,
    },
    mapPreview,
    fieldList: selection.fields.map((entry) => ({
      id: entry.id,
      name: entry.name,
      href: `/fields/${entry.id}`,
      active: entry.id === field.id,
      areaHaLabel: `${entry.areaHa.toFixed(1)} ha`,
    })),
    /** Shell-ready data */
    sidebarFields,
    summary,
    alertsPanel,
    cellInspector,
    resolvePanels,
  };

  if (debugPerfEnabled) {
    console.debug("[stability][field-overview] build core shell", {
      fieldId,
      workspaceId,
      durationMs: finishPerfTimer(requestStartTime, debugPerfEnabled),
      actorContextDurationMs,
      selectionDurationMs,
      rasterFamilyDurationMs,
      boundaryVertexCount: vertexCount,
      latestCellCount: readModel.moisture.latestCells.length,
      mapPreviewBytes: estimateJsonSize(viewModel.mapPreview),
      alertsBytes: estimateJsonSize(viewModel.alertsPanel),
      cellInspectorBytes: estimateJsonSize(viewModel.cellInspector),
    });
  }

  return viewModel;
}

function resolveRasterSurfaceConfidence(
  sourceKey: string | null | undefined,
): "low" | "medium" | "high" {
  const normalized = sourceKey?.toLowerCase() ?? "";

  if (!normalized || normalized.includes("synthetic")) {
    return "low";
  }

  if (
    normalized.includes("sentinel-hub") ||
    normalized.includes("sentinel-1") ||
    normalized.includes("sentinel-2") ||
    normalized.includes("planet")
  ) {
    return "medium";
  }

  return "low";
}

function buildAlternateAgronomicSurfaces(input: {
  fieldId: string;
  mapPreview: ReturnType<typeof buildFieldBoundaryPreviewRenderModel>;
  latestOpticalObservation: any;
  latestSarObservation: any;
  opticalSeasonality?: OpticalSeasonality | null;
}): Partial<Record<FieldAgronomicSurfaceMetricKey, any>> {
  const metrics: FieldAgronomicSurfaceMetricKey[] = [
    "ndvi",
    "ndre",
    "ndmi",
    "radar-wetness",
  ];
  const surfaces: Partial<Record<FieldAgronomicSurfaceMetricKey, any>> = {};

  for (const metricKey of metrics) {
    const observation =
      metricKey === "radar-wetness"
        ? hasObservationMetric(input.latestSarObservation, metricKey)
          ? input.latestSarObservation
          : null
        : hasObservationMetric(input.latestOpticalObservation, metricKey)
          ? input.latestOpticalObservation
          : null;

    if (!observation || !Array.isArray(observation.cells) || observation.cells.length === 0) {
      continue;
    }

    const averageValue = averageAgronomicMeasurement(observation.cells, metricKey);
    if (averageValue == null) {
      continue;
    }

    const confidence =
      metricKey !== "radar-wetness" && input.opticalSeasonality?.status === "context-only"
        ? input.opticalSeasonality.renderConfidence ?? resolveRasterSurfaceConfidence(observation.sourceKey)
        : resolveRasterSurfaceConfidence(observation.sourceKey);
    const persistedCells = observation.cells.map((cell: any) => ({
      cellKey: cell.cellKey,
      centroid: cell.centroid,
      boundary: cell.boundary,
      measurements: cell.measurements ?? {},
      sourceKey: observation.sourceKey,
    }));

    const baseSurface = buildFieldAgronomicSurfaceRenderModel({
      fieldId: input.fieldId,
      boundaryFeature: input.mapPreview.boundaryFeature,
      bbox: input.mapPreview.bbox,
      metricKey,
      baseValuePct: averageValue * 100,
      confidence,
      sourceLabel:
        input.opticalSeasonality?.status === "context-only" &&
        metricKey !== "radar-wetness" &&
        observation === input.latestOpticalObservation
          ? `preseason-optical-context:${observation.sourceKey}`
          : observation.sourceKey,
      persistedCells,
    });

    surfaces[metricKey] = {
      ...baseSurface,
      cells: buildAlternateSurfaceCellDictionary({
        primaryCells: input.mapPreview.agronomicSurface?.cells ?? [],
        alternateCells: baseSurface.cells,
      }),
    };
  }

  return surfaces;
}

function metricTone(input: "danger" | "warning" | "positive" | "info") {
  switch (input) {
    case "danger":
      return { valueColor: "#ef4444", bg: "#fef2f2", border: "#fecaca" };
    case "warning":
      return { valueColor: "#f59e0b", bg: "#fffbeb", border: "#fde68a" };
    case "positive":
      return { valueColor: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0" };
    case "info":
      return { valueColor: "#3b82f6", bg: "#eff6ff", border: "#bfdbfe" };
  }
}

/* ── Summary enrichment helpers ── */

/**
 * Derive a human-readable status label from depletion percentage,
 * falling back to rootZonePct-based thresholds when depletion is absent.
 */
export function deriveSummaryStatusLabel(
  depletionPct: number | null | undefined,
  rootZonePct: number | null | undefined,
): string | undefined {
  if (depletionPct != null && Number.isFinite(depletionPct)) {
    if (depletionPct <= 30) return "Adequate";
    if (depletionPct <= 50) return "Watch";
    if (depletionPct <= 75) return "Stress";
    return "Critical";
  }
  if (rootZonePct != null && Number.isFinite(rootZonePct)) {
    if (rootZonePct >= 60) return "Adequate";
    if (rootZonePct >= 40) return "Watch";
    if (rootZonePct >= 20) return "Stress";
    return "Critical";
  }
  return undefined;
}

/**
 * Map provenance/inputs fields from the moisture snapshot into a
 * structured confidence breakdown suitable for display.
 */
export function deriveSummaryConfidenceBreakdown(
  snapshot: any | null | undefined,
): { freshness: string; agreement: string; resolution: string; scaleFit: string; sourceAge: string; coverage: string } | null {
  if (!snapshot?.inputs) return null;
  const inputs = snapshot.inputs;

  // Freshness
  let freshness = "Unknown";
  if (inputs.freshnessFactor != null) {
    if (inputs.freshnessFactor >= 0.8) freshness = "Fresh (< 6h)";
    else if (inputs.freshnessFactor >= 0.5) freshness = "Recent (< 24h)";
    else if (inputs.freshnessFactor >= 0.2) freshness = "Aging (< 3d)";
    else freshness = "Stale (> 3d)";
  } else if (snapshot.observedAt) {
    const ageMs = Date.now() - new Date(snapshot.observedAt).getTime();
    const ageH = Math.floor(ageMs / 3_600_000);
    if (ageH < 6) freshness = `Fresh (${ageH}h)`;
    else if (ageH < 24) freshness = `Recent (${ageH}h)`;
    else if (ageH < 72) freshness = `Aging (${Math.floor(ageH / 24)}d)`;
    else freshness = `Stale (${Math.floor(ageH / 24)}d)`;
  }

  // Agreement
  let agreement = "Unknown";
  if (inputs.agreementFlag != null) {
    agreement = inputs.agreementFlag ? "Signals agree" : "Signals diverge";
  }

  // Resolution
  let resolution = "Unknown";
  if (inputs.resolutionTier != null) {
    const tier = String(inputs.resolutionTier).toLowerCase();
    if (tier === "high" || tier === "sub-field") resolution = "Sub-field (10m)";
    else if (tier === "medium" || tier === "field") resolution = "Field-level (30m)";
    else if (tier === "low" || tier === "regional") resolution = "Regional (250m+)";
    else resolution = tier;
  }

  // Scale fit
  let scaleFit = "Unknown";
  if (inputs.scaleFitLabel != null) {
    scaleFit = String(inputs.scaleFitLabel);
  } else if (inputs.scaleFitScore != null) {
    const score = Number(inputs.scaleFitScore);
    if (score >= 0.8) scaleFit = "Well-matched";
    else if (score >= 0.5) scaleFit = "Acceptable";
    else scaleFit = "Poor fit";
  }

  return { freshness, agreement, resolution, scaleFit, sourceAge: freshness, coverage: resolution };
}

/**
 * Derive data-source labels from the moisture snapshot and weather availability.
 */
export function deriveSummaryDataSources(
  snapshot: any | null | undefined,
  weatherAvailability: { latestObservation?: boolean; forecasts?: boolean } | null | undefined,
): { satellite: string | null; weather: string | null; soil: string | null } | null {
  if (!snapshot && !weatherAvailability) return null;

  // Satellite source
  let satellite: string | null = null;
  if (snapshot?.sourceKey) {
    const sk = snapshot.sourceKey.toLowerCase();
    if (sk.includes("sentinel-1")) satellite = "Sentinel-1 (SAR)";
    else if (sk.includes("sentinel-2")) satellite = "Sentinel-2 (Optical)";
    else if (sk.includes("planet")) satellite = "Planet (Optical)";
    else satellite = snapshot.sourceKey;
  }

  // Weather source
  let weather: string | null = null;
  if (weatherAvailability?.latestObservation || weatherAvailability?.forecasts) {
    weather = "Available";
  }

  let soil: string | null = null;
  const soilDataset =
    typeof snapshot?.inputs?.soilDataset === "string" && snapshot.inputs.soilDataset.length > 0
      ? snapshot.inputs.soilDataset
      : typeof snapshot?.inputs?.baselineDataset === "string" &&
          snapshot.inputs.baselineDataset.length > 0
        ? snapshot.inputs.baselineDataset
        : null;
  if (soilDataset) {
    const normalized = soilDataset.toLowerCase();
    if (normalized.includes("soilgrids")) soil = "SoilGrids";
    else if (normalized.includes("era5")) soil = "ERA5-Land baseline";
    else if (normalized.includes("open-meteo")) soil = "Open-Meteo baseline";
    else soil = soilDataset;
  }

  return { satellite, weather, soil };
}

export function deriveSummaryFrostRisk(readModel: {
  cropContext?: { cropType?: string | null; growthStage?: string | null } | null;
  summary?: { cropType?: string | null; growthStage?: string | null } | null;
  weather?: { signals?: Record<string, unknown> | null } | null;
}): FieldSummaryProps["frostRisk"] {
  const signals = readModel.weather?.signals;
  if (!signals) {
    return null;
  }

  const resolvedRules = resolveCropRuleContext({
    rulePack: prairieDefaultRulePack,
    cropContext: {
      cropType: readModel.cropContext?.cropType ?? readModel.summary?.cropType ?? null,
      growthStage: readModel.cropContext?.growthStage ?? readModel.summary?.growthStage ?? null,
    },
  });
  const damageTempC = resolvedRules.weatherRisk.frost.damageTempC;
  const killTempC = resolvedRules.weatherRisk.frost.killTempC;

  const minTempC =
    typeof signals.frostRiskMinTempC7d === "number" && Number.isFinite(signals.frostRiskMinTempC7d)
      ? signals.frostRiskMinTempC7d
      : typeof signals.frostRiskMinTempC === "number" && Number.isFinite(signals.frostRiskMinTempC)
        ? signals.frostRiskMinTempC
        : null;
  const frostNights =
    typeof signals.frostRiskNights7d === "number" && Number.isFinite(signals.frostRiskNights7d)
      ? Math.max(0, Math.round(signals.frostRiskNights7d))
      : 0;
  const probabilityPct =
    typeof signals.frostProbabilityPct7d === "number" && Number.isFinite(signals.frostProbabilityPct7d)
      ? signals.frostProbabilityPct7d
      : null;
  const freezeThawCycles =
    typeof signals.freezeThawCycles7d === "number" && Number.isFinite(signals.freezeThawCycles7d)
      ? Math.max(0, Math.round(signals.freezeThawCycles7d))
      : null;

  const damageThresholdBreached = minTempC != null && minTempC <= damageTempC;
  const killThresholdBreached = minTempC != null && minTempC <= killTempC;
  const elevatedProbability = probabilityPct != null && probabilityPct >= 60;
  const hasActionableRisk = damageThresholdBreached || frostNights > 0 || elevatedProbability;
  if (!hasActionableRisk) {
    return null;
  }

  const verdict: "watch" | "protect" =
    killThresholdBreached ||
    frostNights >= 2 ||
    (damageThresholdBreached && elevatedProbability)
      ? "protect"
      : "watch";

  return {
    minTempC: minTempC ?? 0,
    frostNights,
    probabilityPct,
    freezeThawCycles,
    verdict,
    verdictSub:
      verdict === "protect"
        ? frostNights > 0
          ? `${frostNights} frost night${frostNights === 1 ? "" : "s"} forecast`
          : `Low of ${minTempC?.toFixed(1) ?? "0.0"}°C forecast`
        : frostNights > 0
          ? `${frostNights} marginal night${frostNights === 1 ? "" : "s"} ahead`
          : "Near-frost conditions in the next 7 days",
  };
}

export function buildSummaryProps(input: {
  field: { name: string };
  readModel: any;
  cropStagePresentation: { displayStageLabel: string };
  latestPrimaryCapture: { cloudCoverPct?: number | null; providerKey?: string | null } | null;
  hasRootPct: boolean;
  rootPct: number;
  hasSurfPct: boolean;
  surfPct: number;
  moistureTrendDelta: number | null;
  previousMoistureObservation: { providerKey?: string | null; observedAt: string } | null;
  effectiveMoisture: any;
  confidence: string;
  latestMoisture: any;
  latestObservation: { precipitationMm?: number | null } | null;
  weatherDataAvailability: { latestObservation: boolean; forecasts: boolean };
  nextRainForecast: { validAt: string } | null;
  forecastDays: readonly {
    label: string;
    airTemperatureMaxC: number | null;
    airTemperatureMinC: number | null;
    precipitationMm: number;
    precipitationProbabilityPct?: number | null;
  }[];
  alertItems: readonly { title: string; subtitle: string; severity: string }[];
  summaryDataQuality: FieldDataQualitySummary | null;
  formatTimeAgo: (isoDate: string) => string;
}): FieldSummaryProps {
  const {
    field,
    readModel,
    cropStagePresentation,
    latestPrimaryCapture,
    hasRootPct,
    rootPct,
    hasSurfPct,
    surfPct,
    moistureTrendDelta,
    previousMoistureObservation,
    effectiveMoisture,
    confidence,
    latestMoisture,
    latestObservation,
    weatherDataAvailability,
    nextRainForecast,
    forecastDays,
    alertItems,
    summaryDataQuality,
    formatTimeAgo,
  } = input;

  return {
    name: field.name,
    lld: readModel.intake.legalLandDescription ?? "",
    crop: readModel.cropContext?.cropType ?? "",
    cropStage:
      cropStagePresentation.displayStageLabel === "Stage unavailable"
        ? ""
        : cropStagePresentation.displayStageLabel,
    contextLabel: "Field overview",
    conditionsMeta: "Field average",
    updatedLabel: `UPDATED ${new Date(readModel.generatedAt).toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).toUpperCase()}`,
    moisture: hasRootPct ? rootPct / 100 : 0,
    cloudCover:
      latestPrimaryCapture?.cloudCoverPct != null
        ? toCapturePercentLabel(latestPrimaryCapture.cloudCoverPct)
        : latestPrimaryCapture?.providerKey === "sentinel-1"
          ? "SAR"
          : "—",
    surfaceMoisture: hasSurfPct ? `${surfPct.toFixed(0)}%` : "—",
    fieldState: !hasRootPct ? "Unknown" : rootPct < 30 ? "Dry" : rootPct < 60 ? "Adequate" : "Wet",
    fieldStateColor: !hasRootPct ? "#6b7280" : rootPct < 30 ? "#f59e0b" : "#16a34a",
    rootMoisture: hasRootPct ? `${rootPct.toFixed(1)}%` : "—",
    rootMoistureSub: !hasRootPct ? "No moisture reading" : rootPct < 30 ? "Below threshold" : "Adequate",
    trend: formatSignedPercentDelta(moistureTrendDelta),
    trendSub:
      moistureTrendDelta != null && previousMoistureObservation
        ? `vs ${shortProviderLabel(previousMoistureObservation.providerKey)} raster · ${formatMediumDateTime(previousMoistureObservation.observedAt)}`
        : "Insufficient raster history",
    spread:
      effectiveMoisture.rootZoneMinPct != null && effectiveMoisture.rootZoneMaxPct != null
        ? (effectiveMoisture.rootZoneMaxPct - effectiveMoisture.rootZoneMinPct).toFixed(1)
        : "—",
    spreadSub:
      effectiveMoisture.latestCellCount > 0
        ? `${effectiveMoisture.latestCellCount} mapped cells`
        : "Insufficient data",
    confidence:
      confidence === "unknown" ? "—" : confidence.charAt(0).toUpperCase() + confidence.slice(1),
    confidenceSub: latestMoisture?.sourceKey ?? "No source",
    moistureConfidenceLevel:
      confidence === "high" || confidence === "medium" || confidence === "low"
        ? confidence
        : "unknown",
    moistureDerivationMode: latestMoisture?.inputs?.derivationMode ?? "unknown",
    sourceTagExtended: buildSourceTagExtended(latestMoisture),
    precipitation:
      latestObservation?.precipitationMm != null
        ? `${latestObservation.precipitationMm.toFixed(1)} mm`
        : "—",
    precipitationSub: !weatherDataAvailability.latestObservation
      ? "Weather unavailable"
      : latestObservation
        ? "Current observation"
        : "No weather data",
    nextRain: nextRainForecast ? formatTimeAgo(nextRainForecast.validAt) : "—",
    nextRainSub: nextRainForecast
      ? "Forecast precipitation signal"
      : !weatherDataAvailability.forecasts
        ? "Forecast unavailable"
        : "No forecast signal",
    rainChance:
      forecastDays[0]?.precipitationProbabilityPct != null
        ? `${Math.round(forecastDays[0].precipitationProbabilityPct)}%`
        : "—",
    rainChanceSub: !weatherDataAvailability.forecasts
      ? "Forecast unavailable"
      : forecastDays[0]
        ? "Next forecast day"
        : "No forecast",
    sevenDayTotal:
      forecastDays.length > 0
        ? `${forecastDays.reduce((sum, entry) => sum + entry.precipitationMm, 0).toFixed(1)} mm`
        : "—",
    sevenDayTotalSub: !weatherDataAvailability.forecasts
      ? "Forecast unavailable"
      : forecastDays.length > 0
        ? "Loaded 7-day forecast"
        : "No forecast",
    alerts: alertItems.slice(0, 3).map((alert) => ({
      label: alert.title,
      desc: alert.subtitle,
      severity: alert.severity === "critical" ? "danger" : "warning",
    })),
    outlook: forecastDays.map((entry) => ({
      day: entry.label.split(",")[0] ?? entry.label,
      high: entry.airTemperatureMaxC != null ? Math.round(entry.airTemperatureMaxC) : 0,
      low: entry.airTemperatureMinC != null ? Math.round(entry.airTemperatureMinC) : 0,
      precip:
        entry.precipitationProbabilityPct != null
          ? `${Math.round(entry.precipitationProbabilityPct)}%`
          : `${entry.precipitationMm.toFixed(1)}mm`,
    })),
    historicalAnomaly: resolveHistoricalAnomalyFromReadModel(readModel),
    depletionPct: latestMoisture?.inputs?.depletionPct ?? null,
    availableWaterMm:
      latestMoisture?.inputs?.availableWaterMm != null
        ? `~${Math.round(latestMoisture.inputs.availableWaterMm)}mm`
        : null,
    statusLabel: deriveSummaryStatusLabel(latestMoisture?.inputs?.depletionPct ?? null, hasRootPct ? rootPct : null),
    confidenceBreakdown: deriveSummaryConfidenceBreakdown(latestMoisture),
    dataSources: deriveSummaryDataSources(latestMoisture, weatherDataAvailability),
    dataQuality: summaryDataQuality,
    frostRisk: deriveSummaryFrostRisk(readModel),
  };
}

function isSummarySnapshotStale(snapshot: any | null | undefined) {
  const freshnessFactor =
    typeof snapshot?.inputs?.freshnessFactor === "number" &&
    Number.isFinite(snapshot.inputs.freshnessFactor)
      ? snapshot.inputs.freshnessFactor
      : null;

  if (freshnessFactor != null) {
    return freshnessFactor < 0.2;
  }

  if (typeof snapshot?.observedAt === "string" && !Number.isNaN(Date.parse(snapshot.observedAt))) {
    return Date.now() - new Date(snapshot.observedAt).getTime() >= 72 * 3_600_000;
  }

  return false;
}

export function deriveSummaryDataQuality(input: {
  snapshot: any | null | undefined;
  confidence: string | null | undefined;
  weatherAvailability: { latestObservation?: boolean; forecasts?: boolean } | null | undefined;
  opticalObservationCount: number;
}): FieldDataQualitySummary | null {
  const snapshot = input.snapshot;
  if (!snapshot) {
    return {
      label: "Limited",
      tone: "warning",
      summary: "Field hydration is still incomplete, so the current reading should be treated as partial context.",
      reasons: ["No current moisture snapshot yet"],
    };
  }

  const derivationMode = snapshot?.inputs?.derivationMode ?? null;
  const rasterMode = snapshot?.inputs?.rasterMode ?? null;
  const signalBlend = snapshot?.inputs?.signalBlend ?? null;
  const weatherReady = Boolean(
    input.weatherAvailability?.latestObservation ||
      input.weatherAvailability?.forecasts ||
      snapshot?.inputs?.usedWeather === true,
  );
  const soilReady = Boolean(
    snapshot?.inputs?.usedWeatherSoilMoisture === true ||
      (typeof snapshot?.inputs?.soilDataset === "string" &&
        snapshot.inputs.soilDataset.length > 0) ||
      (typeof snapshot?.inputs?.baselineDataset === "string" &&
        snapshot.inputs.baselineDataset.length > 0),
  );
  const opticalReady = input.opticalObservationCount >= 2;
  const confidence = input.confidence ?? snapshot?.confidence ?? "unknown";
  const stale = isSummarySnapshotStale(snapshot);

  const reasons: string[] = [];
  if (weatherReady) reasons.push("Weather context loaded");
  else reasons.push("Weather context is still missing");

  if (soilReady) reasons.push("Soil context loaded");
  else reasons.push("Soil context is still missing");

  if (input.opticalObservationCount >= 2) {
    reasons.push(`${input.opticalObservationCount} optical observations support trend analysis`);
  } else if (input.opticalObservationCount === 1) {
    reasons.push("Vegetation history is still thin");
  } else {
    reasons.push("No optical vegetation history yet");
  }

  if (confidence === "high") reasons.push("High moisture confidence");
  else if (confidence === "medium") reasons.push("Moderate moisture confidence");
  else if (confidence === "low") reasons.push("Low moisture confidence");

  if (
    derivationMode === "seeded-range" ||
    signalBlend === "seeded" ||
    rasterMode === "synthetic" ||
    rasterMode === "none"
  ) {
    return {
      label: "Modeled",
      tone: "danger",
      summary: "Current moisture is modeled from fallback inputs until stronger live field sources arrive.",
      reasons,
    };
  }

  if (stale) {
    return {
      label: "Stale",
      tone: "muted",
      summary: "Current readings are older than the target freshness window and should be treated as lagging context.",
      reasons,
    };
  }

  if (
    derivationMode !== "source-backed" ||
    !weatherReady ||
    !soilReady ||
    !opticalReady ||
    confidence === "low" ||
    confidence === "unknown"
  ) {
    return {
      label: "Limited",
      tone: "warning",
      summary: !opticalReady
        ? "Current moisture is usable, but vegetation history is still too thin for strong trend analysis."
        : !weatherReady || !soilReady
          ? "Current moisture is source-backed, but parts of the supporting field context are still filling in."
          : "Current field signals are usable, but confidence is not yet strong enough for a full-ready label.",
      reasons,
    };
  }

  return {
    label: "Ready",
    tone: "positive",
    summary: "Current moisture is source-backed and fresh, with enough supporting context for field interpretation.",
    reasons,
  };
}

/** Build an extended source tag with freshness for the donut caption. */
function buildSourceTagExtended(
  snapshot: { observedAt?: string; sourceKey?: string; inputs?: { derivationMode?: string } } | null | undefined,
): string | undefined {
  if (!snapshot) return undefined;
  const derivation = snapshot.inputs?.derivationMode;
  if (!derivation || derivation === "unknown") return undefined;

  const sourceKey = snapshot.sourceKey?.toLowerCase() ?? "";
  const isSatellite = derivation === "source-backed";

  // Provider short name
  let provider = "";
  if (sourceKey.includes("sentinel-1")) provider = "SAR";
  else if (sourceKey.includes("sentinel-2")) provider = "Optical";
  else if (sourceKey.includes("planet")) provider = "Planet";
  else if (sourceKey.includes("open-meteo") || sourceKey.includes("weather")) provider = "ERA5";
  else if (isSatellite) provider = "Satellite";

  // Freshness
  let freshness = "";
  if (snapshot.observedAt) {
    const ageMs = Date.now() - new Date(snapshot.observedAt).getTime();
    const ageH = Math.floor(ageMs / 3_600_000);
    if (ageH < 1) freshness = "current";
    else if (ageH < 24) freshness = `${ageH}h ago`;
    else if (ageH < 48) freshness = "yesterday";
    else freshness = `${Math.floor(ageH / 24)}d ago`;
  }

  const label = isSatellite ? "Satellite-derived" : "Weather-derived";
  const parts = [label, provider, freshness].filter(Boolean);
  return parts.join(" · ");
}
