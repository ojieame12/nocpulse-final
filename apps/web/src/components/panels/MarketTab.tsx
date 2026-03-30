'use client';

import { Info } from 'lucide-react';
import { FieldMarketScenarioForm } from "./fieldMarketScenarioForm";

export interface MarketBarDatum {
  height: number;
  color: string;
  label?: string;
  valueLabel?: string;
}

export interface MarketRevenueRow {
  label: string;
  value: string;
}

export interface MarketContextTile {
  label: string;
  value: string;
  valueColor: string;
  sub: string;
  bg: string;
}

export interface FieldMarketProps {
  fieldId: string;
  cropSymbol: string | null;
  availabilityState:
    | "ready"
    | "unsupported-crop"
    | "unsupported-feed"
    | "quote-unavailable"
    | "yield-unavailable"
    | "quote-and-yield-unavailable";
  availabilityReasonLabel?: string | null;
  valuationState:
    | "reference-only"
    | "provisional"
    | "scenario"
    | "unsupported";
  referenceStatusLabel: string;
  valuationStatusLabel: string;
  missingInputs: readonly ("quote" | "yield")[];
  primaryActionLabel: string;
  primaryActionHint: string;
  referenceRows: readonly MarketRevenueRow[];
  provisionalRevenueLabel: string;
  provisionalRevenueSubLabel: string;
  seasonYear: number | null;
  closePriceCadPerTonne: number | null;
  basisCadPerTonne: number | null;
  yieldTonnesPerHa: number | null;
  basisAssumptionCadPerTonne: number | null;
  basisAssumptionCapturedAtLabel?: string | null;
  basisAssumptionSourceLabel?: string | null;
  basisAssumptionNoteText?: string | null;
  yieldAssumptionCapturedAtLabel?: string | null;
  yieldAssumptionSourceLabel?: string | null;
  yieldAssumptionNoteText?: string | null;
  priceSubmitUrl: string | null;
  basisSubmitUrl: string;
  yieldSubmitUrl: string;
  name: string;
  lld: string;
  sectionLabel: string;
  capturedAtLabel: string;
  contextLabel: string;
  priceLabel: string;
  priceUnitLabel: string;
  priceDeltaLabel?: string | null;
  priceBars: readonly MarketBarDatum[];
  rangeLowLabel: string;
  rangeHighLabel: string;
  quoteStatusLabel?: string | null;
  estimatedGrossLabel: string;
  estimatedGrossSubLabel: string;
  revenueRows: readonly MarketRevenueRow[];
  grossRevenueLabel: string;
  revenueNote: string;
  contextTiles: readonly MarketContextTile[];
  disclaimerText: string;
  footerText: string;
}

interface MarketTabProps {
  field?: FieldMarketProps;
}

export function MarketTab({ field }: MarketTabProps) {
  if (!field) {
    return (
      <div className="panel__body" style={{ paddingBottom: 16 }}>
        <div className="panel__title-section">
          <h2 className="panel__title-main">No market context</h2>
          <span className="panel__title-sub">
            No live quote or field scenario is available for this field right now.
          </span>
        </div>
      </div>
    );
  }

  const hasQuote = field.closePriceCadPerTonne != null;
  const hasGrossRevenue = field.grossRevenueLabel !== "—";
  const historyRow = field.referenceRows.find((row) => row.label === "Stored History") ?? null;
  const areaRow = field.referenceRows.find((row) => row.label === "Field Area") ?? null;
  const yieldRow = field.revenueRows.find((row) => row.label === "Expected Yield") ?? null;
  const priceAtHarvestRow = field.revenueRows.find((row) => row.label === "Price at Harvest") ?? null;
  const basisRow = field.revenueRows.find((row) => row.label === "Local Basis") ?? null;
  const feedStatusLabel = resolveFeedStatusLabel(field, hasQuote);
  const historyStatusLabel =
    historyRow?.value === "No stored captures" ? "0 captures" : historyRow?.value ?? "N/A";
  const yieldStatusLabel =
    yieldRow?.value === "Add yield" || yieldRow?.value == null || yieldRow?.value === "—"
      ? "N/A"
      : yieldRow.value;
  const quoteStatusLabel =
    priceAtHarvestRow?.value === "Add quote" ||
    priceAtHarvestRow?.value === "Needs yield" ||
    priceAtHarvestRow?.value == null ||
    priceAtHarvestRow?.value === "—"
      ? "N/A"
      : priceAtHarvestRow.value;
  const basisStatusLabel =
    basisRow?.value === "Uses feed basis"
      ? "Feed"
      : basisRow?.value === "Not set" || basisRow?.value == null || basisRow?.value === "—"
        ? "N/A"
        : basisRow.value;
  const compactTopSummary = [feedStatusLabel, historyStatusLabel, areaRow?.value]
    .filter(Boolean)
    .join(" · ");
  const compactRevenueSummary = buildMetricSummary([
    ['Yield', yieldStatusLabel],
    ['Price', quoteStatusLabel],
    ['Basis', basisStatusLabel],
  ]);
  const assumptionMetaRows = [
    ['Season', field.seasonYear != null ? String(field.seasonYear) : 'N/A'],
    ['Next', field.primaryActionLabel ?? 'N/A'],
    ['Yield Source', field.yieldAssumptionSourceLabel ?? 'N/A'],
    ['Yield Saved', field.yieldAssumptionCapturedAtLabel ?? 'N/A'],
    ['Basis Source', field.basisAssumptionSourceLabel ?? 'N/A'],
    ['Basis Saved', field.basisAssumptionCapturedAtLabel ?? 'N/A'],
  ] as const;
  const yieldNoteText = compactHint(field.yieldAssumptionNoteText);
  const basisNoteText = compactHint(field.basisAssumptionNoteText);
  const showYieldQuickForm = field.availabilityState === "yield-unavailable" && hasQuote;
  const collapseRevenueRows = showYieldQuickForm && !hasGrossRevenue;

  return (
    <div className="panel__body" style={{ paddingBottom: 16 }}>
      <div className="panel__title-section">
        <h2 className="panel__title-main">{field.name}</h2>
        <span className="panel__title-sub">{field.lld} &middot; Legal Land Description</span>
      </div>

      <div className="market__section-card market__price-card">
        {/* Header: label + date */}
        <div className="market__section-row">
          <span className="panel__section-label">{field.sectionLabel}</span>
          <span className="market__date-chip">{field.capturedAtLabel}</span>
        </div>

        {/* Hero price block */}
        <div className="market__price-hero">
          {hasQuote ? (
            <>
              <div className="market__price-amount">
                <span className="market__price-currency">$</span>
                <span className="market__price-value">{field.priceLabel.replace(/^\$/, '')}</span>
              </div>
              <span className="market__price-unit">{field.priceUnitLabel}</span>
            </>
          ) : (
            <span className="market__price-value market__price-value--symbol">
              {field.cropSymbol ?? field.referenceStatusLabel}
            </span>
          )}
          {field.priceDeltaLabel ? (
            <span className="market__price-delta">{field.priceDeltaLabel}</span>
          ) : null}
        </div>

        {/* Inline status chips */}
        <div className="market__status-chips">
          <span className={`market__chip${hasQuote ? ' market__chip--active' : ''}`}>
            {field.referenceStatusLabel}
          </span>
          {field.missingInputs.includes("yield") ? (
            <span className="market__chip market__chip--muted">Yield N/A</span>
          ) : null}
        </div>

        {/* Compact metadata strip */}
        <div className="market__meta-strip">
          {[
            field.cropSymbol ? { label: "Symbol", value: field.cropSymbol } : null,
            { label: "Feed", value: feedStatusLabel },
            { label: "History", value: historyStatusLabel },
            areaRow ? { label: "Area", value: areaRow.value } : null,
          ].filter(Boolean).map((item) => (
            <div key={item!.label} className="market__meta-item">
              <span className="market__meta-label">{item!.label}</span>
              <span className="market__meta-value">{item!.value}</span>
            </div>
          ))}
        </div>

        {/* Bar chart (when history available) */}
        {field.priceBars.length > 0 ? (
          <>
            <div className="market__bar-chart">
              {field.priceBars.map((bar, index) => (
                <div
                  key={index}
                  className="market__bar"
                  title={bar.valueLabel ? `${bar.label ?? `Point ${index + 1}`}: ${bar.valueLabel}` : bar.label}
                  style={{ height: bar.height, background: bar.color }}
                />
              ))}
            </div>
            <div className="market__price-range">
              <span className="market__price-lo">{field.rangeLowLabel}</span>
              <span className="market__price-hi">{field.rangeHighLabel}</span>
            </div>
          </>
        ) : null}
      </div>

      <div className="market__section-card">
        <span className="panel__section-label">REVENUE SCENARIO</span>

        <div className="market__revenue-hero">
          <span className="market__revenue-value">
            {hasGrossRevenue
              ? field.estimatedGrossLabel
              : field.provisionalRevenueLabel !== "—"
                ? field.provisionalRevenueLabel
                : "N/A"}
          </span>
          {collapseRevenueRows ? (
            <details className="market__revenue-details market__revenue-details--inline">
              <summary className="market__revenue-summary market__revenue-summary--inline">
                <span className="market__revenue-label">
                  {compactRevenueSummary ||
                    (hasGrossRevenue ? field.estimatedGrossSubLabel : "Yield N/A · Price N/A · Basis N/A")}
                </span>
                <span className="market__revenue-summary-meta">Inputs</span>
              </summary>
              <div className="market__revenue-grid market__revenue-grid--detail">
                {field.revenueRows.map((row) => (
                  <div key={row.label} className="market__revenue-row">
                    <span className="market__revenue-row-label">{row.label}</span>
                    <span className="market__revenue-row-value">{row.value}</span>
                  </div>
                ))}
                <div className="market__revenue-row market__revenue-row--total">
                  <span className="market__revenue-row-label market__revenue-row-label--bold">Gross Revenue</span>
                  <span className="market__revenue-row-value market__revenue-row-value--green">
                    {field.grossRevenueLabel}
                  </span>
                </div>
              </div>
            </details>
          ) : (
            <span className="market__revenue-label">
              {compactRevenueSummary ||
                (hasGrossRevenue ? field.estimatedGrossSubLabel : "Yield N/A · Price N/A · Basis N/A")}
            </span>
          )}
        </div>
        {showYieldQuickForm ? (
          <div className="market__yield-inline">
            <div className="market__yield-inline-header">
              <span className="panel__section-label">ADD FIELD YIELD</span>
              <span className="market__yield-inline-meta">{field.priceLabel} {field.priceUnitLabel}</span>
            </div>
            <FieldMarketScenarioForm field={field} mode="yield-only" submitLabel="Save Yield" />
          </div>
        ) : null}

        {!collapseRevenueRows ? (
          <div className="market__revenue-grid">
            {field.revenueRows.map((row) => (
              <div key={row.label} className="market__revenue-row">
                <span className="market__revenue-row-label">{row.label}</span>
                <span className="market__revenue-row-value">{row.value}</span>
              </div>
            ))}
            <div className="market__revenue-row market__revenue-row--total">
              <span className="market__revenue-row-label market__revenue-row-label--bold">Gross Revenue</span>
              <span className="market__revenue-row-value market__revenue-row-value--green">
                {field.grossRevenueLabel}
              </span>
            </div>
          </div>
        ) : null}

        {hasGrossRevenue ? (
          <span className="market__revenue-note">{compactHint(field.revenueNote) ?? field.revenueNote}</span>
        ) : null}
      </div>

      <div className={`market__section-card ${showYieldQuickForm ? 'market__section-card--subtle' : ''}`}>
        <details
          className="market__overrides-details"
          {...(!showYieldQuickForm ? { open: true } : {})}
        >
          <summary className="market__overrides-summary">
            <span className="panel__section-label">{showYieldQuickForm ? 'MORE OVERRIDES' : 'OPTIONAL OVERRIDES'}</span>
            <span className="market__section-meta market__overrides-meta">
              {field.cropSymbol ?? 'Crop unset'}
              {field.seasonYear != null ? ` · ${field.seasonYear}` : ''}
            </span>
          </summary>

          <div className="market__overrides-body">
            <span className="market__revenue-note">
              {showYieldQuickForm
                ? 'Quote and basis adjustments stay optional.'
                : 'Optional quote, basis, and yield overrides.'}
            </span>

            <FieldMarketScenarioForm field={field} submitLabel="Save Overrides" />
            <div className="market__revenue-grid market__revenue-grid--detail">
              {assumptionMetaRows.map(([label, value]) => (
                <div key={label} className="market__revenue-row">
                  <span className="market__revenue-row-label">{label}</span>
                  <span className="market__revenue-row-value">{value}</span>
                </div>
              ))}
            </div>
            {field.primaryActionHint ? (
              <span className="market__revenue-note">
                {compactHint(field.primaryActionHint) ?? field.primaryActionHint}
              </span>
            ) : null}
            {yieldNoteText ? (
              <span className="market__revenue-note">{`Yield note: ${yieldNoteText}`}</span>
            ) : null}
            {basisNoteText ? (
              <span className="market__revenue-note">{`Basis note: ${basisNoteText}`}</span>
            ) : null}
          </div>
        </details>
      </div>

      <div className="market__section-card">
        <div className="market__section-row">
          <span className="panel__section-label">FIELD CONTEXT</span>
          <span className="market__section-meta">{field.contextLabel}</span>
        </div>

        <div className="market__precip-tiles">
          {field.contextTiles.map((tile) => (
            <div
              key={tile.label}
              className="market__precip-tile"
              style={{ background: tile.bg }}
            >
              <span className="market__precip-tile-label">{tile.label}</span>
              <span className="market__precip-tile-value" style={{ color: tile.valueColor }}>
                {tile.value}
              </span>
              <span className="market__precip-tile-sub">{tile.sub}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="market__disclaimer">
        <Info size={14} style={{ color: '#f59e0b', flexShrink: 0, marginTop: 1 }} />
        <span className="market__disclaimer-text">{field.disclaimerText}</span>
      </div>

      <div className="market__footer">
        <span className="market__footer-text">{field.footerText}</span>
      </div>
    </div>
  );
}

function compactHint(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  return value
    .replace("Add a manual quote plus a yield assumption to unlock revenue for this field.", "Add quote + yield to unlock field revenue.")
    .replace("No live quote symbol is configured for", "No feed symbol for")
    .replace("No live ", "No ")
    .replace(" quote is stored yet, and no field yield assumption is saved for this field.", " quote and yield are both missing.")
    .replace(" quote is stored yet.", " quote stored yet.")
    .replace(" feed is connected yet.", " feed connected.")
    .replace("Revenue will stay provisional until a quote arrives or you add a manual quote.", "Revenue stays provisional until a quote is added.")
    .replace("Use this crop in field revenue planning.", "Use this crop in field planning.");
}

function resolveFeedStatusLabel(field: FieldMarketProps, hasQuote: boolean) {
  if (!field.cropSymbol) {
    return "N/A";
  }

  if (field.availabilityState === "unsupported-feed") {
    return "Unsupported";
  }

  if (hasQuote) {
    return "Stored";
  }

  if (field.referenceStatusLabel.includes("feed connected")) {
    return "Offline";
  }

  if (field.referenceStatusLabel.includes("quote yet")) {
    return "Pending";
  }

  return "N/A";
}

function buildMetricSummary(rows: readonly [string, string | null | undefined][]) {
  return rows.map(([label, value]) => `${label} ${value ?? "N/A"}`).join(" · ");
}
