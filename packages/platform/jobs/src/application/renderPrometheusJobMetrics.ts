import type { JobMetricsSnapshot } from "./createJobMetricsSnapshot";

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
    type?: "gauge" | "counter";
    samples: Array<{
      labels?: Record<string, string>;
      value: number | null;
    }>;
  },
) {
  lines.push(`# HELP ${input.name} ${input.help}`);
  lines.push(`# TYPE ${input.name} ${input.type ?? "gauge"}`);

  for (const sample of input.samples) {
    if (sample.value == null || Number.isNaN(sample.value)) {
      continue;
    }

    lines.push(
      `${input.name}${formatLabels(sample.labels ?? {})} ${sample.value}`,
    );
  }
}

export function renderPrometheusJobMetrics(snapshot: JobMetricsSnapshot) {
  const lines: string[] = [];

  pushMetricBlock(lines, {
    name: "fieldpulse_job_metrics_generated_at_seconds",
    help: "Unix timestamp when the job metrics snapshot was generated.",
    samples: [{
      value: Math.floor(new Date(snapshot.generatedAt).getTime() / 1_000),
    }],
  });

  pushMetricBlock(lines, {
    name: "fieldpulse_job_queue_health_total",
    help: "Current total number of job dispatch rows.",
    samples: [{ value: snapshot.health.totalCount }],
  });
  pushMetricBlock(lines, {
    name: "fieldpulse_job_queue_health_queued",
    help: "Current number of queued dispatches.",
    samples: [{ value: snapshot.health.queuedCount }],
  });
  pushMetricBlock(lines, {
    name: "fieldpulse_job_queue_health_running",
    help: "Current number of running dispatches.",
    samples: [{ value: snapshot.health.runningCount }],
  });
  pushMetricBlock(lines, {
    name: "fieldpulse_job_queue_health_completed",
    help: "Current number of completed dispatches.",
    samples: [{ value: snapshot.health.completedCount }],
  });
  pushMetricBlock(lines, {
    name: "fieldpulse_job_queue_health_failed",
    help: "Current number of failed dispatches.",
    samples: [{ value: snapshot.health.failedCount }],
  });
  pushMetricBlock(lines, {
    name: "fieldpulse_job_queue_health_cancelled",
    help: "Current number of cancelled dispatches.",
    samples: [{ value: snapshot.health.cancelledCount }],
  });
  pushMetricBlock(lines, {
    name: "fieldpulse_job_queue_health_stale_running",
    help: "Current number of stale running dispatches.",
    samples: [{ value: snapshot.health.staleRunningCount }],
  });
  pushMetricBlock(lines, {
    name: "fieldpulse_job_queue_health_cancellation_requested",
    help: "Current number of running dispatches with cancellation requested.",
    samples: [{ value: snapshot.health.cancellationRequestedCount }],
  });

  pushMetricBlock(lines, {
    name: "fieldpulse_job_dispatch_total",
    help: "Dispatch counts grouped by job key and dispatch status.",
    samples: snapshot.dispatchSummary.map((row) => ({
      labels: {
        job_key: row.key,
        status: row.status,
      },
      value: row.dispatchCount,
    })),
  });

  pushMetricBlock(lines, {
    name: "fieldpulse_job_dispatch_active_cancellation_total",
    help: "Dispatch counts with active cancellation requests grouped by job key and dispatch status.",
    samples: snapshot.dispatchSummary.map((row) => ({
      labels: {
        job_key: row.key,
        status: row.status,
      },
      value: row.activeCancellationCount,
    })),
  });

  pushMetricBlock(lines, {
    name: "fieldpulse_job_phase_run_total",
    help: "Phase-run counts grouped by job key, phase key, and phase-run status.",
    samples: snapshot.phaseTimingSummary.flatMap((row) => ([
      { labels: { job_key: row.key, phase_key: row.phaseKey, status: "running" }, value: row.runningCount },
      { labels: { job_key: row.key, phase_key: row.phaseKey, status: "completed" }, value: row.completedCount },
      { labels: { job_key: row.key, phase_key: row.phaseKey, status: "cancelled" }, value: row.cancelledCount },
      { labels: { job_key: row.key, phase_key: row.phaseKey, status: "failed" }, value: row.failedCount },
      { labels: { job_key: row.key, phase_key: row.phaseKey, status: "interrupted" }, value: row.interruptedCount },
    ])),
  });

  pushMetricBlock(lines, {
    name: "fieldpulse_job_phase_duration_ms_average",
    help: "Average phase duration in milliseconds grouped by job key and phase key.",
    samples: snapshot.phaseTimingSummary.map((row) => ({
      labels: {
        job_key: row.key,
        phase_key: row.phaseKey,
      },
      value: row.averageDurationMs,
    })),
  });
  pushMetricBlock(lines, {
    name: "fieldpulse_job_phase_duration_ms_min",
    help: "Minimum phase duration in milliseconds grouped by job key and phase key.",
    samples: snapshot.phaseTimingSummary.map((row) => ({
      labels: {
        job_key: row.key,
        phase_key: row.phaseKey,
      },
      value: row.minDurationMs,
    })),
  });
  pushMetricBlock(lines, {
    name: "fieldpulse_job_phase_duration_ms_max",
    help: "Maximum phase duration in milliseconds grouped by job key and phase key.",
    samples: snapshot.phaseTimingSummary.map((row) => ({
      labels: {
        job_key: row.key,
        phase_key: row.phaseKey,
      },
      value: row.maxDurationMs,
    })),
  });

  pushMetricBlock(lines, {
    name: "fieldpulse_job_attempt_total",
    help: "Attempt counts grouped by job key and attempt status.",
    samples: snapshot.attemptTimingSummary.map((row) => ({
      labels: {
        job_key: row.key,
        status: row.attemptStatus,
      },
      value: row.runCount,
    })),
  });
  pushMetricBlock(lines, {
    name: "fieldpulse_job_attempt_duration_ms_average",
    help: "Average total attempt duration in milliseconds grouped by job key and attempt status.",
    samples: snapshot.attemptTimingSummary.map((row) => ({
      labels: {
        job_key: row.key,
        status: row.attemptStatus,
      },
      value: row.averageDurationMs,
    })),
  });
  pushMetricBlock(lines, {
    name: "fieldpulse_job_attempt_duration_ms_min",
    help: "Minimum total attempt duration in milliseconds grouped by job key and attempt status.",
    samples: snapshot.attemptTimingSummary.map((row) => ({
      labels: {
        job_key: row.key,
        status: row.attemptStatus,
      },
      value: row.minDurationMs,
    })),
  });
  pushMetricBlock(lines, {
    name: "fieldpulse_job_attempt_duration_ms_max",
    help: "Maximum total attempt duration in milliseconds grouped by job key and attempt status.",
    samples: snapshot.attemptTimingSummary.map((row) => ({
      labels: {
        job_key: row.key,
        status: row.attemptStatus,
      },
      value: row.maxDurationMs,
    })),
  });

  return `${lines.join("\n")}\n`;
}
