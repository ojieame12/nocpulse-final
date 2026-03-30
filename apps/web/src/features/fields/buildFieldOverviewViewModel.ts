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
import {
  RequestContextError,
} from "../../server/runtime/resolveRequestContext";
import { getWebServerRuntime } from "../../server/runtime/getWebServerRuntime";
import { resolveServerComponentActorContext } from "../../server/runtime/resolveServerComponentActorContext";
import type { SidebarFieldItem } from "../../components/layout/Sidebar";
import type { FieldSummaryProps } from "../../components/panels/SummaryTab";
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

  const actorContextDurationMs = finishPerfTimer(
    actorContextStartedAt,
    debugPerfEnabled,
  );
  const selectionStartedAt = startPerfTimer(debugPerfEnabled);
  const selection = await runtime.services.catalog.loadWorkspaceFieldDetail({
    actorUserId: actorContext.actor.userId,
    preferredWorkspaceId:
      options.preferredWorkspaceId ?? actorContext.actor.workspaceId,
    fieldId,
  });
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

  const alertItems: AlertItem[] = readModel.alerts.map((a) => ({
    id: a.id,
    title: a.title,
    severity: a.severity === "high" ? "critical" : a.severity,
    subtitle: a.summary ?? a.family.replace(/_/g, " "),
    time: formatTimeAgo(a.startedAt),
    trackedZoneIds: extractTrackedZoneIds(a.evidence),
  }));

  const resolvedItems: ResolvedAlertItem[] = readModel.resolvedAlerts.map((a) => ({
    id: a.id,
    title: a.title,
    subtitle: a.summary ?? a.family.replace(/_/g, " "),
    time: a.resolvedAt ? formatTimeAgo(a.resolvedAt) : "—",
    trackedZoneIds: extractTrackedZoneIds(a.evidence),
  }));
  const activeAlertsAvailable = readModel.dataAvailability?.activeAlerts !== false;
  const resolvedAlertsAvailable = readModel.dataAvailability?.resolvedAlerts !== false;

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
  const allCropContexts = await allCropContextsPromise;

  const resolvePanels = async () => {
    const reportPanel: FieldReportProps = buildReportProps(
      effectiveReadModel,
      field.name,
      formatTimeAgo,
    );
    const actionPanel: FieldActionProps = buildActionProps(effectiveReadModel, field.name);
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
        ? readModel.summary.activeAlertCount ?? undefined
        : undefined,
    status:
      entry.id === field.id
        ? deriveSidebarStatus({
            rootZonePct: effectiveMoisture.latestSnapshot?.rootZonePct ?? null,
            confidence: effectiveMoisture.latestSnapshot?.confidence ?? null,
            activeAlertCount: activeAlertsAvailable
              ? readModel.summary.activeAlertCount
              : undefined,
          })
        : deriveSidebarStatus({
            rootZonePct: entry.latestMoisture?.rootZonePct ?? null,
            confidence: entry.latestMoisture?.confidence ?? null,
          }),
  }));

  /* ── Summary panel data (from whatever the catalog provides) ── */

  const latestMoisture = effectiveMoisture.latestSnapshot;
  const rootPct = effectiveMoisture.rootZoneAvgPct;
  const surfPct = effectiveMoisture.surfaceAvgPct;
  const hasRootPct = rootPct != null && Number.isFinite(rootPct);
  const hasSurfPct = surfPct != null && Number.isFinite(surfPct);
  const confidence = latestMoisture?.confidence ?? "unknown";
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
  const forecast = readModel.weather.profile.forecasts.slice(0, 4);
  const weatherDataAvailability = readModel.weather.profile.dataAvailability ?? {
    latestObservation: true,
    forecasts: true,
  };
  const nextRainForecast =
    forecast.find(
      (entry) =>
        (entry.precipitationProbabilityPct ?? 0) >= 40 ||
        entry.precipitationMm > 0.5,
    ) ?? null;
  const summary: FieldSummaryProps = {
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
    spread: effectiveMoisture.rootZoneMinPct != null && effectiveMoisture.rootZoneMaxPct != null
      ? (effectiveMoisture.rootZoneMaxPct - effectiveMoisture.rootZoneMinPct).toFixed(1)
      : "—",
    spreadSub: effectiveMoisture.latestCellCount > 0
      ? `${effectiveMoisture.latestCellCount} mapped cells`
      : "Insufficient data",
    confidence: confidence === "unknown" ? "—" : confidence.charAt(0).toUpperCase() + confidence.slice(1),
    confidenceSub: latestMoisture?.sourceKey ?? "No source",
    precipitation: latestObservation?.precipitationMm != null
      ? `${latestObservation.precipitationMm.toFixed(1)} mm`
      : "—",
    precipitationSub: !weatherDataAvailability.latestObservation
      ? "Weather unavailable"
      : latestObservation
        ? "Current observation"
        : "No weather data",
    nextRain: nextRainForecast
      ? formatTimeAgo(nextRainForecast.validAt)
      : "—",
    nextRainSub: nextRainForecast
      ? "Forecast precipitation signal"
      : !weatherDataAvailability.forecasts
        ? "Forecast unavailable"
        : "No forecast signal",
    rainChance: forecast[0]?.precipitationProbabilityPct != null
      ? `${Math.round(forecast[0].precipitationProbabilityPct)}%`
      : "—",
    rainChanceSub: !weatherDataAvailability.forecasts
      ? "Forecast unavailable"
      : forecast[0]
        ? "Next forecast window"
        : "No forecast",
    sevenDayTotal: forecast.length > 0
      ? `${forecast.reduce((sum, entry) => sum + entry.precipitationMm, 0).toFixed(1)} mm`
      : "—",
    sevenDayTotalSub: !weatherDataAvailability.forecasts
      ? "Forecast unavailable"
      : forecast.length > 0
        ? "Loaded forecast window"
        : "No forecast",
    alerts: alertItems.slice(0, 3).map((alert) => ({
      label: alert.title,
      desc: alert.subtitle,
      severity: alert.severity === "critical" ? "danger" : "warning",
    })),
    outlook: forecast.map((entry) => ({
      day: new Date(entry.validAt).toLocaleDateString("en-US", { weekday: "short" }),
      high: Math.round(entry.airTemperatureMaxC),
      low: Math.round(entry.airTemperatureMinC),
      precip: entry.precipitationProbabilityPct != null
        ? `${Math.round(entry.precipitationProbabilityPct)}%`
        : `${entry.precipitationMm.toFixed(1)}mm`,
    })),
  };

  const viewModel = {
    status: "ready" as const,
    fieldId,
    workspaceId,
    workspaceLabel: `${selection.selectedWorkspace.name} · ${selection.selectedWorkspace.slug}`,
    authStatusLabel: actorContext.authModeLabel,
    fieldName: field.name,
    areaHaLabel: `${field.areaHa.toFixed(1)} ha`,
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

    const cellDict: Record<string, any> = {};
    for (const cell of baseSurface.cells) {
      const { polygon, centroid, ...rest } = cell;
      cellDict[cell.id] = rest;
    }

    surfaces[metricKey] = {
      ...baseSurface,
      cells: cellDict,
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
