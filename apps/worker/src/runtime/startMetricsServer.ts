import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { type JobKey, type PersistentJobQueueAdapter } from "@fieldpulse/platform-jobs";
import type { Logger } from "@fieldpulse/platform-observability";
import type { ServerRuntime } from "@fieldpulse/platform-runtime";
import {
  createWorkerMetricsSnapshot,
  renderPrometheusWorkerMetrics,
} from "./workerMetrics";

type MetricsServerConfig = {
  enabled: boolean;
  host: string;
  port: number;
  summaryLimit: number;
};

type StartedMetricsServer = {
  close(): Promise<void>;
  url: string;
};

function readBooleanEnv(value: string | undefined, fallback: boolean) {
  if (!value) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();

  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  throw new Error(
    `[worker-metrics-server] invalid boolean value "${value}" for WORKER_METRICS_ENABLED`,
  );
}

function readIntegerEnv(
  name: string,
  value: string | undefined,
  fallback: number,
  predicate: (value: number) => boolean,
) {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || !predicate(parsed)) {
    throw new Error(`[worker-metrics-server] invalid integer for ${name}`);
  }

  return parsed;
}

function readMetricsServerConfig(env: NodeJS.ProcessEnv): MetricsServerConfig {
  return {
    enabled: readBooleanEnv(env.WORKER_METRICS_ENABLED, true),
    host: env.WORKER_METRICS_HOST?.trim() || "0.0.0.0",
    port: readIntegerEnv("WORKER_METRICS_PORT", env.WORKER_METRICS_PORT, 9464, (value) => value > 0 && value <= 65535),
    summaryLimit: readIntegerEnv("WORKER_METRICS_LIMIT", env.WORKER_METRICS_LIMIT, 500, (value) => value > 0 && value <= 10_000),
  };
}

function readRequestedJobKeys(
  requestUrl: URL,
  allowedKeys: readonly JobKey[],
): JobKey[] | undefined {
  const values = requestUrl.searchParams
    .getAll("key")
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean);

  if (values.length === 0) {
    return undefined;
  }

  for (const value of values) {
    if (!allowedKeys.includes(value as JobKey)) {
      throw new Error(
        `[worker-metrics-server] invalid job key "${value}". Expected one of: ${allowedKeys.join(", ")}`,
      );
    }
  }

  return values as JobKey[];
}

export async function startMetricsServer<TContext>(
  input: {
    env: NodeJS.ProcessEnv;
    logger: Logger;
    queue: PersistentJobQueueAdapter<TContext>;
    runtime: Extract<ServerRuntime, { mode: "supabase" }>;
  },
): Promise<StartedMetricsServer | null> {
  const config = readMetricsServerConfig(input.env);

  if (!config.enabled) {
    input.logger.info("job.metrics-server.disabled", {
      reason: "WORKER_METRICS_ENABLED=false",
    });
    return null;
  }

  const server = createServer(async (request, response) => {
    const requestUrl = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

    try {
      if (request.method !== "GET") {
        response.writeHead(405, {
          "content-type": "text/plain; charset=utf-8",
        });
        response.end("Method Not Allowed\n");
        return;
      }

      if (requestUrl.pathname === "/healthz") {
        response.writeHead(200, {
          "content-type": "text/plain; charset=utf-8",
        });
        response.end("ok\n");
        return;
      }

      if (requestUrl.pathname === "/readyz") {
        await input.queue.getQueueHealth();
        response.writeHead(200, {
          "content-type": "text/plain; charset=utf-8",
        });
        response.end("ready\n");
        return;
      }

      if (requestUrl.pathname === "/metrics" || requestUrl.pathname === "/metrics.json") {
        const keys = readRequestedJobKeys(
          requestUrl,
          input.queue.listJobs().map((job) => job.key),
        );
        const snapshot = await createWorkerMetricsSnapshot({
          queue: input.queue,
          runtime: input.runtime,
          keys,
          limit: config.summaryLimit,
        });

        if (requestUrl.pathname === "/metrics.json") {
          response.writeHead(200, {
            "content-type": "application/json; charset=utf-8",
          });
          response.end(JSON.stringify(snapshot, null, 2));
          return;
        }

        response.writeHead(200, {
          "content-type": "text/plain; version=0.0.4; charset=utf-8",
        });
        response.end(renderPrometheusWorkerMetrics(snapshot));
        return;
      }

      response.writeHead(404, {
        "content-type": "text/plain; charset=utf-8",
      });
      response.end("Not Found\n");
    } catch (error: unknown) {
      input.logger.error("job.metrics-server.request-failed", {
        path: requestUrl.pathname,
        message: error instanceof Error ? error.message : String(error),
      });

      response.writeHead(500, {
        "content-type": "text/plain; charset=utf-8",
      });
      response.end("Internal Server Error\n");
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(config.port, config.host, () => {
      server.off("error", reject);
      resolve();
    });
  });

  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("[worker-metrics-server] failed to resolve listen address");
  }

  const url = `http://${address.address}:${address.port}`;

  input.logger.info("job.metrics-server.started", {
    url,
    host: address.address,
    port: address.port,
    summaryLimit: config.summaryLimit,
  });

  return {
    url,
    close() {
      return new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          input.logger.info("job.metrics-server.stopped", {
            url,
          });
          resolve();
        });
      });
    },
  };
}
