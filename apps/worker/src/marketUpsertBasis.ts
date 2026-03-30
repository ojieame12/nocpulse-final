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

export type MarketUpsertBasisRuntime = {
  mode: string;
  services: {
    market: {
      upsertFieldBasisAssumption(input: {
        workspaceId: string;
        fieldId: string;
        seasonYear?: number;
        cropSymbol: string | null;
        basisCadPerTonne: number;
        sourceKey: string;
        noteText?: string;
        assumedAt?: string;
      }): Promise<{
        fieldId: string;
        cropSymbol: string | null;
        basisCadPerTonne: number;
        seasonYear: number | null;
        sourceKey: string;
        assumedAt: string;
      }>;
    };
  };
};

export async function runMarketUpsertBasis(input: {
  runtime: MarketUpsertBasisRuntime;
  args: ParsedCliArgs;
}) {
  const { runtime, args } = input;
  const workspaceId = readStringFlag(args, "workspace-id")?.trim();
  const fieldId = readStringFlag(args, "field-id")?.trim();
  const cropSymbol = readStringFlag(args, "crop")?.trim().toUpperCase();
  const basisCadPerTonne =
    readNumberFlag(args, "basis-cad-per-tonne") ?? readNumberFlag(args, "basis");
  const seasonYear = readNumberFlag(args, "season-year");
  const sourceKey = readStringFlag(args, "source")?.trim() ?? "manual-admin";
  const noteText = readStringFlag(args, "note")?.trim();
  const assumedAt = readStringFlag(args, "assumed-at")?.trim();

  if (runtime.mode !== "supabase") {
    throw new Error("Supabase runtime is not configured");
  }

  if (!workspaceId) {
    throw new Error("[worker-market-upsert-basis] --workspace-id is required");
  }

  if (!fieldId) {
    throw new Error("[worker-market-upsert-basis] --field-id is required");
  }

  if (basisCadPerTonne == null || !Number.isFinite(basisCadPerTonne)) {
    throw new Error(
      "[worker-market-upsert-basis] --basis-cad-per-tonne must be a number",
    );
  }

  if (
    seasonYear != null &&
    (!Number.isInteger(seasonYear) || seasonYear < 1900 || seasonYear > 3000)
  ) {
    throw new Error("[worker-market-upsert-basis] --season-year must be a valid integer year");
  }

  return runtime.services.market.upsertFieldBasisAssumption({
    workspaceId,
    fieldId,
    seasonYear: seasonYear ?? undefined,
    cropSymbol: cropSymbol ?? null,
    basisCadPerTonne,
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

  const assumption = await runMarketUpsertBasis({ runtime, args });

  if (asJson) {
    console.log(JSON.stringify(assumption, null, 2));
    return;
  }

  console.log(
    [
      `field=${assumption.fieldId}`,
      `crop=${assumption.cropSymbol ?? "UNKNOWN"}`,
      `basis=${assumption.basisCadPerTonne.toFixed(2)} CAD/t`,
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
      error instanceof Error ? error.message : "Unknown basis assumption upsert failure";
    console.error(`[worker-market-upsert-basis] ${message}`);
    process.exitCode = 1;
  });
}
