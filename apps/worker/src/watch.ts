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

function sleep(durationMs: number, signal: AbortSignal) {
  if (signal.aborted) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    const timeout = setTimeout(() => {
      cleanup();
      resolve();
    }, durationMs);

    const onAbort = () => {
      clearTimeout(timeout);
      cleanup();
      resolve();
    };

    const cleanup = () => {
      signal.removeEventListener("abort", onAbort);
    };

    signal.addEventListener("abort", onAbort, { once: true });
  });
}

function renderSnapshot(snapshot: unknown) {
  console.clear();
  console.log(`[worker-watch] ${new Date().toISOString()}`);
  if (Array.isArray(snapshot) && snapshot.length === 0) {
    console.log("No job dispatches matched the current filters.");
    return;
  }

  console.table(snapshot);
}

async function main() {
  loadWorkerEnv();
  const queue = createWorkerJobQueue();
  const args = parseCliArgs();
  const intervalMs = readNumberFlag(args, "interval-ms") ?? 1_000;
  const limit = readNumberFlag(args, "limit") ?? 20;
  const dispatchId = readStringFlag(args, "id");
  const once = readBooleanFlag(args, "once");
  const stopWhenSettled = dispatchId
    ? !readBooleanFlag(args, "keep-watching")
    : readBooleanFlag(args, "stop-when-settled");
  const keys = readJobKeys(
    args,
    queue.listJobs().map((job) => job.key),
    "worker-watch",
  );
  const statuses = readJobStatuses(args, "worker-watch");
  const controller = new AbortController();

  const shutdown = () => {
    controller.abort();
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);

  let lastSnapshot = "";

  while (!controller.signal.aborted) {
    const resolved = dispatchId
      ? await queue.getDispatchById(dispatchId)
      : await queue.listDispatches({
          keys,
          statuses,
          limit,
        });

    const rows = formatDispatchTableRows(
      Array.isArray(resolved) ? resolved : resolved ? [resolved] : [],
    );
    const serialized = JSON.stringify(rows);

    if (serialized !== lastSnapshot) {
      renderSnapshot(rows);
      lastSnapshot = serialized;
    }

    if (once) {
      return;
    }

    if (
      dispatchId
      && stopWhenSettled
      && (rows.length === 0
        || (rows[0].status !== "queued" && rows[0].status !== "running"))
    ) {
      return;
    }

    await sleep(intervalMs, controller.signal);
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown watch failure";
  console.error(`[worker-watch] ${message}`);
  process.exitCode = 1;
});
