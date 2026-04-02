import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { ThemeContext } from "../../layout/WorkspaceShell";
import { FieldDetailPanel } from "../FieldDetailPanel";
import { CropsSubPage } from "../fieldDetailCropsSubPage";
import { ReportSubPage } from "../fieldDetailReportSubPage";
import { LineSpark, MultiLineSpark } from "../fieldDetailVisualizations";

function renderWithDarkTheme(element: React.ReactElement) {
  return renderToStaticMarkup(
    <ThemeContext.Provider value="dark">{element}</ThemeContext.Provider>,
  );
}

function createBasePanelProps() {
  return {
    fieldId: "field-1",
    workspaceId: "workspace-1",
    fieldName: "Biehn",
    areaLabel: "259.0 ha",
    activeMode: "moisture" as const,
    availableModes: ["moisture"] as const,
    summary: {
      crop: "Rye",
      cropStage: "Stage unverified",
      updatedLabel: "Mar 29, 2026",
      outlook: [
        { day: "Mon", high: 12, low: 2, precip: "20%" },
        { day: "Tue", high: 15, low: 4, precip: "10%" },
      ],
      alerts: [
        {
          label: "Heat risk",
          desc: "Stress expected in exposed ridges.",
          severity: "danger",
        },
      ],
    } as any,
    report: {
      findings: [],
      zones: [],
      alerts: [],
      readings: [],
      charts: [],
      sources: [],
    } as any,
    market: {
      sectionLabel: "RYE MARKET",
      cropSymbol: "RYE",
      closePriceCadPerTonne: 167.31,
      priceLabel: "$167.31",
      priceUnitLabel: "/tonne CAD",
      priceDeltaLabel: "+0.00 CAD/t",
      availabilityState: "yield-unavailable",
      referenceStatusLabel: "Stored",
      referenceRows: [
        { label: "Stored History", value: "1 capture" },
        { label: "Field Area", value: "259.0 ha" },
      ],
      contextTiles: [],
      priceBars: [167.31],
      revenueRows: [
        { label: "Expected Yield", value: "N/A" },
        { label: "Price at Harvest", value: "$167.31/t" },
        { label: "Local Basis", value: "+0.00 CAD/t" },
        { label: "Field Area", value: "259.0 ha" },
      ],
    } as any,
    crop: {
      cropName: "Rye",
      thresholdStageLabel: "Tillering",
      growthSegments: [{ label: "Tillering", active: true }],
      accumulatedGddLabel: "245",
      healthIndex: { label: "Healthy", value: 0.72, fillColor: "#16a34a", metrics: [] },
      moistureBalance: { label: "Balanced", value: 0.61, fillColor: "#3b82f6", metrics: [] },
      provenanceRows: [],
      diseaseRisks: [],
      fieldTiles: [],
    } as any,
    action: {
      recommendation: "Scout the driest part of the field.",
      urgency: "Watch",
      intelligenceSourceLabel: "Heuristic watchlist",
      intelligenceFreshnessLabel: "Signals Mar 29",
    } as any,
    notes: {
      fieldId: "field-1",
      inspectionTarget: {
        name: "Field-wide",
        dateLabel: "Mar 29, 2026",
        coordinateLabel: "Field-wide",
      },
      entries: [
        {
          id: "note-1",
          date: "2026-03-27T00:00:00.000Z",
          text: "Scout moisture pocket on the west edge.",
          status: "confirmed",
        },
      ],
    } as any,
    activity: null,
  };
}

function createModeData() {
  return {
    hero: { v: 0.62, d: "62", u: "%", sev: "positive" },
    headline: "Root moisture steady",
    sub: "Spread holding field-wide",
    vitals: [{ label: "Surface", value: "62%" }],
    spark: [44, 51, 57, 61, 63, 62],
    sparkColor: "#16a34a",
    trendLabel: "Vegetation trend",
    trendMeta: "NDVI 0.72",
    spatialColumns: [
      { label: "Low", value: "44%" },
      { label: "Avg", value: "62%" },
      { label: "High", value: "79%" },
    ],
    spatialProgressPct: 62,
    interpretation: "Healthy field signal.",
    risk: "Low risk",
    riskLevel: "Low",
    sourceSummary: "Sentinel-1",
    belowThresholdValue: "0",
    belowThresholdLabel: "Below threshold",
    inZonesValue: "0",
    inZonesLabel: "Tracked zones",
    contextOnly: false,
  } as any;
}

test("FieldDetailPanel top fold renders outlook, field alerts, and terse market metrics", () => {
  const markup = renderWithDarkTheme(<FieldDetailPanel {...createBasePanelProps()} />);

  assert.match(markup, /Biehn/);
  assert.match(markup, /Outlook/);
  assert.match(markup, /Field Alerts/);
  assert.match(markup, /\$167\.31/);
  assert.match(markup, /\+0\.00 CAD\/t/);
  assert.match(markup, /1 capture · 259\.0 ha/);
  assert.match(markup, /Yield N\/A · Price \$167\.31\/t · Basis \+0\.00 CAD\/t/);
  assert.match(markup, /Heuristic watchlist · Signals Mar 29/);
});

test("FieldDetailPanel initialPage='notes' renders the canonical notes subpage", () => {
  const markup = renderWithDarkTheme(
    <FieldDetailPanel {...createBasePanelProps()} initialPage="notes" />,
  );

  assert.match(markup, /Inspection Target/);
  assert.match(markup, /Field Observation/);
  assert.match(markup, /Field Notes \(1\)/);
  assert.match(markup, /Scout moisture pocket on the west edge\./);
});

test("FieldDetailPanel keeps first insight details collapsed by default", () => {
  const markup = renderWithDarkTheme(
    <FieldDetailPanel
      {...createBasePanelProps()}
      summary={{
        ...createBasePanelProps().summary,
        rootMoisture: "31%",
        trend: "-4%",
        fieldState: "Dry",
        confidence: "High",
        dataQuality: {
          label: "Ready",
          tone: "positive",
          summary: "Backed by recent raster and moisture coverage.",
          reasons: [],
        },
      }}
      action={{
        ...createBasePanelProps().action,
        recommendation: "Scout the driest part of the field before the next pass.",
      }}
    />,
  );

  assert.match(markup, /aria-expanded="false"/);
  assert.doesNotMatch(markup, /What this field is telling me/);
  assert.doesNotMatch(markup, /How much I should trust it/);
  assert.doesNotMatch(markup, /What I should look at next/);
});

test("CropsSubPage renders lld, provenance, crop alerts, and footer content", () => {
  const markup = renderWithDarkTheme(
    <CropsSubPage
      ac="#16a34a"
      crop={{
        cropName: "Rye",
        lld: "NW-1-1-1-W1",
        growthSegments: [{ label: "Tillering", active: true }],
        accumulatedGddLabel: "245",
        thresholdStageLabel: "Tillering",
        healthIndex: {
          label: "Healthy",
          value: 0.72,
          fillColor: "#16a34a",
          metrics: [{ label: "Vigor", value: "0.72", valueColor: "#16a34a" }],
        },
        moistureBalance: {
          label: "Balanced",
          value: 0.61,
          fillColor: "#3b82f6",
          metrics: [{ label: "Root Zone", value: "38%", valueColor: "#3b82f6" }],
        },
        provenanceLabel: "Crop Provenance",
        provenanceRows: [{ key: "Provider", value: "Sentinel Hub" }],
        provenanceChips: ["SAR", "OPTICAL"],
        alerts: [{ title: "Frost risk", desc: "Monitor low areas.", iconColor: "#ef4444" }],
        footer: "Crop thresholds are stage-adjusted.",
      } as any}
      summary={{ crop: "Rye", cropStage: "Tillering" } as any}
      mc={createModeData()}
      contextOnlyOptical={false}
      contextTone="#94a3b8"
      radarWetnessModeLabel="Radar Wetness"
      cropSignalSummary="Healthy canopy signal."
      cropMoistureSummary="Balanced profile."
      cropActiveSignalSub="Live field signal."
      cropTrackedContextText={null}
      cropThresholds={[
        { param: "Soil Temp", min: "5", optimal: "8-12", max: "18", optimalColor: "#16a34a", status: "ok" },
      ]}
      cropFieldTiles={[]}
      cropDiseaseRisks={[]}
      focusedZone={null}
      focusedZoneJumpHint={null}
      handleOpenFocusedZone={() => {}}
      contextualNotesTarget={null}
      handleOpenContextNotes={() => {}}
      statusColor={() => "#16a34a"}
    />,
  );

  assert.match(markup, /NW-1-1-1-W1/);
  assert.match(markup, /Crop Provenance/);
  assert.match(markup, /Provider/);
  assert.match(markup, /Sentinel Hub/);
  assert.match(markup, /Active Crop Alerts/);
  assert.match(markup, /Frost risk/);
  assert.match(markup, /Crop thresholds are stage-adjusted\./);
});

test("ReportSubPage renders alerts, findings, tracked zones, and provenance", () => {
  const markup = renderWithDarkTheme(
    <ReportSubPage
      ac="#16a34a"
      report={{
        updatedDate: "Mar 29, 2026",
        cropStage: "Tillering",
        alerts: [],
        findings: [
          {
            id: "finding-1",
            title: "Moisture stress",
            summary: "Root zone declining on the west edge.",
            trackedZoneIds: ["zone-1"],
            severity: "High",
          },
        ],
        zones: [
          {
            id: "zone-1",
            trackingKey: "Zone 1",
            family: "Moisture",
            affectedCellCount: 12,
            lastSeenAt: "Mar 29",
            status: "watch",
            severity: "High",
          },
        ],
        cropParams: [],
        sources: [{ label: "Sentinel-1" }],
        provenanceText: "Derived from SAR capture.",
      } as any}
      summary={{ updatedLabel: "Mar 29, 2026", rootMoisture: "38%" } as any}
      crop={{ thresholdStageLabel: "Tillering" } as any}
      mc={createModeData()}
      contextOnlyOptical={false}
      contextTone="#94a3b8"
      contextToneSoft="rgba(148,163,184,0.12)"
      hoveredAttentionLevel={null}
      reportStatusTitle="Stable field signal"
      reportStatusSub="No field-wide escalation."
      reportReadings={[]}
      reportForecast={[{ day: "Mon", temp: "12C", precip: "20%" }]}
      reportAlerts={[
        {
          iconKey: "temperature",
          severity: "High",
          text: "Temperature swing",
          trackedZoneIds: ["zone-1"],
        },
      ]}
      vegetationChart={null}
      moistureHistoryChart={null}
      temperatureChart={null}
      vegetationRange={{ start: "Start", end: "Latest" }}
      moistureHistoryRange={{ start: "Start", end: "Latest" }}
      temperatureRange={{ start: "Start", end: "Latest" }}
      focusedZone={null}
      focusedZoneJumpHint={null}
      handleOpenFocusedZone={() => {}}
      contextualNotesTarget={null}
      handleOpenContextNotes={() => {}}
      statusColor={() => "#f59e0b"}
    />,
  );

  assert.match(markup, /7-Day Outlook/);
  assert.match(markup, /Temperature swing/);
  assert.match(markup, /Findings/);
  assert.match(markup, /Moisture stress/);
  assert.match(markup, /Tracked Zones/);
  assert.match(markup, /Zone 1/);
  assert.match(markup, /Provenance/);
  assert.match(markup, /Sentinel-1/);
});

test("ReportSubPage renders truthful chart empty-state copy and multi-series labels", () => {
  const markup = renderWithDarkTheme(
    <ReportSubPage
      ac="#f59e0b"
      report={{
        findings: [],
        zones: [],
        alerts: [],
        readings: [],
        cropParams: [],
        sources: [],
        provenanceText: "Derived from recent captures.",
      } as any}
      summary={{ updatedLabel: "Mar 29, 2026", rootMoisture: "38%" } as any}
      crop={{ thresholdStageLabel: "Tillering" } as any}
      mc={createModeData()}
      contextOnlyOptical={false}
      contextTone="#94a3b8"
      contextToneSoft="rgba(148,163,184,0.12)"
      hoveredAttentionLevel={null}
      reportStatusTitle="Stable field signal"
      reportStatusSub="No field-wide escalation."
      reportReadings={[]}
      reportForecast={[{ day: "Mon", temp: "-6/-8", precip: "70%" }]}
      reportAlerts={[]}
      vegetationChart={{
        title: "VEGETATION HISTORY",
        subtitle: "Preseason optical context",
        emptyText: "Only one optical capture is stored so far.",
        series: [
          { label: "NDVI", color: "#16a34a", format: "index", points: [{ label: "Mar 27", value: 0.04 }] },
          { label: "NDRE", color: "#14b8a6", format: "index", points: [{ label: "Mar 27", value: 0 }] },
        ],
      } as any}
      moistureHistoryChart={{
        title: "MOISTURE PROFILE HISTORY",
        subtitle: "Root + surface moisture from raster",
        emptyText: "Only one SAR-backed moisture capture is stored so far.",
        series: [
          { label: "Root", color: "#3b82f6", format: "percent", points: [{ label: "Mar 26", value: 27.6 }] },
          { label: "Surface", color: "#0ea5e9", format: "percent", points: [{ label: "Mar 26", value: 11.0 }] },
          { label: "Radar Wetness", color: "#06b6d4", format: "index", points: [{ label: "Mar 26", value: 0.42 }] },
        ],
      } as any}
      temperatureChart={{
        title: "TEMPERATURE WINDOW",
        subtitle: "Latest observation + next forecast days",
        series: [
          { label: "High", color: "#f97316", format: "temperature", points: [{ label: "Now", value: -6 }, { label: "Tue", value: -3 }] },
          { label: "Low", color: "#94a3b8", format: "temperature", points: [{ label: "Now", value: -8 }, { label: "Tue", value: -5 }] },
        ],
      } as any}
      vegetationRange={{ start: "Mar 27", end: "Latest" }}
      moistureHistoryRange={{ start: "Mar 26", end: "Latest" }}
      temperatureRange={{ start: "Now", end: "Tue" }}
      focusedZone={null}
      focusedZoneJumpHint={null}
      handleOpenFocusedZone={() => {}}
      contextualNotesTarget={null}
      handleOpenContextNotes={() => {}}
      statusColor={() => "#f59e0b"}
    />,
  );

  assert.match(markup, /Only one optical capture is stored so far/);
  assert.match(markup, /Only one SAR-backed moisture capture is stored so far/);
  assert.match(markup, /Radar Wetness 0.42/);
  assert.match(markup, /High -3.0°C/);
  assert.match(markup, /Low -5.0°C/);
  assert.match(markup, />70%<\/span>/);
});

test("LineSpark renders a single-point series without NaN coordinates", () => {
  const markup = renderWithDarkTheme(<LineSpark data={[52]} color="#16a34a" height={48} />);

  assert.doesNotMatch(markup, /NaN/);
  assert.match(markup, /100,44/);
});

test("MultiLineSpark renders multi-series data without NaN coordinates", () => {
  const markup = renderWithDarkTheme(
    <MultiLineSpark
      series={[
        { data: [12, 18, 15], color: "#16a34a" },
        { data: [9, 11, 10], color: "#0ea5e9" },
      ]}
      height={48}
    />,
  );

  assert.doesNotMatch(markup, /NaN/);
  assert.match(markup, /polyline/);
});
