import test from "node:test";
import assert from "node:assert/strict";

import type { FieldSummaryProps } from "../../components/panels/SummaryTab";
import { buildWorkspaceFirstInsightSummary } from "./workspaceFirstInsightSummary";

function makeSummary(overrides: Partial<FieldSummaryProps> = {}): FieldSummaryProps {
  return {
    name: "Field",
    lld: "NW-25-010-17-W4",
    crop: "canola",
    cropStage: "flowering",
    moisture: 0.41,
    cloudCover: "12%",
    surfaceMoisture: "Watch",
    fieldState: "Adequate",
    fieldStateColor: "#16a34a",
    rootMoisture: "41%",
    rootMoistureSub: "Root zone",
    trend: "+3%",
    trendSub: "7d change",
    spread: "Moderate",
    spreadSub: "Across field",
    confidence: "High",
    confidenceSub: "SAR + weather",
    moistureConfidenceLevel: "high",
    moistureDerivationMode: "source-backed",
    precipitation: "4 mm",
    precipitationSub: "72h",
    nextRain: "Thu",
    nextRainSub: "Next event",
    rainChance: "40%",
    rainChanceSub: "48h",
    sevenDayTotal: "12 mm",
    sevenDayTotalSub: "7d total",
    alerts: [],
    outlook: [],
    dataQuality: {
      label: "Ready",
      tone: "positive",
      summary: "Strong signal support.",
      reasons: ["Trend support is strong."],
    },
    ...overrides,
  };
}

test("buildWorkspaceFirstInsightSummary prefers the active trackable field and computes comparison slots", () => {
  const result = buildWorkspaceFirstInsightSummary({
    workspaceId: "workspace-1",
    activeFieldId: "field-b",
    fields: [
      {
        fieldId: "field-a",
        fieldName: "North Quarter",
        summary: makeSummary({ rootMoisture: "46%", moisture: 0.46, trend: "+1%" }),
      },
      {
        fieldId: "field-b",
        fieldName: "South Quarter",
        summary: makeSummary({ rootMoisture: "38%", moisture: 0.38, trend: "-6%" }),
      },
      {
        fieldId: "field-c",
        fieldName: "East Quarter",
        summary: makeSummary({ rootMoisture: "29%", moisture: 0.29, trend: "+2%" }),
      },
    ],
  });

  assert.ok(result);
  assert.equal(result.focusFieldId, "field-b");
  assert.match(result.summary, /South Quarter/);
  assert.deepEqual(
    result.comparisons.map((entry) => [entry.label, entry.fieldName, entry.value]),
    [
      ["Wettest field", "North Quarter", "46%"],
      ["Driest field", "East Quarter", "29%"],
      ["Most changed this week", "South Quarter", "-6%"],
    ],
  );
});

test("buildWorkspaceFirstInsightSummary returns null when there are not enough strong fields", () => {
  const result = buildWorkspaceFirstInsightSummary({
    workspaceId: "workspace-1",
    activeFieldId: "field-a",
    fields: [
      {
        fieldId: "field-a",
        fieldName: "Only Field",
        summary: makeSummary(),
      },
      {
        fieldId: "field-b",
        fieldName: "Thin Field",
        summary: makeSummary({
          dataQuality: {
            label: "Modeled",
            tone: "danger",
            summary: "Fallback driven.",
            reasons: ["Not enough live support."],
          },
          moistureConfidenceLevel: "low",
        }),
      },
    ],
  });

  assert.equal(result, null);
});

test("buildWorkspaceFirstInsightSummary includes limited fields when moisture confidence is medium", () => {
  const result = buildWorkspaceFirstInsightSummary({
    workspaceId: "workspace-1",
    activeFieldId: "field-a",
    fields: [
      {
        fieldId: "field-a",
        fieldName: "Ready Field",
        summary: makeSummary(),
      },
      {
        fieldId: "field-b",
        fieldName: "Limited Field",
        summary: makeSummary({
          dataQuality: {
            label: "Limited",
            tone: "warning",
            summary: "Usable but still thin.",
            reasons: ["Vegetation history is still thin."],
          },
          moistureConfidenceLevel: "medium",
        }),
      },
    ],
  });

  assert.ok(result);
  assert.equal(result.focusFieldId, "field-a");
  assert.match(result.summary, /Across 2 fields/);
});

test("buildWorkspaceFirstInsightSummary respects the Hope Creek allowlist when the active field is weak", () => {
  const result = buildWorkspaceFirstInsightSummary({
    workspaceId: "8f2afceb-aefe-4e90-a24e-7ab07c4423fe",
    activeFieldId: "field-x",
    fields: [
      {
        fieldId: "field-x",
        fieldName: "Kranst",
        summary: makeSummary({
          dataQuality: {
            label: "Limited",
            tone: "warning",
            summary: "Usable but not first-choice.",
            reasons: ["Still thin."],
          },
          moistureConfidenceLevel: "medium",
        }),
      },
      {
        fieldId: "field-a",
        fieldName: "Rath",
        summary: makeSummary(),
      },
      {
        fieldId: "field-b",
        fieldName: "Towes",
        summary: makeSummary({ rootMoisture: "35%", moisture: 0.35 }),
      },
    ],
  });

  assert.ok(result);
  assert.equal(result.focusFieldName, "Rath");
});

test("buildWorkspaceFirstInsightSummary scopes comparisons to allowlisted trackable fields", () => {
  const result = buildWorkspaceFirstInsightSummary({
    workspaceId: "8f2afceb-aefe-4e90-a24e-7ab07c4423fe",
    activeFieldId: "field-a",
    fields: [
      {
        fieldId: "field-a",
        fieldName: "Rath",
        summary: makeSummary({ rootMoisture: "41%", moisture: 0.41, trend: "+2%" }),
      },
      {
        fieldId: "field-b",
        fieldName: "Towes",
        summary: makeSummary({ rootMoisture: "35%", moisture: 0.35, trend: "-4%" }),
      },
      {
        fieldId: "field-c",
        fieldName: "Zeta North",
        summary: makeSummary({ rootMoisture: "58%", moisture: 0.58, trend: "+9%" }),
      },
    ],
  });

  assert.ok(result);
  assert.deepEqual(
    result.comparisons.map((entry) => [entry.label, entry.fieldName, entry.value]),
    [
      ["Wettest field", "Rath", "41%"],
      ["Driest field", "Towes", "35%"],
      ["Most changed this week", "Towes", "-4%"],
    ],
  );
});

test("buildWorkspaceFirstInsightSummary returns null when an allowlisted workspace lacks two eligible allowlisted fields", () => {
  const result = buildWorkspaceFirstInsightSummary({
    workspaceId: "8f2afceb-aefe-4e90-a24e-7ab07c4423fe",
    activeFieldId: "field-a",
    fields: [
      {
        fieldId: "field-a",
        fieldName: "Rath",
        summary: makeSummary(),
      },
      {
        fieldId: "field-z",
        fieldName: "Zeta North",
        summary: makeSummary(),
      },
    ],
  });

  assert.equal(result, null);
});

test("buildWorkspaceFirstInsightSummary scopes the dev farm summary to curated ready fields", () => {
  const result = buildWorkspaceFirstInsightSummary({
    workspaceId: "a625a72d-a2de-43ee-8bb4-aad93466f750",
    activeFieldId: "field-noisy",
    fields: [
      {
        fieldId: "field-b",
        fieldName: "Biehn",
        summary: makeSummary({ rootMoisture: "44%", moisture: 0.44, trend: "+3%" }),
      },
      {
        fieldId: "field-k",
        fieldName: "Krants",
        summary: makeSummary({ rootMoisture: "31%", moisture: 0.31, trend: "-5%" }),
      },
      {
        fieldId: "field-noisy",
        fieldName: "Route Import North mn8xvfub",
        summary: makeSummary({ rootMoisture: "59%", moisture: 0.59, trend: "+11%" }),
      },
    ],
  });

  assert.ok(result);
  assert.equal(result.focusFieldName, "Biehn");
  assert.deepEqual(
    result.comparisons.map((entry) => [entry.label, entry.fieldName, entry.value]),
    [
      ["Wettest field", "Biehn", "44%"],
      ["Driest field", "Krants", "31%"],
      ["Most changed this week", "Krants", "-5%"],
    ],
  );
});
