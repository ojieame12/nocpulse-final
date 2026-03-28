import type {
  AnyRegisteredJob,
  JobCatalog,
  JobDispatchResult,
  JobQueueAdapter,
} from "../contracts/JobCatalog";
import type { JobKey } from "../contracts/RegisteredJob";

type CreateInlineJobQueueOptions<TContext> = {
  catalog: JobCatalog<TContext>;
  createContext: () => Promise<TContext> | TContext;
};

function requireJob<TContext>(
  catalog: JobCatalog<TContext>,
  key: JobKey,
): AnyRegisteredJob<TContext> {
  const job = catalog.getJob(key);

  if (!job) {
    throw new Error(`[jobs] job "${key}" is not registered`);
  }

  return job;
}

export function createInlineJobQueue<TContext>(
  options: CreateInlineJobQueueOptions<TContext>,
): JobQueueAdapter<TContext> {
  return {
    listJobs() {
      return options.catalog.listJobs();
    },
    async enqueue(input): Promise<JobDispatchResult> {
      const context = await options.createContext();
      const job = requireJob(options.catalog, input.key);

      const payload =
        input.payload !== undefined
          ? input.payload
          : input.useSamplePayload
            ? await job.samplePayload?.(context)
            : undefined;

      if (payload === undefined) {
        throw new Error(
          `[jobs] job "${job.key}" requires payload or samplePayload support`,
        );
      }

      const result = await job.run(context, payload, {
        dispatchId: "inline-dispatch",
        attempt: 1,
        workerName: "inline-queue",
        async reportProgress() {
          return;
        },
        async throwIfCancellationRequested() {
          return;
        },
      });

      return {
        key: job.key,
        payload,
        result,
      };
    },
  };
}
