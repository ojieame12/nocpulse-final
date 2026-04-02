import {
  prairieDefaultRulePack,
  resolveCropRuleContext,
} from "@fieldpulse/module-crop-intelligence";
import { isLiveMarketFeedCropSymbol } from "@fieldpulse/module-market";
import type { FieldMarketProps, MarketBarDatum } from "../../components/panels/MarketTab";
import {
  filterFieldQualityDependentAlertRecords,
  formatHistoryLabel,
} from "./buildFieldOverviewViewModel.shared";
import { resolveCropStagePresentation } from "./buildFieldOverviewViewModel.cropSignals";

function shortSourceLabel(value: string | null | undefined) {
  if (!value) {
    return "—";
  }

  const parts = value.split(":");
  return parts.length > 1 ? parts.slice(-2).join(" · ") : value;
}

export function resolveMarketCropSymbol(cropType: string | null | undefined) {
  if (!cropType) {
    return null;
  }

  switch (cropType.trim().toLowerCase()) {
    case "canola":
      return "CANOLA";
    case "wheat":
    case "spring wheat":
    case "durum":
      return "WHEAT";
    case "barley":
      return "BARLEY";
    case "oats":
      return "OATS";
    case "rye":
      return "RYE";
    case "corn":
    case "maize":
      return "CORN";
    case "soybean":
    case "soybeans":
      return "SOYBEAN";
    default:
      return null;
  }
}

function formatSignedMillimetres(value: number | null | undefined) {
  if (value == null) {
    return "—";
  }

  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)} mm`;
}

function formatSourceUnitLabel(unit: string | null | undefined) {
  switch (unit?.toLowerCase()) {
    case "bushel":
      return "bu";
    case "tonne":
      return "t";
    default:
      return unit ?? "unit";
  }
}

function formatCadCurrency(
  value: number,
  options: {
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
  } = {},
) {
  return value.toLocaleString("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: options.minimumFractionDigits ?? 2,
    maximumFractionDigits: options.maximumFractionDigits ?? 2,
  });
}

function formatYieldTonnesPerHa(value: number) {
  return `${value.toFixed(2)} t/ha`;
}

function formatSignedCadDelta(value: number) {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}$${Math.abs(value).toFixed(2)}`;
}

function buildMarketHistoryLabels(
  prices: readonly {
    capturedAt: string;
  }[],
) {
  const shortDateLabels = prices.map((snapshot) => formatHistoryLabel(snapshot.capturedAt));
  const duplicateDates = new Set<string>();

  for (const label of shortDateLabels) {
    if (shortDateLabels.filter((entry) => entry === label).length > 1) {
      duplicateDates.add(label);
    }
  }

  return prices.map((snapshot, index) => {
    const baseLabel = shortDateLabels[index] ?? "—";
    if (!duplicateDates.has(baseLabel)) {
      return baseLabel;
    }

    return new Date(snapshot.capturedAt).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  });
}

function dedupeMarketPriceHistory<
  T extends {
    closePriceCadPerTonne: number;
    basisCadPerTonne: number;
    sourceKey: string;
    capturedAt: string;
  },
>(prices: readonly T[]) {
  const seen = new Set<string>();

  return prices.filter((snapshot) => {
    const key = [
      snapshot.capturedAt,
      snapshot.sourceKey,
      snapshot.closePriceCadPerTonne.toFixed(4),
      snapshot.basisCadPerTonne.toFixed(4),
    ].join("::");

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

export function resolveLatestMarketSnapshot<
  T extends {
    capturedAt: string;
    createdAt?: string;
  },
>(prices: readonly T[]): T | null {
  if (prices.length === 0) {
    return null;
  }

  return prices.reduce<T | null>((latest, snapshot) => {
    if (!latest) {
      return snapshot;
    }

    const capturedAtComparison =
      Date.parse(snapshot.capturedAt) - Date.parse(latest.capturedAt);

    if (capturedAtComparison !== 0) {
      return capturedAtComparison > 0 ? snapshot : latest;
    }

    const latestCreatedAt = latest.createdAt ?? latest.capturedAt;
    const snapshotCreatedAt = snapshot.createdAt ?? snapshot.capturedAt;

    return Date.parse(snapshotCreatedAt) > Date.parse(latestCreatedAt)
      ? snapshot
      : latest;
  }, null);
}

function buildMarketPriceBars(
  prices: readonly {
    closePriceCadPerTonne: number;
    capturedAt: string;
  }[],
): readonly MarketBarDatum[] {
  if (prices.length === 0) {
    return [];
  }

  const sorted = [...prices].sort(
    (left, right) => Date.parse(left.capturedAt) - Date.parse(right.capturedAt),
  );
  const labels = buildMarketHistoryLabels(sorted);
  const values = sorted.map((snapshot) => snapshot.closePriceCadPerTonne);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const spread = maxValue - minValue;

  return sorted.map((snapshot, index) => {
    const previous = index > 0 ? sorted[index - 1] : null;
    const normalized =
      spread <= 0 ? 0.55 : (snapshot.closePriceCadPerTonne - minValue) / spread;
    const height = Math.round(18 + normalized * 62);
    const color =
      previous == null
        ? "#94a3b8"
        : snapshot.closePriceCadPerTonne > previous.closePriceCadPerTonne
          ? index === sorted.length - 1
            ? "#166534"
            : "#16a34a"
          : snapshot.closePriceCadPerTonne < previous.closePriceCadPerTonne
            ? "#ef4444"
            : "#94a3b8";

    return {
      height,
      color,
      label: labels[index] ?? "—",
      valueLabel: formatCadCurrency(snapshot.closePriceCadPerTonne),
    };
  });
}

export function buildMarketProps(
  rm: any,
  fieldId: string,
  fieldName: string,
  fieldAreaHa: number,
  marketPrice: {
    cropSymbol: string;
    closePriceCadPerTonne: number;
    basisCadPerTonne: number;
    sourceCurrency: string;
    sourceUnit: string;
    sourceClosePrice: number;
    fxRateToCad: number;
    sourceKey: string;
    capturedAt: string;
  } | null,
  recentMarketPrices: readonly {
    cropSymbol: string;
    closePriceCadPerTonne: number;
    basisCadPerTonne: number;
    sourceCurrency: string;
    sourceUnit: string;
    sourceClosePrice: number;
    fxRateToCad: number;
    sourceKey: string;
    capturedAt: string;
    createdAt: string;
  }[],
  fieldBasisAssumption: {
    cropSymbol: string | null;
    basisCadPerTonne: number;
    sourceKey: string;
    assumedAt: string;
    noteText: string | null;
  } | null,
  fieldYieldAssumption: {
    cropSymbol: string | null;
    yieldTonnesPerHa: number;
    sourceKey: string;
    assumedAt: string;
    noteText: string | null;
  } | null,
): FieldMarketProps {
  const cropLabel = rm.cropContext?.cropType ?? rm.summary?.cropType ?? "Field crop";
  const defaultCropRules = resolveCropRuleContext({
    rulePack: prairieDefaultRulePack,
    cropContext: {
      cropType: rm.cropContext?.cropType ?? rm.summary?.cropType ?? null,
      growthStage: null,
    },
  });
  const cropStagePresentation = resolveCropStagePresentation({
    cropContext: rm.cropContext ?? null,
    fallbackGrowthStage: rm.summary?.growthStage ?? null,
    defaultGrowthStage: defaultCropRules.crop.growthStage,
    gddBaseC: defaultCropRules.crop.gddBaseC,
  });
  const cropStage =
    cropStagePresentation.displayStageLabel === "Stage unavailable"
      ? "Current stage"
      : cropStagePresentation.displayStageLabel;
  const marketCropSymbol = resolveMarketCropSymbol(
    rm.cropContext?.cropType ?? rm.summary?.cropType,
  );
  const effectiveMarketPrice =
    marketPrice ?? resolveLatestMarketSnapshot(recentMarketPrices);
  const liveFeedSupported = isLiveMarketFeedCropSymbol(marketCropSymbol);
  const moisture = rm.moisture?.latestSnapshot ?? null;
  const weatherSignals = rm.weather?.signals ?? null;
  const dataQualityLabel = rm.summary?.dataQuality?.label ?? null;
  const presentedAlerts = filterFieldQualityDependentAlertRecords(
    rm.alerts ?? [],
    dataQualityLabel,
  );
  const presentedFindings = filterFieldQualityDependentAlertRecords(
    rm.findings ?? [],
    dataQualityLabel,
  );
  const alertsCount = presentedAlerts.length;
  const findingsCount = presentedFindings.length;
  const hiddenSignalsCount =
    (rm.alerts?.length ?? 0) +
    (rm.findings?.length ?? 0) -
    alertsCount -
    findingsCount;
  const generatedAtLabel = new Date(rm.generatedAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const effectiveYieldAssumption =
    fieldYieldAssumption &&
    (!marketCropSymbol ||
      !fieldYieldAssumption.cropSymbol ||
      fieldYieldAssumption.cropSymbol === marketCropSymbol)
      ? fieldYieldAssumption
      : null;
  const effectiveBasisAssumption =
    fieldBasisAssumption &&
    (!marketCropSymbol ||
      !fieldBasisAssumption.cropSymbol ||
      fieldBasisAssumption.cropSymbol === marketCropSymbol)
      ? fieldBasisAssumption
      : null;
  const effectiveBasisCadPerTonne =
    effectiveBasisAssumption?.basisCadPerTonne ??
    effectiveMarketPrice?.basisCadPerTonne ??
    null;
  const harvestPriceCadPerTonne = effectiveMarketPrice
    ? effectiveMarketPrice.closePriceCadPerTonne + (effectiveBasisCadPerTonne ?? 0)
    : null;
  const grossRevenueCad =
    effectiveYieldAssumption && harvestPriceCadPerTonne != null
      ? fieldAreaHa *
        effectiveYieldAssumption.yieldTonnesPerHa *
        harvestPriceCadPerTonne
      : null;
  const yieldAssumptionLabel = effectiveYieldAssumption
    ? formatYieldTonnesPerHa(effectiveYieldAssumption.yieldTonnesPerHa)
    : "N/A";
  const harvestPriceLabel =
    harvestPriceCadPerTonne != null
      ? `${formatCadCurrency(harvestPriceCadPerTonne)}/t`
      : "N/A";
  const yieldAssumptionDateLabel = effectiveYieldAssumption
    ? new Date(effectiveYieldAssumption.assumedAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;
  const quoteAvailable = effectiveMarketPrice != null;
  const yieldAvailable = effectiveYieldAssumption != null;
  const missingInputs = [
    quoteAvailable ? null : ("quote" as const),
    yieldAvailable ? null : ("yield" as const),
  ].filter((value): value is "quote" | "yield" => value != null);
  const availabilityState =
    !marketCropSymbol
      ? "unsupported-crop"
      : !liveFeedSupported
        ? "unsupported-feed"
      : !quoteAvailable && !yieldAvailable
        ? "quote-and-yield-unavailable"
        : !quoteAvailable
          ? "quote-unavailable"
          : !yieldAvailable
            ? "yield-unavailable"
            : "ready";
  const availabilityReasonLabel =
    availabilityState === "unsupported-crop"
      ? `No live quote symbol is configured for ${cropLabel.toLowerCase()} yet. You can still store field yield and basis assumptions for planning.`
      : availabilityState === "unsupported-feed"
        ? `No live ${marketCropSymbol} quote source is wired in FieldPulse yet.`
      : availabilityState === "quote-and-yield-unavailable"
        ? liveFeedSupported
          ? `No live ${marketCropSymbol} quote is stored yet, and no field yield assumption is saved for this field. You can add a manual quote while the feed catches up.`
          : `No live ${marketCropSymbol} feed is connected yet, and no field yield assumption is saved for this field. Add a manual quote plus a yield assumption to unlock revenue for this field.`
        : availabilityState === "quote-unavailable"
          ? liveFeedSupported
            ? `No live ${marketCropSymbol} quote is stored yet. Revenue will stay provisional until a quote arrives or you add a manual quote.`
            : `No live ${marketCropSymbol} feed is connected yet. Add a manual quote to use this crop in field revenue planning.`
          : availabilityState === "yield-unavailable"
            ? "Add a field yield assumption to unlock revenue for this field."
            : null;
  const valuationState =
    !marketCropSymbol || availabilityState === "unsupported-feed"
      ? "unsupported"
      : grossRevenueCad != null
        ? "scenario"
        : effectiveYieldAssumption != null || effectiveBasisAssumption != null
          ? "provisional"
          : "reference-only";
  const recentHistory = dedupeMarketPriceHistory(
    recentMarketPrices.length > 0
      ? recentMarketPrices
      : effectiveMarketPrice
        ? [{ ...effectiveMarketPrice, createdAt: effectiveMarketPrice.capturedAt }]
        : [],
  );
  const latestHistorySnapshot = recentHistory.at(-1) ?? null;
  const previousHistorySnapshot =
    recentHistory.length > 1 ? recentHistory[recentHistory.length - 2] ?? null : null;
  const priceBars = buildMarketPriceBars(recentHistory);
  const recentLow = recentHistory.length > 0
    ? Math.min(...recentHistory.map((snapshot) => snapshot.closePriceCadPerTonne))
    : null;
  const recentHigh = recentHistory.length > 0
    ? Math.max(...recentHistory.map((snapshot) => snapshot.closePriceCadPerTonne))
    : null;
  const deltaCadPerTonne =
    latestHistorySnapshot && previousHistorySnapshot
      ? latestHistorySnapshot.closePriceCadPerTonne - previousHistorySnapshot.closePriceCadPerTonne
      : null;
  const deltaPct =
    deltaCadPerTonne != null &&
    previousHistorySnapshot != null &&
    previousHistorySnapshot.closePriceCadPerTonne !== 0
      ? (deltaCadPerTonne / previousHistorySnapshot.closePriceCadPerTonne) * 100
      : null;
  const priceDeltaLabel =
    deltaCadPerTonne != null && deltaPct != null
      ? `${deltaCadPerTonne >= 0 ? "▲" : "▼"} ${formatSignedCadDelta(deltaCadPerTonne)} (${deltaPct >= 0 ? "+" : "−"}${Math.abs(deltaPct).toFixed(1)}%)`
      : null;
  const referenceStatusLabel =
    !marketCropSymbol
      ? "N/A"
      : availabilityState === "unsupported-feed"
        ? "Unsupported"
      : quoteAvailable
        ? "Stored"
      : liveFeedSupported
          ? "Pending"
          : "Offline";
  const valuationStatusLabel =
    valuationState === "unsupported"
      ? "Unsupported"
      : valuationState === "scenario"
        ? "Scenario"
      : !quoteAvailable && !yieldAvailable
          ? "Quote N/A · Yield N/A"
      : !quoteAvailable
            ? "Quote N/A"
          : !yieldAvailable
              ? "Yield N/A"
              : "Provisional";
  const primaryActionLabel =
    valuationState === "unsupported"
      ? "N/A"
      : !quoteAvailable && !yieldAvailable
        ? "Add manual quote and yield"
        : !quoteAvailable
          ? "Add manual quote"
          : !yieldAvailable
            ? "Add field yield"
            : effectiveBasisAssumption == null
              ? "Refine local basis"
              : "Refine field scenario";
  const primaryActionHint =
    availabilityReasonLabel ??
    (valuationState === "scenario"
      ? "Stored field inputs are active. Update quote, basis, or yield to refine this estimate."
      : availabilityState === "unsupported-feed"
        ? ""
        : "Store field inputs to move from reference market context into a field-specific revenue view.");
  const referenceRows = [
    {
      label: "Market Symbol",
      value: marketCropSymbol ?? "—",
    },
    {
      label: "Feed",
      value: referenceStatusLabel,
    },
    {
      label: "Stored History",
      value:
        recentHistory.length > 0
          ? `${recentHistory.length} capture${recentHistory.length === 1 ? "" : "s"}`
          : "No stored captures",
    },
    {
      label: "Field Area",
      value: `${fieldAreaHa.toFixed(1)} ha`,
    },
  ];
  const provisionalRevenueLabel =
    grossRevenueCad != null
      ? formatCadCurrency(grossRevenueCad, {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        })
      : harvestPriceCadPerTonne != null
        ? `${formatCadCurrency(harvestPriceCadPerTonne)}/t`
        : effectiveMarketPrice != null
          ? formatCadCurrency(effectiveMarketPrice.closePriceCadPerTonne)
          : "—";
  const provisionalRevenueSubLabel =
    grossRevenueCad != null
      ? "Scenario"
      : harvestPriceCadPerTonne != null
        ? "Price at harvest"
      : effectiveMarketPrice != null
          ? "Reference"
        : yieldAvailable
          ? "Yield only"
            : availabilityState === "unsupported-feed"
              ? "Unsupported"
            : liveFeedSupported
              ? "Pending"
              : marketCropSymbol
                ? "Offline"
                : "Unsupported";

  return {
    fieldId,
    cropSymbol: marketCropSymbol,
    availabilityState,
    availabilityReasonLabel,
    valuationState,
    referenceStatusLabel,
    valuationStatusLabel,
    missingInputs,
    primaryActionLabel,
    primaryActionHint,
    referenceRows,
    provisionalRevenueLabel,
    provisionalRevenueSubLabel,
    seasonYear: rm.cropContext?.seasonYear ?? null,
    closePriceCadPerTonne: effectiveMarketPrice?.closePriceCadPerTonne ?? null,
    basisCadPerTonne: effectiveBasisCadPerTonne,
    yieldTonnesPerHa: effectiveYieldAssumption?.yieldTonnesPerHa ?? null,
    basisAssumptionCadPerTonne: effectiveBasisAssumption?.basisCadPerTonne ?? null,
    basisAssumptionCapturedAtLabel: effectiveBasisAssumption
      ? new Date(effectiveBasisAssumption.assumedAt).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : null,
    basisAssumptionSourceLabel: effectiveBasisAssumption
      ? shortSourceLabel(effectiveBasisAssumption.sourceKey)
      : null,
    basisAssumptionNoteText: effectiveBasisAssumption?.noteText ?? null,
    yieldAssumptionCapturedAtLabel: yieldAssumptionDateLabel,
    yieldAssumptionSourceLabel: effectiveYieldAssumption
      ? shortSourceLabel(effectiveYieldAssumption.sourceKey)
      : null,
    yieldAssumptionNoteText: effectiveYieldAssumption?.noteText ?? null,
    priceSubmitUrl: availabilityState === "unsupported-feed" ? null : marketCropSymbol ? "/api/market/prices" : null,
    basisSubmitUrl: `/api/fields/${fieldId}/basis-assumption`,
    yieldSubmitUrl: `/api/fields/${fieldId}/yield-assumption`,
    name: fieldName,
    lld: rm.intake?.legalLandDescription ?? "No legal land description",
    sectionLabel: `${String(cropLabel).toUpperCase()} MARKET`,
    capturedAtLabel: latestHistorySnapshot
      ? new Date(latestHistorySnapshot.capturedAt).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : generatedAtLabel,
    contextLabel:
      recentHistory.length > 1
        ? `${recentHistory.length}-capture history`
        : "Latest stored quote",
    priceLabel: effectiveMarketPrice ? `$${effectiveMarketPrice.closePriceCadPerTonne.toFixed(2)}` : "—",
    priceUnitLabel: effectiveMarketPrice ? "/tonne CAD" : "live quote unavailable",
    priceDeltaLabel,
    priceBars,
    rangeLowLabel:
      recentLow != null ? `Recent low: ${formatCadCurrency(recentLow)}` : "Recent low: —",
    rangeHighLabel:
      recentHigh != null ? `Recent high: ${formatCadCurrency(recentHigh)}` : "Recent high: —",
    quoteStatusLabel: effectiveMarketPrice
      ? [
          `${formatCadCurrency(effectiveMarketPrice.closePriceCadPerTonne)}/t`,
          effectiveBasisAssumption
            ? `Field basis ${effectiveBasisAssumption.basisCadPerTonne >= 0 ? "+" : ""}${effectiveBasisAssumption.basisCadPerTonne.toFixed(2)} CAD/t`
            : `Basis ${effectiveMarketPrice.basisCadPerTonne >= 0 ? "+" : ""}${effectiveMarketPrice.basisCadPerTonne.toFixed(2)} CAD/t`,
          `Stored`,
          `Source ${shortSourceLabel(effectiveMarketPrice.sourceKey)}`,
          effectiveMarketPrice.sourceCurrency === "CAD" && effectiveMarketPrice.sourceUnit === "tonne"
            ? null
            : `Normalized from ${effectiveMarketPrice.sourceClosePrice.toFixed(2)} ${effectiveMarketPrice.sourceCurrency}/${formatSourceUnitLabel(effectiveMarketPrice.sourceUnit)} × FX ${effectiveMarketPrice.fxRateToCad.toFixed(4)}`,
        ]
          .filter(Boolean)
          .join(" · ")
      : !marketCropSymbol
        ? "N/A"
      : liveFeedSupported
          ? "Pending"
          : "Offline",
    estimatedGrossLabel:
      grossRevenueCad != null
        ? formatCadCurrency(grossRevenueCad, {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
          })
        : "—",
    estimatedGrossSubLabel:
      grossRevenueCad != null
        ? "estimated gross revenue"
        : yieldAvailable
          ? "live quote unavailable"
        : quoteAvailable
          ? "yield assumption unavailable"
            : "gross estimate unavailable",
    revenueRows: [
      { label: "Expected Yield", value: yieldAssumptionLabel },
      { label: "Price at Harvest", value: harvestPriceLabel },
      {
        label: "Local Basis",
        value:
          effectiveBasisCadPerTonne != null
            ? `${effectiveBasisCadPerTonne >= 0 ? "+" : ""}${effectiveBasisCadPerTonne.toFixed(2)} CAD/t`
            : "N/A",
      },
      { label: "Field Area", value: `${fieldAreaHa.toFixed(1)} ha` },
    ],
    grossRevenueLabel:
      grossRevenueCad != null
        ? formatCadCurrency(grossRevenueCad, {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
          })
        : "—",
    revenueNote: grossRevenueCad != null
      ? [
          `Based on stored yield assumption ${yieldAssumptionLabel}`,
          effectiveBasisAssumption
            ? `with field basis ${effectiveBasisAssumption.basisCadPerTonne >= 0 ? "+" : ""}${effectiveBasisAssumption.basisCadPerTonne.toFixed(2)} CAD/t`
            : null,
          yieldAssumptionDateLabel
            ? `captured ${yieldAssumptionDateLabel}`
            : null,
          `from ${shortSourceLabel(effectiveYieldAssumption!.sourceKey)}`,
          effectiveYieldAssumption!.noteText
            ? `(${effectiveYieldAssumption!.noteText})`
            : null,
        ]
          .filter(Boolean)
          .join(" ")
      : yieldAvailable
        ? `Stored yield assumption ${yieldAssumptionLabel} from ${shortSourceLabel(
            effectiveYieldAssumption!.sourceKey,
          )} is available, but revenue is waiting on a live quote.`
        : quoteAvailable
          ? "Live quote is available, but revenue remains unavailable until a field yield assumption is stored."
          : "Connect a live grain price feed and store a field yield assumption before using this tab for revenue decisions.",
    contextTiles: [
      {
        label: "ROOT MOISTURE",
        value:
          moisture?.rootZonePct != null ? `${moisture.rootZonePct.toFixed(1)}%` : "—",
        valueColor:
          moisture?.rootZonePct != null && moisture.rootZonePct < 35
            ? "#f59e0b"
            : "#16a34a",
        sub:
          moisture?.confidence != null
            ? `${moisture.confidence} confidence`
            : "No moisture snapshot",
        bg:
          moisture?.rootZonePct != null && moisture.rootZonePct < 35
            ? "rgba(245,158,11,0.12)"
            : "rgba(22,163,74,0.12)",
      },
      {
        label: "WATER BALANCE",
        value: formatSignedMillimetres(weatherSignals?.netWaterBalance72hMm),
        valueColor:
          weatherSignals?.netWaterBalance72hMm != null &&
          weatherSignals.netWaterBalance72hMm < 0
            ? "#f59e0b"
            : "#3b82f6",
        sub: weatherSignals?.netWaterBalance72hMm != null
          ? "72h forecast window"
          : "No weather signal",
        bg:
          weatherSignals?.netWaterBalance72hMm != null &&
          weatherSignals.netWaterBalance72hMm < 0
            ? "rgba(245,158,11,0.12)"
            : "rgba(59,130,246,0.12)",
      },
      {
        label: "ACTIVE SIGNALS",
        value: `${alertsCount + findingsCount}`,
        valueColor:
          alertsCount + findingsCount > 0 || hiddenSignalsCount > 0
            ? "#f59e0b"
            : "#16a34a",
        sub:
          hiddenSignalsCount > 0
            ? alertsCount + findingsCount > 0
              ? `${alertsCount} visible · ${hiddenSignalsCount} held back · ${cropStage}`
              : `Field-dependent signals held back · ${cropStage}`
            : `${alertsCount} alerts · ${findingsCount} findings · ${cropStage}`,
        bg:
          alertsCount + findingsCount > 0 || hiddenSignalsCount > 0
            ? "rgba(245,158,11,0.10)"
            : "rgba(22,163,74,0.12)",
      },
    ],
    disclaimerText:
      effectiveMarketPrice
        ? effectiveMarketPrice.sourceCurrency === "CAD" && effectiveMarketPrice.sourceUnit === "tonne"
          ? yieldAvailable
            ? effectiveBasisAssumption
              ? "Quote data is live from the persisted market snapshot feed. Revenue uses the latest stored field yield and field-local basis assumptions and is an estimate only."
              : "Quote data is live from the persisted market snapshot feed. Revenue uses the latest stored field yield assumption and is an estimate only."
            : "Quote data is live from the persisted market snapshot feed. Revenue remains unavailable until a field yield assumption is stored."
          : yieldAvailable
            ? effectiveBasisAssumption
              ? "Quote data is live and normalized into CAD/tonne from the upstream futures unit. Revenue uses the latest stored field yield and field-local basis assumptions and is an estimate only."
              : "Quote data is live and normalized into CAD/tonne from the upstream futures unit. Revenue uses the latest stored field yield assumption and is an estimate only."
            : "Quote data is live and normalized into CAD/tonne from the upstream futures unit. Revenue remains unavailable until a field yield assumption is stored."
        : yieldAvailable
          ? "A stored field yield assumption is available, but no live market quote source is connected yet, so revenue remains unavailable."
          : "No live market quote source or stored field yield assumption is available yet. Price and revenue sections stay unavailable until both exist.",
    footerText: `Context updated ${new Date(rm.generatedAt).toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    })} · moisture ${shortSourceLabel(moisture?.sourceKey)} · weather ${shortSourceLabel(weatherSignals?.sourceKey)}`,
  };
}
