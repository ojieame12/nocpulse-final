import type { PersistentJobQueueAdapter } from "../contracts/PersistentJobQueue";
import type { JobKey } from "../contracts/RegisteredJob";

export type JobMetricsSnapshot = {
  generatedAt: string;
  health: Awaited<ReturnType<PersistentJobQueueAdapter["getQueueHealth"]>>;
  dispatchSummary: Awaited<
    ReturnType<PersistentJobQueueAdapter["listDispatchSummary"]>
  >;
  phaseTimingSummary: Awaited<
    ReturnType<PersistentJobQueueAdapter["listPhaseTimingSummary"]>
  >;
  attemptTimingSummary: Awaited<
    ReturnType<PersistentJobQueueAdapter["listAttemptTimingSummary"]>
  >;
};

export async function createJobMetricsSnapshot<TContext>(
  queue: PersistentJobQueueAdapter<TContext>,
  input: {
    keys?: readonly JobKey[];
    limit?: number;
  } = {},
): Promise<JobMetricsSnapshot> {
  const limit = input.limit ?? 500;
  const [health, dispatchSummary, phaseTimingSummary, attemptTimingSummary] =
    await Promise.all([
      queue.getQueueHealth(),
      queue.listDispatchSummary({
        keys: input.keys,
        limit,
      }),
      queue.listPhaseTimingSummary({
        keys: input.keys,
        limit,
      }),
      queue.listAttemptTimingSummary({
        keys: input.keys,
        limit,
      }),
    ]);

  return {
    generatedAt: new Date().toISOString(),
    health,
    dispatchSummary,
    phaseTimingSummary,
    attemptTimingSummary,
  };
}
