import test from "node:test";
import assert from "node:assert/strict";

import { describeFieldAccessDecisionNarrative } from "./describeFieldAccessDecisionNarrative";
import { resolveFieldAccessDecision } from "./resolveSeedingAdvisoryDecision";

test("describeFieldAccessDecisionNarrative preserves the shared summary and detailed wait explanation", () => {
  const decision = resolveFieldAccessDecision({
    surfaceMoisturePct: 88,
    recentPrecipTotal72hMm: 16,
    freezeThawCycles7d: 5,
  });

  assert.ok(decision);
  assert.deepEqual(describeFieldAccessDecisionNarrative(decision), {
    valueLabel: "Wait",
    tone: "danger",
    summary: "Surface 88% · P72h 16mm · 5 thaw cycles",
    detailedExplanation:
      "Surface moisture at 88% — soil saturated. Equipment access will cause compaction. 5 freeze-thaw cycles. Top soil is unstable and prone to rutting.",
  });
});

test("describeFieldAccessDecisionNarrative keeps the workable summary while expanding the explanation", () => {
  const decision = resolveFieldAccessDecision({
    surfaceMoisturePct: 62,
    recentPrecipTotal72hMm: 4,
    freezeThawCycles7d: 1,
  });

  assert.ok(decision);
  assert.deepEqual(describeFieldAccessDecisionNarrative(decision), {
    valueLabel: "Workable",
    tone: "positive",
    summary: "Surface 62% · P72h 4mm · 1 thaw cycle",
    detailedExplanation: "Field conditions are workable. Soil is firm enough for equipment traffic.",
  });
});
