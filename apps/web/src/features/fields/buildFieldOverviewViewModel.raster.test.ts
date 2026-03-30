import assert from "node:assert/strict";
import test from "node:test";
import {
  selectLatestMetricFamilyCaptures,
  selectMetricFamilyObservationRows,
} from "./buildFieldOverviewViewModel.raster";

function createCapture(input: {
  id: string;
  providerKey: string;
  capturedAt: string;
  createdAt: string;
  requestedAt?: string;
}) {
  return {
    id: input.id,
    workspace_id: "workspace-1",
    field_id: "field-1",
    requested_at: input.requestedAt ?? input.createdAt,
    captured_at: input.capturedAt,
    provider_key: input.providerKey,
    scene_key: `scene-${input.id}`,
    status: "completed",
    coverage_pct: 96,
    cloud_cover_pct: 4,
    note: null,
    metadata: {},
    observation_id: `observation-${input.id}`,
    created_at: input.createdAt,
  };
}

test("selectLatestMetricFamilyCaptures derives the latest optical and SAR captures from one recent-capture list", () => {
  const captures = [
    createCapture({
      id: "optical-older",
      providerKey: "sentinel-2",
      capturedAt: "2026-03-27T10:00:00.000Z",
      createdAt: "2026-03-27T10:05:00.000Z",
    }),
    createCapture({
      id: "sar-latest",
      providerKey: "sentinel-1",
      capturedAt: "2026-03-29T06:00:00.000Z",
      createdAt: "2026-03-29T06:03:00.000Z",
    }),
    createCapture({
      id: "optical-latest",
      providerKey: "planet",
      capturedAt: "2026-03-28T12:00:00.000Z",
      createdAt: "2026-03-28T12:04:00.000Z",
    }),
  ];

  const selected = selectLatestMetricFamilyCaptures(captures);

  assert.equal(selected.latestOpticalCapture?.id, "optical-latest");
  assert.equal(selected.latestOpticalCapture?.providerKey, "planet");
  assert.equal(selected.latestSarCapture?.id, "sar-latest");
  assert.equal(selected.latestSarCapture?.providerKey, "sentinel-1");
});

test("selectLatestMetricFamilyCaptures ignores unsupported providers and returns null for missing families", () => {
  const captures = [
    createCapture({
      id: "radar-only",
      providerKey: "sentinel-1",
      capturedAt: "2026-03-29T06:00:00.000Z",
      createdAt: "2026-03-29T06:03:00.000Z",
    }),
    createCapture({
      id: "unsupported",
      providerKey: "landsat",
      capturedAt: "2026-03-30T06:00:00.000Z",
      createdAt: "2026-03-30T06:03:00.000Z",
    }),
  ];

  const selected = selectLatestMetricFamilyCaptures(captures);

  assert.equal(selected.latestOpticalCapture, null);
  assert.equal(selected.latestSarCapture?.id, "radar-only");
});

test("selectMetricFamilyObservationRows preserves SAR slots even when optical rows dominate recency", () => {
  const rows = [
    {
      id: "optical-1",
      workspace_id: "workspace-1",
      field_id: "field-1",
      observed_at: "2026-03-30T12:00:00.000Z",
      source_key: "source:planet-1",
      provider_key: "planet",
      artifact_key: null,
      metadata: {},
      created_at: "2026-03-30T12:05:00.000Z",
    },
    {
      id: "optical-2",
      workspace_id: "workspace-1",
      field_id: "field-1",
      observed_at: "2026-03-29T12:00:00.000Z",
      source_key: "source:sentinel-2-1",
      provider_key: "sentinel-2",
      artifact_key: null,
      metadata: {},
      created_at: "2026-03-29T12:05:00.000Z",
    },
    {
      id: "optical-3",
      workspace_id: "workspace-1",
      field_id: "field-1",
      observed_at: "2026-03-28T12:00:00.000Z",
      source_key: "source:planet-2",
      provider_key: "planet",
      artifact_key: null,
      metadata: {},
      created_at: "2026-03-28T12:05:00.000Z",
    },
    {
      id: "sar-1",
      workspace_id: "workspace-1",
      field_id: "field-1",
      observed_at: "2026-03-27T12:00:00.000Z",
      source_key: "source:sentinel-1-1",
      provider_key: "sentinel-1",
      artifact_key: null,
      metadata: {},
      created_at: "2026-03-27T12:05:00.000Z",
    },
    {
      id: "sar-2",
      workspace_id: "workspace-1",
      field_id: "field-1",
      observed_at: "2026-03-26T12:00:00.000Z",
      source_key: "source:sentinel-1-2",
      provider_key: "sentinel-1",
      artifact_key: null,
      metadata: {},
      created_at: "2026-03-26T12:05:00.000Z",
    },
  ];

  const selected = selectMetricFamilyObservationRows(rows, {
    optical: 2,
    sar: 2,
  });

  assert.deepEqual(
    selected.opticalRows.map((row) => row.id),
    ["optical-1", "optical-2"],
  );
  assert.deepEqual(
    selected.sarRows.map((row) => row.id),
    ["sar-1", "sar-2"],
  );
});
