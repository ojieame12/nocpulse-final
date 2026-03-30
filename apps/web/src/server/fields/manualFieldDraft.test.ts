import assert from "node:assert/strict";
import test from "node:test";
import { buildManualFieldDraft } from "./manualFieldDraft";

test("buildManualFieldDraft derives an approximate square boundary from centerpoint and area", () => {
  const result = buildManualFieldDraft({
    latitude: 51.2,
    longitude: -109.5,
    areaHa: 64.8,
  });

  assert.equal(result.boundary.type, "MultiPolygon");
  assert.equal(result.boundary.coordinates.length, 1);
  assert.equal(result.boundary.coordinates[0].length, 1);
  assert.equal(result.boundary.coordinates[0][0].length, 5);
  assert.ok(Math.abs(result.areaHa - 64.8) < 0.5);
});

test("buildManualFieldDraft rejects invalid coordinates and area", () => {
  assert.throws(
    () =>
      buildManualFieldDraft({
        latitude: 120,
        longitude: -109.5,
        areaHa: 64.8,
      }),
    /Latitude must be between -90 and 90/,
  );

  assert.throws(
    () =>
      buildManualFieldDraft({
        latitude: 51.2,
        longitude: -109.5,
        areaHa: 0,
      }),
    /Area must be a positive number of hectares/,
  );
});
