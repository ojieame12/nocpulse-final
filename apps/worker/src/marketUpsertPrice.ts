import { pathToFileURL } from "node:url";
import { createServerRuntime } from "@fieldpulse/platform-runtime";
import { loadWorkerEnv } from "./runtime/loadEnv";
import {
  type ParsedCliArgs,
  parseCliArgs,
  readBooleanFlag,
  readNumberFlag,
  readStringFlag,
} from "./runtime/parseCliArgs";

export type MarketUpsertPriceRuntime = {
  mode: string;
  services: {
    market: {
      upsertPrice(input: {
        cropSymbol: string;
        closePriceCadPerTonne: number;
        basisCadPerTonne?: number;
        sourceKey: string;
        capturedAt?: string;
      }): Promise<{
        cropSymbol: string;
        closePriceCadPerTonne: number;
        basisCadPerTonne: number;
        sourceKey: string;
        capturedAt: string;
      }>;
    };
  };
};

export async function runMarketUpsertPrice(input: {
  runtime: MarketUpsertPriceRuntime;
  args: ParsedCliArgs;
}) {
  const { runtime, args } = input;
  const cropSymbol = readStringFlag(args, "crop")?.trim().toUpperCase();
  const closePriceCadPerTonne = readNumberFlag(args, "price");
  const basisCadPerTonne = readNumberFlag(args, "basis");
  const sourceKey =
    readStringFlag(args, "source")?.trim() ?? "manual-admin";
  const capturedAt = readStringFlag(args, "captured-at")?.trim();

  if (runtime.mode !== "supabase") {
    throw new Error("Supabase runtime is not configured");
  }

  if (!cropSymbol) {
    throw new Error("[worker-market-upsert-price] --crop is required");
  }

  if (closePriceCadPerTonne == null) {
    throw new Error("[worker-market-upsert-price] --price is required");
  }

  return runtime.services.market.upsertPrice({
    cropSymbol,
    closePriceCadPerTonne,
    basisCadPerTonne,
    sourceKey,
    capturedAt,
  });
}

async function main() {
  loadWorkerEnv();
  const runtime = createServerRuntime(process.env);
  const args = parseCliArgs();
  const asJson = readBooleanFlag(args, "json");

  if (runtime.mode !== "supabase") {
    throw new Error("Supabase runtime is not configured");
  }

  const snapshot = await runMarketUpsertPrice({ runtime, args });

  if (asJson) {
    console.log(JSON.stringify(snapshot, null, 2));
    return;
  }

  console.log(
    [
      `crop=${snapshot.cropSymbol}`,
      `price=${snapshot.closePriceCadPerTonne.toFixed(2)} CAD/t`,
      `basis=${snapshot.basisCadPerTonne.toFixed(2)} CAD/t`,
      `source=${snapshot.sourceKey}`,
      `capturedAt=${snapshot.capturedAt}`,
    ].join(" "),
  );
}

const executedAsScript =
  typeof process.argv[1] === "string" &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (executedAsScript) {
  void main().catch((error: unknown) => {
    const message =
      error instanceof Error ? error.message : "Unknown market upsert failure";
    console.error(`[worker-market-upsert-price] ${message}`);
    process.exitCode = 1;
  });
}
