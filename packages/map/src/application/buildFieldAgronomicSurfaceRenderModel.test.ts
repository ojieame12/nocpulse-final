import test from "node:test";
import assert from "node:assert/strict";
import { buildFieldAgronomicSurfaceRenderModel } from "./buildFieldAgronomicSurfaceRenderModel";
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

test("agronomic surface height reflects deficit attention, not only high raw vigor", () => {
  const model = buildFieldAgronomicSurfaceRenderModel({
    fieldId: "field-1",
    boundaryFeature,
    bbox: [-108.181, 51.889, -108.171, 51.899],
    metricKey: "ndvi",
    baseValuePct: 58,
    confidence: "medium",
    sourceLabel: "planet-orders-cog-v1:planet",
    persistedCells: [
      {
        cellKey: "cell-stressed",
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
        measurements: {
          ndvi: 0.24,
        },
        sourceKey: "planet-orders-cog-v1:planet",
      },
      {
        cellKey: "cell-healthy",
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
        measurements: {
          ndvi: 0.78,
        },
        sourceKey: "planet-orders-cog-v1:planet",
      },
      {
        cellKey: "cell-moderate",
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
        measurements: {
          ndvi: 0.62,
        },
        sourceKey: "planet-orders-cog-v1:planet",
      },
    ],
  });

  const stressedCell = model.cells.find((cell) => cell.id === "cell-stressed");
  const healthyCell = model.cells.find((cell) => cell.id === "cell-healthy");

  assert.ok(stressedCell);
  assert.ok(healthyCell);
  assert.equal(stressedCell.severityLabel, "critical");
  assert.equal(healthyCell.severityLabel, "healthy");
  assert.ok(
    stressedCell.displayHeightM > healthyCell.displayHeightM,
    "a low-vigor NDVI cell should stand taller than a healthy cell when attention is anomaly-driven",
  );
  assert.equal(stressedCell.percentileInField, 0);
  assert.equal(stressedCell.anomalyClass, "below-field");
  assert.equal(healthyCell.percentileInField, 100);
  assert.equal(healthyCell.anomalyClass, "above-field");
});

test("low-average NDVI fields keep relief restrained and emphasize anomalies over blanket stress", () => {
  const model = buildFieldAgronomicSurfaceRenderModel({
    fieldId: "field-1",
    boundaryFeature,
    bbox: [-108.181, 51.889, -108.171, 51.899],
    metricKey: "ndvi",
    baseValuePct: 6,
    confidence: "medium",
    sourceLabel: "sentinel-hub-stats-v1:sentinel-2",
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
        measurements: {
          ndvi: 0.04,
        },
        sourceKey: "sentinel-hub-stats-v1:sentinel-2",
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
        measurements: {
          ndvi: 0.06,
        },
        sourceKey: "sentinel-hub-stats-v1:sentinel-2",
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
        measurements: {
          ndvi: 0.1,
        },
        sourceKey: "sentinel-hub-stats-v1:sentinel-2",
      },
    ],
  });

  const heights = model.cells.map((cell) => cell.displayHeightM);
  const heightRange = Math.max(...heights) - Math.min(...heights);
  const maxHeight = Math.max(...heights);

  assert.ok(
    maxHeight < 25,
    "low-average early-season NDVI should not render as a field of full-stress spikes",
  );
  assert.ok(
    heightRange > 1.5,
    "low-average early-season NDVI should still preserve visible anomaly separation",
  );
  const lowestCell = model.cells.find((cell) => cell.id === "cell-a");
  const highestCell = model.cells.find((cell) => cell.id === "cell-c");

  assert.ok(lowestCell);
  assert.ok(highestCell);
  assert.notDeepEqual(
    lowestCell.fillColor.slice(0, 3),
    highestCell.fillColor.slice(0, 3),
    "low-average early-season NDVI should still preserve visible color contrast between local anomalies",
  );
});

test("radar-wetness uses SAR values and dims synthetic cells relative to provider-backed cells", () => {
  const providerModel = buildFieldAgronomicSurfaceRenderModel({
    fieldId: "field-1",
    boundaryFeature,
    bbox: [-108.181, 51.889, -108.171, 51.899],
    metricKey: "radar-wetness",
    baseValuePct: 44,
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
        measurements: {
          sarWetness: 0.31,
        },
        sourceKey: "sentinel-hub-stats-v1:sentinel-1",
      },
    ],
  });

  const syntheticModel = buildFieldAgronomicSurfaceRenderModel({
    fieldId: "field-1",
    boundaryFeature,
    bbox: [-108.181, 51.889, -108.171, 51.899],
    metricKey: "radar-wetness",
    baseValuePct: 44,
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
        measurements: {
          sarWetness: 0.31,
        },
        sourceKey: "synthetic-raster-grid-sentinel-1-v1:sentinel-1",
      },
    ],
  });

  const providerCell = providerModel.cells[0];
  const syntheticCell = syntheticModel.cells[0];

  assert.equal(providerCell.metricValuePct, 31);
  assert.equal(providerCell.sourceTier, "fresh-sar");
  assert.equal(syntheticCell.sourceTier, "synthetic");
  assert.ok(
    syntheticCell.fillColor[3] < providerCell.fillColor[3],
    "synthetic radar-wetness cells should render with reduced opacity",
  );
  assert.ok(
    syntheticCell.displayHeightM < providerCell.displayHeightM,
    "synthetic radar-wetness cells should render with slightly reduced relief",
  );
});

test("optical NDMI no longer falls back to SAR wetness values", () => {
  const model = buildFieldAgronomicSurfaceRenderModel({
    fieldId: "field-1",
    boundaryFeature,
    bbox: [-108.181, 51.889, -108.171, 51.899],
    metricKey: "ndmi",
    baseValuePct: 44,
    confidence: "medium",
    sourceLabel: "sentinel-hub-stats-v1:sentinel-2",
    persistedCells: [
      {
        cellKey: "cell-optical-missing",
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
        measurements: {
          sarWetness: 0.31,
        },
        sourceKey: "sentinel-hub-stats-v1:sentinel-2",
      },
    ],
  });

  assert.equal(
    model.cells.some((cell) => cell.id === "cell-optical-missing"),
    false,
    "optical NDMI should ignore SAR-only wetness values instead of materializing them as persisted NDMI cells",
  );
});

test("radar-wetness uses Hope Creek-like SAR bands instead of flagging normal returns as stressed", () => {
  const model = buildFieldAgronomicSurfaceRenderModel({
    fieldId: "field-1",
    boundaryFeature,
    bbox: [-108.181, 51.889, -108.171, 51.899],
    metricKey: "radar-wetness",
    baseValuePct: 20,
    confidence: "medium",
    sourceLabel: "imagery-raster-derived-v1:sentinel-hub-stats-v1:sentinel-1",
    persistedCells: [
      {
        cellKey: "cell-dry-edge",
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
        measurements: {
          sarWetness: 0.15,
        },
        sourceKey: "sentinel-hub-stats-v1:sentinel-1",
      },
      {
        cellKey: "cell-normal",
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
        measurements: {
          sarWetness: 0.22,
        },
        sourceKey: "sentinel-hub-stats-v1:sentinel-1",
      },
      {
        cellKey: "cell-wet-outlier",
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
        measurements: {
          sarWetness: 0.61,
        },
        sourceKey: "sentinel-hub-stats-v1:sentinel-1",
      },
    ],
  });

  const dryEdge = model.cells.find((cell) => cell.id === "cell-dry-edge");
  const normal = model.cells.find((cell) => cell.id === "cell-normal");
  const wetOutlier = model.cells.find((cell) => cell.id === "cell-wet-outlier");

  assert.ok(dryEdge);
  assert.ok(normal);
  assert.ok(wetOutlier);
  assert.equal(dryEdge.severityLabel, "stressed");
  assert.equal(normal.severityLabel, "healthy");
  assert.equal(wetOutlier.severityLabel, "stressed");
  assert.ok(
    wetOutlier.displayHeightM > normal.displayHeightM,
    "anomalously wet SAR returns should still stand out against normal wetness values",
  );
});

test("optical NDMI uses a tighter canopy-water band so typical 0.66-0.78 values stay healthy", () => {
  const model = buildFieldAgronomicSurfaceRenderModel({
    fieldId: "field-1",
    boundaryFeature,
    bbox: [-108.181, 51.889, -108.171, 51.899],
    metricKey: "ndmi",
    baseValuePct: 72,
    confidence: "medium",
    sourceLabel: "sentinel-hub-stats-v1:sentinel-2",
    persistedCells: [
      {
        cellKey: "cell-low-normal",
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
        measurements: {
          ndmi: 0.66,
        },
        sourceKey: "sentinel-hub-stats-v1:sentinel-2",
      },
      {
        cellKey: "cell-normal",
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
        measurements: {
          ndmi: 0.73,
        },
        sourceKey: "sentinel-hub-stats-v1:sentinel-2",
      },
      {
        cellKey: "cell-high-normal",
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
        measurements: {
          ndmi: 0.78,
        },
        sourceKey: "sentinel-hub-stats-v1:sentinel-2",
      },
    ],
  });

  const severities = model.cells.map((cell) => cell.severityLabel);
  assert.deepEqual(severities, ["healthy", "healthy", "healthy"]);
});

test("field-relative analytics expose percentile and anomaly for agronomic cells", () => {
  const model = buildFieldAgronomicSurfaceRenderModel({
    fieldId: "field-1",
    boundaryFeature,
    bbox: [-108.181, 51.889, -108.171, 51.899],
    metricKey: "radar-wetness",
    baseValuePct: 20,
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
        measurements: {
          sarWetness: 0.11,
        },
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
        measurements: {
          sarWetness: 0.21,
        },
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
        measurements: {
          sarWetness: 0.34,
        },
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

test("compressed agronomic ranges get a gentle relief boost without a dramatic remap", () => {
  const model = buildFieldAgronomicSurfaceRenderModel({
    fieldId: "field-1",
    boundaryFeature,
    bbox: [-108.181, 51.889, -108.171, 51.899],
    metricKey: "ndre",
    baseValuePct: 1,
    confidence: "medium",
    sourceLabel: "planet-orders-cog-v1:planet",
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
        measurements: {
          ndre: 0,
        },
        sourceKey: "planet-orders-cog-v1:planet",
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
        measurements: {
          ndre: 0.006,
        },
        sourceKey: "planet-orders-cog-v1:planet",
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
        measurements: {
          ndre: 0.0119,
        },
        sourceKey: "planet-orders-cog-v1:planet",
      },
    ],
  });

  const heights = model.cells.map((cell) => cell.displayHeightM);
  const heightRange = Math.max(...heights) - Math.min(...heights);

  assert.ok(
    heightRange > 1.5,
    "compressed NDRE surfaces should gain enough relief separation to avoid reading as a flat slab",
  );
  assert.ok(
    heightRange < 3.5,
    "the spread boost should stay subtle rather than turning clustered data into theatrical spikes",
  );
});

test("preseason optical context renders more quietly than in-season optical surfaces", () => {
  const persistedCells = [
    {
      cellKey: "cell-a",
      centroid: [-108.179, 51.891] as [number, number],
      boundary: {
        type: "Polygon" as const,
        coordinates: [[
          [-108.181, 51.889] as [number, number],
          [-108.1775, 51.889] as [number, number],
          [-108.1775, 51.894] as [number, number],
          [-108.181, 51.894] as [number, number],
          [-108.181, 51.889] as [number, number],
        ]],
      },
      measurements: {
        ndvi: 0.04,
      },
      sourceKey: "sentinel-hub-stats-v1:sentinel-2",
    },
    {
      cellKey: "cell-b",
      centroid: [-108.176, 51.891] as [number, number],
      boundary: {
        type: "Polygon" as const,
        coordinates: [[
          [-108.1775, 51.889] as [number, number],
          [-108.174, 51.889] as [number, number],
          [-108.174, 51.894] as [number, number],
          [-108.1775, 51.894] as [number, number],
          [-108.1775, 51.889] as [number, number],
        ]],
      },
      measurements: {
        ndvi: 0.1,
      },
      sourceKey: "sentinel-hub-stats-v1:sentinel-2",
    },
  ];

  const inSeasonModel = buildFieldAgronomicSurfaceRenderModel({
    fieldId: "field-1",
    boundaryFeature,
    bbox: [-108.181, 51.889, -108.171, 51.899],
    metricKey: "ndvi",
    baseValuePct: 7,
    confidence: "low",
    sourceLabel: "sentinel-hub-stats-v1:sentinel-2",
    persistedCells,
  });

  const preseasonModel = buildFieldAgronomicSurfaceRenderModel({
    fieldId: "field-1",
    boundaryFeature,
    bbox: [-108.181, 51.889, -108.171, 51.899],
    metricKey: "ndvi",
    baseValuePct: 7,
    confidence: "low",
    sourceLabel: "preseason-optical-context:sentinel-hub-stats-v1:sentinel-2",
    persistedCells,
  });

  const maxInSeasonHeight = Math.max(...inSeasonModel.cells.map((cell) => cell.displayHeightM));
  const maxPreseasonHeight = Math.max(...preseasonModel.cells.map((cell) => cell.displayHeightM));

  assert.ok(
    maxPreseasonHeight < maxInSeasonHeight,
    "preseason optical context should render with calmer relief than an in-season optical scene",
  );
  assert.ok(
    preseasonModel.cells[0].fillColor[3] < inSeasonModel.cells[0].fillColor[3],
    "preseason optical context should render with reduced fill authority",
  );
});
