import { loadWorkerEnv } from "./runtime/loadEnv";
import { createWorkerJobQueue } from "./runtime/createWorkerJobQueue";
import { parseCliArgs, readBooleanFlag } from "./runtime/parseCliArgs";

function toAgeSeconds(value: string | null) {
  if (!value) {
    return null;
  }

  const ageMs = Date.now() - new Date(value).getTime();
  return Math.max(0, Math.round(ageMs / 1_000));
}

async function main() {
  loadWorkerEnv();
  const queue = createWorkerJobQueue();
  const args = parseCliArgs();
  const asJson = readBooleanFlag(args, "json");
  const health = await queue.getQueueHealth();

  if (asJson) {
    console.log(JSON.stringify(health, null, 2));
    return;
  }

  console.table([{
    totalCount: health.totalCount,
    queuedCount: health.queuedCount,
    runningCount: health.runningCount,
    completedCount: health.completedCount,
    failedCount: health.failedCount,
    cancelledCount: health.cancelledCount,
    staleRunningCount: health.staleRunningCount,
    cancellationRequestedCount: health.cancellationRequestedCount,
    oldestQueuedAt: health.oldestQueuedAt ?? "",
    oldestQueuedAgeSeconds: toAgeSeconds(health.oldestQueuedAt) ?? "",
    oldestRunningAt: health.oldestRunningAt ?? "",
    oldestRunningAgeSeconds: toAgeSeconds(health.oldestRunningAt) ?? "",
    latestUpdatedAt: health.latestUpdatedAt ?? "",
  }]);
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown health failure";
  console.error(`[worker-health] ${message}`);
  process.exitCode = 1;
});
