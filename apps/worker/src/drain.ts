import { readJobKeys } from "./runtime/jobCliFilters";
import { loadWorkerEnv } from "./runtime/loadEnv";
import { createWorkerJobContext } from "./runtime/createWorkerJobContext";
import { createWorkerJobQueue } from "./runtime/createWorkerJobQueue";
import { parseCliArgs, readNumberFlag } from "./runtime/parseCliArgs";

async function main() {
  loadWorkerEnv();
  const context = await createWorkerJobContext();
  const queue = createWorkerJobQueue();
  const args = parseCliArgs();
  const limit = readNumberFlag(args, "limit") ?? 10;
  const keys = readJobKeys(
    args,
    queue.listJobs().map((job) => job.key),
    "worker-drain",
  );
  const results = keys?.length
    ? await queue.drainMatching({
        limit,
        keys,
      })
    : await queue.drain(limit);

  if (results.length === 0) {
    context.logger.info("job.drain.idle", {
      queue: "persistent-db",
      keys: keys ?? null,
    });
    return;
  }

  for (const dispatch of results) {
    context.logger.info("job.drain.completed", {
      ...dispatch,
      filteredKeys: keys ?? null,
    });
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown worker drain failure";
  console.error(`[worker-drain] ${message}`);
  process.exitCode = 1;
});
