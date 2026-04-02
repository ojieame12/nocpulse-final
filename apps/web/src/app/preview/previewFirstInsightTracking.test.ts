import assert from "node:assert/strict";
import test from "node:test";
import type { FieldViewModel } from "./PreviewShell";
import {
  buildPreviewFirstInsightAuditPayload,
  buildPreviewFirstInsightSessionKey,
} from "./previewFirstInsightTracking";

function makeFieldViewModel(
  overrides: Partial<FieldViewModel> = {},
): FieldViewModel {
  return {
    workspaceId: "workspace-1",
    fieldId: "field-1",
    fieldName: "Main Farm",
    areaHaLabel: "64.0 ha",
    mapPreview: {} as FieldViewModel["mapPreview"],
    sidebarFields: [],
    reportPanel: null,
    actionPanel: null,
    notesPanel: null,
    marketPanel: null,
    cropPanel: null,
    alertsPanel: null,
    activityPanel: null,
    cellInspector: null,
    summary: {
      name: "Main Farm",
      lld: "01-001-01-W1",
      crop: "canola",
      cropStage: "Stem elongation",
      moisture: 0.48,
      cloudCover: "0%",
      surfaceMoisture: "31%",
      fieldState: "Adequate",
      fieldStateColor: "#16a34a",
      rootMoisture: "48.0%",
      rootMoistureSub: "Adequate",
      trend: "+4.2%",
      trendSub: "vs previous raster",
      spread: "8.1",
      spreadSub: "12 mapped cells",
      confidence: "High",
      confidenceSub: "sentinel-1",
      moistureConfidenceLevel: "high",
      moistureDerivationMode: "source-backed",
      precipitation: "0.0 mm",
      precipitationSub: "Current observation",
      nextRain: "—",
      nextRainSub: "No forecast signal",
      rainChance: "—",
      rainChanceSub: "No forecast",
      sevenDayTotal: "2.1 mm",
      sevenDayTotalSub: "Loaded forecast window",
      alerts: [],
      outlook: [],
      dataQuality: {
        label: "Ready",
        tone: "positive",
        summary: "Current moisture is source-backed and fresh.",
        reasons: ["Weather context loaded"],
      },
    },
    ...overrides,
  };
}

test("buildPreviewFirstInsightAuditPayload returns payload for a ready focus field", () => {
  const payload = buildPreviewFirstInsightAuditPayload({
    workspaceId: "workspace-1",
    fieldData: makeFieldViewModel(),
    workspaceFirstInsightSummary: {
      focusFieldId: "field-1",
      focusFieldName: "Main Farm",
      headline: "Workspace first read",
      summary: "Start with Main Farm.",
      comparisons: [
        {
          label: "Wettest ready field",
          fieldId: "field-1",
          fieldName: "Main Farm",
          value: "48.0%",
          note: "Adequate",
        },
      ],
    },
  });

  assert.deepEqual(payload, {
    workspaceId: "workspace-1",
    fieldId: "field-1",
    fieldName: "Main Farm",
    dataQualityLabel: "Ready",
    moistureConfidenceLevel: "high",
    moistureDerivationMode: "source-backed",
    workspaceSummaryComparisonCount: 1,
    focusFieldId: "field-1",
    focusFieldName: "Main Farm",
  });
  assert.equal(
    buildPreviewFirstInsightSessionKey(payload!),
    "fieldpulse:first-insight-surfaced:workspace-1:field-1",
  );
});

test("buildPreviewFirstInsightAuditPayload excludes non-focus fields", () => {
  const payload = buildPreviewFirstInsightAuditPayload({
    workspaceId: "workspace-1",
    fieldData: makeFieldViewModel({ fieldId: "field-2", fieldName: "Rath" }),
    workspaceFirstInsightSummary: {
      focusFieldId: "field-1",
      focusFieldName: "Main Farm",
      headline: "Workspace first read",
      summary: "Start with Main Farm.",
      comparisons: [],
    },
  });

  assert.equal(payload, null);
});

test("buildPreviewFirstInsightAuditPayload excludes weak limited fields", () => {
  const payload = buildPreviewFirstInsightAuditPayload({
    workspaceId: "workspace-1",
    fieldData: makeFieldViewModel({
      summary: {
        ...makeFieldViewModel().summary!,
        moistureConfidenceLevel: "low",
        dataQuality: {
          label: "Limited",
          tone: "warning",
          summary: "Context is still filling in.",
          reasons: ["Vegetation history is still thin"],
        },
      },
    }),
    workspaceFirstInsightSummary: {
      focusFieldId: "field-1",
      focusFieldName: "Main Farm",
      headline: "Workspace first read",
      summary: "Start with Main Farm.",
      comparisons: [],
    },
  });

  assert.equal(payload, null);
});
