import type { JobKey } from "@fieldpulse/platform-jobs";
import { loadWorkerEnv } from "./runtime/loadEnv";
import { createWorkerJobQueue } from "./runtime/createWorkerJobQueue";
import { formatDispatchTableRows } from "./runtime/jobCliFilters";
import {
  parseCliArgs,
  readBooleanFlag,
  readStringFlag,
} from "./runtime/parseCliArgs";

function readJobKey(
  key: string | undefined,
  allowedKeys: readonly JobKey[],
): JobKey {
  if (!key) {
    throw new Error("missing required --key flag");
  }

  if (!allowedKeys.includes(key as JobKey)) {
    throw new Error(
      `[worker-enqueue] invalid job key "${key}". Expected one of: ${allowedKeys.join(", ")}`,
    );
  }

  return key as JobKey;
}

function readPayloadJson(raw: string | undefined): unknown {
  if (!raw) {
    return undefined;
  }

  try {
    return JSON.parse(raw) as unknown;
  } catch (error: unknown) {
    throw new Error(
      `[worker-enqueue] invalid --payload-json value: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

async function main() {
  loadWorkerEnv();
  const queue = createWorkerJobQueue();
  const args = parseCliArgs();
  const key = readJobKey(
    readStringFlag(args, "key"),
    queue.listJobs().map((job) => job.key),
  );
  const useSamplePayload = readBooleanFlag(args, "sample");
  const payload = readPayloadJson(readStringFlag(args, "payload-json"));
  const asJson = readBooleanFlag(args, "json");

  if (!useSamplePayload && payload === undefined) {
    throw new Error("provide --sample or --payload-json");
  }

  const dispatch = await queue.enqueue({
    key,
    payload,
    useSamplePayload,
  });

  const record =
    dispatch.result && typeof dispatch.result === "object" && "id" in dispatch.result
      ? dispatch.result
      : dispatch;

  if (asJson) {
    console.log(JSON.stringify(record, null, 2));
    return;
  }

  console.table(
    formatDispatchTableRows([
      record as Parameters<typeof formatDispatchTableRows>[0][number],
    ]),
  );
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown enqueue failure";
  console.error(`[worker-enqueue] ${message}`);
  process.exitCode = 1;
});
