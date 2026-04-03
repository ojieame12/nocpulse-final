import assert from "node:assert/strict";
import test from "node:test";
import { describeSprayWindowAdvisoryNarrative } from "./describeSprayWindowAdvisoryNarrative";

test("describeSprayWindowAdvisoryNarrative builds shared UI and PDF spray copy", () => {
  const narrative = describeSprayWindowAdvisoryNarrative({
    cropLabel: "Canola",
    sprayWindowCount24h: 2,
    firstWindow: {
      startAt: "2026-04-02T18:00:00.000Z",
      endAt: "2026-04-02T22:00:00.000Z",
      maxWindKph: 14,
      maxPrecipProbabilityPct: 12,
      minAverageTempC: 13,
      maxAverageTempC: 18,
    },
    startLabel: "Apr 2, 12:00 PM CST",
    endLabel: "Apr 2, 4:00 PM CST",
  });

  assert.equal(narrative.uiTitle, "Spray window open");
  assert.equal(narrative.windowCountLabel, "2 spray windows");
  assert.match(narrative.explanation, /2 spray windows/i);
  assert.match(narrative.whyNow, /Apr 2, 12:00 PM CST to Apr 2, 4:00 PM CST/i);
  assert.match(narrative.pdfBody, /Wind up to 14 km\/h/i);
  assert.match(narrative.pdfBody, /12% rain chance/i);
  assert.match(narrative.pdfBody, /13–18°C/i);
  assert.equal(
    narrative.pdfAction,
    "Confirm the target crop stage and product label first, then re-check wind exposure on the most open field edges before committing the full pass.",
  );
});
