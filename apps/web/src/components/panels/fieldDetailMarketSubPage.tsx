/**
 * Market subpage for FieldDetailPanel. Extracted from SubPageView — pure render, no local state.
 */

import type { FieldMarketProps } from "./MarketTab";
import type { FieldNotesInspectionTarget } from "./NotesTab";
import { Card, Lbl, LblM, Big, Sub, Mono } from "./fieldDetailCardPrimitives";
import { FieldMarketScenarioForm } from "./fieldMarketScenarioForm";

export function MarketSubPage({
  market,
  ac,
  marketContextTiles,
  marketHistoryEmptyText,
  marketAgronomicContextText,
  marketScenarioQualifier,
  focusedZone,
  focusedZoneJumpHint,
  handleOpenFocusedZone,
  contextualNotesTarget,
  handleOpenContextNotes,
  statusColor,
  onScenarioSaved,
}: {
  market: FieldMarketProps | null;
  ac: string;
  marketContextTiles: readonly {
    label: string;
    value: string;
    valueColor: string;
    sub: string;
  }[];
  marketHistoryEmptyText: string;
  marketAgronomicContextText: string | null;
  marketScenarioQualifier: string | null;
  focusedZone: {
    id: string;
    trackingKey: string;
    status: string;
    affectedCellCount: number;
  } | null;
  focusedZoneJumpHint: string | null;
  handleOpenFocusedZone: () => void;
  contextualNotesTarget: FieldNotesInspectionTarget | null;
  handleOpenContextNotes: () => void;
  statusColor: (status: string) => string;
  onScenarioSaved?: (() => void | Promise<void>) | null;
}) {
  const hasQuote = market?.closePriceCadPerTonne != null;
  const hasHistory = (market?.priceBars.length ?? 0) > 0;
  const hasGrossRevenue = market?.grossRevenueLabel != null && market.grossRevenueLabel !== "—";
  const symbolRow = findMarketRow(market?.referenceRows, "Market Symbol");
  const historyRow = findMarketRow(market?.referenceRows, "Stored History");
  const fieldAreaRow = findMarketRow(market?.referenceRows, "Field Area");
  const yieldRow = findMarketRow(market?.revenueRows, "Expected Yield");
  const priceAtHarvestRow = findMarketRow(market?.revenueRows, "Price at Harvest");
  const basisRow = findMarketRow(market?.revenueRows, "Local Basis");
  const feedStatusLabel = resolveFeedStatusLabel(market, hasQuote);
  const historyStatusLabel = resolveHistoryStatusLabel(historyRow?.value);
  const yieldStatusLabel = resolveYieldStatusLabel(yieldRow?.value);
  const quoteStatusLabel = resolveQuoteStatusLabel(priceAtHarvestRow?.value);
  const basisStatusLabel = resolveBasisStatusLabel(basisRow?.value);
  const missingInputsLabel =
    market?.missingInputs.length ? market.missingInputs.map((value) => value.toUpperCase()).join(" + ") : null;
  const topHeroValue =
    hasQuote
      ? market?.priceLabel ?? "—"
      : symbolRow?.value ?? market?.cropSymbol ?? "—";
  const topHeroUnit = hasQuote ? market?.priceUnitLabel ?? "" : "";
  const compactTopSummary = [feedStatusLabel, historyStatusLabel, fieldAreaRow?.value]
    .filter(Boolean)
    .join(" · ");
  const topHeroSub = hasQuote
    ? compactTopSummary || market?.priceUnitLabel || ""
    : compactTopSummary || marketHistoryEmptyText;
  const topBadgeLabel = hasQuote
    ? market?.priceDeltaLabel ?? market?.quoteFreshnessLabel ?? market?.capturedAtLabel ?? "N/A"
    : market?.quoteFreshnessLabel ?? "N/A";
  const topBadgeStyle =
    market?.quoteFreshnessState === "fresh"
      ? { background: "rgba(22,163,74,0.12)", color: "#16a34a" }
      : market?.quoteFreshnessState === "stale"
        ? { background: "rgba(245,158,11,0.12)", color: "#b45309" }
        : market?.quoteFreshnessState === "unsupported"
          ? { background: "#f8fafc", color: "#475569" }
          : { background: "rgba(245,158,11,0.12)", color: "#b45309" };
  const statusChips = [
    market?.valuationState
      ? {
          value: resolveValuationStateLabel(market.valuationState),
          style:
            market.valuationState === "scenario"
              ? { background: "rgba(22,163,74,0.12)", color: "#166534" }
              : market.valuationState === "provisional"
                ? { background: "rgba(59,130,246,0.12)", color: "#1d4ed8" }
                : market.valuationState === "unsupported"
                  ? { background: "rgba(148,163,184,0.12)", color: "#475569" }
                  : { background: "rgba(245,158,11,0.12)", color: "#b45309" },
        }
      : null,
    missingInputsLabel
      ? {
          value: `${missingInputsLabel} N/A`,
          style: { background: "#f8fafc", color: "#475569" },
        }
      : null,
  ].filter(
    (
      value,
    ): value is {
      value: string;
      style: { background: string; color: string };
    } => value != null,
  );
  const revenueHeroValue =
    hasGrossRevenue
      ? market?.grossRevenueLabel ?? "—"
      : market?.provisionalRevenueLabel && market.provisionalRevenueLabel !== "—"
        ? market.provisionalRevenueLabel
        : "N/A";
  const compactRevenueSummary = [yieldRow?.value, priceAtHarvestRow?.value, basisRow?.value]
    .filter(Boolean)
    .join(" · ");
  const revenueHeroSub =
    hasGrossRevenue
      ? compactRevenueSummary ||
        marketScenarioQualifier ||
        market?.estimatedGrossSubLabel ||
        "Gross revenue estimate"
      : buildMetricSummary([
          ["Yield", yieldStatusLabel],
          ["Price", quoteStatusLabel],
          ["Basis", basisStatusLabel],
        ]) || "Yield N/A · Price N/A · Basis N/A";
  const scenarioIntroText = "Optional quote, basis, and yield overrides.";
  const historyEmptySummary =
    hasQuote
      ? historyStatusLabel
      : market?.cropSymbol
        ? historyStatusLabel
        : "N/A";
  const showYieldQuickForm = market?.availabilityState === "yield-unavailable" && hasQuote;
  const revenueFootnote =
    hasGrossRevenue
      ? marketScenarioQualifier ?? compactRevenueSummary ?? market?.revenueNote ?? "Revenue estimate available."
      : null;
  const collapseRevenueRows = showYieldQuickForm && !hasGrossRevenue;
  const revenueRows = (market?.revenueRows ?? []).map((row) => ({
    ...row,
    value:
      row.value !== "—"
        ? row.value
        : row.label === "Expected Yield"
          ? "N/A"
          : row.label === "Price at Harvest"
            ? "N/A"
            : row.label === "Local Basis"
              ? hasQuote
                ? "Feed basis"
                : "N/A"
              : row.value,
  }));
  const marketMetaRows = [
    { label: "Season", value: market?.seasonYear != null ? String(market.seasonYear) : "N/A" },
    { label: "Next", value: market?.primaryActionLabel ?? "N/A" },
    { label: "Yield Source", value: market?.yieldAssumptionSourceLabel ?? "N/A" },
    { label: "Yield Saved", value: market?.yieldAssumptionCapturedAtLabel ?? "N/A" },
    { label: "Basis Source", value: market?.basisAssumptionSourceLabel ?? "N/A" },
    { label: "Basis Saved", value: market?.basisAssumptionCapturedAtLabel ?? "N/A" },
  ];
  const yieldNoteText = compactHint(market?.yieldAssumptionNoteText ?? null);
  const basisNoteText = compactHint(market?.basisAssumptionNoteText ?? null);

  return (
    <>
      <Card span={-1}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <LblM>{market?.sectionLabel ?? "Market"}</LblM>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 6 }}>
              <Big size={hasQuote ? 28 : 20}>{topHeroUnit ? `${topHeroValue} ${topHeroUnit}` : topHeroValue}</Big>
            </div>
            <div style={{ marginTop: 4 }}>
              <Sub>{topHeroSub}</Sub>
            </div>
          </div>
          <span
            className="fdp-mono"
            style={{
              fontSize: 11,
              fontWeight: 700,
              padding: "3px 10px",
              borderRadius: 999,
              ...topBadgeStyle,
            }}
          >
            {topBadgeLabel}
          </span>
        </div>
        {statusChips.length > 0 ? (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              marginTop: 10,
            }}
          >
            {statusChips.map((chip) => (
              <div
                key={chip.value}
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "6px 9px",
                  borderRadius: 10,
                  ...chip.style,
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: 11,
                    fontWeight: 700,
                    color: chip.style.color,
                  }}
                >
                  {chip.value}
                </span>
              </div>
            ))}
          </div>
        ) : null}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: 10,
            marginTop: 10,
          }}
        >
          {[
            { label: "Market Symbol", value: symbolRow?.value ?? market?.cropSymbol ?? "—" },
            { label: "Feed", value: feedStatusLabel },
            { label: "Stored History", value: historyStatusLabel },
            { label: "Field Area", value: fieldAreaRow?.value ?? "—" },
          ].map((row) => (
            <div key={row.label}>
              <span style={{ fontFamily: "var(--font-body)", fontSize: 9, color: "var(--text-muted)" }}>
                {row.label}
              </span>
              <div>
                <Mono>{row.value}</Mono>
              </div>
            </div>
          ))}
        </div>
      </Card>
      <Card span={-1}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Lbl color={ac}>{market?.estimatedGrossLabel ?? "Revenue Scenario"}</Lbl>
          <span style={{ fontFamily: "var(--font-body)", fontSize: 10, color: "var(--text-muted)", fontStyle: "italic" }}>
            {hasGrossRevenue ? "Estimated" : "N/A"}
          </span>
        </div>
        <div style={{ marginTop: 2 }}>
          <Big size={26}>{revenueHeroValue}</Big>
          {collapseRevenueRows ? (
            <details className="market__revenue-details market__revenue-details--inline">
              <summary className="market__revenue-summary market__revenue-summary--inline">
                <Sub>{revenueHeroSub}</Sub>
                <span className="fdp-mono market__revenue-summary-meta">Inputs</span>
              </summary>
              <div
                className="market__revenue-grid market__revenue-grid--detail"
                style={{ borderTop: "1px solid var(--border-light)", paddingTop: 10 }}
              >
                {revenueRows.map((r, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between" }}>
                    <Sub>{r.label}</Sub>
                    <Mono>{r.value}</Mono>
                  </div>
                ))}
              </div>
            </details>
          ) : (
            <div>
              <Sub>{revenueHeroSub}</Sub>
            </div>
          )}
        </div>
        {showYieldQuickForm && market ? (
          <div className="market__yield-inline">
            <div className="market__yield-inline-header">
              <LblM>Add Field Yield</LblM>
              <span className="fdp-mono market__yield-inline-meta">
                {market.priceLabel} {market.priceUnitLabel}
              </span>
            </div>
            <FieldMarketScenarioForm
              field={market}
              mode="yield-only"
              submitLabel="Save Yield"
              onScenarioSaved={onScenarioSaved}
            />
          </div>
        ) : null}
        {!collapseRevenueRows ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, borderTop: "1px solid var(--border-light)", paddingTop: 10 }}>
            {revenueRows.map((r, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between" }}>
                <Sub>{r.label}</Sub>
                <Mono>{r.value}</Mono>
              </div>
            ))}
          </div>
        ) : null}
        {revenueFootnote ? <Sub>{compactHint(revenueFootnote)}</Sub> : null}
      </Card>
      <Card
        span={-1}
        accent={showYieldQuickForm ? undefined : ac}
        className={showYieldQuickForm ? "market__overrides-card market__overrides-card--subtle" : "market__overrides-card"}
      >
        <details
          className="market__overrides-details"
          {...(!showYieldQuickForm ? { open: true } : {})}
        >
          <summary className="market__overrides-summary">
            {showYieldQuickForm ? <LblM>More Overrides</LblM> : <Lbl color={ac}>Optional Overrides</Lbl>}
            <span
              className="fdp-mono market__overrides-meta"
              style={{ color: showYieldQuickForm ? "var(--text-secondary)" : ac }}
            >
              {market?.cropSymbol ?? "Custom crop"}
              {market?.seasonYear != null ? ` · ${market.seasonYear}` : ""}
            </span>
          </summary>
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
            <Sub>
              {showYieldQuickForm
                ? "Quote and basis adjustments stay optional."
                : scenarioIntroText}
            </Sub>
            {market ? (
              <FieldMarketScenarioForm
                field={market}
                submitLabel="Save Overrides"
                onScenarioSaved={onScenarioSaved}
              />
            ) : (
              <Sub>Market context is unavailable for this field right now.</Sub>
            )}
            {market ? (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  gap: 8,
                  paddingTop: 2,
                }}
              >
                {marketMetaRows.map((row) => (
                  <div key={row.label}>
                    <span style={{ fontFamily: "var(--font-body)", fontSize: 9, color: "var(--text-muted)" }}>
                      {row.label}
                    </span>
                    <div>
                      <Mono>{row.value}</Mono>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
            {market?.primaryActionHint ? <Sub>{compactHint(market.primaryActionHint) ?? market.primaryActionHint}</Sub> : null}
            {yieldNoteText ? <Sub>{`Yield note: ${yieldNoteText}`}</Sub> : null}
            {basisNoteText ? <Sub>{`Basis note: ${basisNoteText}`}</Sub> : null}
          </div>
        </details>
      </Card>
      <Card span={-1}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <LblM>{market?.contextLabel ?? "Price movement"}</LblM>
          <span className="fdp-mono" style={{ fontSize: 10, color: "var(--text-secondary)" }}>
            {market?.capturedAtLabel ?? "No capture"}
          </span>
        </div>
        {hasHistory ? (
          <>
            <div className="fdp__bars">
              {(market?.priceBars ?? []).map((b, i, arr) => (
                <div
                  key={i}
                  className="fdp__bar"
                  title={b.valueLabel ? `${b.label ?? `Point ${i + 1}`}: ${b.valueLabel}` : b.label}
                  style={{ height: b.height, background: b.color, opacity: i === arr.length - 1 ? 1 : 0.6 }}
                />
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              {(market?.priceBars ?? []).map((bar, i) => (
                <span
                  key={i}
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: 7,
                    color: "var(--text-muted)",
                    flex: 1,
                    textAlign: "center",
                  }}
                >
                  {bar.label ?? "—"}
                </span>
              ))}
            </div>
            <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
              <div>
                <span style={{ fontFamily: "var(--font-body)", fontSize: 9, color: "var(--text-muted)" }}>
                  Range low
                </span>
                <div>
                  <Mono>{market?.rangeLowLabel ?? "—"}</Mono>
                </div>
              </div>
              <div>
                <span style={{ fontFamily: "var(--font-body)", fontSize: 9, color: "var(--text-muted)" }}>
                  Range high
                </span>
                <div>
                  <Mono>{market?.rangeHighLabel ?? "—"}</Mono>
                </div>
              </div>
            </div>
            {marketAgronomicContextText ? <Sub>{marketAgronomicContextText}</Sub> : null}
          </>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <Mono>{historyEmptySummary || "N/A"}</Mono>
            {marketAgronomicContextText ? <Sub>{marketAgronomicContextText}</Sub> : null}
          </div>
        )}
      </Card>
      {marketContextTiles.slice(0, 4).map((tile, i) => (
        <Card key={i}>
          <LblM>{tile.label}</LblM>
          <div>
            <Big size={22} color={tile.valueColor}>
              {tile.value}
            </Big>
            <div>
              <Sub>{tile.sub}</Sub>
            </div>
          </div>
        </Card>
      ))}
      <Card span={-1} className="fdp-card--muted">
        <Sub>
          {market?.disclaimerText ?? market?.footerText ?? "No market disclaimer available."}
        </Sub>
      </Card>
      {focusedZone ? (
        <Card span={-1} accent={statusColor(focusedZone.status)} onClick={handleOpenFocusedZone}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <Lbl color={statusColor(focusedZone.status)}>Focused Zone</Lbl>
            <span className="fdp-mono" style={{ fontSize: 9, fontWeight: 700, color: statusColor(focusedZone.status), textTransform: "uppercase" }}>
              Open zone evidence
            </span>
          </div>
          <div style={{ marginTop: 4 }}>
            <span style={{ fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
              {focusedZone.trackingKey}
            </span>
            <div>
              <Sub>{focusedZoneJumpHint ?? "Open the zones page for current tracked-zone evidence."}</Sub>
            </div>
          </div>
        </Card>
      ) : null}
      {contextualNotesTarget ? (
        <Card span={-1} accent={ac} onClick={handleOpenContextNotes}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <Lbl color={ac}>Scout This Context</Lbl>
            <span className="fdp-mono" style={{ fontSize: 9, fontWeight: 700, color: ac, textTransform: "uppercase" }}>
              Open notes
            </span>
          </div>
          <div style={{ marginTop: 4 }}>
            <span style={{ fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
              {contextualNotesTarget.name}
            </span>
            <div>
              <Sub>{contextualNotesTarget.coordinateLabel}</Sub>
            </div>
          </div>
        </Card>
      ) : null}
    </>
  );
}

function summarizeWholeFieldScenario(value: string | null) {
  if (!value) {
    return null;
  }

  return value.includes("whole-field scenario")
    ? "This remains a whole-field reference view."
    : value;
}

function findMarketRow(
  rows: readonly { label: string; value: string }[] | null | undefined,
  label: string,
) {
  return rows?.find((row) => row.label === label) ?? null;
}

function resolveFeedStatusLabel(market: FieldMarketProps | null, hasQuote: boolean) {
  if (!market) {
    return "N/A";
  }

  if (market.feedStatusLabel) {
    return market.feedStatusLabel;
  }

  if (!market.cropSymbol) {
    return "N/A";
  }

  if (market.availabilityState === "unsupported-feed") {
    return "Unsupported";
  }

  if (hasQuote) {
    return "Stored";
  }

  if (market.referenceStatusLabel.includes("feed connected")) {
    return "Offline";
  }

  if (market.referenceStatusLabel.includes("quote yet")) {
    return "Pending";
  }

  return "N/A";
}

function resolveHistoryStatusLabel(value: string | null | undefined) {
  return value === "No stored captures" ? "0 captures" : value ?? "N/A";
}

function resolveYieldStatusLabel(value: string | null | undefined) {
  return value === "Add yield" || value == null || value === "—" ? "N/A" : value;
}

function resolveQuoteStatusLabel(value: string | null | undefined) {
  if (value === "Add quote" || value === "Needs yield" || value == null || value === "—") {
    return "N/A";
  }

  return value;
}

function resolveBasisStatusLabel(value: string | null | undefined) {
  if (value === "Uses feed basis") {
    return "Feed";
  }

  if (value === "Not set" || value == null || value === "—") {
    return "N/A";
  }

  return value;
}

function resolveValuationStateLabel(
  value: FieldMarketProps["valuationState"],
) {
  switch (value) {
    case "scenario":
      return "Scenario";
    case "provisional":
      return "Provisional";
    case "reference-only":
      return "Reference";
    case "unsupported":
      return "Unsupported";
    default:
      return "N/A";
  }
}

function buildMetricSummary(rows: readonly [string, string | null | undefined][]) {
  const items = rows
    .map(([label, value]) => `${label} ${value ?? "N/A"}`)
    .filter(Boolean);

  return items.join(" · ");
}

function compactHint(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  return value
    .replace("Add a manual quote plus a yield assumption to unlock revenue for this field.", "Add quote + yield to unlock field revenue.")
    .replace("No market symbol is configured for", "No symbol for")
    .replace("No stored ", "No ")
    .replace(" quote is stored yet, and no field yield assumption is saved for this field.", " quote and yield are both missing.")
    .replace(" quote is stored yet.", " quote stored yet.")
    .replace(" quote source is wired in FieldPulse yet.", " feed unsupported.")
    .replace("Revenue will stay provisional until a quote arrives or you add a manual quote.", "Revenue stays provisional until a quote is added.")
    .replace("Use this crop in field revenue planning.", "Use this crop in field planning.");
}
