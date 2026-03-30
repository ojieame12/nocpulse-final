import test from "node:test";
import assert from "node:assert/strict";
import { toMapZoneMultiPolygon } from "./zoneGeometry";

test("toMapZoneMultiPolygon merges feature-collection zone geometry into a single multipolygon", () => {
  const geometry = toMapZoneMultiPolygon({
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: {
          type: "MultiPolygon",
          coordinates: [
            [
              [
                [1, 2],
                [3, 2],
                [3, 4],
                [1, 2],
              ],
            ],
          ],
        },
      },
      {
        type: "Feature",
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [5, 6],
              [7, 6],
              [7, 8],
              [5, 6],
            ],
          ],
        },
      },
    ],
  });

  assert.deepEqual(geometry, {
    type: "MultiPolygon",
    coordinates: [
      [
        [
          [1, 2],
          [3, 2],
          [3, 4],
          [1, 2],
        ],
      ],
      [
        [
          [5, 6],
          [7, 6],
          [7, 8],
          [5, 6],
        ],
      ],
    ],
  });
});

test("toMapZoneMultiPolygon normalizes a polygon into a multipolygon", () => {
  const geometry = toMapZoneMultiPolygon({
    type: "Polygon",
    coordinates: [
      [
        [10, 20],
        [11, 20],
        [11, 21],
        [10, 20],
      ],
    ],
  });

  assert.deepEqual(geometry, {
    type: "MultiPolygon",
    coordinates: [
      [
        [
          [10, 20],
          [11, 20],
          [11, 21],
          [10, 20],
        ],
      ],
    ],
  });
});

test("toMapZoneMultiPolygon rejects unsupported geometry", () => {
  assert.equal(
    toMapZoneMultiPolygon({
      type: "Point",
      coordinates: [1, 2],
    }),
    null,
  );
});
