import test from "node:test";
import assert from "node:assert/strict";
import { lookupLldBoundary } from "./lookupLldBoundary";

test("lookupLldBoundary returns cached geometry when cache hit exists", async () => {
  const cachedBoundary = {
    type: "MultiPolygon",
    coordinates: [[[
      [-109.61, 51.31],
      [-109.41, 51.31],
      [-109.43, 51.18],
      [-109.58, 51.19],
      [-109.61, 51.31],
    ]]],
  } as const;

  const result = await lookupLldBoundary(
    {
      code: "NW-25-010-17-W4",
      suggestedFieldName: "Cached Quarter",
    },
    {
      geocodeCache: {
        async lookup() {
          return {
            lldCode: "NW-25-010-17-W4",
            boundary: cachedBoundary,
            centroidLat: 51.25,
            centroidLng: -109.5,
            bbox: {
              west: -109.61,
              south: 51.18,
              east: -109.41,
              north: 51.31,
            },
          };
        },
      },
    },
  );

  assert.equal(result.resolution, "cached");
  assert.equal(result.draft.name, "Cached Quarter");
  assert.deepEqual(result.draft.boundary, cachedBoundary);
  assert.deepEqual(result.draft.boundary.coordinates[0][0], cachedBoundary.coordinates[0][0]);
  assert.deepEqual(result.bbox, {
    west: -109.61,
    south: 51.18,
    east: -109.41,
    north: 51.31,
  });
  assert.notEqual(result.draft.areaHa, 64.75);
});

test("lookupLldBoundary falls back to synthetic geometry when cache misses", async () => {
  const result = await lookupLldBoundary(
    { code: "NW-25-010-17-W4" },
    {
      geocodeCache: {
        async lookup() {
          return null;
        },
      },
    },
  );

  assert.equal(result.resolution, "synthetic");
  assert.equal(result.draft.name, "Quarter NW 25 010 17 W4");
  assert.equal(result.draft.boundary.type, "MultiPolygon");
  assert.equal(result.draft.boundary.coordinates[0][0].length, 5);
  assert.equal(Number(result.draft.areaHa.toFixed(2)), 64.75);
  assert.deepEqual(result.centroid, [
    -112.28114469996032,
    49.84934387351778,
  ]);
});

test("lookupLldBoundary trims suggested field names before using them", async () => {
  const result = await lookupLldBoundary(
    {
      code: "NW-25-010-17-W4",
      suggestedFieldName: "  North Quarter  ",
    },
    {
      geocodeCache: {
        async lookup() {
          return null;
        },
      },
    },
  );

  assert.equal(result.resolution, "synthetic");
  assert.equal(result.draft.name, "North Quarter");
});

test("lookupLldBoundary falls back to the normalized quarter name when suggested name is blank", async () => {
  const result = await lookupLldBoundary(
    {
      code: "NW-25-010-17-W4",
      suggestedFieldName: "   ",
    },
    {
      geocodeCache: {
        async lookup() {
          return null;
        },
      },
    },
  );

  assert.equal(result.resolution, "synthetic");
  assert.equal(result.draft.name, "Quarter NW 25 010 17 W4");
});
