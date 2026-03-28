import { loadWorkerEnv } from "./runtime/loadEnv";
import { createWorkerJobQueue } from "./runtime/createWorkerJobQueue";
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
  const requestedBy = readStringFlag(args, "requested-by");
  const forceRequeue = readBooleanFlag(args, "force-requeue");
  const asJson = readBooleanFlag(args, "json");
  const recovered = await queue.recoverStaleDispatches({
    limit,
    requestedBy,
    forceRequeue,
  });

  if (asJson) {
    console.log(JSON.stringify(recovered, null, 2));
    return;
  }

  if (recovered.length === 0) {
    console.log("No stale running dispatches were recovered.");
    return;
  }

  console.table(recovered.map((dispatch) => ({
    id: dispatch.id,
    key: dispatch.key,
    status: dispatch.status,
    attempts: dispatch.attempts,
    lockedBy: dispatch.lockedBy ?? "",
    cancelRequestedAt: dispatch.cancelRequestedAt ?? "",
    cancelReason: dispatch.cancelReason ?? "",
    updatedAt: dispatch.updatedAt,
    lastError: dispatch.lastError ?? "",
  })));
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown stale recovery failure";
  console.error(`[worker-recover-stale] ${message}`);
  process.exitCode = 1;
});
