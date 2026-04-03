import assert from "node:assert/strict";
import test from "node:test";
import { describeMoistureBandNarrative } from "./describeMoistureBandNarrative";

test("describeMoistureBandNarrative keeps the compact dry/adequate/saturated copy", () => {
  assert.equal(
    describeMoistureBandNarrative(null),
    "Insufficient data.",
  );
  assert.equal(
    describeMoistureBandNarrative(18),
    "Root zone critically dry. Irrigation urgent.",
  );
  assert.equal(
    describeMoistureBandNarrative(24),
    "Below optimal. Monitor for stress signs.",
  );
  assert.equal(
    describeMoistureBandNarrative(52),
    "Within acceptable range for most crops.",
  );
  assert.equal(
    describeMoistureBandNarrative(84),
    "Saturated. Risk of waterlogging.",
  );
});
