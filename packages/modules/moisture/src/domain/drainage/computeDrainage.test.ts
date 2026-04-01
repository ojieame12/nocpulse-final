import test from "node:test";
import assert from "node:assert/strict";
import { computeDrainageMm, inferTextureClass } from "./computeDrainage";

// ---------------------------------------------------------------------------
// computeDrainageMm
// ---------------------------------------------------------------------------

test("zero drainage when storage is below field capacity", () => {
  assert.equal(computeDrainageMm(80, 100, 24, "loam"), 0);
});

test("zero drainage when storage equals field capacity", () => {
  assert.equal(computeDrainageMm(100, 100, 24, "loam"), 0);
});

test("full drainage: sand after many hours drains nearly all excess", () => {
  // tau=6 for sand. After 100 hours, e^(-100/6) ~ 0, so nearly all excess drains.
  const drained = computeDrainageMm(150, 100, 100, "sand");
  const excess = 150 - 100;
  assert.ok(drained > excess * 0.99, `expected nearly full drainage, got ${drained}`);
});

test("partial drainage: clay after 12 hours drains less than sand after 12 hours", () => {
  const storage = 150;
  const fc = 100;
  const hours = 12;

  const drainedSand = computeDrainageMm(storage, fc, hours, "sand");
  const drainedClay = computeDrainageMm(storage, fc, hours, "clay");

  assert.ok(
    drainedSand > drainedClay,
    `sand drainage (${drainedSand}) should exceed clay drainage (${drainedClay}) at ${hours}h`,
  );
});

test("unknown texture defaults to loam tau (18 hours)", () => {
  const storage = 150;
  const fc = 100;
  const hours = 18;

  const drainedUnknown = computeDrainageMm(storage, fc, hours, "unknown");
  const drainedLoam = computeDrainageMm(storage, fc, hours, "loam");

  assert.equal(drainedUnknown, drainedLoam);
});

test("omitted textureClass defaults to unknown (loam tau)", () => {
  const storage = 150;
  const fc = 100;
  const hours = 18;

  const drainedDefault = computeDrainageMm(storage, fc, hours);
  const drainedUnknown = computeDrainageMm(storage, fc, hours, "unknown");

  assert.equal(drainedDefault, drainedUnknown);
});

test("drainage never makes storage go below field capacity", () => {
  // For any texture and any time, drained <= excess
  const storage = 120;
  const fc = 100;
  const excess = storage - fc;

  for (const texture of ["sand", "sandy-loam", "loam", "clay-loam", "clay"] as const) {
    for (const hours of [0, 1, 6, 12, 24, 48, 100, 1000]) {
      const drained = computeDrainageMm(storage, fc, hours, texture);
      assert.ok(
        drained <= excess + 1e-10,
        `${texture} at ${hours}h: drained ${drained} exceeds excess ${excess}`,
      );
      assert.ok(drained >= 0, `${texture} at ${hours}h: drained ${drained} is negative`);
    }
  }
});

test("zero hours means zero drainage", () => {
  const drained = computeDrainageMm(150, 100, 0, "sand");
  assert.equal(drained, 0);
});

// ---------------------------------------------------------------------------
// inferTextureClass
// ---------------------------------------------------------------------------

test("inferTextureClass: FC < 15% -> sand", () => {
  assert.equal(inferTextureClass(10, 5), "sand");
  assert.equal(inferTextureClass(14.9, 5), "sand");
});

test("inferTextureClass: FC 15-25% -> sandy-loam", () => {
  assert.equal(inferTextureClass(15, 7), "sandy-loam");
  assert.equal(inferTextureClass(24.9, 10), "sandy-loam");
});

test("inferTextureClass: FC 25-35% -> loam", () => {
  assert.equal(inferTextureClass(25, 12), "loam");
  assert.equal(inferTextureClass(30, 15), "loam");
});

test("inferTextureClass: FC 35-45% -> clay-loam", () => {
  assert.equal(inferTextureClass(35, 18), "clay-loam");
  assert.equal(inferTextureClass(44, 22), "clay-loam");
});

test("inferTextureClass: FC > 45% -> clay", () => {
  assert.equal(inferTextureClass(45, 25), "clay");
  assert.equal(inferTextureClass(60, 30), "clay");
});

test("inferTextureClass: null FC -> unknown", () => {
  assert.equal(inferTextureClass(null, 10), "unknown");
});

test("inferTextureClass: null WP still infers from FC", () => {
  assert.equal(inferTextureClass(30, null), "loam");
});

test("inferTextureClass: both null -> unknown", () => {
  assert.equal(inferTextureClass(null, null), "unknown");
});
