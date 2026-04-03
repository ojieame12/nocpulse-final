import {
  LIVE_MARKET_FEED_CROP_SYMBOLS,
  describeGrainPriceSnapshotFreshness,
} from "@fieldpulse/module-market";
import type { ServerRuntime } from "@fieldpulse/platform-runtime";

export type LandingMarketIntelligenceViewModel = {
  subtitle: string;
  sourcePills: readonly string[];
  leftLabel: string;
  leftValue: string;
  leftUnit: string;
  leftSubLabel: string;
  rightLabel: string;
  rightValue: string;
  rightUnit: string;
  rightSubLabel: string;
  rightValueColor: string;
};

const DEFAULT_SOURCE_PILLS = [
  "ICE / CBOT Settlements",
  "Johnston's Grain Bids",
  "Bank of Canada FX",
] as const;

function formatCadPerTonne(value: number | null | undefined) {
  if (value == null) {
    return "—";
  }

  return value.toLocaleString("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatCapturedAtLabel(value: string | null | undefined) {
  if (!value) {
    return "No stored capture";
  }

  return new Date(value).toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
  });
}

export function buildLandingMarketIntelligenceFallback(): LandingMarketIntelligenceViewModel {
  return {
    subtitle:
      "Stored market snapshots are unavailable until the Supabase runtime is configured.",
    sourcePills: [...DEFAULT_SOURCE_PILLS],
    leftLabel: "Canola Snapshot",
    leftValue: "—",
    leftUnit: "CAD / tonne",
    leftSubLabel: "No stored capture",
    rightLabel: "Coverage",
    rightValue: "0 / 5",
    rightUnit: "feeds fresh",
    rightSubLabel: "runtime unavailable",
    rightValueColor: "var(--ds-text-on-dark)",
  };
}

export async function buildLandingMarketIntelligence(
  runtime: ServerRuntime,
): Promise<LandingMarketIntelligenceViewModel> {
  if (runtime.mode !== "supabase") {
    return buildLandingMarketIntelligenceFallback();
  }

  const snapshots = await Promise.all(
    LIVE_MARKET_FEED_CROP_SYMBOLS.map(async (cropSymbol) => {
      const snapshot = await runtime.services.market.latestPrice({ cropSymbol });
      const freshness = describeGrainPriceSnapshotFreshness({
        capturedAt: snapshot?.capturedAt ?? null,
        sourceKey: snapshot?.sourceKey ?? null,
      });

      return {
        cropSymbol,
        snapshot,
        freshness,
      };
    }),
  );

  const canola = snapshots.find((entry) => entry.cropSymbol === "CANOLA") ?? null;
  const freshCount = snapshots.filter((entry) => entry.freshness.status === "fresh").length;
  const availableCount = snapshots.filter((entry) => entry.snapshot != null).length;
  const totalCount = LIVE_MARKET_FEED_CROP_SYMBOLS.length;

  return {
    subtitle:
      "Stored commodity snapshots from ICE and CBOT settlements, Western Canada cash bids, and Bank of Canada FX. Freshness is surfaced directly so stale quotes do not read as live.",
    sourcePills: [...DEFAULT_SOURCE_PILLS],
    leftLabel: "Canola Snapshot",
    leftValue: formatCadPerTonne(canola?.snapshot?.closePriceCadPerTonne ?? null),
    leftUnit: "CAD / tonne",
    leftSubLabel:
      canola?.snapshot != null
        ? `${canola.freshness.status === "fresh" ? "Fresh" : "Stale"} · ${formatCapturedAtLabel(canola.snapshot.capturedAt)}`
        : "Missing",
    rightLabel: "Coverage",
    rightValue: `${freshCount} / ${totalCount}`,
    rightUnit: "feeds fresh",
    rightSubLabel: `${availableCount} stored snapshots`,
    rightValueColor:
      freshCount === totalCount
        ? "var(--ds-green-300)"
        : freshCount > 0
          ? "#fbbf24"
          : "var(--ds-text-on-dark)",
  };
}
