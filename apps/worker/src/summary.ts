import type { JobKey, PersistentJobDispatchStatus } from "@fieldpulse/platform-jobs";
import { loadWorkerEnv } from "./runtime/loadEnv";
import { createWorkerJobQueue } from "./runtime/createWorkerJobQueue";
import { readJobKeys, readJobStatuses } from "./runtime/jobCliFilters";
import { parseCliArgs, readNumberFlag } from "./runtime/parseCliArgs";

async function main() {
  loadWorkerEnv();
  const queue = createWorkerJobQueue();
  const args = parseCliArgs();
  const statuses = readJobStatuses(args, "worker-summary");
  const keys = readJobKeys(
    args,
    queue.listJobs().map((job) => job.key),
    "worker-summary",
  );
  const limit = readNumberFlag(args, "limit") ?? 200;
  const summary = await queue.listDispatchSummary({
    keys,
    statuses,
    limit,
  });

  if (summary.length === 0) {
    console.log("No job dispatches matched the current filters.");
    return;
  }

  console.table(summary.map((row) => ({
    key: row.key,
    status: row.status,
    count: row.dispatchCount,
    oldestCreatedAt: row.oldestCreatedAt ?? "",
    latestCreatedAt: row.latestCreatedAt ?? "",
    latestUpdatedAt: row.latestUpdatedAt ?? "",
    activeCancellationCount: row.activeCancellationCount,
  })));
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown summary failure";
  console.error(`[worker-summary] ${message}`);
  process.exitCode = 1;
});
