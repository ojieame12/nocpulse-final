"use client";

import type {
  FieldBoundaryPreviewRenderModel,
  FieldAgronomicSurfaceMetricKey,
  FieldAgronomicSurfaceRenderModel,
  MapRuntimeContract,
  CellHoverEvent,
  CellClickEvent,
} from "@fieldpulse/map";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CellTooltip } from "./CellTooltip";
import { DeselectRipple } from "./DeselectRipple";

type FieldBoundaryMapProps = {
  model: FieldBoundaryPreviewRenderModel;
  onCellHover?: (event: CellHoverEvent | null) => void;
  onCellClick?: (event: CellClickEvent) => void;
  onFieldClick?: (fieldId: string) => void;
  onSurfaceChange?: (surface: FieldAgronomicSurfaceRenderModel | null) => void;
  /** When provided by the parent, the map renders this metric instead of its own default. */
  activeMetric?: FieldAgronomicSurfaceMetricKey;
};

export function FieldBoundaryMap({
  model,
  onCellHover,
  onCellClick,
  onFieldClick,
  onSurfaceChange,
  activeMetric: activeMetricProp,
}: FieldBoundaryMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const runtimeRef = useRef<MapRuntimeContract<FieldBoundaryPreviewRenderModel> | null>(null);

  const [hover, setHover] = useState<CellHoverEvent | null>(null);
  const [hoveredFieldId, setHoveredFieldId] = useState<string | null>(null);
  const hoverFrameRef = useRef<number | null>(null);
  const pendingHoverRef = useRef<CellHoverEvent | null>(null);

  // Escape-velocity ripple on deselect
  const [deselectRipple, setDeselectRipple] = useState<{ x: number; y: number } | null>(null);

  // Resolve which metric to render — parent prop takes priority.
  const serverMetric = model.agronomicSurface?.metricKey ?? "root-zone-moisture-pct";
  const activeMetric = activeMetricProp ?? serverMetric;

  const effectiveModel = useMemo<FieldBoundaryPreviewRenderModel>(() => {
    if (activeMetric === serverMetric) return model;
    const alternateSurface = model.alternateAgronomicSurfaces?.[activeMetric] ?? null;
    if (!alternateSurface) return model;

    return {
      ...model,
      agronomicSurface: alternateSurface,
    };
  }, [model, activeMetric, serverMetric]);

  // Stable callback refs so the runtime doesn't need re-creation on prop changes.
  const onCellClickRef = useRef(onCellClick);
  onCellClickRef.current = onCellClick;
  const onCellHoverRef = useRef(onCellHover);
  onCellHoverRef.current = onCellHover;
  const onFieldClickRef = useRef(onFieldClick);
  onFieldClickRef.current = onFieldClick;
  const handleFieldHover = useCallback((fieldId: string | null) => {
    setHoveredFieldId((current) => (current === fieldId ? current : fieldId));
  }, []);

  const handleCellHover = useCallback((event: CellHoverEvent | null) => {
    pendingHoverRef.current = event;

    if (hoverFrameRef.current !== null) {
      return;
    }

    hoverFrameRef.current = requestAnimationFrame(() => {
      hoverFrameRef.current = null;
      const next = pendingHoverRef.current;

      setHover((current) => {
        if (current === next) {
          return current;
        }

        if (!current || !next) {
          return next;
        }

        if (
          current.cellId === next.cellId
          && current.metricKey === next.metricKey
          && current.metricValuePct === next.metricValuePct
          && current.displayHeightM === next.displayHeightM
          && current.screenX === next.screenX
          && current.screenY === next.screenY
          && current.confidence === next.confidence
          && current.sourceTier === next.sourceTier
          && current.deltaFromFieldAvgPct === next.deltaFromFieldAvgPct
          && current.varianceBucket === next.varianceBucket
          && current.severityLabel === next.severityLabel
          && current.zoneId === next.zoneId
        ) {
          return current;
        }

        return next;
      });

      onCellHoverRef.current?.(next);
    });
  }, []);

  const handleCellClick = useCallback((event: CellClickEvent) => {
    // Fire escape-velocity ripple on deselect
    if (!event.selected && event.screenX != null && event.screenY != null) {
      setDeselectRipple({ x: event.screenX, y: event.screenY });
    }
    onCellClickRef.current?.(event);
  }, []);

  // Keep a ref to the latest effectiveModel so mount always uses the current one.
  const latestModelRef = useRef(effectiveModel);
  latestModelRef.current = effectiveModel;

  // Track whether mount has finished so the update effect can fire safely.
  const [mountReady, setMountReady] = useState(false);

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
        onFieldHover: handleFieldHover,
        onFieldClick: (fieldId) => onFieldClickRef.current?.(fieldId),
      });
      runtimeRef.current = mountedRuntime;
      // Always mount with the latest model (not the stale closure capture).
      await mountedRuntime.mount(container, latestModelRef.current);
      if (!disposed) setMountReady(true);
    }

    void mountRuntime();

    return () => {
      disposed = true;
      runtimeRef.current = null;
      if (hoverFrameRef.current !== null) {
        cancelAnimationFrame(hoverFrameRef.current);
        hoverFrameRef.current = null;
      }
      if (mountedRuntime) {
        void mountedRuntime.unmount();
      }
    };
  }, []);

  // Push model changes to the runtime after mount is ready.
  useEffect(() => {
    if (!mountReady) return;
    const runtime = runtimeRef.current;
    if (!runtime) return;
    void runtime.update(effectiveModel);
  }, [effectiveModel, mountReady]);

  useEffect(() => {
    onSurfaceChange?.(effectiveModel.agronomicSurface ?? null);
  }, [effectiveModel.agronomicSurface, onSurfaceChange]);

  return (
    <div
      className="mapCanvas"
      aria-label="Field boundary map"
      style={{ cursor: hover || hoveredFieldId ? "pointer" : "grab" }}
    >
      {/* Map container — runtime owns this div's children via replaceChildren() */}
      <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />

      {/* Overlays — siblings, safe from runtime's DOM mutations */}
      <CellTooltip hover={hover} />
      <DeselectRipple trigger={deselectRipple} />
    </div>
  );
}
