import type { JobKey, RegisteredJob } from "./RegisteredJob";

export type AnyRegisteredJob<TContext = unknown> = RegisteredJob<
  TContext,
  unknown,
  unknown
>;

export type JobCatalog<TContext = unknown> = {
  listJobs(): readonly AnyRegisteredJob<TContext>[];
  getJob(key: JobKey): AnyRegisteredJob<TContext> | null;
};

export type JobDispatchResult = {
  key: JobKey;
  payload: unknown;
  result: unknown;
};

export type JobQueueAdapter<TContext = unknown> = {
  listJobs(): readonly AnyRegisteredJob<TContext>[];
  enqueue(input: {
    key: JobKey;
    payload?: unknown;
    useSamplePayload?: boolean;
  }): Promise<JobDispatchResult>;
};
