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

export type MarketUpsertYieldRuntime = {
  mode: string;
  services: {
    market: {
      upsertFieldYieldAssumption(input: {
        workspaceId: string;
        fieldId: string;
        seasonYear?: number;
        cropSymbol: string | null;
        yieldTonnesPerHa: number;
        sourceKey: string;
        noteText?: string;
        assumedAt?: string;
      }): Promise<{
        fieldId: string;
        cropSymbol: string | null;
        yieldTonnesPerHa: number;
        seasonYear: number | null;
        sourceKey: string;
        assumedAt: string;
      }>;
    };
  };
};

export async function runMarketUpsertYield(input: {
  runtime: MarketUpsertYieldRuntime;
  args: ParsedCliArgs;
}) {
  const { runtime, args } = input;
  const workspaceId = readStringFlag(args, "workspace-id")?.trim();
  const fieldId = readStringFlag(args, "field-id")?.trim();
  const cropSymbol = readStringFlag(args, "crop")?.trim().toUpperCase();
  const yieldTonnesPerHa =
    readNumberFlag(args, "yield-tonnes-per-ha") ?? readNumberFlag(args, "yield");
  const seasonYear = readNumberFlag(args, "season-year");
  const sourceKey = readStringFlag(args, "source")?.trim() ?? "manual-admin";
  const noteText = readStringFlag(args, "note")?.trim();
  const assumedAt = readStringFlag(args, "assumed-at")?.trim();

  if (runtime.mode !== "supabase") {
    throw new Error("Supabase runtime is not configured");
  }

  if (!workspaceId) {
    throw new Error("[worker-market-upsert-yield] --workspace-id is required");
  }

  if (!fieldId) {
    throw new Error("[worker-market-upsert-yield] --field-id is required");
  }

  if (yieldTonnesPerHa == null || !Number.isFinite(yieldTonnesPerHa) || yieldTonnesPerHa <= 0) {
    throw new Error(
      "[worker-market-upsert-yield] --yield-tonnes-per-ha must be a positive number",
    );
  }

  if (
    seasonYear != null &&
    (!Number.isInteger(seasonYear) || seasonYear < 1900 || seasonYear > 3000)
  ) {
    throw new Error("[worker-market-upsert-yield] --season-year must be a valid integer year");
  }

  return runtime.services.market.upsertFieldYieldAssumption({
    workspaceId,
    fieldId,
    seasonYear: seasonYear ?? undefined,
    cropSymbol: cropSymbol ?? null,
    yieldTonnesPerHa,
    sourceKey,
    noteText,
    assumedAt,
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

  const assumption = await runMarketUpsertYield({ runtime, args });

  if (asJson) {
    console.log(JSON.stringify(assumption, null, 2));
    return;
  }

  console.log(
    [
      `field=${assumption.fieldId}`,
      `crop=${assumption.cropSymbol ?? "UNKNOWN"}`,
      `yield=${assumption.yieldTonnesPerHa.toFixed(2)} t/ha`,
      `season=${assumption.seasonYear ?? "none"}`,
      `source=${assumption.sourceKey}`,
      `assumedAt=${assumption.assumedAt}`,
    ].join(" "),
  );
}

const executedAsScript =
  typeof process.argv[1] === "string" &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (executedAsScript) {
  void main().catch((error: unknown) => {
    const message =
      error instanceof Error ? error.message : "Unknown yield assumption upsert failure";
    console.error(`[worker-market-upsert-yield] ${message}`);
    process.exitCode = 1;
  });
}
