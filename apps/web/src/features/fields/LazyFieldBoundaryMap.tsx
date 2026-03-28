"use client";

import type { FieldBoundaryPreviewRenderModel, CellClickEvent } from "@fieldpulse/map";
import dynamic from "next/dynamic";

type LazyFieldBoundaryMapProps = {
  model: FieldBoundaryPreviewRenderModel;
  onCellClick?: (event: CellClickEvent) => void;
  allowSyntheticOverlays?: boolean;
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
  onCellClick,
  allowSyntheticOverlays = false,
}: LazyFieldBoundaryMapProps) {
  return (
    <ClientFieldBoundaryMap
      model={model}
      onCellClick={onCellClick}
      allowSyntheticOverlays={allowSyntheticOverlays}
    />
  );
}
