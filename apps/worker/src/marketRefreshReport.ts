import { pathToFileURL } from "node:url";
import { createServerRuntime } from "@fieldpulse/platform-runtime";
import { describeGrainPriceSnapshotFreshness } from "@fieldpulse/module-market";
import { loadWorkerEnv } from "./runtime/loadEnv";
import {
  normalizeRequestedMarketSymbols,
  SUPPORTED_MARKET_CROP_SYMBOLS,
} from "./marketRefreshQuotes";
import {
  parseCliArgs,
  readBooleanFlag,
  readCsvFlag,
  readNumberFlag,
} from "./runtime/parseCliArgs";

type MarketSnapshotForReport = {
  cropSymbol: string;
  closePriceCadPerTonne: number;
  basisCadPerTonne: number;
  sourceCurrency: string;
  sourceUnit: string;
  sourceClosePrice: number;
  fxRateToCad: number;
  sourceKey: string;
  capturedAt: string;
};

export type MarketRefreshReportEntry = {
  cropSymbol: string;
  status: "fresh" | "stale" | "missing" | "error";
  capturedAt: string | null;
  ageHours: number | null;
  priceCadPerTonne: number | null;
  basisCadPerTonne: number | null;
  sourceKey: string | null;
  normalizationLabel: string | null;
  errorMessage: string | null;
};

export type MarketRefreshReport = {
  generatedAt: string;
  staleBefore: string;
  staleAfterHours: number;
  cropSymbols: readonly string[];
  healthStatus: "healthy" | "degraded";
  healthSummary: string;
  freshCount: number;
  staleCount: number;
  missingCount: number;
  errorCount: number;
  entries: readonly MarketRefreshReportEntry[];
};

function formatNormalizationLabel(snapshot: MarketSnapshotForReport) {
  if (snapshot.sourceCurrency === "CAD" && snapshot.sourceUnit === "tonne") {
    return "Native CAD/t";
  }

  return `${snapshot.sourceClosePrice.toFixed(4)} ${snapshot.sourceCurrency}/${snapshot.sourceUnit} × FX ${snapshot.fxRateToCad.toFixed(4)}`;
}

export function describeMarketRefreshReportHealth(input: {
  cropSymbols: readonly string[];
  freshCount: number;
  staleCount: number;
  missingCount: number;
  errorCount: number;
}) {
  const degradedParts: string[] = [];

  if (input.staleCount > 0) {
    degradedParts.push(
      `${input.staleCount} stale quote${input.staleCount === 1 ? "" : "s"}`,
    );
  }

  if (input.missingCount > 0) {
    degradedParts.push(
      `${input.missingCount} missing quote${input.missingCount === 1 ? "" : "s"}`,
    );
  }

  if (input.errorCount > 0) {
    degradedParts.push(
      `${input.errorCount} errored quote${input.errorCount === 1 ? "" : "s"}`,
    );
  }

  if (degradedParts.length === 0) {
    return {
      status: "healthy" as const,
      summary: `${input.freshCount} / ${input.cropSymbols.length} requested quotes fresh`,
    };
  }

  return {
    status: "degraded" as const,
    summary: degradedParts.join(", "),
  };
}

export async function buildMarketRefreshReport(input: {
  cropSymbols?: readonly string[];
  staleAfterHours?: number;
  now?: string;
  loadLatestPrice: (cropSymbol: string) => Promise<MarketSnapshotForReport | null>;
}): Promise<MarketRefreshReport> {
  const cropSymbols = normalizeRequestedMarketSymbols(input.cropSymbols);
  const staleAfterHours = input.staleAfterHours ?? 24;

  if (!Number.isFinite(staleAfterHours) || staleAfterHours < 0) {
    throw new Error("[worker-market-refresh-report] --stale-after-hours must be non-negative");
  }

  const generatedAt = input.now ? new Date(input.now).toISOString() : new Date().toISOString();

  if (Number.isNaN(Date.parse(generatedAt))) {
    throw new Error(`[worker-market-refresh-report] invalid now value "${input.now}"`);
  }

  const staleBefore = new Date(
    Date.parse(generatedAt) - staleAfterHours * 60 * 60 * 1000,
  ).toISOString();

  const entries = await Promise.all(
    cropSymbols.map(async (cropSymbol) => {
      try {
        const snapshot = await input.loadLatestPrice(cropSymbol);

        if (!snapshot) {
          return {
            cropSymbol,
            status: "missing" as const,
            capturedAt: null,
            ageHours: null,
            priceCadPerTonne: null,
            basisCadPerTonne: null,
            sourceKey: null,
            normalizationLabel: null,
            errorMessage: null,
          };
        }

        const freshness = describeGrainPriceSnapshotFreshness({
          capturedAt: snapshot.capturedAt,
          sourceKey: snapshot.sourceKey,
          now: generatedAt,
          staleAfterHours,
        });

        return {
          cropSymbol,
          status: freshness.status,
          capturedAt: snapshot.capturedAt,
          ageHours: freshness.ageHours,
          priceCadPerTonne: snapshot.closePriceCadPerTonne,
          basisCadPerTonne: snapshot.basisCadPerTonne,
          sourceKey: snapshot.sourceKey,
          normalizationLabel: formatNormalizationLabel(snapshot),
          errorMessage: null,
        };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(
          `[worker-market-refresh-report] failed to load latest price for ${cropSymbol}: ${message}`,
        );
        return {
          cropSymbol,
          status: "error" as const,
          capturedAt: null,
          ageHours: null,
          priceCadPerTonne: null,
          basisCadPerTonne: null,
          sourceKey: null,
          normalizationLabel: null,
          errorMessage: message,
        };
      }
    }),
  );

  const freshCount = entries.filter((entry) => entry.status === "fresh").length;
  const staleCount = entries.filter((entry) => entry.status === "stale").length;
  const missingCount = entries.filter((entry) => entry.status === "missing").length;
  const errorCount = entries.filter((entry) => entry.status === "error").length;
  const health = describeMarketRefreshReportHealth({
    cropSymbols,
    freshCount,
    staleCount,
    missingCount,
    errorCount,
  });

  return {
    generatedAt,
    staleBefore,
    staleAfterHours,
    cropSymbols,
    healthStatus: health.status,
    healthSummary: health.summary,
    freshCount,
    staleCount,
    missingCount,
    errorCount,
    entries,
  };
}

async function main() {
  loadWorkerEnv();
  const runtime = createServerRuntime(process.env);
  const args = parseCliArgs();
  const asJson = readBooleanFlag(args, "json");
  const requireHealthy = readBooleanFlag(args, "require-healthy");
  const cropSymbols = readCsvFlag(args, "crop-symbols");
  const staleAfterHours = readNumberFlag(args, "stale-after-hours");

  if (runtime.mode !== "supabase") {
    throw new Error("Supabase runtime is not configured");
  }

  const report = await buildMarketRefreshReport({
    cropSymbols,
    staleAfterHours,
    loadLatestPrice(cropSymbol) {
      return runtime.services.market.latestPrice({ cropSymbol });
    },
  });

  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
    if (requireHealthy && report.healthStatus !== "healthy") {
      console.error(
        `[worker-market-refresh-report] market quote coverage degraded: ${report.healthSummary}`,
      );
      process.exitCode = 1;
    }
    return;
  }

  console.log(
    [
      `Generated: ${report.generatedAt}`,
      `Stale before: ${report.staleBefore}`,
      `Supported symbols: ${SUPPORTED_MARKET_CROP_SYMBOLS.join(", ")}`,
      `Requested symbols: ${report.cropSymbols.join(", ")}`,
      `Health: ${report.healthStatus}`,
      `Health summary: ${report.healthSummary}`,
      `Fresh quotes: ${report.freshCount}`,
      `Stale quotes: ${report.staleCount}`,
      `Missing quotes: ${report.missingCount}`,
      `Errored quotes: ${report.errorCount}`,
    ].join("\n"),
  );

  console.log("\nMarket quote coverage");
  console.table(
    report.entries.map((entry) => ({
      cropSymbol: entry.cropSymbol,
      status: entry.status,
      priceCadPerTonne: entry.priceCadPerTonne ?? "",
      basisCadPerTonne: entry.basisCadPerTonne ?? "",
      capturedAt: entry.capturedAt ?? "",
      ageHours: entry.ageHours == null ? "" : entry.ageHours.toFixed(2),
      sourceKey: entry.sourceKey ?? "",
      normalization: entry.normalizationLabel ?? "",
      error: entry.errorMessage ?? "",
    })),
  );

  if (requireHealthy && report.healthStatus !== "healthy") {
    throw new Error(`market quote coverage degraded: ${report.healthSummary}`);
  }
}

const executedAsScript =
  typeof process.argv[1] === "string" &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (executedAsScript) {
  void main().catch((error: unknown) => {
    const message =
      error instanceof Error ? error.message : "Unknown market refresh report failure";
    console.error(`[worker-market-refresh-report] ${message}`);
    process.exitCode = 1;
  });
}
