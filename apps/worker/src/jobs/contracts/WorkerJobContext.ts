import type { Logger } from "@fieldpulse/platform-observability";
import type { JobDispatchResult, JobKey } from "@fieldpulse/platform-jobs";
import type { ServerRuntime } from "@fieldpulse/platform-runtime";

export type SupabaseServerRuntime = Extract<ServerRuntime, { mode: "supabase" }>;

export type WorkerFieldTarget = {
  workspaceId: string;
  fieldId: string;
};

export type WorkerJobContext = {
  logger: Logger;
  runtime: SupabaseServerRuntime;
  enqueueJob(input: {
    key: JobKey;
    payload?: unknown;
    useSamplePayload?: boolean;
  }): Promise<JobDispatchResult>;
  resolveDefaultFieldTarget(): Promise<WorkerFieldTarget>;
};
