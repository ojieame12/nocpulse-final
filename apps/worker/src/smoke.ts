import { loadWorkerEnv } from "./runtime/loadEnv";
import { createWorkerJobContext } from "./runtime/createWorkerJobContext";
import { createWorkerJobQueue } from "./runtime/createWorkerJobQueue";

async function main() {
  loadWorkerEnv();
  const context = await createWorkerJobContext();
  const queue = createWorkerJobQueue();
  const smokeJobs = queue
    .listJobs()
    .filter((job) => !job.key.startsWith("ops."))
    .filter((job) => job.key !== "imagery.schedule-workspace-provider-probes")
    .filter((job) => job.key !== "imagery.schedule-workspace-sync")
    .filter((job) => job.key !== "intelligence.schedule-workspace-disease-risk")
    .filter((job) => job.key !== "hail.schedule-workspace-refresh")
    .filter((job) => job.key !== "moisture.schedule-workspace-cell-backfill")
    .filter((job) => job.key !== "weather.schedule-workspace-refresh");

  for (const job of smokeJobs) {
    await queue.enqueue({
      key: job.key,
      useSamplePayload: true,
    });
  }

  const results = await queue.drain(smokeJobs.length);

  for (const dispatch of results) {
    context.logger.info("job.smoke.completed", dispatch);
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown worker smoke failure";
  console.error(`[worker-smoke] ${message}`);
  process.exitCode = 1;
});
