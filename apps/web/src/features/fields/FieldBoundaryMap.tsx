"use client";

import type {
  FieldBoundaryPreviewRenderModel,
  FieldAgronomicSurfaceMetricKey,
  MapRuntimeContract,
  CellHoverEvent,
  CellClickEvent,
} from "@fieldpulse/map";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CellTooltip } from "./CellTooltip";
import { MetricLayerSwitcher } from "./MetricLayerSwitcher";
import { MetricLegendCard } from "./MetricLegendCard";
import { DeselectRipple } from "./DeselectRipple";

type FieldBoundaryMapProps = {
  model: FieldBoundaryPreviewRenderModel;
  onCellClick?: (event: CellClickEvent) => void;
  allowSyntheticOverlays?: boolean;
};

/**
 * Available metrics for the switcher. The first one is whatever the server
 * sent (usually moisture). The rest are synthetic overlays generated client-side.
 */
const SYNTHETIC_OVERLAYS: FieldAgronomicSurfaceMetricKey[] = [
  "ndvi",
  "ndre",
  "ndmi",
];

export function FieldBoundaryMap({
  model,
  onCellClick,
  allowSyntheticOverlays = false,
}: FieldBoundaryMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const runtimeRef = useRef<MapRuntimeContract<FieldBoundaryPreviewRenderModel> | null>(null);

  const [hover, setHover] = useState<CellHoverEvent | null>(null);

  // Cross-fade: opacity drops to 0 on metric switch, then ramps back to 1
  const [legendFade, setLegendFade] = useState(1);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Escape-velocity ripple on deselect
  const [deselectRipple, setDeselectRipple] = useState<{ x: number; y: number } | null>(null);

  // Track which metric is active. Default to whatever the server model has.
  const serverMetric = model.agronomicSurface?.metricKey ?? "root-zone-moisture-pct";
  const [activeMetric, setActiveMetric] = useState<FieldAgronomicSurfaceMetricKey>(serverMetric);

  // Reset metric to server metric when field changes.
  const fieldIdRef = useRef(model.fieldId);
  if (model.fieldId !== fieldIdRef.current) {
    fieldIdRef.current = model.fieldId;
    setActiveMetric(serverMetric);
  }

  // Wrapped metric change: triggers cross-fade
  const handleMetricChange = useCallback(
    (metric: FieldAgronomicSurfaceMetricKey) => {
      if (metric === activeMetric) return;
      // Fade out
      setLegendFade(0);
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
      // After fade-out completes, switch metric and fade in
      fadeTimerRef.current = setTimeout(() => {
        setActiveMetric(metric);
        // Small delay to let new surface settle, then fade in
        requestAnimationFrame(() => setLegendFade(1));
        fadeTimerRef.current = null;
      }, 300);
    },
    [activeMetric],
  );

  const availableMetrics = useMemo<FieldAgronomicSurfaceMetricKey[]>(() => {
    if (!model.agronomicSurface) return [];
    if (!allowSyntheticOverlays) return [serverMetric];
    return [serverMetric, ...SYNTHETIC_OVERLAYS.filter((m) => m !== serverMetric)];
  }, [allowSyntheticOverlays, serverMetric, !!model.agronomicSurface]);

  // Build effective model: swap surface if user picked a synthetic metric.
  const [syntheticSurfaces, setSyntheticSurfaces] = useState<
    Partial<Record<FieldAgronomicSurfaceMetricKey, FieldBoundaryPreviewRenderModel["agronomicSurface"]>>
  >({});

  // When a synthetic metric is selected for the first time, build it.
  useEffect(() => {
    if (!allowSyntheticOverlays) return;
    if (activeMetric === serverMetric) return; // server model, no build needed
    if (syntheticSurfaces[activeMetric]) return; // already built

    let cancelled = false;

    async function buildSynthetic() {
      const { buildFieldAgronomicSurfaceRenderModel } = await import("@fieldpulse/map");
      if (cancelled) return;

      const surface = buildFieldAgronomicSurfaceRenderModel({
        fieldId: model.fieldId,
        boundaryFeature: model.boundaryFeature,
        bbox: model.bbox,
        metricKey: activeMetric,
        baseValuePct: 55 + Math.random() * 20, // plausible synthetic baseline
        confidence: "medium",
        sourceLabel: "synthetic-preview",
      });

      if (cancelled) return;
      setSyntheticSurfaces((prev) => ({ ...prev, [activeMetric]: surface }));
    }

    void buildSynthetic();
    return () => { cancelled = true; };
  }, [
    activeMetric,
    allowSyntheticOverlays,
    serverMetric,
    model.fieldId,
    model.boundaryFeature,
    model.bbox,
  ]);

  const effectiveModel = useMemo<FieldBoundaryPreviewRenderModel>(() => {
    if (activeMetric === serverMetric) return model;

    const syntheticSurface = syntheticSurfaces[activeMetric];
    if (!syntheticSurface) return model; // still building, show server model

    return {
      ...model,
      agronomicSurface: syntheticSurface,
    };
  }, [model, activeMetric, serverMetric, syntheticSurfaces]);

  // Stable callback refs so the runtime doesn't need re-creation on prop changes.
  const onCellClickRef = useRef(onCellClick);
  onCellClickRef.current = onCellClick;

  const handleCellHover = useCallback((event: CellHoverEvent | null) => {
    setHover(event);
  }, []);

  const handleCellClick = useCallback((event: CellClickEvent) => {
    // Fire escape-velocity ripple on deselect
    if (!event.selected && event.screenX != null && event.screenY != null) {
      setDeselectRipple({ x: event.screenX, y: event.screenY });
    }
    onCellClickRef.current?.(event);
  }, []);

  useEffect(() => {
    let disposed = false;
    let mountedRuntime: MapRuntimeContract<FieldBoundaryPreviewRenderModel> | null = null;

    async function mountRuntime() {
      const container = containerRef.current;
      if (!container) return;

      const { createFieldBoundaryPreviewRuntime } = await import("@fieldpulse/map");

      if (disposed || containerRef.current !== container) return;

      mountedRuntime = createFieldBoundaryPreviewRuntime({
        onCellHover: handleCellHover,
        onCellClick: handleCellClick,
      });
      runtimeRef.current = mountedRuntime;
      await mountedRuntime.mount(container, effectiveModel);
    }

    void mountRuntime();

    return () => {
      disposed = true;
      runtimeRef.current = null;
      if (mountedRuntime) {
        void mountedRuntime.unmount();
      }
    };
  }, []);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    void runtime.update(effectiveModel);
  }, [effectiveModel]);

  return (
    <div
      className="mapCanvas"
      aria-label="Field boundary map"
      style={{ cursor: hover ? "pointer" : "grab" }}
    >
      {/* Map container — runtime owns this div's children via replaceChildren() */}
      <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />

      {/* Overlays — siblings, safe from runtime's DOM mutations */}
      <CellTooltip hover={hover} />
      <MetricLayerSwitcher
        activeMetric={activeMetric}
        availableMetrics={availableMetrics}
        onMetricChange={handleMetricChange}
      />
      {effectiveModel.agronomicSurface ? (
        <MetricLegendCard
          metricKey={effectiveModel.agronomicSurface.metricKey}
          metricAveragePct={effectiveModel.agronomicSurface.metricAveragePct}
          confidence={effectiveModel.agronomicSurface.confidence}
          sourceLabel={effectiveModel.agronomicSurface.sourceLabel}
          fadeOpacity={legendFade}
        />
      ) : null}
      <DeselectRipple trigger={deselectRipple} />
    </div>
  );
}
