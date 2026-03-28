import {
  createPersistentJobQueue,
  type PersistentJobQueueAdapter,
} from "@fieldpulse/platform-jobs";
import { createSupabaseDatabaseClient } from "@fieldpulse/platform-db";
import { createServerRuntime } from "@fieldpulse/platform-runtime";
import { jobCatalog } from "../jobs/catalog";
import type { WorkerJobContext } from "../jobs/contracts/WorkerJobContext";
import {
  createQueueBackedWorkerJobContext,
} from "./createWorkerJobContext";

export function createWorkerJobQueue() {
  const runtime = createServerRuntime(process.env);

  if (runtime.mode !== "supabase") {
    throw new Error("[worker] Supabase runtime is required for queue access.");
  }

  if (!runtime.env.supabase.url || !runtime.env.supabase.serviceRoleKey) {
    throw new Error("[worker] Supabase runtime is missing URL or service role key.");
  }

  const client = createSupabaseDatabaseClient({
    url: runtime.env.supabase.url,
    serviceKey: runtime.env.supabase.serviceRoleKey,
  });

  let queue: PersistentJobQueueAdapter<WorkerJobContext>;

  queue = createPersistentJobQueue({
    catalog: jobCatalog,
    client,
    createContext: () =>
      createQueueBackedWorkerJobContext({
        enqueueJob(input) {
          return queue.enqueue(input);
        },
      }),
    workerName: `worker-${process.pid}`,
    retryPolicy: {
      maxAttempts: 4,
      baseDelayMs: 2_000,
      maxDelayMs: 60_000,
    },
    leasePolicy: {
      staleAfterSeconds: 300,
      heartbeatIntervalMs: 60_000,
    },
  });

  return queue;
}
