import { loadWorkerEnv } from "./runtime/loadEnv";
import { createWorkerJobQueue } from "./runtime/createWorkerJobQueue";
import {
  readJobKeys,
  readPhaseRunStatuses,
} from "./runtime/jobCliFilters";
import { parseCliArgs, readBooleanFlag, readNumberFlag } from "./runtime/parseCliArgs";

async function main() {
  loadWorkerEnv();
  const queue = createWorkerJobQueue();
  const args = parseCliArgs();
  const keys = readJobKeys(
    args,
    queue.listJobs().map((job) => job.key),
    "worker-phase-summary",
  );
  const statuses = readPhaseRunStatuses(args, "worker-phase-summary");
  const limit = readNumberFlag(args, "limit") ?? 50;
  const asJson = readBooleanFlag(args, "json");
  const summary = await queue.listPhaseTimingSummary({
    keys,
    statuses,
    limit,
  });

  if (asJson) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  if (summary.length === 0) {
    console.log("No phase timing summaries matched the current filters.");
    return;
  }

  console.table(summary.map((row) => ({
    key: row.key,
    phaseKey: row.phaseKey,
    phaseLabel: row.phaseLabel,
    runCount: row.runCount,
    runningCount: row.runningCount,
    completedCount: row.completedCount,
    cancelledCount: row.cancelledCount,
    failedCount: row.failedCount,
    interruptedCount: row.interruptedCount,
    averageDurationMs: row.averageDurationMs ?? "",
    minDurationMs: row.minDurationMs ?? "",
    maxDurationMs: row.maxDurationMs ?? "",
    latestEndedAt: row.latestEndedAt ?? "",
  })));
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown phase summary failure";
  console.error(`[worker-phase-summary] ${message}`);
  process.exitCode = 1;
});
