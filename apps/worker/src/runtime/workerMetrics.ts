import type { ImageryProviderDiagnostics } from "@fieldpulse/module-imagery";
import {
  createJobMetricsSnapshot,
  renderPrometheusJobMetrics,
  type JobKey,
  type JobMetricsSnapshot,
  type PersistentJobQueueAdapter,
} from "@fieldpulse/platform-jobs";
import type { ServerRuntime } from "@fieldpulse/platform-runtime";

export type WorkerMetricsSnapshot = {
  jobs: JobMetricsSnapshot;
  imageryProviders: readonly ImageryProviderDiagnostics[];
};

type CreateWorkerMetricsSnapshotInput<TContext> = {
  queue: PersistentJobQueueAdapter<TContext>;
  runtime: Extract<ServerRuntime, { mode: "supabase" }>;
  keys?: readonly JobKey[];
  limit?: number;
};

function escapeLabelValue(value: string) {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("\n", "\\n")
    .replaceAll("\"", "\\\"");
}

function formatLabels(labels: Record<string, string>) {
  const entries = Object.entries(labels);

  if (entries.length === 0) {
    return "";
  }

  return `{${entries
    .map(([key, value]) => `${key}="${escapeLabelValue(value)}"`)
    .join(",")}}`;
}

function pushMetricBlock(
  lines: string[],
  input: {
    name: string;
    help: string;
    samples: Array<{
      labels?: Record<string, string>;
      value: number | null;
    }>;
  },
) {
  lines.push(`# HELP ${input.name} ${input.help}`);
  lines.push(`# TYPE ${input.name} gauge`);

  for (const sample of input.samples) {
    if (sample.value == null || Number.isNaN(sample.value)) {
      continue;
    }

    lines.push(`${input.name}${formatLabels(sample.labels ?? {})} ${sample.value}`);
  }
}

export async function createWorkerMetricsSnapshot<TContext>({
  queue,
  runtime,
  keys,
  limit,
}: CreateWorkerMetricsSnapshotInput<TContext>): Promise<WorkerMetricsSnapshot> {
  const [jobs, imageryProviders] = await Promise.all([
    createJobMetricsSnapshot(queue, { keys, limit }),
    runtime.services.imagery.inspectProviders(),
  ]);

  return {
    jobs,
    imageryProviders,
  };
}

export function renderPrometheusWorkerMetrics(snapshot: WorkerMetricsSnapshot) {
  const lines = [renderPrometheusJobMetrics(snapshot.jobs).trimEnd()];

  pushMetricBlock(lines, {
    name: "fieldpulse_imagery_provider_state",
    help: "Current imagery provider state by provider and status.",
    samples: snapshot.imageryProviders.map((provider) => ({
      labels: {
        provider: provider.provider,
        status: provider.status,
      },
      value: 1,
    })),
  });

  pushMetricBlock(lines, {
    name: "fieldpulse_imagery_provider_discovery_mode",
    help: "Current imagery provider discovery mode by provider and mode.",
    samples: snapshot.imageryProviders.map((provider) => ({
      labels: {
        provider: provider.provider,
        mode: provider.discoveryMode,
      },
      value: 1,
    })),
  });

  pushMetricBlock(lines, {
    name: "fieldpulse_imagery_provider_materialization_mode",
    help: "Current imagery provider materialization mode by provider and mode.",
    samples: snapshot.imageryProviders.map((provider) => ({
      labels: {
        provider: provider.provider,
        mode: provider.materializationMode,
      },
      value: 1,
    })),
  });

  pushMetricBlock(lines, {
    name: "fieldpulse_imagery_provider_client_info",
    help: "Current imagery provider client wiring by provider.",
    samples: snapshot.imageryProviders.map((provider) => ({
      labels: {
        provider: provider.provider,
        discovery_client: provider.discoveryClient ?? "",
        materialization_client: provider.materializationClient ?? "",
        fallback_client: provider.fallbackClient ?? "",
      },
      value: 1,
    })),
  });

  return `${lines.join("\n")}\n`;
}
