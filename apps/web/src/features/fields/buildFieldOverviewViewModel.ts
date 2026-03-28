import { buildFieldBoundaryPreviewRenderModel } from "@fieldpulse/map";
import {
  RequestContextError,
} from "../../server/runtime/resolveRequestContext";
import { getWebServerRuntime } from "../../server/runtime/getWebServerRuntime";
import { resolveServerComponentActorContext } from "../../server/runtime/resolveServerComponentActorContext";
import type { SidebarFieldItem } from "../../components/layout/Sidebar";
import type { FieldSummaryProps } from "../../components/panels/SummaryTab";
import type { AlertsPanelProps, AlertItem, ResolvedAlertItem } from "../../components/panels/AlertsPanel";
import type {
  FieldReportProps,
  ReportReadingCell,
  ReportAlertItem,
  ReportFindingItem,
  ReportZoneItem,
  ReadingIconKey,
} from "../../components/panels/ReportTab";
import type { FieldCellInspectorModel } from "./CellInspectorModel";
import type {
  FieldActivityPanelModel,
  FieldActivityFindingItem,
  FieldActivityZoneItem,
  FieldActivityFamilySummary,
} from "./FieldActivityPanelModel";

function deriveSidebarStatus(input: {
  rootZonePct?: number | null;
  confidence?: "low" | "medium" | "high" | null;
  activeAlertCount?: number;
}): SidebarFieldItem["status"] {
  if ((input.activeAlertCount ?? 0) > 0) {
    return input.activeAlertCount && input.activeAlertCount > 1
      ? "stressed"
      : "warning";
  }
  if (input.rootZonePct == null) {
    return "pending";
  }
  if (input.rootZonePct < 25) {
    return "stressed";
  }
  if (input.rootZonePct < 35 || input.confidence === "low") {
    return "warning";
  }
  return "healthy";
}

function extractTrackedZoneIds(value: unknown): string[] {
  if (!value || typeof value !== "object") return [];
  const trackedZones = (value as { trackedZones?: unknown }).trackedZones;
  if (!Array.isArray(trackedZones)) return [];
  return trackedZones
    .map((entry) =>
      entry && typeof entry === "object" && "zoneId" in entry
        ? (entry as { zoneId?: unknown }).zoneId
        : null,
    )
    .filter((zoneId): zoneId is string => typeof zoneId === "string");
}

export async function buildFieldOverviewViewModel(fieldId: string) {
  const runtime = getWebServerRuntime();

  if (runtime.mode !== "supabase") {
    return {
      status: "unauthenticated" as const,
      fieldId,
      authMessage: "Supabase runtime is not configured for this request.",
    };
  }

  const actorContext = await resolveServerComponentActorContext(runtime).catch(
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

  const selection = await runtime.services.catalog.loadWorkspaceFieldDetail({
    actorUserId: actorContext.actor.userId,
    preferredWorkspaceId: actorContext.actor.workspaceId,
    fieldId,
  });

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
    moistureSurface: readModel.moisture.latestSnapshot
      ? {
          rootZonePct: readModel.moisture.latestSnapshot.rootZonePct,
          surfacePct: readModel.moisture.latestSnapshot.surfacePct,
          confidence: readModel.moisture.latestSnapshot.confidence,
          sourceLabel: readModel.moisture.latestSnapshot.sourceKey,
          cells: readModel.moisture.latestCells.map((cell) => ({
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
  const workspaceId = selection.selectedWorkspace.id;

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

  const alertsPanel: AlertsPanelProps = {
    activeAlerts: alertItems,
    resolvedAlerts: resolvedItems,
    activeCount: alertItems.length,
    criticalCount: alertItems.filter((a) => a.severity === "critical").length,
    weekCount: alertItems.length + resolvedItems.length,
  };
  const reportPanel: FieldReportProps = buildReportProps(
    readModel,
    field.name,
    formatTimeAgo,
  );
  const activityPanel: FieldActivityPanelModel = buildActivityPanelModel(readModel);

  const zoneAssignments = new Map<string, string>();
  for (const zone of readModel.zones.zones) {
    if (zone.status === "resolved") continue;
    for (const cellKey of zone.affectedCellKeys) {
      if (!zoneAssignments.has(cellKey)) {
        zoneAssignments.set(cellKey, zone.id);
      }
    }
  }

  if (mapPreview.agronomicSurface) {
    mapPreview.agronomicSurface = {
      ...mapPreview.agronomicSurface,
      cells: mapPreview.agronomicSurface.cells.map((cell) => ({
        ...cell,
        zoneId: zoneAssignments.get(cell.id) ?? cell.zoneId,
      })),
    };
  }

  const cellInspector: FieldCellInspectorModel = {
    cells: readModel.moisture.latestCells.map((cell) => ({
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

  /* ── Sidebar field items ── */

  const sidebarFields: SidebarFieldItem[] = selection.fields.map((entry) => ({
    id: entry.id,
    name: entry.name,
    area: `${entry.areaHa.toFixed(1)} ha`,
    crop: entry.id === field.id ? readModel.cropContext?.cropType ?? undefined : undefined,
    alertCount: entry.id === field.id ? readModel.summary.activeAlertCount : undefined,
    status:
      entry.id === field.id
        ? deriveSidebarStatus({
            rootZonePct: readModel.moisture.latestSnapshot?.rootZonePct ?? null,
            confidence: readModel.moisture.latestSnapshot?.confidence ?? null,
            activeAlertCount: readModel.summary.activeAlertCount,
          })
        : deriveSidebarStatus({
            rootZonePct: entry.latestMoisture?.rootZonePct ?? null,
            confidence: entry.latestMoisture?.confidence ?? null,
          }),
  }));

  /* ── Summary panel data (from whatever the catalog provides) ── */

  const latestMoisture = readModel.moisture.latestSnapshot;
  const rootPct = latestMoisture?.rootZonePct ?? 0;
  const surfPct = latestMoisture?.surfacePct ?? 0;
  const confidence = latestMoisture?.confidence ?? "unknown";
  const latestObservation = readModel.weather.profile.latestObservation;
  const forecast = readModel.weather.profile.forecasts.slice(0, 4);
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
    cropStage: readModel.cropContext?.growthStage ?? "",
    moisture: rootPct / 100,
    cloudCover: "—",
    surfaceMoisture: surfPct > 0 ? `${surfPct.toFixed(0)}%` : "—",
    fieldState: rootPct < 30 ? "Dry" : rootPct < 60 ? "Adequate" : "Wet",
    fieldStateColor: rootPct < 30 ? "#f59e0b" : "#16a34a",
    rootMoisture: rootPct > 0 ? `${rootPct.toFixed(1)}%` : "—",
    rootMoistureSub: rootPct < 30 ? "Below threshold" : "Adequate",
    trend: "—",
    trendSub: "Insufficient data",
    spread: readModel.moisture.rootZoneMinPct != null && readModel.moisture.rootZoneMaxPct != null
      ? (readModel.moisture.rootZoneMaxPct - readModel.moisture.rootZoneMinPct).toFixed(1)
      : "—",
    spreadSub: readModel.moisture.latestCellCount > 0
      ? `${readModel.moisture.latestCellCount} mapped cells`
      : "Insufficient data",
    confidence: confidence === "unknown" ? "—" : confidence.charAt(0).toUpperCase() + confidence.slice(1),
    confidenceSub: latestMoisture?.sourceKey ?? "No source",
    precipitation: latestObservation?.precipitationMm != null
      ? `${latestObservation.precipitationMm.toFixed(1)} mm`
      : "—",
    precipitationSub: latestObservation ? "Current observation" : "No weather data",
    nextRain: nextRainForecast
      ? formatTimeAgo(nextRainForecast.validAt)
      : "—",
    nextRainSub: nextRainForecast
      ? "Forecast precipitation signal"
      : "No forecast signal",
    rainChance: forecast[0]?.precipitationProbabilityPct != null
      ? `${Math.round(forecast[0].precipitationProbabilityPct)}%`
      : "—",
    rainChanceSub: forecast[0] ? "Next forecast window" : "No forecast",
    sevenDayTotal: forecast.length > 0
      ? `${forecast.reduce((sum, entry) => sum + entry.precipitationMm, 0).toFixed(1)} mm`
      : "—",
    sevenDayTotalSub: forecast.length > 0 ? "Loaded forecast window" : "No forecast",
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

  return {
    status: "ready" as const,
    fieldId,
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
    activityPanel,
    reportPanel,
    cellInspector,
  };
}

/* ── Report read model → UI props mapper ── */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildReportProps(
  rm: any,
  fieldName: string,
  formatTimeAgo: (iso: string) => string,
): FieldReportProps {
  const obs = rm.weather?.profile?.latestObservation;
  const forecasts = rm.weather?.profile?.forecasts ?? [];
  const moisture = rm.moisture;
  const alerts = rm.alerts ?? [];
  const summary = rm.summary;
  const cropContext = rm.cropContext;

  const readings: ReportReadingCell[] = [
    {
      iconKey: "temperature" as ReadingIconKey,
      label: "Temperature",
      value: obs ? `${obs.airTemperatureC.toFixed(1)}°C` : "—",
    },
    {
      iconKey: "soil-temp" as ReadingIconKey,
      label: "Soil Temp",
      value: obs?.soilMoisturePct != null ? `${obs.soilMoisturePct.toFixed(1)}%` : "—",
    },
    {
      iconKey: "root-moisture" as ReadingIconKey,
      label: "Root Moisture",
      value: moisture?.rootZoneAvgPct != null ? `${moisture.rootZoneAvgPct.toFixed(1)}%` : "—",
    },
    {
      iconKey: "wind" as ReadingIconKey,
      label: "Wind",
      value: obs ? `${obs.windSpeedKph.toFixed(0)} km/h` : "—",
    },
    {
      iconKey: "ndvi" as ReadingIconKey,
      label: "NDVI",
      value: "—",
    },
    {
      iconKey: "stress-area" as ReadingIconKey,
      label: "Stress Area",
      value: summary?.activeFindingCount != null ? `${summary.activeFindingCount} findings` : "—",
    },
  ];

  const forecastDays = forecasts.slice(0, 4).map((f: any) => {
    const date = new Date(f.validAt);
    const day = date.toLocaleDateString("en-US", { weekday: "short" });
    return {
      day,
      temp: `${Math.round(f.airTemperatureMaxC)}/${Math.round(f.airTemperatureMinC)}`,
      precip: f.precipitationProbabilityPct != null
        ? `${Math.round(f.precipitationProbabilityPct)}%`
        : `${f.precipitationMm.toFixed(1)}mm`,
    };
  });

  const alertFamilyToIconKey: Record<string, ReportAlertItem["iconKey"]> = {
    moisture_stress: "moisture",
    weather_risk: "temperature",
    crop_health: "leaf",
    hail_risk: "wind",
    disease_risk: "leaf",
  };

  const alertItems: ReportAlertItem[] = alerts.map((a: any) => ({
    iconKey: alertFamilyToIconKey[a.family] ?? "generic",
    text: a.summary ?? a.title,
    severity: a.severity === "critical" || a.severity === "high" ? "High" as const
      : a.severity === "medium" ? "Med" as const
      : "Low" as const,
    trackedZoneIds: extractTrackedZoneIds(a.evidence),
  }));

  const findingItems: ReportFindingItem[] = (rm.findings ?? []).map((finding: any) => ({
    id: finding.id,
    title: finding.title,
    summary: finding.summary,
    severity: finding.severity === "critical" || finding.severity === "high" ? "High" as const
      : finding.severity === "medium" ? "Med" as const
      : "Low" as const,
    trackedZoneIds:
      finding.evidence?.trackedZones?.map((zone: any) => zone.zoneId).filter((zoneId: unknown) => typeof zoneId === "string") ?? [],
  }));

  const zoneItems: ReportZoneItem[] = (rm.zones?.zones ?? []).map((zone: any) => ({
    id: zone.id,
    family: zone.family,
    trackingKey: zone.trackingKey,
    status: zone.status,
    severity:
      zone.latestSeverity === "critical" || zone.latestSeverity === "high"
        ? "High"
        : zone.latestSeverity === "medium"
          ? "Med"
          : zone.latestSeverity === "low"
            ? "Low"
            : null,
    affectedCellCount: zone.affectedCellCount,
    lastSeenAt: zone.lastSeenAt,
  }));

  const sourceKeys = new Set<string>();
  if (moisture?.latestSnapshot?.sourceKey) sourceKeys.add(moisture.latestSnapshot.sourceKey);
  if (obs?.providerKey) sourceKeys.add(obs.providerKey);

  return {
    name: fieldName,
    lld: rm.intake?.legalLandDescription ?? "",
    updatedDate: new Date(rm.generatedAt).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    healthStatus: (summary?.activeAlertCount ?? 0) > 0 ? "Needs Attention" : "Healthy",
    readings,
    cropStage: cropContext?.growthStage ?? summary?.growthStage ?? "—",
    cropParams: [],
    charts: [
      { title: "VEGETATION INDEX TREND", subtitle: "NDVI + NDRE over time" },
      { title: "SOIL MOISTURE & PRECIPITATION", subtitle: "30-day history" },
      { title: "TEMPERATURE HISTORY", subtitle: "Surface + root zone · 30 days" },
    ],
    forecast: forecastDays,
    alerts: alertItems,
    findings: findingItems,
    zones: zoneItems,
    provenanceText: moisture?.latestSnapshot
      ? `Root zone moisture: avg ${moisture.rootZoneAvgPct?.toFixed(1) ?? "—"}%, range ${moisture.rootZoneMinPct?.toFixed(1) ?? "—"}–${moisture.rootZoneMaxPct?.toFixed(1) ?? "—"}%. ${moisture.latestCellCount} cells, ${moisture.lowConfidenceCellCount} low-confidence.`
      : "No moisture data available for provenance.",
    sources: [...sourceKeys].map((s) => ({ label: s })),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildActivityPanelModel(rm: any): FieldActivityPanelModel {
  const activeFindingCount = rm.summary?.activeFindingCount ?? 0;
  const activeZoneCount = rm.summary?.activeTrackedZoneCount ?? 0;
  const newZoneCount = rm.zones?.newZoneCount ?? 0;
  const recoveringZoneCount = rm.zones?.recoveringZoneCount ?? 0;
  const resolvedZoneCount = rm.zones?.resolvedZoneCount ?? 0;

  const findings: FieldActivityFindingItem[] = (rm.findings ?? []).map((finding: any) => ({
    id: finding.id,
    title: finding.title,
    summary: finding.summary,
    severity: finding.severity,
    startedAt: finding.startedAt,
    trackedZoneIds:
      finding.evidence?.trackedZones
        ?.map((zone: any) => zone.zoneId)
        .filter((zoneId: unknown) => typeof zoneId === "string") ?? [],
  }));

  const zones: FieldActivityZoneItem[] = (rm.zones?.zones ?? []).map((zone: any) => ({
    id: zone.id,
    family: zone.family,
    trackingKey: zone.trackingKey,
    status: zone.status,
    severity: zone.latestSeverity,
    affectedCellCount: zone.affectedCellCount,
    detectionCount: zone.detectionCount,
    lastSeenAt: zone.lastSeenAt,
  }));

  const familySummaries: FieldActivityFamilySummary[] = (rm.zones?.familySummaries ?? []).map(
    (summary: any) => ({
      family: summary.family,
      activeZoneCount:
        (summary.newZoneCount ?? 0) +
        (summary.persistentZoneCount ?? 0) +
        (summary.recoveringZoneCount ?? 0),
      totalZoneCount: summary.totalZoneCount ?? 0,
    }),
  );

  return {
    generatedAt: rm.generatedAt,
    activeFindingCount,
    activeZoneCount,
    newZoneCount,
    recoveringZoneCount,
    resolvedZoneCount,
    familySummaries,
    findings,
    zones,
  };
}
