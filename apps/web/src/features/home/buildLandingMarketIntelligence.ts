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
  "ICE / CBOT",
  "Johnston's",
  "USD → CAD",
] as const;

const MARKET_SOURCE_FAMILIES = {
  CANOLA: "ICE / CBOT",
  WHEAT: "ICE / CBOT",
  CORN: "ICE / CBOT",
  SOYBEAN: "ICE / CBOT",
  RYE: "Johnston's",
} as const;

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

function buildSourcePills(
  snapshots: readonly {
    cropSymbol: string;
    snapshot: {
      sourceCurrency: string;
    } | null;
    freshness: {
      status: "fresh" | "stale" | "missing";
    };
  }[],
) {
  const familyLabels = ["ICE / CBOT", "Johnston's"] as const;

  const sourceCoverage = familyLabels.map((familyLabel) => {
    const entries = snapshots.filter(
      (entry) =>
        MARKET_SOURCE_FAMILIES[entry.cropSymbol as keyof typeof MARKET_SOURCE_FAMILIES] ===
        familyLabel,
    );
    const freshCount = entries.filter((entry) => entry.freshness.status === "fresh").length;

    if (entries.length === 0) {
      return `${familyLabel} Missing`;
    }

    return `${familyLabel} ${freshCount}/${entries.length} fresh`;
  });

  const hasUsdNormalizedSnapshot = snapshots.some(
    (entry) => entry.snapshot?.sourceCurrency === "USD",
  );

  return [
    ...sourceCoverage,
    hasUsdNormalizedSnapshot ? "USD → CAD normalized" : "Native CAD only",
  ];
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
      "Stored commodity snapshots from ICE and CBOT settlements plus Western Canada cash bids. USD-denominated quotes are normalized to CAD so stale snapshots do not read as live.",
    sourcePills: buildSourcePills(snapshots),
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
