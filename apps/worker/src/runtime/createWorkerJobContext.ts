import { createLogger } from "@fieldpulse/platform-observability";
import type { JobDispatchResult, JobKey } from "@fieldpulse/platform-jobs";
import { createServerRuntime } from "@fieldpulse/platform-runtime";
import type { WorkerFieldTarget, WorkerJobContext } from "../jobs/contracts/WorkerJobContext";

async function resolveDefaultFieldTarget(
  runtime: WorkerJobContext["runtime"],
): Promise<WorkerFieldTarget> {
  const selection = await runtime.services.catalog.loadWorkspaceFieldOverview({
    actorUserId: runtime.env.devActorUserId,
    preferredWorkspaceId: runtime.env.devWorkspaceId,
  });

  if (!selection.selectedWorkspace || !selection.primaryField) {
    throw new Error(
      "[worker] no workspace/field available. Run `corepack pnpm bootstrap:dev-data` first.",
    );
  }

  return {
    workspaceId: selection.selectedWorkspace.id,
    fieldId: selection.primaryField.id,
  };
}

export async function createWorkerJobContext(): Promise<WorkerJobContext> {
  const runtime = createServerRuntime(process.env);

  if (runtime.mode !== "supabase") {
    throw new Error("[worker] Supabase runtime is required for job execution.");
  }

  const logger = createLogger("worker");

  return {
    logger,
    runtime,
    enqueueJob() {
      throw new Error(
        "[worker] enqueueJob is not bound in the standalone context. Use the queue-backed worker runtime.",
      );
    },
    resolveDefaultFieldTarget() {
      return resolveDefaultFieldTarget(runtime);
    },
  };
}

export async function createQueueBackedWorkerJobContext(input: {
  enqueueJob: (request: {
    key: JobKey;
    payload?: unknown;
    useSamplePayload?: boolean;
  }) => Promise<JobDispatchResult>;
}): Promise<WorkerJobContext> {
  const context = await createWorkerJobContext();

  return {
    ...context,
    enqueueJob(request) {
      return input.enqueueJob(request);
    },
  };
}
