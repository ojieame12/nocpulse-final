import test from "node:test";
import assert from "node:assert/strict";

import { buildAlternateSurfaceCellDictionary } from "./alternateSurfaceCells.shared";

test("buildAlternateSurfaceCellDictionary remaps alternate cells onto primary ids by centroid", () => {
  const cells = buildAlternateSurfaceCellDictionary({
    primaryCells: [
      { id: "primary-1", centroid: [-112.1234567, 52.1234567] as const },
      { id: "primary-2", centroid: [-112.2234567, 52.2234567] as const },
    ],
    alternateCells: [
      {
        id: "ndvi-a",
        centroid: [-112.1234567, 52.1234567],
        polygon: [],
        metricValuePct: 41,
      },
      {
        id: "ndvi-b",
        centroid: [-112.2234567, 52.2234567],
        polygon: [],
        metricValuePct: 62,
      },
    ] as any,
  });

  assert.deepEqual(Object.keys(cells), ["primary-1", "primary-2"]);
  assert.equal(cells["primary-1"]?.metricValuePct, 41);
  assert.equal(cells["primary-2"]?.metricValuePct, 62);
});

test("buildAlternateSurfaceCellDictionary falls back to alternate ids when no primary centroid matches", () => {
  const cells = buildAlternateSurfaceCellDictionary({
    primaryCells: [{ id: "primary-1", centroid: [-112.1234567, 52.1234567] as const }],
    alternateCells: [
      {
        id: "ndvi-x",
        centroid: [-111.999999, 51.999999],
        polygon: [],
        metricValuePct: 27,
      },
    ] as any,
  });

  assert.deepEqual(Object.keys(cells), ["ndvi-x"]);
  assert.equal(cells["ndvi-x"]?.metricValuePct, 27);
});
