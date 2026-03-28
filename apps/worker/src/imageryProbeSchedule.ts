import { createServerRuntime } from "@fieldpulse/platform-runtime";
import { loadWorkerEnv } from "./runtime/loadEnv";
import { createWorkerJobQueue } from "./runtime/createWorkerJobQueue";
import { formatDispatchTableRows } from "./runtime/jobCliFilters";
import { readRequestedAt } from "./runtime/readRequestedAt";
import { resolveWorkspaceDispatchTargets } from "./runtime/resolveWorkspaceDispatchTargets";
import {
  parseCliArgs,
  readBooleanFlag,
  readNumberFlag,
  readStringFlag,
} from "./runtime/parseCliArgs";

async function main() {
  loadWorkerEnv();
  const runtime = createServerRuntime(process.env);
  const queue = createWorkerJobQueue();
  const args = parseCliArgs();
  const asJson = readBooleanFlag(args, "json");
  const workspaceId = readStringFlag(args, "workspace-id");
  const fieldId = readStringFlag(args, "field-id");
  const limit = readNumberFlag(args, "limit");
  const requestedAt = readRequestedAt(
    readStringFlag(args, "requested-at"),
    "worker-imagery-probe-schedule",
  );

  if (runtime.mode !== "supabase") {
    throw new Error("Supabase runtime is not configured");
  }

  if (fieldId && !workspaceId) {
    throw new Error(
      "[worker-imagery-probe-schedule] --field-id requires --workspace-id",
    );
  }

  const targets = await resolveWorkspaceDispatchTargets({
    runtime,
    workspaceId,
    label: "worker-imagery-probe-schedule",
  });

  const dispatches = [];

  for (const target of targets) {
    const dispatch = await queue.enqueue({
      key: "imagery.schedule-workspace-provider-probes",
      payload: {
        workspaceId: target.workspaceId,
        requestedAt,
        fieldIds: fieldId ? [fieldId] : undefined,
        limit,
      },
    });

    dispatches.push({
      workspaceId: target.workspaceId,
      workspaceSlug: target.workspaceSlug,
      requestedAt,
      dispatch:
        dispatch.result && typeof dispatch.result === "object" && "id" in dispatch.result
          ? dispatch.result
          : dispatch,
    });
  }

  if (asJson) {
    console.log(JSON.stringify(dispatches, null, 2));
    return;
  }

  console.table(
    formatDispatchTableRows(
      dispatches.map((entry) => ({
        ...(entry.dispatch as Parameters<typeof formatDispatchTableRows>[0][number]),
        workspaceId: entry.workspaceId,
      })),
    ),
  );
}

void main().catch((error: unknown) => {
  const message =
    error instanceof Error
      ? error.message
      : "Unknown imagery probe schedule failure";
  console.error(`[worker-imagery-probe-schedule] ${message}`);
  process.exitCode = 1;
});
