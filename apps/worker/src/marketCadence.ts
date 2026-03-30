import { pathToFileURL } from "node:url";
import type { GrainPriceSnapshot } from "@fieldpulse/module-market";
import type {
  JobDispatchResult,
  JobKey,
  PersistentJobDispatchRecord,
} from "@fieldpulse/platform-jobs";
import { createServerRuntime } from "@fieldpulse/platform-runtime";
import { normalizeRequestedMarketSymbols } from "./marketRefreshQuotes";
import { loadWorkerEnv } from "./runtime/loadEnv";
import { createWorkerJobQueue } from "./runtime/createWorkerJobQueue";
import { formatDispatchTableRows } from "./runtime/jobCliFilters";
import {
  parseCliArgs,
  readBooleanFlag,
  readCsvFlag,
  readNumberFlag,
  readStringFlag,
} from "./runtime/parseCliArgs";
import { readRequestedAt } from "./runtime/readRequestedAt";

export const MARKET_CADENCE_JOB_KEYS = ["market.refresh-prices"] as const;

export type MarketCadenceQueue = {
  enqueue(input: {
    key: "market.refresh-prices";
    payload: {
      requestedAt: string;
      cropSymbols?: readonly string[];
      dryRun: boolean;
    };
  }): Promise<JobDispatchResult>;
  drainMatching(input: {
    limit: number;
    keys: readonly JobKey[];
  }): Promise<readonly JobDispatchResult[]>;
};

export type RunMarketCadenceInput = {
  queue: MarketCadenceQueue;
  requestedAt: string;
  cropSymbols: readonly string[];
  dryRun: boolean;
  drainLimit: number;
  loadLatestPrice: (cropSymbol: string) => Promise<GrainPriceSnapshot | null>;
  sleepFn?: (ms: number) => Promise<void>;
};

export type MarketCadenceSnapshotEntry = {
  cropSymbol: string;
  snapshot: GrainPriceSnapshot | null;
  errorMessage: string | null;
};

type ScheduledDispatchRecord = Pick<
  PersistentJobDispatchRecord,
  "id" | "key" | "status"
> &
  Partial<PersistentJobDispatchRecord>;

function isScheduledDispatchRecord(
  value: unknown,
): value is ScheduledDispatchRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    "key" in value &&
    "status" in value
  );
}

function toScheduledDispatchRecord(
  dispatch: JobDispatchResult,
): ScheduledDispatchRecord {
  if (isScheduledDispatchRecord(dispatch.result)) {
    return dispatch.result;
  }

  throw new Error(
    "[worker-market-cadence] persistent queue enqueue did not return a dispatch record",
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function drainScheduledMarketJobs(input: {
  queue: MarketCadenceQueue;
  limit: number;
  sleepFn?: (ms: number) => Promise<void>;
}) {
  const drained = await input.queue.drainMatching({
    limit: input.limit,
    keys: [...MARKET_CADENCE_JOB_KEYS],
  });

  if (drained.length > 0) {
    return drained;
  }

  await (input.sleepFn ?? sleep)(350);

  return input.queue.drainMatching({
    limit: input.limit,
    keys: [...MARKET_CADENCE_JOB_KEYS],
  });
}

export async function runMarketCadence(input: RunMarketCadenceInput) {
  const normalizedCropSymbols = normalizeRequestedMarketSymbols(input.cropSymbols);
  const dispatch = await input.queue.enqueue({
    key: "market.refresh-prices",
    payload: {
      requestedAt: input.requestedAt,
      cropSymbols: normalizedCropSymbols,
      dryRun: input.dryRun,
    },
  });

  const drainedDispatches = await drainScheduledMarketJobs({
    queue: input.queue,
    limit: input.drainLimit,
    sleepFn: input.sleepFn,
  });

  const latestSnapshots: MarketCadenceSnapshotEntry[] = await Promise.all(
    normalizedCropSymbols.map(async (cropSymbol) => {
      try {
        return {
          cropSymbol,
          snapshot: await input.loadLatestPrice(cropSymbol),
          errorMessage: null,
        };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(
          `[worker-market-cadence] failed to load latest snapshot for ${cropSymbol}: ${message}`,
        );
        return {
          cropSymbol,
          snapshot: null,
          errorMessage: message,
        };
      }
    }),
  );

  return {
    requestedAt: input.requestedAt,
    cropSymbols: normalizedCropSymbols,
    scheduledDispatch: toScheduledDispatchRecord(dispatch),
    drainedDispatches,
    latestSnapshots,
  };
}

async function main() {
  loadWorkerEnv();
  const runtime = createServerRuntime(process.env);
  const queue = createWorkerJobQueue();
  const args = parseCliArgs();
  const asJson = readBooleanFlag(args, "json");
  const dryRun = readBooleanFlag(args, "dry-run");
  const cropSymbols = readCsvFlag(args, "crop-symbols");
  const requestedAt = readRequestedAt(
    readStringFlag(args, "requested-at"),
    "worker-market-cadence",
  );
  const drainLimit = readNumberFlag(args, "drain-limit") ?? 10;

  if (runtime.mode !== "supabase") {
    throw new Error("Supabase runtime is not configured");
  }

  const result = await runMarketCadence({
    queue,
    requestedAt,
    cropSymbols,
    dryRun,
    drainLimit,
    loadLatestPrice(cropSymbol) {
      return runtime.services.market.latestPrice({ cropSymbol });
    },
  });

  if (asJson) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log("Queued market refresh job");
  console.table(
    formatDispatchTableRows([
      result.scheduledDispatch as Parameters<typeof formatDispatchTableRows>[0][number],
    ]),
  );

  console.log(
    [
      "",
      "Market cadence summary",
      `Requested at: ${result.requestedAt}`,
      `Filtered keys: ${MARKET_CADENCE_JOB_KEYS.join(", ")}`,
      `Drained dispatches: ${result.drainedDispatches.length}`,
      `Crop symbols: ${result.cropSymbols.join(", ")}`,
    ].join("\n"),
  );

  if (result.latestSnapshots.length > 0) {
    console.log("\nLatest market snapshots");
    console.table(
      result.latestSnapshots.map((entry) => ({
        cropSymbol: entry.cropSymbol,
        status: entry.errorMessage ? "error" : entry.snapshot ? "loaded" : "missing",
        priceCadPerTonne: entry.snapshot?.closePriceCadPerTonne ?? "",
        basisCadPerTonne: entry.snapshot?.basisCadPerTonne ?? "",
        sourceKey: entry.snapshot?.sourceKey ?? "",
        capturedAt: entry.snapshot?.capturedAt ?? "",
        error: entry.errorMessage ?? "",
      })),
    );
  }
}

const executedAsScript =
  typeof process.argv[1] === "string" &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (executedAsScript) {
  void main().catch((error: unknown) => {
    const message =
      error instanceof Error ? error.message : "Unknown market cadence failure";
    console.error(`[worker-market-cadence] ${message}`);
    process.exitCode = 1;
  });
}
