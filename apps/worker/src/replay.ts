import { loadWorkerEnv } from "./runtime/loadEnv";
import { createWorkerJobQueue } from "./runtime/createWorkerJobQueue";
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
  const asJson = readBooleanFlag(args, "json");

  if (!dispatchId) {
    throw new Error("missing required --id flag");
  }

  const replayed = await queue.replayDispatch(dispatchId);

  if (asJson) {
    console.log(JSON.stringify(replayed, null, 2));
    return;
  }

  console.log(`Replayed dispatch ${dispatchId} as ${replayed.id}`);
  console.table([
    {
      id: replayed.id,
      key: replayed.key,
      status: replayed.status,
      attempts: replayed.attempts,
      availableAt: replayed.availableAt,
      createdAt: replayed.createdAt,
    },
  ]);
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown replay failure";
  console.error(`[worker-replay] ${message}`);
  process.exitCode = 1;
});
