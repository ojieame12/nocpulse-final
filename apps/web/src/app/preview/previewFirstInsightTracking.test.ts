import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPreviewFirstInsightAuditPayload,
  buildPreviewFirstInsightSessionKey,
} from "./previewFirstInsightTracking";

test("buildPreviewFirstInsightAuditPayload returns a payload for the focused ready field", () => {
  const result = buildPreviewFirstInsightAuditPayload({
    workspaceId: "workspace-1",
    fieldId: "field-1",
    activePanel: "detail",
    isGuestSession: false,
    summary: {
      moisture: 0.51,
      moistureLabel: "51%",
      moistureTrend: "Flat",
      moistureTrendDirection: "flat",
      moistureConfidence: "High confidence",
      moistureConfidenceLevel: "high",
      moistureObservedAtLabel: "Today",
      rootMoisture: "51%",
      fieldState: "Stable",
      trend: "+4%",
      trendSub: "vs last week",
      modeLabels: ["Crop health", "Canopy vigor", "Leaf moisture"],
      currentModeLabel: "Crop health",
      currentModeValue: "0.64",
      dataQuality: {
        label: "Ready",
        tone: "good",
        detail: "Source-backed",
      },
    },
    workspaceFirstInsightSummary: {
      focusFieldId: "field-1",
      focusFieldName: "North Quarter",
      headline: "Workspace first read",
      summary: "Start here.",
      comparisons: [],
    },
  });

  assert.deepEqual(result, {
    workspaceId: "workspace-1",
    fieldId: "field-1",
    fieldName: "North Quarter",
    dataQualityLabel: "Ready",
    moistureConfidenceLevel: "high",
    moistureDerivationMode: "unknown",
    focusFieldId: "field-1",
    focusFieldName: "North Quarter",
    workspaceSummaryComparisonCount: 0,
    source: "workspace-first-read",
  });
});

test("buildPreviewFirstInsightAuditPayload rejects thin or off-focus fields", () => {
  const offFocus = buildPreviewFirstInsightAuditPayload({
    workspaceId: "workspace-1",
    fieldId: "field-2",
    activePanel: "detail",
    isGuestSession: false,
    summary: {
      moisture: 0.41,
      moistureLabel: "41%",
      moistureTrend: "Flat",
      moistureTrendDirection: "flat",
      moistureConfidence: "Medium confidence",
      moistureConfidenceLevel: "medium",
      moistureObservedAtLabel: "Today",
      rootMoisture: "41%",
      fieldState: "Stable",
      trend: "+1%",
      trendSub: "vs last week",
      modeLabels: ["Crop health", "Canopy vigor", "Leaf moisture"],
      currentModeLabel: "Crop health",
      currentModeValue: "0.55",
      dataQuality: {
        label: "Ready",
        tone: "good",
        detail: "Source-backed",
      },
    },
    workspaceFirstInsightSummary: {
      focusFieldId: "field-1",
      focusFieldName: "North Quarter",
      headline: "Workspace first read",
      summary: "Start here.",
      comparisons: [],
    },
  });

  const thin = buildPreviewFirstInsightAuditPayload({
    workspaceId: "workspace-1",
    fieldId: "field-1",
    activePanel: "detail",
    isGuestSession: false,
    summary: {
      moisture: 0.41,
      moistureLabel: "41%",
      moistureTrend: "Flat",
      moistureTrendDirection: "flat",
      moistureConfidence: "Low confidence",
      moistureConfidenceLevel: "low",
      moistureObservedAtLabel: "Today",
      rootMoisture: "41%",
      fieldState: "Stable",
      trend: "+1%",
      trendSub: "vs last week",
      modeLabels: ["Crop health", "Canopy vigor", "Leaf moisture"],
      currentModeLabel: "Crop health",
      currentModeValue: "0.55",
      dataQuality: {
        label: "Limited",
        tone: "caution",
        detail: "Weak support",
      },
    },
    workspaceFirstInsightSummary: {
      focusFieldId: "field-1",
      focusFieldName: "North Quarter",
      headline: "Workspace first read",
      summary: "Start here.",
      comparisons: [],
    },
  });

  assert.equal(offFocus, null);
  assert.equal(thin, null);
});

test("buildPreviewFirstInsightAuditPayload accepts a focused limited field when confidence is medium", () => {
  const result = buildPreviewFirstInsightAuditPayload({
    workspaceId: "workspace-1",
    fieldId: "field-1",
    activePanel: "detail",
    isGuestSession: false,
    summary: {
      moisture: 0.44,
      moistureLabel: "44%",
      moistureTrend: "Rising",
      moistureTrendDirection: "up",
      moistureConfidence: "Medium confidence",
      moistureConfidenceLevel: "medium",
      moistureObservedAtLabel: "Today",
      rootMoisture: "44%",
      fieldState: "Watch",
      trend: "+2%",
      trendSub: "vs last week",
      modeLabels: ["Crop health", "Canopy vigor", "Leaf moisture"],
      currentModeLabel: "Crop health",
      currentModeValue: "0.58",
      moistureDerivationMode: "source-backed",
      dataQuality: {
        label: "Limited",
        tone: "caution",
        detail: "Usable but still thin",
      },
    },
    workspaceFirstInsightSummary: {
      focusFieldId: "field-1",
      focusFieldName: "North Quarter",
      headline: "Workspace first read",
      summary: "Start here.",
      comparisons: [],
    },
  });

  assert.deepEqual(result, {
    workspaceId: "workspace-1",
    fieldId: "field-1",
    fieldName: "North Quarter",
    dataQualityLabel: "Limited",
    moistureConfidenceLevel: "medium",
    moistureDerivationMode: "source-backed",
    focusFieldId: "field-1",
    focusFieldName: "North Quarter",
    workspaceSummaryComparisonCount: 0,
    source: "workspace-first-read",
  });
});

test("buildPreviewFirstInsightSessionKey is stable", () => {
  assert.equal(
    buildPreviewFirstInsightSessionKey({
      workspaceId: "workspace-1",
      fieldId: "field-1",
    }),
    "preview:first-insight:workspace-1:field-1",
  );
});
