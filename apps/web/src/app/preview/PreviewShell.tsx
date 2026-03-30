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
import { AddFieldPanel } from '../../components/panels/AddFieldPanel';
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

export type PreviewShellProps = {
  initial: FieldViewModel;
  initialPanelsPromise?: Promise<Partial<FieldViewModel>>;
};

import React from "react";
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

type PendingOnboardingWatch = {
  workspaceId?: string | null;
  preferredFieldId?: string | null;
  fieldIds: string[];
  dispatchIds: string[];
};

type OnboardingDispatchSnapshot = {
  id: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
};

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
  | 'add-field';

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

export function PreviewShell({ initial, initialPanelsPromise }: PreviewShellProps) {
  const [theme, setTheme] = useState<AppTheme>("dark");

  /* Field data state — starts with server-loaded initial */
  const [fieldData, setFieldData] = useState<FieldViewModel>(initial);
  const [workspaceId, setWorkspaceId] = useState(initial.workspaceId);
  const [activeFieldId, setActiveFieldId] = useState(initial.fieldId);
  const [sidebarFields, setSidebarFields] = useState(initial.sidebarFields);
  const [revealedFieldId, setRevealedFieldId] = useState<string | null>(null);
  const [isLoadingField, setIsLoadingField] = useState(false);
  const [workspaceFieldFeatures] = useState(
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
  }, []);

  const fetchFieldOverview = useCallback(
    (
      fieldId: string,
      options?: {
        force?: boolean;
      },
    ) => {
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
    const nextField = await fetchFieldOverview(activeFieldId, { force: true });
    if (!nextField || nextField.fieldId !== activeFieldId) {
      return;
    }

    applyFieldData(nextField);
  }, [activeFieldId, applyFieldData, fetchFieldOverview]);

  const handleFieldsChanged = useCallback(async (result: {
    preferredFieldId?: string | null;
    fieldIds: string[];
  }) => {
    const preferredFieldId = result.preferredFieldId ?? null;
    const revealedFieldId = preferredFieldId ?? result.fieldIds[0] ?? null;
    setRevealedFieldId(revealedFieldId);

    if (
      preferredFieldId &&
      result.fieldIds.length === 1 &&
      preferredFieldId !== activeFieldId
    ) {
      setActiveFieldId(preferredFieldId);
      setActivePanel('detail');
      setPanelAnim('entering');
      const requestSequence = fieldRequestSequenceRef.current + 1;
      fieldRequestSequenceRef.current = requestSequence;
      setIsLoadingField(true);

      void (async () => {
        try {
          const nextField = await fetchFieldOverview(preferredFieldId, { force: true });
          if (!nextField || fieldRequestSequenceRef.current !== requestSequence) {
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

    const nextField = await fetchFieldOverview(activeFieldId, { force: true });
    if (!nextField || nextField.fieldId !== activeFieldId) {
      return;
    }

    if (preferredFieldId && result.fieldIds.length === 1) {
      setActivePanel('detail');
      setPanelAnim('entering');
    }
    applyFieldData(nextField);
  }, [activeFieldId, applyFieldData, fetchFieldOverview]);

  const handleOnboardingTracked = useCallback((watch: PendingOnboardingWatch) => {
    if (watch.dispatchIds.length === 0) {
      setPendingOnboardingWatch(null);
      return;
    }

    setPendingOnboardingWatch(watch);
  }, []);

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

        const dispatchById = new Map(
          (payload.result?.dispatches ?? []).map((dispatch) => [dispatch.id, dispatch] as const),
        );
        const shouldContinue = pendingOnboardingWatch.dispatchIds.some((dispatchId) => {
          const status = dispatchById.get(dispatchId)?.status ?? 'queued';
          return status === 'queued' || status === 'running';
        });

        if (cancelled) {
          return;
        }

        if (shouldContinue) {
          timeoutId = setTimeout(() => {
            void poll();
          }, ONBOARDING_STATUS_POLL_MS);
          return;
        }

        const nextField = await fetchFieldOverview(activeFieldId, { force: true });
        if (cancelled) {
          return;
        }

        if (nextField && nextField.fieldId === activeFieldId) {
          applyFieldData(nextField);
        }
        setPendingOnboardingWatch(null);
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
      if (id === activeFieldId) return;
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
          if (!nextField || fieldRequestSequenceRef.current !== requestSequence) {
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
    [activeFieldId, applyFieldData, fetchFieldOverview],
  );

  const handleFieldPrefetch = useCallback(
    (fieldId: string) => {
      if (
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
      else if (nav === 'Settings') switchPanel('settings');
      else switchPanel('detail');
    },
    [switchPanel],
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
        return (
          <SettingsPanel
            workspaceId={fieldData.workspaceId}
            onClose={() => switchPanel('detail')}
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
        return (
          <AddFieldPanel
            onFieldsChanged={handleFieldsChanged}
            onOnboardingTracked={handleOnboardingTracked}
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
      <TopBar
        activeNav={activeNav}
        onNavChange={handleNavChange}
        onAlertsBell={() => switchPanel(activePanel === 'alerts' ? 'detail' : 'alerts')}
        onAddField={() => switchPanel(activePanel === 'add-field' ? 'detail' : 'add-field')}
        theme={theme}
        onThemeToggle={() => setTheme(theme === "dark" ? "light" : "dark")}
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
            </div>

            {/* Field strip — horizontal bottom dock */}
            <FieldStrip
              fields={sidebarFields}
              activeFieldId={activeFieldId}
              revealFieldId={revealedFieldId ?? undefined}
              onFieldSelect={handleFieldSelect}
              onFieldPrefetch={handleFieldPrefetch}
              onAddField={() => switchPanel(activePanel === 'add-field' ? 'detail' : 'add-field')}
              onSearchOpen={() => setPaletteOpen(true)}
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
