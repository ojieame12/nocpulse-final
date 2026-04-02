'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import type {
  FieldBoundaryPreviewRenderModel,
  FieldAgronomicSurfaceRenderModel,
  FieldAgronomicSurfaceMetricKey,
  CellHoverEvent,
  CellClickEvent,
} from '@fieldpulse/map';
import { TopBar } from '../../components/layout/TopBar';
import { AppShellErrorBoundary } from '../../components/layout/AppShellErrorBoundary';
import { ThemeContext, type AppTheme } from '../../components/layout/WorkspaceShell';
import type { SidebarFieldItem } from '../../components/layout/Sidebar';
import { FieldStrip } from '../../components/layout/FieldStrip';
import { FieldCommandPalette, type PaletteSearchIndex } from '../../components/layout/FieldCommandPalette';
import { LazyFieldBoundaryMap } from '../../features/fields/LazyFieldBoundaryMap';
import { MetricLegendCard } from '../../features/fields/MetricLegendCard';
import type { FieldActivityPanelModel } from '../../features/fields/FieldActivityPanelModel';
import { type FieldSummaryProps } from '../../components/panels/SummaryTab';
import { type FieldReportProps } from '../../components/panels/ReportTab';
import { ScoutReportPanel } from '../../components/panels/ScoutReportPanel';
import { EvidencePanel } from '../../components/panels/EvidencePanel';
import { SpotInspectorPanel } from '../../components/panels/SpotInspectorPanel';
import { SettingsPanel } from '../../components/panels/SettingsPanel';
import { EditFieldPanel } from '../../components/panels/EditFieldPanel';
import { AddFieldPanel, type CommitFieldHydrationSummary } from '../../components/panels/AddFieldPanel';
import type { FieldActionProps } from '../../components/panels/ActionTab';
import type { FieldNotesProps } from '../../components/panels/NotesTab';
import { AlertsPanel, type AlertsPanelProps } from '../../components/panels/AlertsPanel';
import { type FieldMarketProps } from '../../components/panels/MarketTab';
import {
  ZoneDetailPanel,
  type ZoneDetailPanelCell,
  type ZoneDetailPanelFinding,
  type ZoneDetailPanelZone,
} from '../../components/panels/ZoneDetailPanel';
import { FieldActivityPanel } from '../../features/fields/FieldActivityPanel';
import type {
  FieldCellInspectorCell,
  FieldCellInspectorModel,
} from '../../features/fields/CellInspectorModel';
import { SelectedCellInspector } from '../../features/fields/SelectedCellInspector';
import {
  FieldDetailPanel,
  MODE_TO_METRIC_KEY,
  type ModeKey,
} from '../../components/panels/FieldDetailPanel';
import {
  chooseFirstInsightField,
  type FirstInsightFieldEntry,
} from '../../features/fields/firstInsightChooser';
import { resolvePreviewPostOnboardingFieldId } from './resolvePreviewPostOnboardingFieldId';
import type { FieldCropProps as LiveCropPanelProps } from '../../features/fields/tabs/CropTab';

/* ── Types ── */

/** The serializable field view model returned by the API */
export type FieldViewModel = {
  workspaceId: string;
  fieldId: string;
  fieldName: string;
  areaHaLabel: string;
  mapPreview: FieldBoundaryPreviewRenderModel;
  sidebarFields: SidebarFieldItem[];
  summary: FieldSummaryProps | null;
  reportPanel: FieldReportProps | null;
  actionPanel: FieldActionProps | null;
  notesPanel: FieldNotesProps | null;
  marketPanel: FieldMarketProps | null;
  cropPanel: LiveCropPanelProps | null;
  alertsPanel: AlertsPanelProps | null;
  activityPanel: FieldActivityPanelModel | null;
  cellInspector: FieldCellInspectorModel | null;
};

export type PreviewShellViewer = {
  displayName: string;
  email: string | null;
  initials: string;
  workspaceRoleLabel: string;
  workspaceName: string | null;
};

export type PreviewShellProps = {
  initial: FieldViewModel;
  initialPanelsPromise?: Promise<Partial<FieldViewModel>>;
  viewer?: PreviewShellViewer | null;
  guestSession?: {
    expiresAt: string;
  } | null;
};

import React from "react";
import { WelcomeModal } from "../../components/ui/WelcomeModal";
function StreamingPanels({
  promise,
  onResolve,
}: {
  promise: Promise<Partial<FieldViewModel>>;
  onResolve: (data: Partial<FieldViewModel>) => void;
}) {
  const data = React.use(promise);
  React.useEffect(() => {
    onResolve(data);
  }, [data, onResolve]);
  return null;
}

const PREFETCH_DELAY_MS = 250;
const FAILED_FETCH_RETRY_MS = 15_000;
const ONBOARDING_STATUS_POLL_MS = 3_000;
const EMPTY_PREVIEW_FIELD_ID = "__empty__";
const GUEST_COUNTDOWN_TICK_MS = 60_000;

type WorkspaceFieldFeatures = NonNullable<
  FieldBoundaryPreviewRenderModel["workspaceFieldFeatures"]
>;

type PendingOnboardingWatch = {
  workspaceId?: string | null;
  preferredFieldId?: string | null;
  fieldIds: string[];
  dispatchIds: string[];
  /** Maps dispatchId → { fieldId, fieldLabel } for per-field progress derivation */
  dispatchFieldMap: ReadonlyMap<string, { fieldId: string; fieldLabel: string }>;
};

type OnboardingDispatchSnapshot = {
  id: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  activePhaseLabel?: string | null;
  progressPct?: number | null;
  progressMessage?: string | null;
  fieldId?: string | null;
};

type PreviewJobDispatchSnapshot = {
  id: string;
  key: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  activePhaseLabel: string | null;
  progressPct: number | null;
  progressMessage: string | null;
  updatedAt: string | null;
  completedAt: string | null;
  failedAt: string | null;
  cancelledAt: string | null;
  lastError: string | null;
  fieldId: string | null;
};

/** Per-field onboarding progress derived from dispatch snapshots. */
export type FieldOnboardingStatus = {
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  progressPct: number | null;
  phaseLabel: string | null;
};

function isPlaceholderFieldId(fieldId?: string | null) {
  return !fieldId || fieldId === EMPTY_PREVIEW_FIELD_ID;
}

function toFieldViewModel(data: FieldViewModel): FieldViewModel;
function toFieldViewModel(data: Record<string, unknown>): FieldViewModel;
function toFieldViewModel(data: Record<string, unknown>): FieldViewModel {
  return {
    workspaceId: String(data.workspaceId),
    fieldId: String(data.fieldId),
    fieldName: String(data.fieldName),
    areaHaLabel: String(data.areaHaLabel),
    mapPreview: data.mapPreview as FieldBoundaryPreviewRenderModel,
    sidebarFields: data.sidebarFields as SidebarFieldItem[],
    summary: (data.summary as FieldSummaryProps | null) ?? null,
    reportPanel: (data.reportPanel as FieldReportProps | null) ?? null,
    actionPanel: (data.actionPanel as FieldActionProps | null) ?? null,
    notesPanel: (data.notesPanel as FieldNotesProps | null) ?? null,
    marketPanel: (data.marketPanel as FieldMarketProps | null) ?? null,
    cropPanel: (data.cropPanel as LiveCropPanelProps | null) ?? null,
    alertsPanel: (data.alertsPanel as AlertsPanelProps | null) ?? null,
    activityPanel: (data.activityPanel as FieldActivityPanelModel | null) ?? null,
    cellInspector: (data.cellInspector as FieldCellInspectorModel | null) ?? null,
  };
}

function summarizeOverviewFetchFailure(status: number, message?: string | null) {
  if (message && message.trim().length > 0) {
    return `${status} ${message.trim()}`;
  }

  return `${status} request failed`;
}

function resolveFieldMeta(
  summary: FieldSummaryProps | null,
  crop: LiveCropPanelProps | null,
  areaLabel: string,
) {
  const cropLabel = summary?.crop || crop?.cropName;
  const stageLabel = summary?.cropStage || crop?.thresholdStageLabel;
  return [cropLabel, stageLabel, areaLabel].filter(Boolean).join(' · ');
}

function renameSidebarField(
  fields: SidebarFieldItem[],
  fieldId: string,
  name: string,
) {
  return fields.map((field) =>
    field.id === fieldId ? { ...field, name } : field,
  );
}

function updateSidebarFieldLld(
  fields: SidebarFieldItem[],
  fieldId: string,
  legalLandDescription: string | null,
) {
  return fields.map((field) =>
    field.id === fieldId ? { ...field, legalLandDescription } : field,
  );
}

function updateSidebarFieldCrop(
  fields: SidebarFieldItem[],
  fieldId: string,
  crop: string,
) {
  return fields.map((field) =>
    field.id === fieldId ? { ...field, crop } : field,
  );
}

function removeSidebarField(fields: SidebarFieldItem[], fieldId: string) {
  return fields.filter((field) => field.id !== fieldId);
}

function patchFieldViewModelName(field: FieldViewModel, name: string): FieldViewModel {
  return {
    ...field,
    fieldName: name,
    mapPreview: {
      ...field.mapPreview,
      fieldName: name,
      boundaryFeature: {
        ...field.mapPreview.boundaryFeature,
        properties: {
          ...field.mapPreview.boundaryFeature.properties,
          fieldName: name,
        },
      },
    },
    summary: field.summary ? { ...field.summary, name } : field.summary,
  };
}

function patchFieldViewModelLld(
  field: FieldViewModel,
  legalLandDescription: string | null,
): FieldViewModel {
  const nextLabel = legalLandDescription ?? '';

  return {
    ...field,
    summary: field.summary ? { ...field.summary, lld: nextLabel } : field.summary,
    cropPanel: field.cropPanel ? { ...field.cropPanel, lld: nextLabel } : field.cropPanel,
  };
}

function patchFieldViewModelCrop(
  field: FieldViewModel,
  crop: string,
): FieldViewModel {
  return {
    ...field,
    summary: field.summary ? { ...field.summary, crop } : field.summary,
    cropPanel: field.cropPanel ? { ...field.cropPanel, cropName: crop } : field.cropPanel,
  };
}

function buildEmptyPreviewFieldViewModel(
  workspaceId: string,
  template: FieldBoundaryPreviewRenderModel,
  workspaceFieldFeatures: WorkspaceFieldFeatures,
): FieldViewModel {
  return {
    workspaceId,
    fieldId: EMPTY_PREVIEW_FIELD_ID,
    fieldName: '',
    areaHaLabel: '',
    mapPreview: {
      fieldId: EMPTY_PREVIEW_FIELD_ID,
      fieldName: '',
      bbox: template.bbox,
      labelPoint: template.labelPoint,
      boundaryFeature: {
        type: 'Feature',
        properties: {
          fieldId: EMPTY_PREVIEW_FIELD_ID,
          fieldName: '',
        },
        geometry: {
          type: 'MultiPolygon',
          coordinates: [],
        },
      },
      workspaceFieldFeatures,
      zones: [],
      agronomicSurface: null,
      alternateAgronomicSurfaces: {},
      focusedZoneId: null,
      presentation: template.presentation,
    },
    sidebarFields: [],
    summary: null,
    reportPanel: null,
    actionPanel: null,
    notesPanel: null,
    marketPanel: null,
    cropPanel: null,
    alertsPanel: null,
    activityPanel: null,
    cellInspector: null,
  };
}

function selectFallbackFieldId(
  fields: SidebarFieldItem[],
  removedFieldId: string,
) {
  const removedIndex = fields.findIndex((field) => field.id === removedFieldId);
  const remaining = removeSidebarField(fields, removedFieldId);

  if (remaining.length === 0) {
    return null;
  }

  return remaining[removedIndex]?.id ?? remaining[removedIndex - 1]?.id ?? remaining[0]?.id ?? null;
}

async function readApiErrorMessage(response: Response, fallback: string) {
  try {
    const payload = (await response.clone().json()) as {
      error?: { message?: string };
      message?: string;
    };
    return payload.error?.message ?? payload.message ?? fallback;
  } catch {
    const text = await response.text().catch(() => "");
    return text.trim().length > 0 ? text : fallback;
  }
}

function formatGuestRemaining(expiresAt: string, now: number) {
  const remainingMs = Math.max(0, Date.parse(expiresAt) - now);
  const remainingHours = Math.floor(remainingMs / (60 * 60 * 1000));

  if (remainingHours >= 1) {
    return `${remainingHours}h remaining`;
  }

  const remainingMinutes = Math.max(
    1,
    Math.ceil(remainingMs / (60 * 1000)),
  );
  return `${remainingMinutes}m remaining`;
}

/* ── Panel views ── */

type PanelView =
  | 'detail'
  | 'action'
  | 'notes'
  | 'alerts'
  | 'crops'
  | 'cell'
  | 'settings'
  | 'scout'
  | 'zone'
  | 'zoneDetail'
  | 'evidence'
  | 'spot'
  | 'add-field'
  | 'edit-field';

export function resolvePreviewCanonicalDetailInitialPage(
  panel: PanelView,
): "actions" | "notes" | "crops" | null {
  switch (panel) {
    case "action":
      return "actions";
    case "notes":
      return "notes";
    case "crops":
      return "crops";
    default:
      return null;
  }
}

/* ── Layer → metric mapping ── */

type LayerKey = 'NDVI' | 'NDRE' | 'NDMI' | 'Radar Wetness' | 'Moisture';
const LAYER_TABS: readonly LayerKey[] = ['NDVI', 'NDRE', 'NDMI', 'Radar Wetness', 'Moisture'];

const LAYER_TO_METRIC: Record<LayerKey, FieldAgronomicSurfaceMetricKey> = {
  NDVI: 'ndvi',
  NDRE: 'ndre',
  NDMI: 'ndmi',
  'Radar Wetness': 'radar-wetness',
  Moisture: 'root-zone-moisture-pct',
};
const AVAILABLE_METRICS = LAYER_TABS.map((layer) => LAYER_TO_METRIC[layer]);

function metricToModeKey(
  metric: FieldAgronomicSurfaceMetricKey,
): ModeKey | null {
  const entry = Object.entries(MODE_TO_METRIC_KEY).find(
    ([, metricKey]) => metricKey === metric,
  );
  return (entry?.[0] as ModeKey | undefined) ?? null;
}

function buildInteractiveActivity(
  activity: FieldActivityPanelModel | null,
  selection: CellHoverEvent | null,
  model: FieldCellInspectorModel | null,
): { activity: FieldActivityPanelModel | null; contextLabel?: string; scopeLabel?: string } {
  if (!activity || !selection) {
    return { activity };
  }

  const cell = model?.cells.find((entry) => entry.id === selection.cellId) ?? null;
  const cellLabel = cell
    ? `cell r${cell.rowIndex + 1} · c${cell.columnIndex + 1}`
    : `cell ${selection.cellId.toUpperCase()}`;
  const relatedFindings =
    model?.findings.filter((finding) => finding.affectedCellKeys.includes(selection.cellId)) ?? [];
  const zoneIds = new Set<string>();
  const findingIds = new Set<string>(relatedFindings.map((finding) => finding.id));

  if (selection.zoneId) {
    zoneIds.add(selection.zoneId);
  }

  for (const finding of relatedFindings) {
    for (const zoneId of finding.trackedZoneIds) {
      zoneIds.add(zoneId);
    }
  }

  for (const zone of model?.zones ?? []) {
    if (zone.affectedCellKeys.includes(selection.cellId)) {
      zoneIds.add(zone.id);
    }
  }

  const findings = activity.findings.filter(
    (finding) =>
      findingIds.has(finding.id) ||
      finding.trackedZoneIds.some((zoneId) => zoneIds.has(zoneId)),
  );
  const zones = activity.zones.filter((zone) => zoneIds.has(zone.id));
  const familySummaries = Array.from(
    zones.reduce((summaries, zone) => {
      const summary = summaries.get(zone.family) ?? {
        family: zone.family,
        activeZoneCount: 0,
        totalZoneCount: 0,
      };
      summary.totalZoneCount += 1;
      if (zone.status !== 'resolved') {
        summary.activeZoneCount += 1;
      }
      summaries.set(zone.family, summary);
      return summaries;
    }, new Map<string, { family: string; activeZoneCount: number; totalZoneCount: number }>()),
  ).map(([, summary]) => summary);

  return {
    activity: {
      ...activity,
      activeFindingCount: findings.length,
      activeZoneCount: zones.filter((zone) => zone.status !== 'resolved').length,
      newZoneCount: zones.filter((zone) => zone.status === 'new').length,
      recoveringZoneCount: zones.filter((zone) => zone.status === 'recovering').length,
      resolvedZoneCount: zones.filter((zone) => zone.status === 'resolved').length,
      familySummaries,
      findings,
      zones,
    },
    contextLabel: `${cellLabel} · linked activity`,
    scopeLabel: cellLabel,
  };
}

function buildZoneDetailSelection(
  zoneId: string | null,
  activity: FieldActivityPanelModel | null,
  model: FieldCellInspectorModel | null,
):
  | {
      zone: ZoneDetailPanelZone;
      cells: readonly ZoneDetailPanelCell[];
      findings: readonly ZoneDetailPanelFinding[];
    }
  | null {
  if (!zoneId) {
    return null;
  }

  const zone = activity?.zones.find((entry) => entry.id === zoneId);
  const zoneInspector = model?.zones.find((entry) => entry.id === zoneId);

  if (!zone || !zoneInspector) {
    return null;
  }

  const cells =
    zoneInspector.affectedCellKeys
      .map((cellId) => model?.cells.find((cell) => cell.id === cellId) ?? null)
      .filter((cell): cell is FieldCellInspectorCell => cell != null)
      .map((cell) => ({
        id: cell.id,
        rootZonePct: cell.rootZonePct,
        surfacePct: cell.surfacePct,
        confidence: cell.confidence,
      })) ?? [];

  const findings =
    model?.findings
      .filter((finding) => finding.trackedZoneIds.includes(zoneId))
      .map((finding) => ({
        id: finding.id,
        title: finding.title,
        summary: finding.summary,
        severity: finding.severity,
        startedAt: finding.startedAt,
      })) ?? [];

  return {
    zone: {
      id: zone.id,
      family: zone.family,
      trackingKey: zone.trackingKey,
      status: zone.status,
      severity: zone.severity,
      affectedCellCount: zone.affectedCellCount,
      detectionCount: zone.detectionCount,
      lastSeenAt: zone.lastSeenAt,
    },
    cells,
    findings,
  };
}

/* ── Main shell ── */

export function PreviewShell({ initial, initialPanelsPromise, viewer = null, guestSession = null }: PreviewShellProps) {
  const [theme, setTheme] = useState<AppTheme>("dark");
  const [guestNow, setGuestNow] = useState(() => Date.now());

  /* Field data state — starts with server-loaded initial */
  const [fieldData, setFieldData] = useState<FieldViewModel>(initial);
  const [workspaceId, setWorkspaceId] = useState(initial.workspaceId);
  const [activeFieldId, setActiveFieldId] = useState(initial.fieldId);
  const [sidebarFields, setSidebarFields] = useState(initial.sidebarFields);
  const [revealedFieldId, setRevealedFieldId] = useState<string | null>(null);
  const [isLoadingField, setIsLoadingField] = useState(false);
  const [fieldSwitchError, setFieldSwitchError] = useState<string | null>(null);
  const [workspaceFieldFeatures, setWorkspaceFieldFeatures] = useState<WorkspaceFieldFeatures>(
    initial.mapPreview.workspaceFieldFeatures ?? [],
  );
  const [pendingOnboardingWatch, setPendingOnboardingWatch] =
    useState<PendingOnboardingWatch | null>(null);
  const fieldRequestSequenceRef = useRef(0);
  const fieldCacheRef = useRef(new Map<string, FieldViewModel>([
    [initial.fieldId, initial],
  ]));
  const inflightRequestsRef = useRef(new Map<string, Promise<FieldViewModel | null>>());
  const failedRequestsRef = useRef(
    new Map<string, { retryAfter: number; summary: string }>(),
  );

  /* Welcome modal for fresh workspaces */
  const isEmptyWorkspace = isPlaceholderFieldId(activeFieldId) && sidebarFields.length === 0;
  const [welcomeDismissed, setWelcomeDismissed] = useState(false);
  const showWelcome = isEmptyWorkspace && !welcomeDismissed;

  /* Onboarding dispatch statuses — owned here so they survive panel switches */
  const [onboardingStatuses, setOnboardingStatuses] = useState<Map<string, PreviewJobDispatchSnapshot>>(new Map());

  /** Pre-built stage arrays from the commit response, keyed by fieldId. */
  const [prebuiltStagesByField, setPrebuiltStagesByField] = useState<
    ReadonlyMap<string, CommitFieldHydrationSummary["stages"]>
  >(new Map());

  /** Derived per-field progress for the field strip */
  const fieldOnboardingProgress = useMemo(() => {
    if (!pendingOnboardingWatch || onboardingStatuses.size === 0) return new Map<string, FieldOnboardingStatus>();
    const map = pendingOnboardingWatch.dispatchFieldMap;
    const byField = new Map<string, FieldOnboardingStatus>();
    const STATUS_ORDER: Record<string, number> = { running: 0, queued: 1, failed: 2, cancelled: 3, completed: 4 };

    for (const [dispatchId, info] of map) {
      const snap = onboardingStatuses.get(dispatchId);
      const status = snap?.status ?? 'queued';
      const existing = byField.get(info.fieldId);
      if (!existing) {
        byField.set(info.fieldId, {
          status,
          progressPct: snap?.progressPct ?? null,
          phaseLabel: snap?.activePhaseLabel ?? snap?.progressMessage ?? null,
        });
        continue;
      }
      if ((STATUS_ORDER[status] ?? 4) < (STATUS_ORDER[existing.status] ?? 4)) {
        existing.status = status;
        existing.phaseLabel = snap?.activePhaseLabel ?? snap?.progressMessage ?? existing.phaseLabel;
      }
      if (snap?.progressPct != null) {
        existing.progressPct = existing.progressPct != null
          ? Math.round((existing.progressPct + snap.progressPct) / 2)
          : snap.progressPct;
      }
    }
    return byField;
  }, [pendingOnboardingWatch, onboardingStatuses]);

  /* UI state */
  const [activePanel, setActivePanel] = useState<PanelView>('detail');
  const [panelAnim, setPanelAnim] = useState<'entering' | 'exiting' | ''>('entering');
  const [activeNav, setActiveNav] = useState('Map');
  const [activeLayer, setActiveLayer] = useState<LayerKey>('Moisture');
  const [hoveredCell, setHoveredCell] = useState<CellHoverEvent | null>(null);
  const [selectedCell, setSelectedCell] = useState<CellClickEvent | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [renderedSurface, setRenderedSurface] = useState<FieldAgronomicSurfaceRenderModel | null>(
    initial.mapPreview.agronomicSurface ?? null,
  );
  const isGuestSession = guestSession != null;
  const guestBadgeLabel = guestSession
    ? `Guest · ${formatGuestRemaining(guestSession.expiresAt, guestNow)}`
    : null;

  useEffect(() => {
    if (!guestSession) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setGuestNow(Date.now());
    }, GUEST_COUNTDOWN_TICK_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [guestSession]);
  const availableMetrics = useMemo(() => {
    const metrics = new Set<FieldAgronomicSurfaceMetricKey>();

    if (fieldData.mapPreview.agronomicSurface) {
      metrics.add(fieldData.mapPreview.agronomicSurface.metricKey);
    }

    for (const metric of AVAILABLE_METRICS) {
      if (fieldData.mapPreview.alternateAgronomicSurfaces?.[metric]) {
        metrics.add(metric);
      }
    }

    return AVAILABLE_METRICS.filter((metric) => metrics.has(metric));
  }, [fieldData.mapPreview]);
  const availableMetricDetails = useMemo(() => {
    const details: Partial<
      Record<
        FieldAgronomicSurfaceMetricKey,
        {
          sourceLabel?: string;
          confidence?: "low" | "medium" | "high";
        }
      >
    > = {};

    const primarySurface = fieldData.mapPreview.agronomicSurface;
    if (primarySurface) {
      details[primarySurface.metricKey] = {
        sourceLabel: primarySurface.sourceLabel,
        confidence: primarySurface.confidence,
      };
    }

    for (const metric of AVAILABLE_METRICS) {
      const surface = fieldData.mapPreview.alternateAgronomicSurfaces?.[metric];
      if (!surface) {
        continue;
      }

      details[metric] = {
        sourceLabel: surface.sourceLabel,
        confidence: surface.confidence,
      };
    }

    return details;
  }, [fieldData.mapPreview]);
  const availablePanelModes = useMemo(
    () =>
      availableMetrics
        .map((metric) => metricToModeKey(metric))
        .filter((mode): mode is ModeKey => mode != null),
    [availableMetrics],
  );
  const activePanelMode = useMemo(
    () => metricToModeKey(LAYER_TO_METRIC[activeLayer]) ?? 'moisture',
    [activeLayer],
  );

  useEffect(() => {
    const activeMetric = LAYER_TO_METRIC[activeLayer];
    if (availableMetrics.includes(activeMetric)) {
      return;
    }

    const fallbackMetric =
      availableMetrics.includes('root-zone-moisture-pct')
        ? 'root-zone-moisture-pct'
        : availableMetrics[0];

    if (!fallbackMetric) {
      return;
    }

    const nextLayer = LAYER_TABS.find(
      (layer) => LAYER_TO_METRIC[layer] === fallbackMetric,
    );
    if (nextLayer && nextLayer !== activeLayer) {
      setActiveLayer(nextLayer);
    }
  }, [activeLayer, availableMetrics]);

  const applyFieldData = useCallback((nextField: FieldViewModel) => {
    fieldCacheRef.current.set(nextField.fieldId, nextField);
    setFieldData(nextField);
    setSidebarFields(nextField.sidebarFields);
    setWorkspaceId(nextField.workspaceId);
    setFieldSwitchError(null);
  }, []);

  const syncSidebarFieldsAcrossCache = useCallback(
    (transform: (fields: SidebarFieldItem[]) => SidebarFieldItem[]) => {
      setSidebarFields((prev) => transform(prev));
      setFieldData((prev) => ({
        ...prev,
        sidebarFields: transform(prev.sidebarFields),
      }));

      const nextCache = new Map<string, FieldViewModel>();

      for (const [cachedFieldId, cachedField] of fieldCacheRef.current.entries()) {
        nextCache.set(cachedFieldId, {
          ...cachedField,
          sidebarFields: transform(cachedField.sidebarFields),
        });
      }

      fieldCacheRef.current = nextCache;
    },
    [],
  );

  const patchCachedField = useCallback(
    (
      fieldId: string,
      update: (field: FieldViewModel) => FieldViewModel,
    ) => {
      const cached = fieldCacheRef.current.get(fieldId);

      if (cached) {
        fieldCacheRef.current.set(fieldId, update(cached));
      }

      setFieldData((prev) => (prev.fieldId === fieldId ? update(prev) : prev));
    },
    [],
  );

  const resolveFieldSelectionLabel = useCallback(
    (fieldId: string) => {
      if (isPlaceholderFieldId(fieldId)) {
        return 'your current workspace';
      }

      return (
        fieldCacheRef.current.get(fieldId)?.fieldName
        ?? sidebarFields.find((field) => field.id === fieldId)?.name
        ?? 'the previous field'
      );
    },
    [sidebarFields],
  );

  const revertFailedFieldSwitch = useCallback(
    (failedFieldId: string, fallbackFieldId: string) => {
      setActiveFieldId(fallbackFieldId);
      const failedSummary =
        failedRequestsRef.current.get(failedFieldId)?.summary
        ?? 'Unable to load field data right now.';
      const failedLabel = resolveFieldSelectionLabel(failedFieldId);
      const fallbackLabel = resolveFieldSelectionLabel(fallbackFieldId);
      setFieldSwitchError(
        `Couldn't load ${failedLabel}. ${failedSummary}. Showing ${fallbackLabel} instead.`,
      );
    },
    [resolveFieldSelectionLabel],
  );

  const fetchFieldOverview = useCallback(
    (
      fieldId: string,
      options?: {
        force?: boolean;
      },
    ) => {
      if (isPlaceholderFieldId(fieldId)) {
        return Promise.resolve(null);
      }

      const cached = fieldCacheRef.current.get(fieldId);
      if (cached && !options?.force) {
        return Promise.resolve(cached);
      }

      const failedRequest = failedRequestsRef.current.get(fieldId);
      if (
        failedRequest &&
        !options?.force &&
        failedRequest.retryAfter > Date.now()
      ) {
        return Promise.resolve(null);
      }

      const inflight = inflightRequestsRef.current.get(fieldId);
      if (inflight) {
        return inflight;
      }

      const request = (async () => {
        const res = await fetch(`/api/fields/${fieldId}/overview`, {
          cache: 'no-store',
          headers: {
            'x-fieldpulse-workspace-id': workspaceId,
          },
        });

        if (!res.ok) {
          let message: string | null = null;

          try {
            const payload = (await res.clone().json()) as {
              error?: { message?: string };
              message?: string;
            };
            message = payload.error?.message ?? payload.message ?? null;
          } catch {
            message = await res.text().catch(() => null);
          }

          const summary = summarizeOverviewFetchFailure(res.status, message);
          failedRequestsRef.current.set(fieldId, {
            retryAfter: Date.now() + FAILED_FETCH_RETRY_MS,
            summary,
          });
          console.error(`[preview] Field fetch failed for ${fieldId}: ${summary}`);
          return null;
        }

        const data = (await res.json()) as Record<string, unknown>;
        if (data.status !== 'ready') {
          failedRequestsRef.current.set(fieldId, {
            retryAfter: Date.now() + FAILED_FETCH_RETRY_MS,
            summary: 'non-ready payload',
          });
          return null;
        }

        const nextField = toFieldViewModel(data);
        fieldCacheRef.current.set(nextField.fieldId, nextField);
        failedRequestsRef.current.delete(nextField.fieldId);
        return nextField;
      })()
        .catch((error) => {
          const summary =
            error instanceof Error ? error.message : 'Unknown fetch error';
          failedRequestsRef.current.set(fieldId, {
            retryAfter: Date.now() + FAILED_FETCH_RETRY_MS,
            summary,
          });
          console.error(`[preview] Field fetch error for ${fieldId}:`, error);
          return null;
        })
        .finally(() => {
          inflightRequestsRef.current.delete(fieldId);
        });

      inflightRequestsRef.current.set(fieldId, request);
      return request;
    },
    [workspaceId],
  );

  const handleMarketScenarioSaved = useCallback(async () => {
    if (isPlaceholderFieldId(activeFieldId)) {
      return;
    }

    const nextField = await fetchFieldOverview(activeFieldId, { force: true });
    if (!nextField || nextField.fieldId !== activeFieldId) {
      return;
    }

    applyFieldData(nextField);
  }, [activeFieldId, applyFieldData, fetchFieldOverview]);

  const handleFieldRename = useCallback(
    async (fieldId: string, newName: string) => {
      const snapshot = {
        fieldData,
        sidebarFields,
        workspaceFieldFeatures,
        cache: new Map(fieldCacheRef.current),
      };

      syncSidebarFieldsAcrossCache((fields) =>
        renameSidebarField(fields, fieldId, newName),
      );
      patchCachedField(fieldId, (field) => patchFieldViewModelName(field, newName));
      setWorkspaceFieldFeatures((prev) =>
        prev.map((feature) =>
          feature.properties.fieldId === fieldId
            ? {
                ...feature,
                properties: {
                  ...feature.properties,
                  fieldName: newName,
                },
              }
            : feature,
        ),
      );

      const response = await fetch(`/api/fields/${fieldId}`, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          'x-fieldpulse-workspace-id': workspaceId,
        },
        body: JSON.stringify({
          name: newName,
        }),
      });

      if (!response.ok) {
        fieldCacheRef.current = snapshot.cache;
        setSidebarFields(snapshot.sidebarFields);
        setWorkspaceFieldFeatures(snapshot.workspaceFieldFeatures);
        setFieldData((current) =>
          current.fieldId === fieldId ? snapshot.fieldData : current,
        );
        setFieldSwitchError(
          await readApiErrorMessage(response, 'Unable to rename this field right now.'),
        );
        return;
      }

      const nextField = await fetchFieldOverview(fieldId, { force: true });
      if (!nextField) {
        return;
      }

      if (activeFieldId === fieldId) {
        applyFieldData(nextField);
      }
    },
    [
      activeFieldId,
      applyFieldData,
      fieldData,
      fetchFieldOverview,
      patchCachedField,
      sidebarFields,
      syncSidebarFieldsAcrossCache,
      workspaceFieldFeatures,
      workspaceId,
    ],
  );

  const handleFieldLldUpdate = useCallback(
    async (fieldId: string, legalLandDescription: string) => {
      const normalizedLegalLandDescription = legalLandDescription.trim();
      const nextLegalLandDescription =
        normalizedLegalLandDescription.length > 0
          ? normalizedLegalLandDescription
          : null;
      const snapshot = {
        fieldData,
        sidebarFields,
        workspaceFieldFeatures,
        cache: new Map(fieldCacheRef.current),
      };

      syncSidebarFieldsAcrossCache((fields) =>
        updateSidebarFieldLld(fields, fieldId, nextLegalLandDescription),
      );
      patchCachedField(fieldId, (field) =>
        patchFieldViewModelLld(field, nextLegalLandDescription),
      );
      setWorkspaceFieldFeatures((prev) =>
        prev.map((feature) =>
          feature.properties.fieldId === fieldId
            ? {
                ...feature,
                properties: {
                  ...feature.properties,
                  legalLandDescription: nextLegalLandDescription,
                },
              }
            : feature,
        ),
      );

      const response = await fetch(`/api/fields/${fieldId}`, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          'x-fieldpulse-workspace-id': workspaceId,
        },
        body: JSON.stringify({
          legalLandDescription: nextLegalLandDescription,
        }),
      });

      if (!response.ok) {
        fieldCacheRef.current = snapshot.cache;
        setSidebarFields(snapshot.sidebarFields);
        setWorkspaceFieldFeatures(snapshot.workspaceFieldFeatures);
        setFieldData((current) =>
          current.fieldId === fieldId ? snapshot.fieldData : current,
        );
        setFieldSwitchError(
          await readApiErrorMessage(
            response,
            'Unable to update the legal land description right now.',
          ),
        );
        return;
      }

      const nextField = await fetchFieldOverview(fieldId, { force: true });
      if (!nextField) {
        return;
      }

      if (activeFieldId === fieldId) {
        applyFieldData(nextField);
      }
    },
    [
      activeFieldId,
      applyFieldData,
      fieldData,
      fetchFieldOverview,
      patchCachedField,
      sidebarFields,
      syncSidebarFieldsAcrossCache,
      workspaceFieldFeatures,
      workspaceId,
    ],
  );

  const handleFieldCropUpdate = useCallback(
    async (
      fieldId: string,
      crop: { cropName: string; variety?: string; seedingDate?: string },
    ) => {
      const nextCropName = crop.cropName.trim();

      if (!nextCropName) {
        setFieldSwitchError('Crop type cannot be empty.');
        return;
      }

      const snapshot = {
        fieldData,
        sidebarFields,
        workspaceFieldFeatures,
        cache: new Map(fieldCacheRef.current),
      };

      syncSidebarFieldsAcrossCache((fields) =>
        updateSidebarFieldCrop(fields, fieldId, nextCropName),
      );
      patchCachedField(fieldId, (field) => patchFieldViewModelCrop(field, nextCropName));

      const response = await fetch(`/api/fields/${fieldId}/crop-context`, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          'x-fieldpulse-workspace-id': workspaceId,
        },
        body: JSON.stringify({
          cropType: nextCropName,
          ...(crop.variety !== undefined ? { variety: crop.variety } : {}),
          ...(crop.seedingDate !== undefined ? { seedingDate: crop.seedingDate } : {}),
        }),
      });

      if (!response.ok) {
        fieldCacheRef.current = snapshot.cache;
        setSidebarFields(snapshot.sidebarFields);
        setWorkspaceFieldFeatures(snapshot.workspaceFieldFeatures);
        setFieldData((current) =>
          current.fieldId === fieldId ? snapshot.fieldData : current,
        );
        setFieldSwitchError(
          await readApiErrorMessage(response, 'Unable to update crop context right now.'),
        );
        return;
      }

      const nextField = await fetchFieldOverview(fieldId, { force: true });
      if (!nextField) {
        return;
      }

      if (activeFieldId === fieldId) {
        applyFieldData(nextField);
      }
    },
    [
      activeFieldId,
      applyFieldData,
      fieldData,
      fetchFieldOverview,
      patchCachedField,
      sidebarFields,
      syncSidebarFieldsAcrossCache,
      workspaceFieldFeatures,
      workspaceId,
    ],
  );

  const handleFieldDelete = useCallback(
    async (fieldId: string) => {
      const fallbackFieldId = selectFallbackFieldId(sidebarFields, fieldId);
      const response = await fetch(`/api/fields/${fieldId}`, {
        method: 'DELETE',
        headers: {
          'x-fieldpulse-workspace-id': workspaceId,
        },
      });

      if (!response.ok) {
        setFieldSwitchError(
          await readApiErrorMessage(response, 'Unable to delete this field right now.'),
        );
        return;
      }

      syncSidebarFieldsAcrossCache((fields) => removeSidebarField(fields, fieldId));
      setWorkspaceFieldFeatures((prev) =>
        prev.filter((feature) => feature.properties.fieldId !== fieldId),
      );
      fieldCacheRef.current.delete(fieldId);
      inflightRequestsRef.current.delete(fieldId);
      failedRequestsRef.current.delete(fieldId);
      setRevealedFieldId(null);
      setActivePanel('detail');
      setPanelAnim('entering');

      if (activeFieldId !== fieldId) {
        return;
      }

      setHoveredCell(null);
      setSelectedCell(null);
      setSelectedZoneId(null);

      if (!fallbackFieldId) {
        const emptyField = buildEmptyPreviewFieldViewModel(
          workspaceId,
          fieldData.mapPreview,
          [],
        );
        fieldCacheRef.current.set(EMPTY_PREVIEW_FIELD_ID, emptyField);
        setActiveFieldId(EMPTY_PREVIEW_FIELD_ID);
        applyFieldData(emptyField);
        setIsLoadingField(false);
        return;
      }

      setActiveFieldId(fallbackFieldId);
      const cachedFallback = fieldCacheRef.current.get(fallbackFieldId);

      if (cachedFallback) {
        applyFieldData(cachedFallback);
      }

      const nextField = await fetchFieldOverview(fallbackFieldId, { force: true });

      if (!nextField || nextField.fieldId !== fallbackFieldId) {
        return;
      }

      applyFieldData(nextField);
    },
    [
      activeFieldId,
      applyFieldData,
      fieldData.mapPreview,
      fetchFieldOverview,
      sidebarFields,
      syncSidebarFieldsAcrossCache,
      workspaceId,
    ],
  );

  const handleFieldsChanged = useCallback(async (result: {
    preferredFieldId?: string | null;
    fieldIds: string[];
    fieldEntries?: readonly FirstInsightFieldEntry[];
    fieldHydrationSummaries?: readonly CommitFieldHydrationSummary[];
  }) => {
    const preferredFieldId = chooseFirstInsightField({
      workspaceId,
      preferredFieldId: result.preferredFieldId ?? null,
      fieldEntries:
        result.fieldEntries ??
        result.fieldIds.map((fieldId) => ({ fieldId })),
      hydrationSummaries: result.fieldHydrationSummaries,
    });
    const previousFieldId = activeFieldId;
    setRevealedFieldId(preferredFieldId);

    /* When the current field is the empty placeholder (fresh workspace), pick
       the best real field from the import result and switch to it. */
    const shouldSwitchFromPlaceholder =
      isPlaceholderFieldId(activeFieldId) && result.fieldIds.length > 0;
    const switchTargetId =
      shouldSwitchFromPlaceholder
        ? preferredFieldId
        : preferredFieldId;

    if (
      switchTargetId &&
      (result.fieldIds.length === 1 || shouldSwitchFromPlaceholder) &&
      switchTargetId !== activeFieldId
    ) {
      setFieldSwitchError(null);
      setActiveFieldId(switchTargetId);
      setActivePanel('detail');
      setPanelAnim('entering');
      const requestSequence = fieldRequestSequenceRef.current + 1;
      fieldRequestSequenceRef.current = requestSequence;
      setIsLoadingField(true);

      void (async () => {
        try {
          const nextField = await fetchFieldOverview(switchTargetId, { force: true });
          if (fieldRequestSequenceRef.current !== requestSequence) {
            return;
          }
          if (!nextField) {
            revertFailedFieldSwitch(switchTargetId, previousFieldId);
            return;
          }
          applyFieldData(nextField);
        } finally {
          if (fieldRequestSequenceRef.current === requestSequence) {
            setIsLoadingField(false);
          }
        }
      })();
      return;
    }

    if (shouldSwitchFromPlaceholder && !switchTargetId) {
      return;
    }

    const nextField = await fetchFieldOverview(activeFieldId, { force: true });
    if (!nextField || nextField.fieldId !== activeFieldId) {
      return;
    }

    if (preferredFieldId && result.fieldIds.length === 1) {
      setActivePanel('detail');
      setPanelAnim('entering');
    }
    applyFieldData(nextField);
  }, [activeFieldId, applyFieldData, fetchFieldOverview, revertFailedFieldSwitch, workspaceId]);

  const handleOnboardingTracked = useCallback((result: {
    preferredFieldId?: string | null;
    fieldIds: string[];
    fieldEntries?: readonly FirstInsightFieldEntry[];
    dispatchIds: string[];
    workspaceId?: string | null;
    trackedJobs?: readonly { dispatchId: string; fieldId: string; fieldLabel: string }[];
    fieldHydrationSummaries?: readonly CommitFieldHydrationSummary[];
  }) => {
    if (result.dispatchIds.length === 0) {
      setPendingOnboardingWatch(null);
      return;
    }

    const dispatchFieldMap = new Map(
      (result.trackedJobs ?? []).map((job) => [
        job.dispatchId,
        { fieldId: job.fieldId, fieldLabel: job.fieldLabel },
      ] as const),
    );

    setPendingOnboardingWatch((prev) => {
      /* Merge with any existing watch so earlier imports aren't lost */
      const merged = prev ? new Map(prev.dispatchFieldMap) : new Map<string, { fieldId: string; fieldLabel: string }>();
      for (const [id, info] of dispatchFieldMap) {
        merged.set(id, info);
      }
      const mergedDispatchIds = Array.from(new Set([
        ...(prev?.dispatchIds ?? []),
        ...result.dispatchIds,
      ]));
      const mergedFieldIds = Array.from(new Set([
        ...(prev?.fieldIds ?? []),
        ...result.fieldIds,
      ]));
      const mergedFieldEntries = Array.from(merged.values()).map((info) => ({
        fieldId: info.fieldId,
        fieldName: info.fieldLabel,
      }));
      const nextPreferredFieldId = chooseFirstInsightField({
        workspaceId: result.workspaceId ?? prev?.workspaceId ?? workspaceId,
        preferredFieldId: result.preferredFieldId ?? prev?.preferredFieldId ?? null,
        fieldEntries:
          result.fieldEntries && result.fieldEntries.length > 0
            ? Array.from(
                new Map(
                  [...mergedFieldEntries, ...result.fieldEntries].map((entry) => [
                    entry.fieldId,
                    entry,
                  ] as const),
                ).values(),
              )
            : mergedFieldEntries,
        hydrationSummaries: result.fieldHydrationSummaries,
      });

      return {
        workspaceId: result.workspaceId ?? prev?.workspaceId,
        preferredFieldId: nextPreferredFieldId,
        fieldIds: mergedFieldIds,
        dispatchIds: mergedDispatchIds,
        dispatchFieldMap: merged,
      };
    });

    /* ── Seed onboarding statuses for fields already hydrated at commit time ── */
    if (result.fieldHydrationSummaries && result.fieldHydrationSummaries.length > 0) {
      setOnboardingStatuses((prev) => {
        const next = new Map(prev);
        for (const summary of result.fieldHydrationSummaries!) {
          if (summary.status !== 'completed') continue;
          /* Find the dispatch ID for this field so the fieldOnboardingProgress
             derivation (which keys by dispatchId → fieldId) picks it up. */
          const dispatchId = (result.trackedJobs ?? []).find(
            (job) => job.fieldId === summary.fieldId,
          )?.dispatchId;
          if (!dispatchId) continue;
          next.set(dispatchId, {
            id: dispatchId,
            key: `hydration-seed:${summary.fieldId}`,
            status: 'completed',
            activePhaseLabel: summary.phaseLabel,
            progressPct: 100,
            progressMessage: summary.phaseLabel,
            updatedAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
            failedAt: null,
            cancelledAt: null,
            lastError: null,
            fieldId: summary.fieldId,
          });
        }
        return next;
      });

      /* Store pre-built stage arrays so HydrationStageTracker can use
         authoritative backend data instead of substring-parsing progressMessages. */
      setPrebuiltStagesByField((prev) => {
        const next = new Map(prev);
        for (const summary of result.fieldHydrationSummaries!) {
          if (summary.stages && summary.stages.length > 0) {
            next.set(summary.fieldId, summary.stages);
          }
        }
        return next;
      });
    }
  }, [workspaceId]);

  useEffect(() => {
    if (!pendingOnboardingWatch || pendingOnboardingWatch.dispatchIds.length === 0) {
      return;
    }

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      try {
        const response = await fetch('/api/jobs/dispatches', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            workspaceId: pendingOnboardingWatch.workspaceId ?? workspaceId,
            ids: pendingOnboardingWatch.dispatchIds,
          }),
        });
        const payload = (await response.json()) as {
          result?: { dispatches?: OnboardingDispatchSnapshot[] };
          error?: { message?: string };
        };

        if (!response.ok) {
          throw new Error(payload.error?.message ?? 'Onboarding dispatch lookup failed.');
        }

        const dispatches = payload.result?.dispatches ?? [];
        const dispatchById = new Map(
          dispatches.map((dispatch) => [
            dispatch.id,
            {
              id: dispatch.id,
              key: dispatch.id,
              status: dispatch.status,
              activePhaseLabel: dispatch.activePhaseLabel ?? null,
              progressPct: dispatch.progressPct ?? null,
              progressMessage: dispatch.progressMessage ?? null,
              updatedAt: null,
              completedAt: dispatch.status === 'completed' ? new Date().toISOString() : null,
              failedAt: dispatch.status === 'failed' ? new Date().toISOString() : null,
              cancelledAt: dispatch.status === 'cancelled' ? new Date().toISOString() : null,
              lastError: null,
              fieldId: dispatch.fieldId ?? pendingOnboardingWatch.dispatchFieldMap.get(dispatch.id)?.fieldId ?? null,
            } satisfies PreviewJobDispatchSnapshot,
          ] as const),
        );

        if (cancelled) return;

        /* Update the shared status map so FieldStrip + AddFieldPanel can read it */
        setOnboardingStatuses(dispatchById);

        const shouldContinue = pendingOnboardingWatch.dispatchIds.some((dispatchId) => {
          const status = dispatchById.get(dispatchId)?.status ?? 'queued';
          return status === 'queued' || status === 'running';
        });

        if (shouldContinue) {
          timeoutId = setTimeout(() => {
            void poll();
          }, ONBOARDING_STATUS_POLL_MS);
          return;
        }

        /* All dispatches finished — refresh the active field and clean up.
           Re-run the chooser so that hydration summaries collected during
           polling are considered and thin/broken fields stay excluded even
           when only a single field was imported. */
        const refreshFieldId = resolvePreviewPostOnboardingFieldId({
          activeFieldId,
          preferredFieldId: pendingOnboardingWatch.preferredFieldId ?? null,
        });

        if (!refreshFieldId) {
          setPendingOnboardingWatch(null);
          setOnboardingStatuses(new Map());
          return;
        }

        const nextField = await fetchFieldOverview(refreshFieldId, { force: true });
        if (cancelled) return;

        if (nextField) {
          if (refreshFieldId !== activeFieldId) {
            setActiveFieldId(refreshFieldId);
          }
          applyFieldData(nextField);
        }
        setPendingOnboardingWatch(null);
        setOnboardingStatuses(new Map());
      } catch {
        if (!cancelled) {
          timeoutId = setTimeout(() => {
            void poll();
          }, ONBOARDING_STATUS_POLL_MS);
        }
      }
    };

    void poll();

    return () => {
      cancelled = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [activeFieldId, applyFieldData, fetchFieldOverview, pendingOnboardingWatch, workspaceId]);

  /* ── Field switching via API ── */
  const handleFieldSelect = useCallback(
    (id: string) => {
      if (isPlaceholderFieldId(id) || id === activeFieldId) return;
      const previousFieldId = activeFieldId;
      setFieldSwitchError(null);
      setActiveFieldId(id);
      setActivePanel('detail');
      setPanelAnim('entering');
      const requestSequence = fieldRequestSequenceRef.current + 1;
      fieldRequestSequenceRef.current = requestSequence;

      const cached = fieldCacheRef.current.get(id);
      if (cached) {
        applyFieldData(cached);
        setIsLoadingField(false);

        void (async () => {
          const nextField = await fetchFieldOverview(id, { force: true });
          if (!nextField || fieldRequestSequenceRef.current !== requestSequence) {
            return;
          }
          applyFieldData(nextField);
        })();

        return;
      }

      setIsLoadingField(true);

      void (async () => {
        try {
          const nextField = await fetchFieldOverview(id, { force: true });
          if (fieldRequestSequenceRef.current !== requestSequence) {
            return;
          }
          if (!nextField) {
            revertFailedFieldSwitch(id, previousFieldId);
            return;
          }
          applyFieldData(nextField);
        } finally {
          if (fieldRequestSequenceRef.current === requestSequence) {
            setIsLoadingField(false);
          }
        }
      })();
    },
    [activeFieldId, applyFieldData, fetchFieldOverview, revertFailedFieldSwitch],
  );

  const handleFieldPrefetch = useCallback(
    (fieldId: string) => {
      if (
        isPlaceholderFieldId(fieldId) ||
        fieldId === activeFieldId ||
        fieldCacheRef.current.has(fieldId) ||
        inflightRequestsRef.current.has(fieldId) ||
        (failedRequestsRef.current.get(fieldId)?.retryAfter ?? 0) > Date.now()
      ) {
        return;
      }

      void fetchFieldOverview(fieldId);
    },
    [activeFieldId, fetchFieldOverview],
  );

  useEffect(() => {
    const pendingFieldIds = sidebarFields
      .map((field) => field.id)
      .filter((fieldId) => fieldId !== activeFieldId);

    if (pendingFieldIds.length === 0) {
      return;
    }

    let cancelled = false;
    let timeoutId: number | null = null;

    const prefetchNext = async (index: number) => {
      if (cancelled || index >= pendingFieldIds.length) {
        return;
      }

      const fieldId = pendingFieldIds[index];
      await fetchFieldOverview(fieldId);

      if (cancelled || index + 1 >= pendingFieldIds.length) {
        return;
      }

      timeoutId = window.setTimeout(() => {
        void prefetchNext(index + 1);
      }, PREFETCH_DELAY_MS);
    };

    timeoutId = window.setTimeout(() => {
      void prefetchNext(0);
    }, PREFETCH_DELAY_MS);

    return () => {
      cancelled = true;
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [activeFieldId, fetchFieldOverview, sidebarFields]);

  useEffect(() => {
    if (isPlaceholderFieldId(activeFieldId)) {
      return;
    }

    let cancelled = false;

    void (async () => {
      const nextField = await fetchFieldOverview(activeFieldId, { force: true });
      if (cancelled || !nextField || nextField.fieldId !== activeFieldId) {
        return;
      }
      applyFieldData(nextField);
    })();

    return () => {
      cancelled = true;
    };
  }, [activeFieldId, applyFieldData, fetchFieldOverview]);

  useEffect(() => {
    if (!fieldSwitchError) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setFieldSwitchError(null);
    }, 6000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [fieldSwitchError]);

  useEffect(() => {
    setHoveredCell(null);
    setSelectedCell(null);
    setSelectedZoneId(null);
    setRenderedSurface(fieldData.mapPreview.agronomicSurface ?? null);
  }, [fieldData.fieldId, fieldData.mapPreview.agronomicSurface]);

  /* ── Panel switching ── */
  const switchPanel = useCallback(
    (next: PanelView) => {
      if (next === activePanel) return;
      setPanelAnim('exiting');
      setTimeout(() => {
        setActivePanel(next);
        setPanelAnim('entering');
      }, 250);
    },
    [activePanel],
  );

  const handleNavChange = useCallback(
    (nav: string) => {
      setActiveNav(nav);
      if (nav === 'Crops') switchPanel('crops');
      else if (nav === 'Action') switchPanel('action');
      else if (nav === 'Notes') switchPanel('notes');
      else if (nav === 'Zones') switchPanel('zone');
      else if (nav === 'Alerts') switchPanel('alerts');
      else if (nav === 'Settings' && !isGuestSession) switchPanel('settings');
      else switchPanel('detail');
    },
    [isGuestSession, switchPanel],
  );

  const handleCellClick = useCallback(
    (event: CellClickEvent) => {
      if (event.selected) {
        setSelectedCell(event);
        setSelectedZoneId(event.zoneId);
        switchPanel('cell');
        return;
      }

      setSelectedCell(null);
      setSelectedZoneId(null);
      switchPanel('detail');
    },
    [switchPanel],
  );

  /* ── Search index for command palette — built from cache ── */
  const paletteSearchIndex = useMemo<PaletteSearchIndex>(() => {
    const fields: PaletteSearchIndex["fields"] = sidebarFields.map((f) => ({
      kind: "field" as const,
      id: f.id,
      name: f.name,
      crop: f.crop,
      area: f.area,
      status: f.status,
      legalLandDescription: f.legalLandDescription,
    }));

    const zones: PaletteSearchIndex["zones"] = [];
    const findings: PaletteSearchIndex["findings"] = [];

    for (const [fId, vm] of fieldCacheRef.current.entries()) {
      const fName = vm.fieldName;
      if (vm.activityPanel) {
        for (const z of vm.activityPanel.zones) {
          zones.push({
            kind: "zone",
            fieldId: fId,
            fieldName: fName,
            zoneId: z.id,
            family: z.family,
            trackingKey: z.trackingKey,
            status: z.status,
            severity: z.severity,
          });
        }
        for (const f of vm.activityPanel.findings) {
          findings.push({
            kind: "finding",
            fieldId: fId,
            fieldName: fName,
            findingId: f.id,
            title: f.title,
            summary: f.summary,
            severity: f.severity,
          });
        }
      }
    }

    return { fields, zones, findings };
  }, [sidebarFields, fieldData]); // re-derive when fields or active field data changes

  /* ── Global ⌘K shortcut ── */
  useEffect(() => {
    function handleGlobalKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setPaletteOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", handleGlobalKey);
    return () => window.removeEventListener("keydown", handleGlobalKey);
  }, []);

  const handlePaletteSelectField = useCallback(
    (fieldId: string) => {
      handleFieldSelect(fieldId);
      setPaletteOpen(false);
    },
    [handleFieldSelect],
  );

  const handlePaletteSelectZone = useCallback(
    (fieldId: string, zoneId: string) => {
      handleFieldSelect(fieldId);
      setSelectedZoneId(zoneId);
      switchPanel("zoneDetail");
      setPaletteOpen(false);
    },
    [handleFieldSelect, switchPanel],
  );

  const handlePaletteSelectFinding = useCallback(
    (fieldId: string, _findingId: string) => {
      handleFieldSelect(fieldId);
      switchPanel("zone");
      setPaletteOpen(false);
    },
    [handleFieldSelect, switchPanel],
  );

  const mapModel = useMemo<FieldBoundaryPreviewRenderModel>(() => ({
    ...fieldData.mapPreview,
    workspaceFieldFeatures,
  }), [fieldData.mapPreview, workspaceFieldFeatures]);
  const effectiveFocusedZoneId = selectedZoneId ?? hoveredCell?.zoneId ?? null;
  const interactiveActivityState = useMemo(
    () => buildInteractiveActivity(fieldData.activityPanel, hoveredCell, fieldData.cellInspector),
    [fieldData.activityPanel, fieldData.cellInspector, hoveredCell],
  );
  const pinnedZoneDetail = useMemo(
    () => buildZoneDetailSelection(selectedZoneId, fieldData.activityPanel, fieldData.cellInspector),
    [fieldData.activityPanel, fieldData.cellInspector, selectedZoneId],
  );

  /* ── Panel renderer ── */
  const renderCanonicalDetailPanel = (
    initialPage?: string | null,
    onInitialPageClose?: (() => void) | null,
  ) => (
    <FieldDetailPanel
      fieldId={fieldData.fieldId}
      workspaceId={workspaceId}
      fieldName={fieldData.fieldName}
      fieldMeta={resolveFieldMeta(
        fieldData.summary,
        fieldData.cropPanel,
        fieldData.areaHaLabel,
      )}
      areaLabel={fieldData.areaHaLabel}
      mapModel={mapModel}
      hoveredCell={hoveredCell}
      activeMode={activePanelMode}
      availableModes={availablePanelModes}
      onModeChange={(nextMode) => {
        const nextMetric = MODE_TO_METRIC_KEY[nextMode];
        const nextLayer = LAYER_TABS.find(
          (layer) => LAYER_TO_METRIC[layer] === nextMetric,
        );
        if (nextLayer) {
          setActiveLayer(nextLayer);
        }
      }}
      summary={fieldData.summary}
      report={fieldData.reportPanel}
      market={fieldData.marketPanel}
      crop={fieldData.cropPanel}
      action={fieldData.actionPanel}
      notes={fieldData.notesPanel}
      activity={fieldData.activityPanel}
      onMarketScenarioSaved={handleMarketScenarioSaved}
      initialPage={initialPage}
      onInitialPageClose={onInitialPageClose}
      onboardingStatus={fieldOnboardingProgress.get(fieldData.fieldId) ?? null}
      progressMessage={fieldOnboardingProgress.get(fieldData.fieldId)?.phaseLabel ?? null}
      prebuiltStages={prebuiltStagesByField.get(fieldData.fieldId) ?? null}
    />
  );

  const renderPanel = () => {
    const canonicalDetailInitialPage =
      resolvePreviewCanonicalDetailInitialPage(activePanel);

    if (canonicalDetailInitialPage) {
      return renderCanonicalDetailPanel(
        canonicalDetailInitialPage,
        () => switchPanel('detail'),
      );
    }

    switch (activePanel) {
      case 'detail':
        return renderCanonicalDetailPanel();
      case 'alerts':
        return fieldData.alertsPanel ? (
          <AlertsPanel {...fieldData.alertsPanel} onClose={() => switchPanel('detail')} />
        ) : (
          <AlertsPanel activeAlerts={[]} resolvedAlerts={[]} activeCount={0} criticalCount={0} weekCount={0} onClose={() => switchPanel('detail')} />
        );
      case 'settings':
        return isGuestSession ? (
          renderCanonicalDetailPanel()
        ) : (
          <SettingsPanel
            workspaceId={fieldData.workspaceId}
            viewer={viewer}
            fieldId={fieldData.fieldId}
            fieldName={fieldData.fieldName}
            onClose={() => switchPanel('detail')}
          />
        );
      case 'edit-field':
        return (
          <EditFieldPanel
            fieldId={activeFieldId}
            fieldName={fieldData.fieldName}
            areaHaLabel={fieldData.areaHaLabel}
            lld={fieldData.summary?.lld ?? fieldData.cropPanel?.lld ?? null}
            crop={fieldData.summary?.crop ?? fieldData.cropPanel?.cropName ?? null}
            cropStage={fieldData.summary?.cropStage ?? fieldData.cropPanel?.thresholdStageLabel ?? null}
            growthStageLabel={fieldData.cropPanel?.thresholdStageLabel ?? null}
            accumulatedGdd={fieldData.cropPanel?.accumulatedGddLabel ?? null}
            onClose={() => switchPanel('detail')}
            onRename={handleFieldRename}
            onUpdateLld={handleFieldLldUpdate}
            onUpdateCrop={handleFieldCropUpdate}
            onDelete={handleFieldDelete}
          />
        );
      case 'scout':
        return <ScoutReportPanel onClose={() => switchPanel('detail')} />;
      case 'zone':
        return (
          <FieldActivityPanel
            activity={interactiveActivityState.activity}
            contextLabel={interactiveActivityState.contextLabel}
            scopeLabel={interactiveActivityState.scopeLabel}
            focusedZoneId={effectiveFocusedZoneId}
            onZoneSelect={setSelectedZoneId}
            onZoneDrillDown={(zoneId) => {
              setSelectedZoneId(zoneId);
              switchPanel('zoneDetail');
            }}
            onClose={() => switchPanel('detail')}
          />
        );
      case 'zoneDetail':
        return pinnedZoneDetail ? (
          <ZoneDetailPanel
            zone={pinnedZoneDetail.zone}
            cells={pinnedZoneDetail.cells}
            findings={pinnedZoneDetail.findings}
            onClose={() => {
              setSelectedZoneId(null);
              switchPanel('zone');
            }}
          />
        ) : (
          <FieldActivityPanel
            activity={interactiveActivityState.activity}
            contextLabel={interactiveActivityState.contextLabel}
            scopeLabel={interactiveActivityState.scopeLabel}
            focusedZoneId={effectiveFocusedZoneId}
            onZoneSelect={setSelectedZoneId}
            onZoneDrillDown={(zoneId) => {
              setSelectedZoneId(zoneId);
              switchPanel('zoneDetail');
            }}
            onClose={() => switchPanel('detail')}
          />
        );
      case 'evidence':
        return <EvidencePanel onClose={() => switchPanel('detail')} />;
      case 'spot':
        return <SpotInspectorPanel onClose={() => switchPanel('detail')} />;
      case 'cell':
        return (
          <SelectedCellInspector
            selection={selectedCell}
            model={fieldData.cellInspector}
            mapModel={mapModel}
            summary={fieldData.summary}
            report={fieldData.reportPanel}
            crop={fieldData.cropPanel}
            fieldName={fieldData.fieldName}
            focusedZoneId={effectiveFocusedZoneId}
            onZoneSelect={setSelectedZoneId}
            onClose={() => {
              setSelectedCell(null);
              setSelectedZoneId(null);
              switchPanel('detail');
            }}
          />
        );
      case 'add-field':
        return isGuestSession ? (
          renderCanonicalDetailPanel()
        ) : (
          <AddFieldPanel
            onFieldsChanged={handleFieldsChanged}
            onOnboardingTracked={handleOnboardingTracked}
            jobStatuses={onboardingStatuses}
            workspaceId={fieldData.workspaceId}
            onClose={() => switchPanel('detail')}
          />
        );
      default:
        return renderCanonicalDetailPanel();
    }
  };

  return (
    <ThemeContext.Provider value={theme}>
    <div className="app-shell" data-theme={theme}>
      {showWelcome && (
        <WelcomeModal
          onAddField={() => {
            setWelcomeDismissed(true);
            switchPanel('add-field');
          }}
          onDismiss={() => setWelcomeDismissed(true)}
        />
      )}
      <TopBar
        activeNav={activeNav}
        onNavChange={handleNavChange}
        onAlertsBell={() => switchPanel(activePanel === 'alerts' ? 'detail' : 'alerts')}
        onAddField={() => switchPanel(activePanel === 'add-field' ? 'detail' : 'add-field')}
        theme={theme}
        onThemeToggle={() => setTheme(theme === "dark" ? "light" : "dark")}
        showSettingsNav={!isGuestSession}
        showAddField={!isGuestSession}
        showAlertsBell={!isGuestSession}
        showAvatar={!isGuestSession}
        viewer={isGuestSession ? null : viewer}
        guestBadgeLabel={guestBadgeLabel}
        guestCtaHref={isGuestSession ? "/request-access" : null}
      />
      <div className="app-body">
        {initialPanelsPromise && (
          <React.Suspense fallback={null}>
            <StreamingPanels
              promise={initialPanelsPromise}
              onResolve={(panels) =>
                setFieldData((prev) => ({ ...prev, ...panels }))
              }
            />
          </React.Suspense>
        )}
        <div className="map-area">
          <AppShellErrorBoundary
            resetKey={`${activeFieldId}:${activePanel}:${activeLayer}`}
            title="Preview shell recovered"
            description="The preview map or panel hit a render failure. Reload the shell to continue exploring this field."
          >
            <div className="map-area__canvas">
              <LazyFieldBoundaryMap
                model={mapModel}
                onCellHover={setHoveredCell}
                onCellClick={handleCellClick}
                onFieldClick={handleFieldSelect}
                onSurfaceChange={setRenderedSurface}
                activeMetric={LAYER_TO_METRIC[activeLayer]}
              />
              {/* Loading indicator during field switch */}
              {isLoadingField && (
                <div className="map-area__loading-indicator">
                  <span className="map-area__loading-dot" />
                </div>
              )}
              {fieldSwitchError ? (
                <div
                  className="map-area__error-indicator"
                  role="status"
                  aria-live="polite"
                >
                  {fieldSwitchError}
                </div>
              ) : null}
            </div>

            {/* Field strip — horizontal bottom dock */}
            <FieldStrip
              fields={sidebarFields}
              activeFieldId={activeFieldId}
              revealFieldId={revealedFieldId ?? undefined}
              onFieldSelect={handleFieldSelect}
              onFieldPrefetch={handleFieldPrefetch}
              onAddField={
                isGuestSession
                  ? undefined
                  : () => switchPanel(activePanel === 'add-field' ? 'detail' : 'add-field')
              }
              onSearchOpen={isGuestSession ? undefined : () => setPaletteOpen(true)}
              onboardingProgress={fieldOnboardingProgress}
              onFieldRename={handleFieldRename}
              onFieldDelete={handleFieldDelete}
              onFieldEdit={(fieldId) => {
                handleFieldSelect(fieldId);
                switchPanel('edit-field');
              }}
              workspaceId={fieldData.workspaceId}
            />

            {/* Command palette — anchored above the field strip */}
            <FieldCommandPalette
              open={paletteOpen}
              onClose={() => setPaletteOpen(false)}
              onSelectField={handlePaletteSelectField}
              onSelectZone={handlePaletteSelectZone}
              onSelectFinding={handlePaletteSelectFinding}
              searchIndex={paletteSearchIndex}
            />

            {renderedSurface ? (
              <MetricLegendCard
                metricKey={renderedSurface.metricKey}
                metricAveragePct={renderedSurface.metricAveragePct}
                hoveredMetricPct={
                  hoveredCell?.metricKey === renderedSurface.metricKey
                    ? hoveredCell.metricValuePct
                    : null
                }
                confidence={renderedSurface.confidence}
                sourceLabel={renderedSurface.sourceLabel}
                allMetrics={AVAILABLE_METRICS}
                availableMetrics={availableMetrics}
                availableMetricDetails={availableMetricDetails}
                onMetricChange={(metric) => {
                  const nextLayer = LAYER_TABS.find((layer) => LAYER_TO_METRIC[layer] === metric);
                  if (nextLayer) {
                    setActiveLayer(nextLayer);
                  }
                }}
              />
            ) : null}

            {/* Right panel — floats over map.
             * IMPORTANT: Clear the entering animation after it finishes so the
             * compositing layer is torn down. While a parent has an active
             * opacity animation, Chromium blocks backdrop-filter on children
             * (.fdp) from sampling content outside the layer. */}
            <div
              className={`map-area__panel-layer ${panelAnim ? `panel--${panelAnim}` : ''}`}
              onAnimationEnd={() => {
                if (panelAnim === 'entering') setPanelAnim('');
              }}
            >
              {renderPanel()}
            </div>
          </AppShellErrorBoundary>
        </div>
      </div>
    </div>
    </ThemeContext.Provider>
  );
}
