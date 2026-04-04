import test from "node:test";
import assert from "node:assert/strict";

import {
  canManagePreviewFieldMutations,
  mergeDeferredFieldPanels,
  patchFieldViewModelCrop,
  resolvePreviewCanonicalDetailInitialPage,
} from "./PreviewShell";

test("resolvePreviewCanonicalDetailInitialPage routes action to canonical actions subpage", () => {
  assert.equal(resolvePreviewCanonicalDetailInitialPage("action"), "actions");
});

test("resolvePreviewCanonicalDetailInitialPage routes notes to canonical notes subpage", () => {
  assert.equal(resolvePreviewCanonicalDetailInitialPage("notes"), "notes");
});

test("resolvePreviewCanonicalDetailInitialPage routes crops to canonical crops subpage", () => {
  assert.equal(resolvePreviewCanonicalDetailInitialPage("crops"), "crops");
});

test("resolvePreviewCanonicalDetailInitialPage leaves non-canonical panel views alone", () => {
  assert.equal(resolvePreviewCanonicalDetailInitialPage("detail"), null);
  assert.equal(resolvePreviewCanonicalDetailInitialPage("alerts"), null);
  assert.equal(resolvePreviewCanonicalDetailInitialPage("zone"), null);
});

test("canManagePreviewFieldMutations allows owners and managers only", () => {
  assert.equal(
    canManagePreviewFieldMutations(
      {
        displayName: "Owner",
        email: "owner@example.com",
        initials: "OW",
        workspaceRole: "owner",
        workspaceRoleLabel: "Owner",
        workspaceName: "Workspace",
      },
      false,
    ),
    true,
  );
  assert.equal(
    canManagePreviewFieldMutations(
      {
        displayName: "Viewer",
        email: "viewer@example.com",
        initials: "VW",
        workspaceRole: "viewer",
        workspaceRoleLabel: "Viewer",
        workspaceName: "Workspace",
      },
      false,
    ),
    false,
  );
  assert.equal(canManagePreviewFieldMutations(null, false), false);
  assert.equal(
    canManagePreviewFieldMutations(
      {
        displayName: "Manager",
        email: "manager@example.com",
        initials: "MG",
        workspaceRole: "manager",
        workspaceRoleLabel: "Manager",
        workspaceName: "Workspace",
      },
      true,
    ),
    false,
  );
});

test("patchFieldViewModelCrop clears stale market context for an unsupported crop", () => {
  const next = patchFieldViewModelCrop(
    {
      workspaceId: "workspace-1",
      fieldId: "field-1",
      fieldName: "Bricks",
      areaHaLabel: "388.5 ha",
      cropContext: {
        seedingDate: null,
        cropType: "Rye",
        growthStage: "tillering",
        growthStageSource: "manual",
      },
      mapPreview: {} as never,
      sidebarFields: [],
      summary: {
        name: "Bricks",
        lld: "",
        crop: "Rye",
        cropStage: "Tillering",
        contextLabel: "Field overview",
        conditionsMeta: "Field average",
        updatedLabel: "UPDATED",
        moisture: 0,
        moistureContextOnly: false,
        cloudCover: "—",
        ndvi: 0,
        ndre: 0,
        temperature: "—",
        moistureSource: "—",
        moistureConfidence: "—",
        frostRisk: null,
        daysSinceRain: null,
        rainStateLabel: "—",
        rainStateSub: "—",
        temperatureTrend: null,
        statusLabel: "Ready",
        confidenceLabel: "High",
        dataSources: [],
        alerts: [],
        dataQuality: null,
      },
      reportPanel: null,
      actionPanel: null,
      notesPanel: null,
      marketPanel: {
        fieldId: "field-1",
        cropSymbol: "RYE",
        availabilityState: "ready",
        availabilityReasonLabel: null,
        valuationState: "scenario",
        feedStatusLabel: "Supported",
        referenceStatusLabel: "Fresh",
        quoteFreshnessState: "fresh",
        quoteFreshnessLabel: "Fresh",
        quoteAgeLabel: "2h old",
        historyStatusLabel: "3 captures",
        yieldStatusLabel: "4.00 t/ha",
        harvestPriceStatusLabel: "$167.31/t",
        basisStatusLabel: "+0.00 CAD/t",
        topSummaryLabel: "Supported · 3 captures · 388.5 ha",
        revenueSummaryLabel: "Yield 4.00 t/ha · Price $167.31/t · Basis +0.00 CAD/t",
        valuationStatusLabel: "Scenario",
        missingInputs: [],
        primaryActionLabel: "Refine field scenario",
        primaryActionHint: "Stored inputs active.",
        primaryActionHintCompact: "Stored inputs active.",
        referenceRows: [],
        provisionalRevenueLabel: "$167.31/t",
        provisionalRevenueSubLabel: "Scenario",
        seasonYear: 2026,
        closePriceCadPerTonne: 167.31,
        basisCadPerTonne: 0,
        yieldTonnesPerHa: 4,
        basisAssumptionCadPerTonne: 0,
        basisAssumptionCapturedAtLabel: null,
        basisAssumptionSourceLabel: null,
        basisAssumptionNoteText: null,
        yieldAssumptionCapturedAtLabel: null,
        yieldAssumptionSourceLabel: null,
        yieldAssumptionNoteText: null,
        priceSubmitUrl: "/api/market/prices",
        basisSubmitUrl: "/api/fields/field-1/basis-assumption",
        yieldSubmitUrl: "/api/fields/field-1/yield-assumption",
        name: "Bricks",
        lld: "",
        sectionLabel: "RYE MARKET",
        capturedAtLabel: "Apr 4, 2026",
        contextLabel: "Latest stored quote",
        priceLabel: "$167.31",
        priceUnitLabel: "/tonne CAD",
        priceDeltaLabel: null,
        priceBars: [],
        rangeLowLabel: "Recent low: —",
        rangeHighLabel: "Recent high: —",
        quoteStatusLabel: "Fresh",
        estimatedGrossLabel: "$259.0k",
        estimatedGrossSubLabel: "estimated gross revenue",
        revenueRows: [],
        grossRevenueLabel: "$259.0k",
        revenueNote: "Stored yield and quote.",
        revenueNoteCompact: "Stored yield and quote.",
        contextTiles: [],
        disclaimerText: "Stored quote.",
        footerText: "Stored quote.",
      },
      cropPanel: {
        cropName: "Rye",
        thresholdStageLabel: "Tillering stage",
      } as never,
      alertsPanel: null,
      activityPanel: null,
      cellInspector: null,
    },
    { cropName: "Faba bean" },
  );

  assert.equal(next.summary?.crop, "Faba bean");
  assert.equal(next.marketPanel?.sectionLabel, "FABA BEAN MARKET");
  assert.equal(next.marketPanel?.cropSymbol, null);
  assert.equal(next.marketPanel?.availabilityState, "unsupported-crop");
  assert.equal(next.marketPanel?.closePriceCadPerTonne, null);
  assert.equal(next.marketPanel?.priceLabel, "—");
});

test("mergeDeferredFieldPanels does not overwrite an existing market panel", () => {
  const current = {
    workspaceId: "workspace-1",
    fieldId: "field-1",
    fieldName: "Bricks",
    areaHaLabel: "388.5 ha",
    cropContext: null,
    mapPreview: {} as never,
    sidebarFields: [],
    summary: null,
    reportPanel: null,
    actionPanel: null,
    notesPanel: null,
    marketPanel: {
      sectionLabel: "FABA BEAN MARKET",
      cropSymbol: null,
    },
    cropPanel: null,
    alertsPanel: null,
    activityPanel: null,
    cellInspector: null,
  } as never;

  const merged = mergeDeferredFieldPanels(
    current,
    {
      marketPanel: {
        sectionLabel: "RYE MARKET",
        cropSymbol: "RYE",
      },
    } as never,
    "field-1",
  );

  assert.equal(merged.marketPanel?.sectionLabel, "FABA BEAN MARKET");
  assert.equal(merged.marketPanel?.cropSymbol, null);
});

test("mergeDeferredFieldPanels ignores streamed panels for a different field", () => {
  const current = {
    workspaceId: "workspace-1",
    fieldId: "field-2",
    fieldName: "Bricks",
    areaHaLabel: "388.5 ha",
    cropContext: null,
    mapPreview: {} as never,
    sidebarFields: [],
    summary: null,
    reportPanel: null,
    actionPanel: null,
    notesPanel: null,
    marketPanel: null,
    cropPanel: null,
    alertsPanel: null,
    activityPanel: null,
    cellInspector: null,
  } as never;

  const merged = mergeDeferredFieldPanels(
    current,
    {
      marketPanel: {
        sectionLabel: "RYE MARKET",
        cropSymbol: "RYE",
      },
    } as never,
    "field-1",
  );

  assert.equal(merged, current);
});
