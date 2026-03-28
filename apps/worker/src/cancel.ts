import { loadWorkerEnv } from "./runtime/loadEnv";
import { createWorkerJobQueue } from "./runtime/createWorkerJobQueue";
import { formatDispatchTableRows } from "./runtime/jobCliFilters";
import {
  parseCliArgs,
  readBooleanFlag,
  readStringFlag,
} from "./runtime/parseCliArgs";

async function main() {
  loadWorkerEnv();
  const queue = createWorkerJobQueue();
  const args = parseCliArgs();
  const dispatchId = readStringFlag(args, "id");
  const reason = readStringFlag(args, "reason");
  const requestedBy = readStringFlag(args, "requested-by");
  const asJson = readBooleanFlag(args, "json");

  if (!dispatchId) {
    throw new Error("missing required --id flag");
  }

  const cancelled = await queue.cancelDispatch(dispatchId, {
    requestedBy,
    reason,
  });

  if (asJson) {
    console.log(JSON.stringify(cancelled, null, 2));
    return;
  }

  console.table(formatDispatchTableRows([cancelled]));
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown cancel failure";
  console.error(`[worker-cancel] ${message}`);
  process.exitCode = 1;
});
