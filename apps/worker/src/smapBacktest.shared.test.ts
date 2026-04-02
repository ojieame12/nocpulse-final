import assert from "node:assert/strict";
import test from "node:test";
import { buildValidationPoint } from "./smapBacktest.shared";

test("scores a source-backed matched point", () => {
  const result = buildValidationPoint(
    "2026-03-30",
    32.4,
    24.5,
    { sourceKey: "imagery-weather-derived-v1", derivationMode: "source-backed" },
  );

  assert.equal(result.rawMatched, true);
  assert.equal(result.point.scored, true);
  assert.equal(result.point.exclusionReason, null);
  assert.deepEqual(result.pair, { predicted: 32.4, observed: 24.5 });
});

test("excludes bootstrap snapshots from scoring", () => {
  const result = buildValidationPoint(
    "2026-03-27",
    41.2,
    24.5,
    { sourceKey: "bootstrap:dev-seed", derivationMode: "source-backed" },
  );

  assert.equal(result.rawMatched, true);
  assert.equal(result.point.scored, false);
  assert.equal(result.point.exclusionReason, "bootstrap-snapshot");
  assert.equal(result.pair, null);
});

test("excludes seeded-range snapshots from scoring", () => {
  const result = buildValidationPoint(
    "2026-03-28",
    33.1,
    24.5,
    { sourceKey: "imagery-weather-derived-v1", derivationMode: "seeded-range" },
  );

  assert.equal(result.rawMatched, true);
  assert.equal(result.point.scored, false);
  assert.equal(result.point.exclusionReason, "non-source-backed-snapshot");
  assert.equal(result.pair, null);
});

test("excludes matched snapshots with missing provenance from scoring", () => {
  const result = buildValidationPoint(
    "2026-03-29",
    31.2,
    24.5,
    { sourceKey: "imagery-weather-derived-v1", derivationMode: null },
  );

  assert.equal(result.rawMatched, true);
  assert.equal(result.point.scored, false);
  assert.equal(result.point.exclusionReason, "missing-snapshot-provenance");
  assert.equal(result.pair, null);
});

test("annotates missing SMAP dates without scoring them", () => {
  const result = buildValidationPoint(
    "2026-03-31",
    29.4,
    null,
    { sourceKey: "imagery-weather-derived-v1", derivationMode: "source-backed" },
  );

  assert.equal(result.rawMatched, false);
  assert.equal(result.point.scored, false);
  assert.equal(result.point.exclusionReason, "missing-smap");
  assert.equal(result.pair, null);
});
