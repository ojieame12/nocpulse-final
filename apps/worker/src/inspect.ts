import { loadWorkerEnv } from "./runtime/loadEnv";
import { createWorkerJobQueue } from "./runtime/createWorkerJobQueue";
import {
  formatDispatchTableRows,
  readJobKeys,
  readJobStatuses,
} from "./runtime/jobCliFilters";
import {
  parseCliArgs,
  readBooleanFlag,
  readNumberFlag,
  readStringFlag,
} from "./runtime/parseCliArgs";

async function main() {
  loadWorkerEnv();
  const queue = createWorkerJobQueue();
  const args = parseCliArgs();
  const limit = readNumberFlag(args, "limit") ?? 20;
  const dispatchId = readStringFlag(args, "id");
  const keys = readJobKeys(
    args,
    queue.listJobs().map((job) => job.key),
    "worker-inspect",
  );
  const statuses = readJobStatuses(args, "worker-inspect");
  const asJson = readBooleanFlag(args, "json");

  const dispatches = await queue.listDispatches({
    ids: dispatchId ? [dispatchId] : undefined,
    keys,
    statuses,
    limit,
  });

  if (asJson) {
    console.log(JSON.stringify(dispatches, null, 2));
    return;
  }

  if (dispatches.length === 0) {
    console.log("No job dispatches matched the current filters.");
    return;
  }

  console.table(
    formatDispatchTableRows(dispatches),
  );
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown inspect failure";
  console.error(`[worker-inspect] ${message}`);
  process.exitCode = 1;
});
