import test from "node:test";
import assert from "node:assert/strict";

import { classifyFieldQuality } from "./fieldQualityAudit";

test("classifyFieldQuality marks missing moisture as broken", () => {
  const result = classifyFieldQuality({
    hasMoistureSnapshot: false,
    hasWeatherObservation: true,
    hasRasterObservation: true,
    hasSoilContext: true,
    vegetationReadiness: "ready",
    moistureReadiness: "ready",
    derivationMode: null,
    rasterMode: null,
    signalBlend: null,
    confidence: "high",
  });

  assert.equal(result.state, "broken");
  assert.ok(result.reasons.includes("missing-moisture-snapshot"));
});

test("classifyFieldQuality marks seeded fallback as fallback", () => {
  const result = classifyFieldQuality({
    hasMoistureSnapshot: true,
    hasWeatherObservation: true,
    hasRasterObservation: true,
    hasSoilContext: false,
    vegetationReadiness: "ready",
    moistureReadiness: "ready",
    derivationMode: "seeded-range",
    rasterMode: "synthetic",
    signalBlend: "seeded",
    confidence: "medium",
  });

  assert.equal(result.state, "fallback");
  assert.ok(result.reasons.includes("seeded-fallback"));
  assert.ok(result.reasons.includes("synthetic-raster"));
  assert.ok(result.reasons.includes("missing-soil-context"));
});

test("classifyFieldQuality marks thin history as thin", () => {
  const result = classifyFieldQuality({
    hasMoistureSnapshot: true,
    hasWeatherObservation: true,
    hasRasterObservation: true,
    hasSoilContext: true,
    vegetationReadiness: "thin",
    moistureReadiness: "ready",
    derivationMode: "source-backed",
    rasterMode: "provider",
    signalBlend: "raster+weather",
    confidence: "high",
  });

  assert.equal(result.state, "thin");
  assert.ok(result.reasons.includes("vegetation-thin"));
});

test("classifyFieldQuality marks strong source-backed field as ready", () => {
  const result = classifyFieldQuality({
    hasMoistureSnapshot: true,
    hasWeatherObservation: true,
    hasRasterObservation: true,
    hasSoilContext: true,
    vegetationReadiness: "ready",
    moistureReadiness: "ready",
    derivationMode: "source-backed",
    rasterMode: "provider",
    signalBlend: "raster+weather",
    confidence: "high",
  });

  assert.equal(result.state, "ready");
  assert.deepEqual(result.reasons, []);
});
