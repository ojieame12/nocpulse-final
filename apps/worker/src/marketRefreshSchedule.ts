import { createServerRuntime } from "@fieldpulse/platform-runtime";
import { loadWorkerEnv } from "./runtime/loadEnv";
import { createWorkerJobQueue } from "./runtime/createWorkerJobQueue";
import { formatDispatchTableRows } from "./runtime/jobCliFilters";
import {
  parseCliArgs,
  readBooleanFlag,
  readCsvFlag,
  readStringFlag,
} from "./runtime/parseCliArgs";
import { readRequestedAt } from "./runtime/readRequestedAt";

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
    "worker-market-refresh-schedule",
  );

  if (runtime.mode !== "supabase") {
    throw new Error("Supabase runtime is not configured");
  }

  const dispatch = await queue.enqueue({
    key: "market.refresh-prices",
    payload: {
      requestedAt,
      cropSymbols: cropSymbols.length > 0 ? cropSymbols : undefined,
      dryRun,
    },
  });

  const row =
    dispatch.result && typeof dispatch.result === "object" && "id" in dispatch.result
      ? dispatch.result
      : dispatch;

  if (asJson) {
    console.log(JSON.stringify(row, null, 2));
    return;
  }

  console.table(
    formatDispatchTableRows([
      row as Parameters<typeof formatDispatchTableRows>[0][number],
    ]),
  );
}

void main().catch((error: unknown) => {
  const message =
    error instanceof Error
      ? error.message
      : "Unknown market refresh schedule failure";
  console.error(`[worker-market-refresh-schedule] ${message}`);
  process.exitCode = 1;
});
