import { readCsvFlag, parseCliArgs, readBooleanFlag, readNumberFlag, readStringFlag } from "./runtime/parseCliArgs";
import { loadWorkerEnv } from "./runtime/loadEnv";
import { createWorkerJobQueue } from "./runtime/createWorkerJobQueue";
import {
  readAttemptStatuses,
  readJobKeys,
} from "./runtime/jobCliFilters";

function readAttemptNumbers(args: ReturnType<typeof parseCliArgs>, context: string) {
  const values = readCsvFlag(args, "attempt");

  if (values.length === 0) {
    return undefined;
  }

  return values.map((value) => {
    const parsed = Number(value);

    if (!Number.isInteger(parsed) || parsed < 1) {
      throw new Error(`[${context}] invalid attempt "${value}". Expected a positive integer.`);
    }

    return parsed;
  });
}

async function main() {
  loadWorkerEnv();
  const queue = createWorkerJobQueue();
  const args = parseCliArgs();
  const dispatchId = readStringFlag(args, "id");
  const keys = readJobKeys(
    args,
    queue.listJobs().map((job) => job.key),
    "worker-attempts",
  );
  const attempts = readAttemptNumbers(args, "worker-attempts");
  const statuses = readAttemptStatuses(args, "worker-attempts");
  const limit = readNumberFlag(args, "limit") ?? 50;
  const asJson = readBooleanFlag(args, "json");
  const timelines = await queue.listAttemptTimelines({
    dispatchIds: dispatchId ? [dispatchId] : undefined,
    keys,
    attempts,
    statuses,
    limit,
  });

  if (asJson) {
    console.log(JSON.stringify(timelines, null, 2));
    return;
  }

  if (timelines.length === 0) {
    console.log("No attempt timelines matched the current filters.");
    return;
  }

  console.table(timelines.map((row) => ({
    dispatchId: row.dispatchId,
    key: row.key,
    attempt: row.attempt,
    attemptStatus: row.attemptStatus,
    attemptStartedAt: row.attemptStartedAt ?? "",
    attemptEndedAt: row.attemptEndedAt ?? "",
    phaseRunCount: row.phaseRunCount,
    runningPhaseCount: row.runningPhaseCount,
    completedPhaseCount: row.completedPhaseCount,
    cancelledPhaseCount: row.cancelledPhaseCount,
    failedPhaseCount: row.failedPhaseCount,
    interruptedPhaseCount: row.interruptedPhaseCount,
    totalPhaseDurationMs: row.totalPhaseDurationMs ?? "",
    latestPhaseUpdatedAt: row.latestPhaseUpdatedAt ?? "",
  })));
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown attempt timeline failure";
  console.error(`[worker-attempts] ${message}`);
  process.exitCode = 1;
});
