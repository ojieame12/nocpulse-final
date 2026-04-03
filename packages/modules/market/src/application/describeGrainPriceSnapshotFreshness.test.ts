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

test("describeGrainPriceSnapshotFreshness keeps investing daily settlements fresh through the next market day", () => {
  assert.deepEqual(
    describeGrainPriceSnapshotFreshness({
      capturedAt: "2026-04-02T00:00:00Z",
      sourceKey: "investing-canada:ice-canola-futures",
      now: "2026-04-03T15:43:22Z",
    }),
    {
      status: "fresh",
      ageHours: 39.72277777777778,
      ageLabel: "40h old",
    },
  );
});

test("describeGrainPriceSnapshotFreshness keeps investing daily settlements fresh across a weekend gap", () => {
  assert.deepEqual(
    describeGrainPriceSnapshotFreshness({
      capturedAt: "2026-04-03T00:00:00Z",
      sourceKey: "investing:cbot-us-wheat-futures",
      now: "2026-04-05T18:00:00Z",
    }),
    {
      status: "fresh",
      ageHours: 66,
      ageLabel: "3d old",
    },
  );
});

test("describeGrainPriceSnapshotFreshness still marks investing daily settlements stale after the next market day is missed", () => {
  assert.deepEqual(
    describeGrainPriceSnapshotFreshness({
      capturedAt: "2026-04-02T00:00:00Z",
      sourceKey: "investing:cbot-us-corn-futures",
      now: "2026-04-06T12:00:00Z",
    }),
    {
      status: "stale",
      ageHours: 108,
      ageLabel: "5d old",
    },
  );
});
