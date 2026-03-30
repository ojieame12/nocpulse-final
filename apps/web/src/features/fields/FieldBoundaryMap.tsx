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
  const [runtimeError, setRuntimeError] = useState<Error | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);

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

    const baseCells = model.agronomicSurface?.cells ?? [];
    const hydratedCells = baseCells
      .map((baseCell) => {
        const altCell = alternateSurface.cells[baseCell.id];
        if (!altCell) return null;
        return {
          ...altCell,
          polygon: baseCell.polygon,
          centroid: baseCell.centroid,
        };
      })
      .filter((cell): cell is NonNullable<typeof cell> => cell !== null);

    return {
      ...model,
      agronomicSurface: {
        ...alternateSurface,
        cells: hydratedCells,
      },
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

  const handleRuntimeFailure = useCallback(
    (
      phase: "mount" | "update" | "unmount",
      error: unknown,
      runtime?: MapRuntimeContract<FieldBoundaryPreviewRenderModel> | null,
    ) => {
      const nextError =
        error instanceof Error ? error : new Error(String(error));

      console.error(`[map] field boundary runtime ${phase} failed`, nextError);
      const activeRuntime = runtime ?? runtimeRef.current;
      runtimeRef.current = null;
      setMountReady(false);
      setHover(null);
      setHoveredFieldId(null);
      pendingHoverRef.current = null;
      if (hoverFrameRef.current !== null) {
        cancelAnimationFrame(hoverFrameRef.current);
        hoverFrameRef.current = null;
      }
      onCellHoverRef.current?.(null);

      if (activeRuntime) {
        void activeRuntime.unmount().catch((unmountError) => {
          console.error("[map] field boundary runtime cleanup failed", unmountError);
        });
      }

      setRuntimeError(nextError);
    },
    [],
  );

  useEffect(() => {
    let disposed = false;
    let mountedRuntime: MapRuntimeContract<FieldBoundaryPreviewRenderModel> | null = null;

    async function mountRuntime() {
      const container = containerRef.current;
      if (!container) return;

      try {
        const { createFieldBoundaryPreviewRuntime } = await import("@fieldpulse/map");

        if (disposed || containerRef.current !== container) return;

        mountedRuntime = createFieldBoundaryPreviewRuntime({
          onCellHover: handleCellHover,
          onCellClick: handleCellClick,
          onFieldHover: handleFieldHover,
          onFieldClick: (fieldId) => onFieldClickRef.current?.(fieldId),
          onFatalError: (error) => handleRuntimeFailure("update", error, mountedRuntime),
        });
        runtimeRef.current = mountedRuntime;
        // Always mount with the latest model (not the stale closure capture).
        await mountedRuntime.mount(container, latestModelRef.current);

        if (disposed) {
          await mountedRuntime.unmount();
          return;
        }

        setRuntimeError(null);
        setMountReady(true);
      } catch (error) {
        if (!disposed) {
          handleRuntimeFailure("mount", error, mountedRuntime);
        }
      }
    }

    setMountReady(false);
    void mountRuntime();

    return () => {
      disposed = true;
      const activeRuntime = mountedRuntime;
      runtimeRef.current = null;
      if (hoverFrameRef.current !== null) {
        cancelAnimationFrame(hoverFrameRef.current);
        hoverFrameRef.current = null;
      }
      setMountReady(false);
      if (activeRuntime) {
        void activeRuntime.unmount().catch((error) => {
          console.error("[map] field boundary runtime unmount failed", error);
        });
      }
    };
  }, [handleCellClick, handleCellHover, handleFieldHover, handleRuntimeFailure, retryNonce]);

  // Push model changes to the runtime after mount is ready.
  useEffect(() => {
    if (!mountReady || runtimeError) return;
    const runtime = runtimeRef.current;
    if (!runtime) return;
    let cancelled = false;

    void runtime.update(effectiveModel).catch((error) => {
      if (!cancelled) {
        handleRuntimeFailure("update", error, runtime);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [effectiveModel, handleRuntimeFailure, mountReady, runtimeError]);

  useEffect(() => {
    if (!runtimeError) {
      return;
    }

    setRuntimeError(null);
    setRetryNonce((current) => current + 1);
  }, [model.fieldId]);

  useEffect(() => {
    onSurfaceChange?.(effectiveModel.agronomicSurface ?? null);
  }, [effectiveModel.agronomicSurface, onSurfaceChange]);

  if (runtimeError) {
    return (
      <div
        className="mapCanvas mapCanvas--fallback"
        role="alert"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "var(--space-2xl)",
          background: "var(--surface-bg)",
        }}
      >
        <div
          style={{
            width: "min(100%, 360px)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "var(--space-lg)",
            padding: "var(--empty-padding)",
            borderRadius: "var(--empty-radius)",
            border: "var(--empty-border)",
            background: "var(--surface-white)",
            boxShadow: "var(--shadow-card)",
            textAlign: "center",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "var(--text-lg)",
              fontWeight: 700,
              color: "var(--text-primary)",
              lineHeight: "var(--leading-snug)",
            }}
          >
            Map render failed safely
          </span>
          <span
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "var(--text-sm)",
              color: "var(--text-secondary)",
              lineHeight: "var(--leading-normal)",
            }}
          >
            The map runtime hit an error during {mountReady ? "update" : "mount"}.
            Retry the map without reloading the full workspace.
          </span>
          <button
            type="button"
            onClick={() => {
              setRuntimeError(null);
              setRetryNonce((current) => current + 1);
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "var(--space-sm)",
              padding: "var(--btn-padding-v) var(--btn-padding-h)",
              border: "1px solid transparent",
              borderRadius: "var(--btn-radius)",
              background: "var(--btn-fill-primary)",
              boxShadow: "var(--shadow-btn)",
              color: "var(--btn-text-primary)",
              fontFamily: "var(--font-body)",
              fontSize: "var(--btn-font-size)",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Retry map
          </button>
        </div>
      </div>
    );
  }

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
