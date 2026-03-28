import type { JobDispatchResult } from "../contracts/JobCatalog";
import type {
  PersistentJobQueueAdapter,
  PersistentJobWorkerLoopOptions,
} from "../contracts/PersistentJobQueue";

function sleep(
  durationMs: number,
  signal: AbortSignal | undefined,
): Promise<void> {
  if (signal?.aborted) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      cleanup();
      resolve();
    }, durationMs);

    const onAbort = () => {
      clearTimeout(timeout);
      cleanup();
      resolve();
    };

    const cleanup = () => {
      signal?.removeEventListener("abort", onAbort);
    };

    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

async function notifyDispatch(
  result: JobDispatchResult,
  onDispatch: PersistentJobWorkerLoopOptions<unknown>["onDispatch"],
) {
  await onDispatch?.(result);
}

async function notifyError(
  error: unknown,
  onError: PersistentJobWorkerLoopOptions<unknown>["onError"],
) {
  await onError?.(error);
}

async function notifyIdle(
  onIdle: PersistentJobWorkerLoopOptions<unknown>["onIdle"],
) {
  await onIdle?.();
}

export async function runPersistentJobWorker<TContext>(
  options: PersistentJobWorkerLoopOptions<TContext> & {
    queue: PersistentJobQueueAdapter<TContext>;
  },
): Promise<void> {
  const batchSize = options.batchSize ?? 1;
  const idleDelayMs = options.idleDelayMs ?? 5000;
  const errorDelayMs = options.errorDelayMs ?? idleDelayMs;

  while (!options.signal?.aborted) {
    try {
      const results = await options.queue.drain(batchSize);

      if (results.length === 0) {
        await notifyIdle(
          options.onIdle as PersistentJobWorkerLoopOptions<unknown>["onIdle"],
        );
        await sleep(idleDelayMs, options.signal);
        continue;
      }

      for (const result of results) {
        await notifyDispatch(
          result,
          options.onDispatch as PersistentJobWorkerLoopOptions<unknown>["onDispatch"],
        );
      }
    } catch (error: unknown) {
      await notifyError(
        error,
        options.onError as PersistentJobWorkerLoopOptions<unknown>["onError"],
      );
      await sleep(errorDelayMs, options.signal);
    }
  }
}
