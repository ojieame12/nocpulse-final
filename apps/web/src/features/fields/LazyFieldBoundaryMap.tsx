"use client";

import type {
  FieldBoundaryPreviewRenderModel,
  FieldAgronomicSurfaceMetricKey,
  FieldAgronomicSurfaceRenderModel,
  CellClickEvent,
  CellHoverEvent,
} from "@fieldpulse/map";
import dynamic from "next/dynamic";

type LazyFieldBoundaryMapProps = {
  model: FieldBoundaryPreviewRenderModel;
  onCellHover?: (event: CellHoverEvent | null) => void;
  onCellClick?: (event: CellClickEvent) => void;
  onFieldClick?: (fieldId: string) => void;
  onSurfaceChange?: (surface: FieldAgronomicSurfaceRenderModel | null) => void;
  /** When provided, the map renders this metric instead of the server default. */
  activeMetric?: FieldAgronomicSurfaceMetricKey;
};

const ClientFieldBoundaryMap = dynamic(
  () => import("./FieldBoundaryMap").then((module) => module.FieldBoundaryMap),
  {
    ssr: false,
    loading: () => (
      <div className="map-loading">
        <div className="map-loading__shimmer" />
      </div>
    ),
  },
);

export function LazyFieldBoundaryMap({
  model,
  onCellHover,
  onCellClick,
  onFieldClick,
  onSurfaceChange,
  activeMetric,
}: LazyFieldBoundaryMapProps) {
  return (
    <ClientFieldBoundaryMap
      model={model}
      onCellHover={onCellHover}
      onCellClick={onCellClick}
      onFieldClick={onFieldClick}
      onSurfaceChange={onSurfaceChange}
      activeMetric={activeMetric}
    />
  );
}
