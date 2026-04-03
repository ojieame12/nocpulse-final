import test from "node:test";
import assert from "node:assert/strict";
import { describeGrainPriceSnapshotFreshness } from "./describeGrainPriceSnapshotFreshness";

test("describeGrainPriceSnapshotFreshness marks missing timestamps as missing", () => {
  assert.deepEqual(
    describeGrainPriceSnapshotFreshness({
      capturedAt: null,
      now: "2026-04-03T12:00:00Z",
    }),
    {
      status: "missing",
      ageHours: null,
      ageLabel: null,
    },
  );
});

test("describeGrainPriceSnapshotFreshness marks recent snapshots as fresh", () => {
  assert.deepEqual(
    describeGrainPriceSnapshotFreshness({
      capturedAt: "2026-04-03T09:30:00Z",
      now: "2026-04-03T12:00:00Z",
    }),
    {
      status: "fresh",
      ageHours: 2.5,
      ageLabel: "3h old",
    },
  );
});

test("describeGrainPriceSnapshotFreshness marks older snapshots as stale", () => {
  assert.deepEqual(
    describeGrainPriceSnapshotFreshness({
      capturedAt: "2026-04-01T12:00:00Z",
      now: "2026-04-03T12:00:00Z",
    }),
    {
      status: "stale",
      ageHours: 48,
      ageLabel: "2d old",
    },
  );
});
