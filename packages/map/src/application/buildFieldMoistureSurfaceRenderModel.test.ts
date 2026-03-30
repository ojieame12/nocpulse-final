import test from "node:test";
import assert from "node:assert/strict";
import { buildFieldMoistureSurfaceRenderModel } from "./buildFieldMoistureSurfaceRenderModel";
import type { FieldBoundaryFeature } from "../domain/render/FieldBoundaryPreviewRenderModel";

const boundaryFeature: FieldBoundaryFeature = {
  type: "Feature" as const,
  properties: {
    fieldId: "field-1",
    fieldName: "Test Field",
  },
  geometry: {
    type: "MultiPolygon" as const,
    coordinates: [[[
      [-108.181, 51.889] as [number, number],
      [-108.171, 51.889] as [number, number],
      [-108.171, 51.899] as [number, number],
      [-108.181, 51.899] as [number, number],
      [-108.181, 51.889] as [number, number],
    ]]],
  },
};

test("moisture surface height reflects attention, not raw wetness", () => {
  const model = buildFieldMoistureSurfaceRenderModel({
    fieldId: "field-1",
    boundaryFeature,
    bbox: [-108.181, 51.889, -108.171, 51.899],
    rootZonePct: 38,
    surfacePct: 26,
    confidence: "medium",
    sourceLabel: "imagery-raster-derived-v1:sentinel-hub-stats-v1:sentinel-1",
    persistedCells: [
      {
        cellKey: "cell-dry",
        centroid: [-108.179, 51.891],
        boundary: {
          type: "Polygon",
          coordinates: [[
            [-108.181, 51.889],
            [-108.176, 51.889],
            [-108.176, 51.894],
            [-108.181, 51.894],
            [-108.181, 51.889],
          ]],
        },
        rootZonePct: 15,
        surfacePct: 11,
        sourceKey: "sentinel-hub-stats-v1:sentinel-1",
      },
      {
        cellKey: "cell-adequate-a",
        centroid: [-108.176, 51.891],
        boundary: {
          type: "Polygon",
          coordinates: [[
            [-108.176, 51.889],
            [-108.171, 51.889],
            [-108.171, 51.894],
            [-108.176, 51.894],
            [-108.176, 51.889],
          ]],
        },
        rootZonePct: 48,
        surfacePct: 34,
        sourceKey: "sentinel-hub-stats-v1:sentinel-1",
      },
      {
        cellKey: "cell-adequate-b",
        centroid: [-108.176, 51.896],
        boundary: {
          type: "Polygon",
          coordinates: [[
            [-108.176, 51.894],
            [-108.171, 51.894],
            [-108.171, 51.899],
            [-108.176, 51.899],
            [-108.176, 51.894],
          ]],
        },
        rootZonePct: 52,
        surfacePct: 37,
        sourceKey: "sentinel-hub-stats-v1:sentinel-1",
      },
    ],
  });

  const dryCell = model.cells.find((cell) => cell.id === "cell-dry");
  const adequateCell = model.cells.find((cell) => cell.id === "cell-adequate-a");

  assert.ok(dryCell);
  assert.ok(adequateCell);
  assert.equal(dryCell.sourceTier, "fresh-sar");
  assert.equal(dryCell.severityLabel, "critical");
  assert.equal(adequateCell.severityLabel, "healthy");
  assert.ok(
    dryCell.displayHeightM > adequateCell.displayHeightM,
    "a critically dry cell should stand taller than an adequate cell even when the adequate cell has a higher raw moisture value",
  );
  assert.equal(dryCell.percentileInField, 0);
  assert.equal(dryCell.anomalyClass, "below-field");
  assert.equal(adequateCell.anomalyClass, "near-field");
});

test("moisture surface dims synthetic fallback cells more aggressively than provider-backed cells", () => {
  const providerModel = buildFieldMoistureSurfaceRenderModel({
    fieldId: "field-1",
    boundaryFeature,
    bbox: [-108.181, 51.889, -108.171, 51.899],
    rootZonePct: 32,
    surfacePct: 21,
    confidence: "medium",
    sourceLabel: "imagery-raster-derived-v1:sentinel-hub-stats-v1:sentinel-1",
    persistedCells: [
      {
        cellKey: "cell-provider",
        centroid: [-108.179, 51.891],
        boundary: {
          type: "Polygon",
          coordinates: [[
            [-108.181, 51.889],
            [-108.171, 51.889],
            [-108.171, 51.899],
            [-108.181, 51.899],
            [-108.181, 51.889],
          ]],
        },
        rootZonePct: 24,
        surfacePct: 18,
        sourceKey: "sentinel-hub-stats-v1:sentinel-1",
      },
    ],
  });

  const syntheticModel = buildFieldMoistureSurfaceRenderModel({
    fieldId: "field-1",
    boundaryFeature,
    bbox: [-108.181, 51.889, -108.171, 51.899],
    rootZonePct: 32,
    surfacePct: 21,
    confidence: "medium",
    sourceLabel: "imagery-raster-derived-v1:synthetic-raster-grid-sentinel-1-v1:sentinel-1",
    persistedCells: [
      {
        cellKey: "cell-synthetic",
        centroid: [-108.179, 51.891],
        boundary: {
          type: "Polygon",
          coordinates: [[
            [-108.181, 51.889],
            [-108.171, 51.889],
            [-108.171, 51.899],
            [-108.181, 51.899],
            [-108.181, 51.889],
          ]],
        },
        rootZonePct: 24,
        surfacePct: 18,
        sourceKey: "synthetic-raster-grid-sentinel-1-v1:sentinel-1",
      },
    ],
  });

  const providerCell = providerModel.cells[0];
  const syntheticCell = syntheticModel.cells[0];

  assert.equal(providerCell.sourceTier, "fresh-sar");
  assert.equal(syntheticCell.sourceTier, "synthetic");
  assert.ok(
    syntheticCell.fillColor[3] < providerCell.fillColor[3],
    "synthetic fallback cells should render with reduced opacity",
  );
  assert.ok(
    syntheticCell.displayHeightM < providerCell.displayHeightM,
    "synthetic fallback cells should render with slightly reduced relief",
  );
});

test("compressed moisture ranges get a gentle relief boost without over-amplifying the field", () => {
  const model = buildFieldMoistureSurfaceRenderModel({
    fieldId: "field-1",
    boundaryFeature,
    bbox: [-108.181, 51.889, -108.171, 51.899],
    rootZonePct: 42,
    surfacePct: 38,
    confidence: "medium",
    sourceLabel: "imagery-raster-derived-v1:sentinel-hub-stats-v1:sentinel-1",
    persistedCells: [
      {
        cellKey: "cell-a",
        centroid: [-108.179, 51.891],
        boundary: {
          type: "Polygon",
          coordinates: [[
            [-108.181, 51.889],
            [-108.1775, 51.889],
            [-108.1775, 51.894],
            [-108.181, 51.894],
            [-108.181, 51.889],
          ]],
        },
        rootZonePct: 39.88,
        surfacePct: 36.7,
        sourceKey: "sentinel-hub-stats-v1:sentinel-1",
      },
      {
        cellKey: "cell-b",
        centroid: [-108.176, 51.891],
        boundary: {
          type: "Polygon",
          coordinates: [[
            [-108.1775, 51.889],
            [-108.174, 51.889],
            [-108.174, 51.894],
            [-108.1775, 51.894],
            [-108.1775, 51.889],
          ]],
        },
        rootZonePct: 41.8,
        surfacePct: 37.9,
        sourceKey: "sentinel-hub-stats-v1:sentinel-1",
      },
      {
        cellKey: "cell-c",
        centroid: [-108.1725, 51.891],
        boundary: {
          type: "Polygon",
          coordinates: [[
            [-108.174, 51.889],
            [-108.171, 51.889],
            [-108.171, 51.894],
            [-108.174, 51.894],
            [-108.174, 51.889],
          ]],
        },
        rootZonePct: 43.72,
        surfacePct: 39.3,
        sourceKey: "sentinel-hub-stats-v1:sentinel-1",
      },
    ],
  });

  const heights = model.cells.map((cell) => cell.displayHeightM);
  const heightRange = Math.max(...heights) - Math.min(...heights);

  assert.ok(
    heightRange > 1.8,
    "clustered moisture cells should gain some visible separation",
  );
  assert.ok(
    heightRange < 3.25,
    "the moisture spread boost should remain restrained",
  );
});

test("moisture surfaces expose field-relative percentile and anomaly context", () => {
  const model = buildFieldMoistureSurfaceRenderModel({
    fieldId: "field-1",
    boundaryFeature,
    bbox: [-108.181, 51.889, -108.171, 51.899],
    rootZonePct: 28,
    surfacePct: 20,
    confidence: "medium",
    sourceLabel: "imagery-raster-derived-v1:sentinel-hub-stats-v1:sentinel-1",
    persistedCells: [
      {
        cellKey: "cell-low",
        centroid: [-108.179, 51.891],
        boundary: {
          type: "Polygon",
          coordinates: [[
            [-108.181, 51.889],
            [-108.1775, 51.889],
            [-108.1775, 51.894],
            [-108.181, 51.894],
            [-108.181, 51.889],
          ]],
        },
        rootZonePct: 18,
        surfacePct: 12,
        sourceKey: "sentinel-hub-stats-v1:sentinel-1",
      },
      {
        cellKey: "cell-mid",
        centroid: [-108.176, 51.891],
        boundary: {
          type: "Polygon",
          coordinates: [[
            [-108.1775, 51.889],
            [-108.174, 51.889],
            [-108.174, 51.894],
            [-108.1775, 51.894],
            [-108.1775, 51.889],
          ]],
        },
        rootZonePct: 28,
        surfacePct: 20,
        sourceKey: "sentinel-hub-stats-v1:sentinel-1",
      },
      {
        cellKey: "cell-high",
        centroid: [-108.1725, 51.891],
        boundary: {
          type: "Polygon",
          coordinates: [[
            [-108.174, 51.889],
            [-108.171, 51.889],
            [-108.171, 51.894],
            [-108.174, 51.894],
            [-108.174, 51.889],
          ]],
        },
        rootZonePct: 39,
        surfacePct: 30,
        sourceKey: "sentinel-hub-stats-v1:sentinel-1",
      },
    ],
  });

  const lowCell = model.cells.find((cell) => cell.id === "cell-low");
  const midCell = model.cells.find((cell) => cell.id === "cell-mid");
  const highCell = model.cells.find((cell) => cell.id === "cell-high");

  assert.ok(lowCell);
  assert.ok(midCell);
  assert.ok(highCell);
  assert.equal(lowCell.percentileInField, 0);
  assert.equal(lowCell.anomalyClass, "below-field");
  assert.equal(midCell.percentileInField, 50);
  assert.equal(midCell.anomalyClass, "near-field");
  assert.equal(highCell.percentileInField, 100);
  assert.equal(highCell.anomalyClass, "above-field");
});
