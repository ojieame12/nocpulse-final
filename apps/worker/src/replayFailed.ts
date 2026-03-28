import type {
  JobKey,
  PersistentJobDispatchRecord,
} from "@fieldpulse/platform-jobs";
import { loadWorkerEnv } from "./runtime/loadEnv";
import { createWorkerJobQueue } from "./runtime/createWorkerJobQueue";
import {
  parseCliArgs,
  readBooleanFlag,
  readCsvFlag,
  readNumberFlag,
} from "./runtime/parseCliArgs";

function readKeys(
  args: ReturnType<typeof parseCliArgs>,
  allowedKeys: readonly JobKey[],
) {
  const values = readCsvFlag(args, "key");

  if (values.length === 0) {
    return undefined;
  }

  for (const value of values) {
    if (!allowedKeys.includes(value as JobKey)) {
      throw new Error(
        `[worker-replay-failed] invalid job key "${value}". Expected one of: ${allowedKeys.join(", ")}`,
      );
    }
  }

  return values as JobKey[];
}

function mapReplayRow(dispatch: PersistentJobDispatchRecord) {
  return {
    id: dispatch.id,
    key: dispatch.key,
    status: dispatch.status,
    attempts: dispatch.attempts,
    availableAt: dispatch.availableAt,
    createdAt: dispatch.createdAt,
  };
}

async function main() {
  loadWorkerEnv();
  const queue = createWorkerJobQueue();
  const args = parseCliArgs();
  const limit = readNumberFlag(args, "limit") ?? 10;
  const keys = readKeys(
    args,
    queue.listJobs().map((job) => job.key),
  );
  const execute = readBooleanFlag(args, "execute");

  const failedDispatches = await queue.listDispatches({
    keys,
    statuses: ["failed"],
    limit,
  });

  if (failedDispatches.length === 0) {
    console.log("No failed job dispatches matched the current filters.");
    return;
  }

  if (!execute) {
    console.log(
      `Found ${failedDispatches.length} failed dispatches. Re-run with --execute to replay them.`,
    );
    console.table(failedDispatches.map(mapReplayRow));
    return;
  }

  const replayed = await queue.replayDispatches(
    failedDispatches.map((dispatch) => dispatch.id),
  );

  console.log(
    `Replayed ${replayed.length} failed dispatch${replayed.length === 1 ? "" : "es"}.`,
  );
  console.table(replayed.map(mapReplayRow));
}

void main().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.message : "Unknown replay-failed failure";
  console.error(`[worker-replay-failed] ${message}`);
  process.exitCode = 1;
});
