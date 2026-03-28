import { createServerRuntime } from "@fieldpulse/platform-runtime";
import { loadWorkerEnv } from "./runtime/loadEnv";
import { createWorkerJobQueue } from "./runtime/createWorkerJobQueue";
import { readJobKeys } from "./runtime/jobCliFilters";
import {
  parseCliArgs,
  readBooleanFlag,
  readNumberFlag,
} from "./runtime/parseCliArgs";
import {
  createWorkerMetricsSnapshot,
  renderPrometheusWorkerMetrics,
} from "./runtime/workerMetrics";

async function main() {
  loadWorkerEnv();
  const queue = createWorkerJobQueue();
  const runtime = createServerRuntime(process.env);
  const args = parseCliArgs();
  const keys = readJobKeys(
    args,
    queue.listJobs().map((job) => job.key),
    "worker-metrics",
  );
  const limit = readNumberFlag(args, "limit") ?? 500;
  const asJson = readBooleanFlag(args, "json");

  if (runtime.mode !== "supabase") {
    throw new Error("Supabase runtime is not configured");
  }

  const snapshot = await createWorkerMetricsSnapshot({
    queue,
    runtime,
    keys,
    limit,
  });

  if (asJson) {
    console.log(JSON.stringify(snapshot, null, 2));
    return;
  }

  process.stdout.write(renderPrometheusWorkerMetrics(snapshot));
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown metrics failure";
  console.error(`[worker-metrics] ${message}`);
  process.exitCode = 1;
});
