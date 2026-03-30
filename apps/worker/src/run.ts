import {
  isJobCancellationRequestedError,
  isJobLeaseLostError,
  runPersistentJobWorker,
} from "@fieldpulse/platform-jobs";
import { loadWorkerEnv } from "./runtime/loadEnv";
import { createWorkerJobContext } from "./runtime/createWorkerJobContext";
import { createWorkerJobQueue } from "./runtime/createWorkerJobQueue";
import { startMetricsServer } from "./runtime/startMetricsServer";

async function main() {
  loadWorkerEnv();
  const context = await createWorkerJobContext();
  const queue = createWorkerJobQueue();
  const metricsServer = await startMetricsServer({
    env: process.env,
    logger: context.logger,
    queue,
    runtime: context.runtime,
  });
  const controller = new AbortController();

  const shutdown = () => {
    controller.abort();
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);

  context.logger.info("job.worker.started", {
    queue: "persistent-db",
    batchSize: 5,
    idleDelayMs: 5000,
    metricsUrl: metricsServer?.url ?? null,
  });

  try {
    await runPersistentJobWorker({
      queue,
      batchSize: 5,
      idleDelayMs: 5000,
      errorDelayMs: 3000,
      signal: controller.signal,
      onDispatch(result) {
        context.logger.info("job.worker.completed", result);
      },
      onIdle() {
        context.logger.debug("job.worker.idle", {
          queue: "persistent-db",
        });
      },
      onError(error) {
        if (isJobCancellationRequestedError(error)) {
          context.logger.info("job.worker.cancelled", {
            message: error.message,
          });
          return;
        }

        if (isJobLeaseLostError(error)) {
          context.logger.error("job.worker.lease-lost", {
            message: error.message,
            dispatchId: error.dispatchId,
            workerName: error.workerName,
            context: error.context,
          });
          return;
        }

        context.logger.error("job.worker.error", {
          message: error instanceof Error ? error.message : String(error),
        });
      },
    });
  } finally {
    await metricsServer?.close();
    context.logger.info("job.worker.stopped", {
      queue: "persistent-db",
    });
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown worker loop failure";
  console.error(`[worker-run] ${message}`);
  process.exitCode = 1;
});
