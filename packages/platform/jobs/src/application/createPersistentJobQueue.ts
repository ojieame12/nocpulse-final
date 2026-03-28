import {
  requireSupabaseData,
  type DatabaseClient,
  type DatabaseSchema,
  type JsonValue,
} from "@fieldpulse/platform-db";
import type {
  AnyRegisteredJob,
  JobCatalog,
  JobDispatchResult,
} from "../contracts/JobCatalog";
import type {
  PersistentJobAttemptStatus,
  PersistentJobAttemptTimingSummaryInput,
  PersistentJobAttemptTimingSummaryRecord,
  PersistentJobAttemptTimelineListInput,
  PersistentJobAttemptTimelineRecord,
  PersistentJobCancelInput,
  PersistentJobDrainInput,
  PersistentJobDispatchListInput,
  PersistentJobPhaseRunListInput,
  PersistentJobPhaseRunRecord,
  PersistentJobPhaseRunStatus,
  PersistentJobPhaseTimingSummaryInput,
  PersistentJobPhaseTimingSummaryRecord,
  PersistentJobDispatchSummaryInput,
  PersistentJobDispatchSummaryRecord,
  PersistentJobLeasePolicy,
  PersistentJobDispatchRecord,
  PersistentJobQueueHealthSnapshot,
  PersistentJobQueueAdapter,
  PersistentJobRecoverStaleInput,
  PersistentJobRetryPolicy,
} from "../contracts/PersistentJobQueue";
import type {
  JobExecutionControls,
  JobKey,
  JobProgressUpdate,
} from "../contracts/RegisteredJob";

type CreatePersistentJobQueueOptions<TContext> = {
  catalog: JobCatalog<TContext>;
  client: DatabaseClient;
  createContext: () => Promise<TContext> | TContext;
  workerName: string;
  retryPolicy?: Partial<PersistentJobRetryPolicy>;
  leasePolicy?: Partial<PersistentJobLeasePolicy>;
};

type JobDispatchRow = DatabaseSchema["app"]["Tables"]["job_dispatches"]["Row"];
type JobDispatchPhaseRunRow =
  DatabaseSchema["app"]["Tables"]["job_dispatch_phase_runs"]["Row"];
type JobDispatchSummaryRow = DatabaseSchema["app"]["Views"]["job_dispatch_summary"]["Row"];
type JobPhaseTimingSummaryRow =
  DatabaseSchema["app"]["Views"]["job_phase_timing_summary"]["Row"];
type JobAttemptTimelineRow =
  DatabaseSchema["app"]["Views"]["job_attempt_timeline"]["Row"];
type JobAttemptTimingSummaryRow =
  DatabaseSchema["app"]["Views"]["job_attempt_timing_summary"]["Row"];
type JobQueueHealthRow =
  DatabaseSchema["app"]["Functions"]["get_job_queue_health"]["Returns"][number];
type OwnedRunningDispatchGuard = {
  dispatchId: string;
  attempts: number;
  lockedBy: string;
  context: string;
};

class JobLeaseLostError extends Error {
  constructor(context: string, dispatchId: string, workerName: string) {
    super(
      `[jobs] ${context}: lease lost for dispatch "${dispatchId}" by ${workerName}`,
    );
    this.name = "JobLeaseLostError";
  }
}

export function isJobLeaseLostError(error: unknown): error is JobLeaseLostError {
  return error instanceof JobLeaseLostError;
}

class JobCancellationRequestedError extends Error {
  constructor(dispatchId: string, reason: string | null) {
    super(
      reason
        ? `[jobs] cancellation requested for dispatch "${dispatchId}": ${reason}`
        : `[jobs] cancellation requested for dispatch "${dispatchId}"`,
    );
    this.name = "JobCancellationRequestedError";
  }
}

export function isJobCancellationRequestedError(
  error: unknown,
): error is JobCancellationRequestedError {
  return error instanceof JobCancellationRequestedError;
}

type JobProgressState = {
  progressPct: number | null;
  progressMessage: string | null;
  phaseKey: string | null;
  phaseLabel: string | null;
  phaseStartedAt: string | null;
};

function toJsonValue(value: unknown): JsonValue {
  if (value === undefined) {
    return {};
  }

  try {
    return JSON.parse(JSON.stringify(value)) as JsonValue;
  } catch {
    return {
      message: String(value),
    };
  }
}

function serializeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function toCount(value: number | string | null | undefined) {
  return Number(value ?? 0);
}

function getRetryPolicy(
  policy: CreatePersistentJobQueueOptions<unknown>["retryPolicy"],
): PersistentJobRetryPolicy {
  return {
    maxAttempts: policy?.maxAttempts ?? 3,
    baseDelayMs: policy?.baseDelayMs ?? 1_000,
    maxDelayMs: policy?.maxDelayMs ?? 30_000,
  };
}

function getLeasePolicy(
  policy: CreatePersistentJobQueueOptions<unknown>["leasePolicy"],
): PersistentJobLeasePolicy {
  const staleAfterSeconds = policy?.staleAfterSeconds ?? 900;

  return {
    staleAfterSeconds,
    heartbeatIntervalMs:
      policy?.heartbeatIntervalMs
      ?? Math.max(5_000, Math.floor((staleAfterSeconds * 1_000) / 3)),
  };
}

function getRetryDelayMs(
  attempts: number,
  retryPolicy: PersistentJobRetryPolicy,
) {
  const exponent = Math.max(0, attempts - 1);
  return Math.min(
    retryPolicy.maxDelayMs,
    retryPolicy.baseDelayMs * (2 ** exponent),
  );
}

function mapDispatchRow(row: JobDispatchRow): PersistentJobDispatchRecord {
  return {
    id: row.id,
    key: row.job_key as JobKey,
    status: row.status,
    payload: row.payload,
    attempts: row.attempts,
    availableAt: row.available_at,
    lockedAt: row.locked_at,
    lockedBy: row.locked_by,
    attemptStartedAt: row.attempt_started_at,
    lastHeartbeatAt: row.last_heartbeat_at,
    activePhaseKey: row.active_phase_key,
    activePhaseLabel: row.active_phase_label,
    activePhaseStartedAt: row.active_phase_started_at,
    lastAttemptDurationMs: row.last_attempt_duration_ms,
    progressPct: row.progress_pct,
    progressMessage: row.progress_message,
    progressUpdatedAt: row.progress_updated_at,
    cancelRequestedAt: row.cancel_requested_at,
    cancelRequestedBy: row.cancel_requested_by,
    cancelReason: row.cancel_reason,
    cancelledAt: row.cancelled_at,
    completedAt: row.completed_at,
    failedAt: row.failed_at,
    result: row.result,
    lastError: row.last_error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapDispatchSummaryRow(
  row: JobDispatchSummaryRow,
): PersistentJobDispatchSummaryRecord {
  return {
    key: row.job_key as JobKey,
    status: row.status,
    dispatchCount: toCount(row.dispatch_count),
    oldestCreatedAt: row.oldest_created_at,
    latestCreatedAt: row.latest_created_at,
    latestUpdatedAt: row.latest_updated_at,
    activeCancellationCount: toCount(row.active_cancellation_count),
  };
}

function mapPhaseRunRow(
  row: JobDispatchPhaseRunRow,
): PersistentJobPhaseRunRecord {
  return {
    id: row.id,
    dispatchId: row.dispatch_id,
    attempt: row.attempt,
    phaseKey: row.phase_key,
    phaseLabel: row.phase_label,
    status: row.status,
    workerName: row.worker_name,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    durationMs: row.duration_ms,
    latestProgressPct: row.latest_progress_pct,
    latestProgressMessage: row.latest_progress_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapPhaseTimingSummaryRow(
  row: JobPhaseTimingSummaryRow,
): PersistentJobPhaseTimingSummaryRecord {
  return {
    key: row.job_key as JobKey,
    phaseKey: row.phase_key,
    phaseLabel: row.phase_label,
    runCount: toCount(row.run_count),
    runningCount: toCount(row.running_count),
    completedCount: toCount(row.completed_count),
    cancelledCount: toCount(row.cancelled_count),
    failedCount: toCount(row.failed_count),
    interruptedCount: toCount(row.interrupted_count),
    averageDurationMs:
      row.average_duration_ms == null ? null : Number(row.average_duration_ms),
    minDurationMs: row.min_duration_ms,
    maxDurationMs: row.max_duration_ms,
    latestEndedAt: row.latest_ended_at,
    latestUpdatedAt: row.latest_updated_at,
  };
}

function mapAttemptTimelineRow(
  row: JobAttemptTimelineRow,
): PersistentJobAttemptTimelineRecord {
  return {
    dispatchId: row.dispatch_id,
    key: row.job_key as JobKey,
    attempt: row.attempt,
    attemptStatus: row.attempt_status as PersistentJobAttemptStatus,
    attemptStartedAt: row.attempt_started_at,
    attemptEndedAt: row.attempt_ended_at,
    phaseRunCount: toCount(row.phase_run_count),
    runningPhaseCount: toCount(row.running_phase_count),
    completedPhaseCount: toCount(row.completed_phase_count),
    cancelledPhaseCount: toCount(row.cancelled_phase_count),
    failedPhaseCount: toCount(row.failed_phase_count),
    interruptedPhaseCount: toCount(row.interrupted_phase_count),
    totalPhaseDurationMs:
      row.total_phase_duration_ms == null ? null : Number(row.total_phase_duration_ms),
    latestPhaseUpdatedAt: row.latest_phase_updated_at,
  };
}

function mapAttemptTimingSummaryRow(
  row: JobAttemptTimingSummaryRow,
): PersistentJobAttemptTimingSummaryRecord {
  return {
    key: row.job_key as JobKey,
    attemptStatus: row.attempt_status as PersistentJobAttemptStatus,
    runCount: toCount(row.run_count),
    averageDurationMs:
      row.average_duration_ms == null ? null : Number(row.average_duration_ms),
    minDurationMs: row.min_duration_ms,
    maxDurationMs: row.max_duration_ms,
    latestEndedAt: row.latest_ended_at,
    latestUpdatedAt: row.latest_updated_at,
  };
}

function mapQueueHealthRow(
  row: JobQueueHealthRow,
): PersistentJobQueueHealthSnapshot {
  return {
    totalCount: toCount(row.total_count),
    queuedCount: toCount(row.queued_count),
    runningCount: toCount(row.running_count),
    completedCount: toCount(row.completed_count),
    failedCount: toCount(row.failed_count),
    cancelledCount: toCount(row.cancelled_count),
    staleRunningCount: toCount(row.stale_running_count),
    cancellationRequestedCount: toCount(row.cancellation_requested_count),
    oldestQueuedAt: row.oldest_queued_at,
    oldestRunningAt: row.oldest_running_at,
    latestUpdatedAt: row.latest_updated_at,
  };
}

async function getDispatchById(
  client: DatabaseClient,
  dispatchId: string,
): Promise<PersistentJobDispatchRecord | null> {
  const result = await client
    .from("job_dispatches")
    .select("*")
    .eq("id", dispatchId)
    .maybeSingle();

  if (result.error) {
    throw result.error;
  }

  if (!result.data) {
    return null;
  }

  return mapDispatchRow(result.data);
}

async function listDispatches(
  client: DatabaseClient,
  input: PersistentJobDispatchListInput = {},
): Promise<readonly PersistentJobDispatchRecord[]> {
  let query = client
    .from("job_dispatches")
    .select("*")
    .order("created_at", { ascending: false });

  if (input.ids?.length === 1) {
    query = query.eq("id", input.ids[0]);
  } else if (input.ids && input.ids.length > 1) {
    query = query.in("id", [...input.ids]);
  }

  if (input.keys?.length === 1) {
    query = query.eq("job_key", input.keys[0]);
  } else if (input.keys && input.keys.length > 1) {
    query = query.in("job_key", [...input.keys]);
  }

  if (input.statuses?.length === 1) {
    query = query.eq("status", input.statuses[0]);
  } else if (input.statuses && input.statuses.length > 1) {
    query = query.in("status", [...input.statuses]);
  }

  if (input.lockedBy === null) {
    query = query.is("locked_by", null);
  } else if (input.lockedBy !== undefined) {
    query = query.eq("locked_by", input.lockedBy);
  }

  query = query.limit(input.limit ?? 20);

  const result = await query;

  if (result.error) {
    throw result.error;
  }

  return (result.data ?? []).map(mapDispatchRow);
}

async function listPhaseRuns(
  client: DatabaseClient,
  input: PersistentJobPhaseRunListInput,
): Promise<readonly PersistentJobPhaseRunRecord[]> {
  let query = client
    .from("job_dispatch_phase_runs")
    .select("*")
    .eq("dispatch_id", input.dispatchId)
    .order("started_at", { ascending: true });

  if (input.attempt !== undefined) {
    query = query.eq("attempt", input.attempt);
  }

  const result = await query;

  if (result.error) {
    throw result.error;
  }

  return (result.data ?? []).map(mapPhaseRunRow);
}

async function listPhaseTimingSummary(
  client: DatabaseClient,
  input: PersistentJobPhaseTimingSummaryInput = {},
): Promise<readonly PersistentJobPhaseTimingSummaryRecord[]> {
  let query = client
    .from("job_phase_timing_summary")
    .select("*")
    .order("latest_updated_at", { ascending: false });

  if (input.keys?.length === 1) {
    query = query.eq("job_key", input.keys[0]);
  } else if (input.keys && input.keys.length > 1) {
    query = query.in("job_key", [...input.keys]);
  }

  if (input.statuses?.length === 1) {
    const [status] = input.statuses;
    query = query.gt(`${status}_count`, 0);
  } else if (input.statuses && input.statuses.length > 1) {
    const statusFilters = input.statuses
      .map((status) => `${status}_count.gt.0`)
      .join(",");
    query = query.or(statusFilters);
  }

  query = query.limit(input.limit ?? 50);

  const result = await query;

  if (result.error) {
    throw result.error;
  }

  return (result.data ?? []).map(mapPhaseTimingSummaryRow);
}

async function listAttemptTimelines(
  client: DatabaseClient,
  input: PersistentJobAttemptTimelineListInput = {},
): Promise<readonly PersistentJobAttemptTimelineRecord[]> {
  let query = client
    .from("job_attempt_timeline")
    .select("*")
    .order("attempt_started_at", { ascending: false, nullsFirst: false });

  if (input.dispatchIds?.length === 1) {
    query = query.eq("dispatch_id", input.dispatchIds[0]);
  } else if (input.dispatchIds && input.dispatchIds.length > 1) {
    query = query.in("dispatch_id", [...input.dispatchIds]);
  }

  if (input.keys?.length === 1) {
    query = query.eq("job_key", input.keys[0]);
  } else if (input.keys && input.keys.length > 1) {
    query = query.in("job_key", [...input.keys]);
  }

  if (input.attempts?.length === 1) {
    query = query.eq("attempt", input.attempts[0]);
  } else if (input.attempts && input.attempts.length > 1) {
    query = query.in("attempt", [...input.attempts]);
  }

  if (input.statuses?.length === 1) {
    query = query.eq("attempt_status", input.statuses[0]);
  } else if (input.statuses && input.statuses.length > 1) {
    query = query.in("attempt_status", [...input.statuses]);
  }

  query = query.limit(input.limit ?? 50);

  const result = await query;

  if (result.error) {
    throw result.error;
  }

  return (result.data ?? []).map(mapAttemptTimelineRow);
}

async function listAttemptTimingSummary(
  client: DatabaseClient,
  input: PersistentJobAttemptTimingSummaryInput = {},
): Promise<readonly PersistentJobAttemptTimingSummaryRecord[]> {
  let query = client
    .from("job_attempt_timing_summary")
    .select("*")
    .order("latest_updated_at", { ascending: false });

  if (input.keys?.length === 1) {
    query = query.eq("job_key", input.keys[0]);
  } else if (input.keys && input.keys.length > 1) {
    query = query.in("job_key", [...input.keys]);
  }

  if (input.statuses?.length === 1) {
    query = query.eq("attempt_status", input.statuses[0]);
  } else if (input.statuses && input.statuses.length > 1) {
    query = query.in("attempt_status", [...input.statuses]);
  }

  query = query.limit(input.limit ?? 50);

  const result = await query;

  if (result.error) {
    throw result.error;
  }

  return (result.data ?? []).map(mapAttemptTimingSummaryRow);
}

async function listDispatchSummary(
  client: DatabaseClient,
  input: PersistentJobDispatchSummaryInput = {},
): Promise<readonly PersistentJobDispatchSummaryRecord[]> {
  let query = client
    .from("job_dispatch_summary")
    .select("*")
    .order("latest_updated_at", { ascending: false });

  if (input.keys?.length === 1) {
    query = query.eq("job_key", input.keys[0]);
  } else if (input.keys && input.keys.length > 1) {
    query = query.in("job_key", [...input.keys]);
  }

  if (input.statuses?.length === 1) {
    query = query.eq("status", input.statuses[0]);
  } else if (input.statuses && input.statuses.length > 1) {
    query = query.in("status", [...input.statuses]);
  }

  query = query.limit(input.limit ?? 50);

  const result = await query;

  if (result.error) {
    throw result.error;
  }

  return (result.data ?? []).map(mapDispatchSummaryRow);
}

async function getQueueHealth(
  client: DatabaseClient,
  staleAfterSeconds: number,
): Promise<PersistentJobQueueHealthSnapshot> {
  const result = await client
    .rpc("get_job_queue_health", {
      stale_after_seconds: staleAfterSeconds,
    })
    .maybeSingle();

  if (result.error) {
    throw result.error;
  }

  if (!result.data) {
    return {
      totalCount: 0,
      queuedCount: 0,
      runningCount: 0,
      completedCount: 0,
      failedCount: 0,
      cancelledCount: 0,
      staleRunningCount: 0,
      cancellationRequestedCount: 0,
      oldestQueuedAt: null,
      oldestRunningAt: null,
      latestUpdatedAt: null,
    };
  }

  return mapQueueHealthRow(result.data);
}

async function requestDispatchCancellation(
  client: DatabaseClient,
  dispatchId: string,
  input: PersistentJobCancelInput = {},
): Promise<PersistentJobDispatchRecord> {
  const existing = await getDispatchById(client, dispatchId);

  if (!existing) {
    throw new Error(`[jobs] dispatch "${dispatchId}" was not found`);
  }

  if (
    existing.status === "completed"
    || existing.status === "failed"
    || existing.status === "cancelled"
  ) {
    throw new Error(
      `[jobs] dispatch "${dispatchId}" is ${existing.status} and cannot be cancelled`,
    );
  }

  const now = new Date().toISOString();
  const patch: DatabaseSchema["app"]["Tables"]["job_dispatches"]["Update"] =
    existing.status === "queued"
      ? {
          status: "cancelled",
          locked_at: null,
          locked_by: null,
          progress_pct: null,
          progress_message: "cancelled",
          progress_updated_at: now,
          cancel_requested_at: now,
          cancel_requested_by: input.requestedBy ?? null,
          cancel_reason: input.reason ?? null,
          cancelled_at: now,
        }
      : {
          cancel_requested_at: now,
          cancel_requested_by: input.requestedBy ?? null,
          cancel_reason: input.reason ?? null,
        };

  const result = await client
    .from("job_dispatches")
    .update(patch)
    .eq("id", dispatchId)
    .select("*")
    .single();

  return mapDispatchRow(requireSupabaseData(result, "jobs.cancel-dispatch"));
}

async function recoverStaleDispatches(
  client: DatabaseClient,
  input: PersistentJobRecoverStaleInput,
  leasePolicy: PersistentJobLeasePolicy,
): Promise<readonly PersistentJobDispatchRecord[]> {
  const limit = input.limit ?? 20;

  if (limit <= 0) {
    return [];
  }

  const staleBefore = new Date(
    Date.now() - (leasePolicy.staleAfterSeconds * 1_000),
  ).toISOString();

  const staleResult = await client
    .from("job_dispatches")
    .select("*")
    .eq("status", "running")
    .lte("locked_at", staleBefore)
    .order("locked_at", { ascending: true })
    .limit(limit);

  if (staleResult.error) {
    throw staleResult.error;
  }

  const recovered: PersistentJobDispatchRecord[] = [];

  for (const row of staleResult.data ?? []) {
    const dispatch = mapDispatchRow(row);
    const now = new Date().toISOString();
    const shouldCancel = Boolean(dispatch.cancelRequestedAt) && !input.forceRequeue;
    const note = input.requestedBy
      ? `[jobs] stale lease recovered by ${input.requestedBy}`
      : "[jobs] stale lease recovered by operator";

    await finalizePhaseRun(client, {
      dispatchId: dispatch.id,
      attempt: dispatch.attempts,
      phaseKey: dispatch.activePhaseKey,
      phaseLabel: dispatch.activePhaseLabel,
      phaseStartedAt: dispatch.activePhaseStartedAt,
      progressPct: dispatch.progressPct,
      progressMessage: dispatch.progressMessage,
      workerName: dispatch.lockedBy ?? input.requestedBy ?? "stale-recovery",
      status: shouldCancel ? "cancelled" : "interrupted",
      endedAt: now,
    });

    const patch: DatabaseSchema["app"]["Tables"]["job_dispatches"]["Update"] =
      shouldCancel
        ? {
            status: "cancelled",
            locked_at: null,
            locked_by: null,
            active_phase_key: null,
            active_phase_label: null,
            active_phase_started_at: null,
            progress_pct: null,
            progress_message: "cancelled",
            progress_updated_at: now,
            last_heartbeat_at: now,
            cancelled_at: now,
            last_attempt_duration_ms: getAttemptDurationMs(
              dispatch.attemptStartedAt,
              now,
            ),
            completed_at: null,
            failed_at: null,
            result: null,
            last_error: note,
          }
        : {
            status: "queued",
            available_at: now,
            locked_at: null,
            locked_by: null,
            attempt_started_at: null,
            last_heartbeat_at: null,
            active_phase_key: null,
            active_phase_label: null,
            active_phase_started_at: null,
            last_attempt_duration_ms: null,
            progress_pct: null,
            progress_message: null,
            progress_updated_at: null,
            cancelled_at: null,
            completed_at: null,
            failed_at: null,
            result: null,
            last_error: note,
          };

    let query = client
      .from("job_dispatches")
      .update(patch)
      .eq("id", dispatch.id)
      .eq("status", "running")
      .eq("attempts", dispatch.attempts);

    query = dispatch.lockedAt
      ? query.eq("locked_at", dispatch.lockedAt)
      : query.is("locked_at", null);

    query = dispatch.lockedBy
      ? query.eq("locked_by", dispatch.lockedBy)
      : query.is("locked_by", null);

    const updateResult = await query.select("*").maybeSingle();

    if (updateResult.error) {
      throw updateResult.error;
    }

    if (updateResult.data) {
      recovered.push(mapDispatchRow(updateResult.data));
    }
  }

  return recovered;
}

function normalizeProgressUpdate(
  update: JobProgressUpdate,
  current: JobProgressState,
): DatabaseSchema["app"]["Tables"]["job_dispatches"]["Update"] {
  const now = new Date().toISOString();
  const patch: DatabaseSchema["app"]["Tables"]["job_dispatches"]["Update"] = {
    progress_updated_at: now,
    last_heartbeat_at: now,
  };

  if (Object.hasOwn(update, "progressPct")) {
    if (update.progressPct == null) {
      patch.progress_pct = null;
    } else if (
      Number.isInteger(update.progressPct)
      && update.progressPct >= 0
      && update.progressPct <= 100
    ) {
      patch.progress_pct = update.progressPct;
    } else {
      throw new Error("[jobs] progressPct must be an integer between 0 and 100");
    }
  }

  if (Object.hasOwn(update, "progressMessage")) {
    patch.progress_message = update.progressMessage ?? null;
  }

  const nextPhaseKey = Object.hasOwn(update, "phaseKey")
    ? update.phaseKey ?? null
    : current.phaseKey;
  const nextPhaseLabel = Object.hasOwn(update, "phaseLabel")
    ? update.phaseLabel ?? null
    : current.phaseLabel;

  if (Object.hasOwn(update, "phaseKey")) {
    patch.active_phase_key = update.phaseKey ?? null;
  }

  if (Object.hasOwn(update, "phaseLabel")) {
    patch.active_phase_label = update.phaseLabel ?? null;
  }

  const phaseChanged =
    nextPhaseKey !== current.phaseKey || nextPhaseLabel !== current.phaseLabel;

  if (phaseChanged) {
    patch.active_phase_started_at = nextPhaseKey || nextPhaseLabel ? now : null;
  }

  return patch;
}

function getAttemptDurationMs(
  attemptStartedAt: string | null,
  terminalAtIso: string,
) {
  if (!attemptStartedAt) {
    return null;
  }

  const startedAt = new Date(attemptStartedAt).getTime();
  const terminalAt = new Date(terminalAtIso).getTime();

  if (!Number.isFinite(startedAt) || !Number.isFinite(terminalAt)) {
    return null;
  }

  return Math.max(0, Math.round(terminalAt - startedAt));
}

function getPhaseDurationMs(
  phaseStartedAt: string | null,
  terminalAtIso: string,
) {
  if (!phaseStartedAt) {
    return null;
  }

  const startedAt = new Date(phaseStartedAt).getTime();
  const terminalAt = new Date(terminalAtIso).getTime();

  if (!Number.isFinite(startedAt) || !Number.isFinite(terminalAt)) {
    return null;
  }

  return Math.max(0, Math.round(terminalAt - startedAt));
}

async function recordPhaseProgress(
  client: DatabaseClient,
  input: {
    dispatchId: string;
    attempt: number;
    workerName: string;
    phaseKey: string;
    phaseLabel: string;
    phaseStartedAt: string;
    progressPct: number | null;
    progressMessage: string | null;
  },
): Promise<void> {
  const now = new Date().toISOString();
  const existing = await client
    .from("job_dispatch_phase_runs")
    .select("*")
    .eq("dispatch_id", input.dispatchId)
    .eq("attempt", input.attempt)
    .eq("phase_key", input.phaseKey)
    .maybeSingle();

  if (existing.error) {
    throw existing.error;
  }

  if (!existing.data) {
    const insertResult = await client
      .from("job_dispatch_phase_runs")
      .insert({
        dispatch_id: input.dispatchId,
        attempt: input.attempt,
        phase_key: input.phaseKey,
        phase_label: input.phaseLabel,
        status: "running",
        worker_name: input.workerName,
        started_at: input.phaseStartedAt,
        latest_progress_pct: input.progressPct,
        latest_progress_message: input.progressMessage,
        updated_at: now,
      });

    if (insertResult.error) {
      throw insertResult.error;
    }

    return;
  }

  const updateResult = await client
    .from("job_dispatch_phase_runs")
    .update({
      phase_label: input.phaseLabel,
      status: "running",
      worker_name: input.workerName,
      latest_progress_pct: input.progressPct,
      latest_progress_message: input.progressMessage,
      updated_at: now,
    })
    .eq("id", existing.data.id);

  if (updateResult.error) {
    throw updateResult.error;
  }
}

async function finalizePhaseRun(
  client: DatabaseClient,
  input: {
    dispatchId: string;
    attempt: number;
    phaseKey: string | null;
    phaseLabel: string | null;
    phaseStartedAt: string | null;
    progressPct: number | null;
    progressMessage: string | null;
    workerName: string;
    status: Exclude<PersistentJobPhaseRunStatus, "running">;
    endedAt: string;
  },
): Promise<void> {
  if (!input.phaseKey || !input.phaseLabel) {
    return;
  }

  const existing = await client
    .from("job_dispatch_phase_runs")
    .select("*")
    .eq("dispatch_id", input.dispatchId)
    .eq("attempt", input.attempt)
    .eq("phase_key", input.phaseKey)
    .maybeSingle();

  if (existing.error) {
    throw existing.error;
  }

  const durationMs = getPhaseDurationMs(input.phaseStartedAt, input.endedAt);

  if (!existing.data) {
    const insertResult = await client
      .from("job_dispatch_phase_runs")
      .insert({
        dispatch_id: input.dispatchId,
        attempt: input.attempt,
        phase_key: input.phaseKey,
        phase_label: input.phaseLabel,
        status: input.status,
        worker_name: input.workerName,
        started_at: input.phaseStartedAt ?? input.endedAt,
        ended_at: input.endedAt,
        duration_ms: durationMs,
        latest_progress_pct: input.progressPct,
        latest_progress_message: input.progressMessage,
        updated_at: input.endedAt,
      });

    if (insertResult.error) {
      throw insertResult.error;
    }

    return;
  }

  const updateResult = await client
    .from("job_dispatch_phase_runs")
    .update({
      phase_label: input.phaseLabel,
      status: input.status,
      worker_name: input.workerName,
      ended_at: input.endedAt,
      duration_ms: durationMs,
      latest_progress_pct: input.progressPct,
      latest_progress_message: input.progressMessage,
      updated_at: input.endedAt,
    })
    .eq("id", existing.data.id);

  if (updateResult.error) {
    throw updateResult.error;
  }
}

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

async function updateOwnedRunningDispatch(
  client: DatabaseClient,
  input: OwnedRunningDispatchGuard & {
    patch: DatabaseSchema["app"]["Tables"]["job_dispatches"]["Update"];
  },
): Promise<PersistentJobDispatchRecord> {
  const result = await client
    .from("job_dispatches")
    .update(input.patch)
    .eq("id", input.dispatchId)
    .eq("status", "running")
    .eq("locked_by", input.lockedBy)
    .eq("attempts", input.attempts)
    .select("*")
    .maybeSingle();

  if (result.error) {
    throw result.error;
  }

  if (!result.data) {
    throw new JobLeaseLostError(input.context, input.dispatchId, input.lockedBy);
  }

  return mapDispatchRow(result.data);
}

function createLeaseHeartbeat(
  client: DatabaseClient,
  input: OwnedRunningDispatchGuard & {
    heartbeatIntervalMs: number;
  },
) {
  let timer: NodeJS.Timeout | null = null;
  let stopped = false;
  let inFlight: Promise<void> | null = null;
  let heartbeatError: unknown = null;

  const schedule = () => {
    if (stopped || heartbeatError) {
      return;
    }

    timer = setTimeout(() => {
      inFlight = updateOwnedRunningDispatch(client, {
        dispatchId: input.dispatchId,
        attempts: input.attempts,
        lockedBy: input.lockedBy,
        context: input.context,
        patch: {
          locked_at: new Date().toISOString(),
          last_heartbeat_at: new Date().toISOString(),
        },
      })
        .then(() => undefined)
        .catch((error: unknown) => {
          heartbeatError = error;
        })
        .finally(() => {
          inFlight = null;
          schedule();
        });
    }, input.heartbeatIntervalMs);

    timer.unref?.();
  };

  schedule();

  return {
    async stop() {
      stopped = true;

      if (timer) {
        clearTimeout(timer);
        timer = null;
      }

      try {
        await inFlight;
      } catch {
        // Swallow here; callers inspect the captured heartbeat error explicitly.
      }
    },
    getError() {
      return heartbeatError;
    },
  };
}

function createJobExecutionControls(
  client: DatabaseClient,
  dispatch: PersistentJobDispatchRecord,
  workerName: string,
) {
  const progressState: JobProgressState = {
    progressPct: dispatch.progressPct,
    progressMessage: dispatch.progressMessage,
    phaseKey: dispatch.activePhaseKey,
    phaseLabel: dispatch.activePhaseLabel,
    phaseStartedAt: dispatch.activePhaseStartedAt,
  };

  const execution: JobExecutionControls = {
    dispatchId: dispatch.id,
    attempt: dispatch.attempts,
    workerName,
    async reportProgress(update) {
      const patch = normalizeProgressUpdate(update, progressState);
      const nextPhaseKey = Object.hasOwn(update, "phaseKey")
        ? update.phaseKey ?? null
        : progressState.phaseKey;
      const nextPhaseLabel = Object.hasOwn(update, "phaseLabel")
        ? update.phaseLabel ?? null
        : progressState.phaseLabel;
      const previousPhaseKey = progressState.phaseKey;
      const previousPhaseLabel = progressState.phaseLabel;
      const previousPhaseStartedAt = progressState.phaseStartedAt;
      const phaseChanged =
        nextPhaseKey !== previousPhaseKey || nextPhaseLabel !== previousPhaseLabel;

      if (phaseChanged && previousPhaseKey && previousPhaseLabel) {
        await finalizePhaseRun(client, {
          dispatchId: dispatch.id,
          attempt: dispatch.attempts,
          phaseKey: previousPhaseKey,
          phaseLabel: previousPhaseLabel,
          phaseStartedAt: previousPhaseStartedAt,
          progressPct: progressState.progressPct,
          progressMessage: progressState.progressMessage,
          workerName,
          status: "completed",
          endedAt: patch.active_phase_started_at ?? new Date().toISOString(),
        });
      }

      await updateOwnedRunningDispatch(client, {
        dispatchId: dispatch.id,
        attempts: dispatch.attempts,
        lockedBy: workerName,
        context: "jobs.progress",
        patch,
      });

      if (Object.hasOwn(update, "phaseKey")) {
        progressState.phaseKey = update.phaseKey ?? null;
      }

      if (Object.hasOwn(update, "phaseLabel")) {
        progressState.phaseLabel = update.phaseLabel ?? null;
      }

      if (Object.hasOwn(patch, "active_phase_started_at")) {
        progressState.phaseStartedAt = patch.active_phase_started_at ?? null;
      }

      if (Object.hasOwn(update, "progressPct")) {
        progressState.progressPct = update.progressPct ?? null;
      }

      if (Object.hasOwn(update, "progressMessage")) {
        progressState.progressMessage = update.progressMessage ?? null;
      }

      if (progressState.phaseKey && progressState.phaseLabel) {
        await recordPhaseProgress(client, {
          dispatchId: dispatch.id,
          attempt: dispatch.attempts,
          workerName,
          phaseKey: progressState.phaseKey,
          phaseLabel: progressState.phaseLabel,
          phaseStartedAt: progressState.phaseStartedAt ?? new Date().toISOString(),
          progressPct: progressState.progressPct,
          progressMessage: progressState.progressMessage,
        });
      }
    },
    async throwIfCancellationRequested() {
      const latest = await getDispatchById(client, dispatch.id);

      if (latest?.cancelRequestedAt) {
        throw new JobCancellationRequestedError(
          dispatch.id,
          latest.cancelReason,
        );
      }
    },
  };

  return {
    execution,
    progressState,
  };
}

export function createPersistentJobQueue<TContext>(
  options: CreatePersistentJobQueueOptions<TContext>,
): PersistentJobQueueAdapter<TContext> {
  const retryPolicy = getRetryPolicy(options.retryPolicy);
  const leasePolicy = getLeasePolicy(options.leasePolicy);

  async function claimNextDispatch(
    keys?: readonly JobKey[],
  ): Promise<PersistentJobDispatchRecord | null> {
    const result = await options.client
      .rpc("claim_next_job_dispatch", {
        worker_name: options.workerName,
        stale_after_seconds: leasePolicy.staleAfterSeconds,
        job_keys: keys && keys.length > 0 ? [...keys] : null,
      })
      .maybeSingle();

    if (result.error) {
      throw result.error;
    }

    if (!result.data || result.data.id == null || result.data.job_key == null) {
      return null;
    }

    return mapDispatchRow(result.data);
  }

  async function drainClaimedDispatch(
    dispatch: PersistentJobDispatchRecord,
  ): Promise<JobDispatchResult> {
    const job = requireJob(options.catalog, dispatch.key);
    const context = await options.createContext();
    const { execution, progressState } = createJobExecutionControls(
      options.client,
      dispatch,
      options.workerName,
    );
    const leaseHeartbeat = createLeaseHeartbeat(options.client, {
      dispatchId: dispatch.id,
      attempts: dispatch.attempts,
      lockedBy: options.workerName,
      context: "jobs.heartbeat",
      heartbeatIntervalMs: leasePolicy.heartbeatIntervalMs,
    });

    try {
      const result = await job.run(context, dispatch.payload, execution);
      await leaseHeartbeat.stop();
      const heartbeatError = leaseHeartbeat.getError();

      if (heartbeatError) {
        throw heartbeatError;
      }

      const serializedResult = toJsonValue(result);
      const terminalAt = new Date().toISOString();

      await finalizePhaseRun(options.client, {
        dispatchId: dispatch.id,
        attempt: dispatch.attempts,
        phaseKey: progressState.phaseKey,
        phaseLabel: progressState.phaseLabel,
        phaseStartedAt: progressState.phaseStartedAt,
        progressPct: progressState.progressPct,
        progressMessage: progressState.progressMessage,
        workerName: options.workerName,
        status: "completed",
        endedAt: terminalAt,
      });

      await updateOwnedRunningDispatch(options.client, {
        dispatchId: dispatch.id,
        attempts: dispatch.attempts,
        lockedBy: options.workerName,
        context: "jobs.complete",
        patch: {
          status: "completed",
          locked_at: null,
          locked_by: null,
          active_phase_key: null,
          active_phase_label: null,
          active_phase_started_at: null,
          progress_pct: 100,
          progress_message: "completed",
          progress_updated_at: terminalAt,
          last_heartbeat_at: terminalAt,
          completed_at: terminalAt,
          last_attempt_duration_ms: getAttemptDurationMs(
            dispatch.attemptStartedAt,
            terminalAt,
          ),
          result: serializedResult,
          last_error: null,
        },
      });

      return {
        key: dispatch.key,
        payload: dispatch.payload,
        result,
      };
    } catch (error: unknown) {
      await leaseHeartbeat.stop();
      const heartbeatError = leaseHeartbeat.getError();
      const effectiveError = heartbeatError ?? error;

      if (effectiveError instanceof JobLeaseLostError) {
        throw effectiveError;
      }

      if (effectiveError instanceof JobCancellationRequestedError) {
        const terminalAt = new Date().toISOString();
        await finalizePhaseRun(options.client, {
          dispatchId: dispatch.id,
          attempt: dispatch.attempts,
          phaseKey: progressState.phaseKey,
          phaseLabel: progressState.phaseLabel,
          phaseStartedAt: progressState.phaseStartedAt,
          progressPct: progressState.progressPct,
          progressMessage: progressState.progressMessage,
          workerName: options.workerName,
          status: "cancelled",
          endedAt: terminalAt,
        });
        const cancelledDispatch = await updateOwnedRunningDispatch(options.client, {
          dispatchId: dispatch.id,
          attempts: dispatch.attempts,
          lockedBy: options.workerName,
          context: "jobs.cancelled",
          patch: {
            status: "cancelled",
            locked_at: null,
            locked_by: null,
            active_phase_key: null,
            active_phase_label: null,
            active_phase_started_at: null,
            progress_pct: null,
            progress_message: "cancelled",
            progress_updated_at: terminalAt,
            last_heartbeat_at: terminalAt,
            cancelled_at: terminalAt,
            last_attempt_duration_ms: getAttemptDurationMs(
              dispatch.attemptStartedAt,
              terminalAt,
            ),
            failed_at: null,
            completed_at: null,
            result: null,
            last_error: null,
          },
        });

        return {
          key: dispatch.key,
          payload: dispatch.payload,
          result: {
            status: "cancelled",
            dispatchId: cancelledDispatch.id,
            reason: cancelledDispatch.cancelReason,
          },
        };
      }

      const shouldRetry = dispatch.attempts < retryPolicy.maxAttempts;
      const retryAt = new Date(
        Date.now() + getRetryDelayMs(dispatch.attempts, retryPolicy),
      ).toISOString();
      const terminalAt = new Date().toISOString();

      await finalizePhaseRun(options.client, {
        dispatchId: dispatch.id,
        attempt: dispatch.attempts,
        phaseKey: progressState.phaseKey,
        phaseLabel: progressState.phaseLabel,
        phaseStartedAt: progressState.phaseStartedAt,
        progressPct: progressState.progressPct,
        progressMessage: progressState.progressMessage,
        workerName: options.workerName,
        status: "failed",
        endedAt: terminalAt,
      });

      await updateOwnedRunningDispatch(options.client, {
        dispatchId: dispatch.id,
        attempts: dispatch.attempts,
        lockedBy: options.workerName,
        context: shouldRetry ? "jobs.retry" : "jobs.fail",
        patch: {
          status: shouldRetry ? "queued" : "failed",
          available_at: shouldRetry ? retryAt : dispatch.availableAt,
          locked_at: null,
          locked_by: null,
          active_phase_key: null,
          active_phase_label: null,
          active_phase_started_at: null,
          progress_pct: shouldRetry ? null : progressState.progressPct,
          progress_message: shouldRetry ? null : progressState.progressMessage,
          progress_updated_at: shouldRetry
            ? null
            : progressState.progressPct !== null
                || progressState.progressMessage !== null
              ? terminalAt
              : null,
          last_heartbeat_at: terminalAt,
          completed_at: null,
          failed_at: shouldRetry ? null : terminalAt,
          last_attempt_duration_ms: shouldRetry
            ? null
            : getAttemptDurationMs(dispatch.attemptStartedAt, terminalAt),
          result: null,
          last_error: serializeError(effectiveError),
        },
      });

      throw effectiveError;
    }
  }

  return {
    listJobs() {
      return options.catalog.listJobs();
    },
    async enqueue(input) {
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

      const insertResult = await options.client
        .from("job_dispatches")
        .insert({
          job_key: job.key,
          payload: toJsonValue(payload),
        })
        .select("*")
        .single();

      const dispatch = mapDispatchRow(
        requireSupabaseData(insertResult, "jobs.enqueue"),
      );

      return {
        key: dispatch.key,
        payload: dispatch.payload,
        result: dispatch,
      };
    },
    getDispatchById(id) {
      return getDispatchById(options.client, id);
    },
    listDispatches(input) {
      return listDispatches(options.client, input);
    },
    listPhaseRuns(input) {
      return listPhaseRuns(options.client, input);
    },
    listPhaseTimingSummary(input) {
      return listPhaseTimingSummary(options.client, input);
    },
    listAttemptTimelines(input) {
      return listAttemptTimelines(options.client, input);
    },
    listAttemptTimingSummary(input) {
      return listAttemptTimingSummary(options.client, input);
    },
    listDispatchSummary(input) {
      return listDispatchSummary(options.client, input);
    },
    getQueueHealth() {
      return getQueueHealth(options.client, leasePolicy.staleAfterSeconds);
    },
    cancelDispatch(id, input) {
      return requestDispatchCancellation(options.client, id, input);
    },
    async cancelDispatches(ids, input) {
      const cancelled: PersistentJobDispatchRecord[] = [];

      for (const id of ids) {
        cancelled.push(await this.cancelDispatch(id, input));
      }

      return cancelled;
    },
    recoverStaleDispatches(input = {}) {
      return recoverStaleDispatches(options.client, input, leasePolicy);
    },
    async replayDispatch(id) {
      const dispatch = await getDispatchById(options.client, id);

      if (!dispatch) {
        throw new Error(`[jobs] dispatch "${id}" was not found`);
      }

      if (dispatch.status === "queued" || dispatch.status === "running") {
        throw new Error(
          `[jobs] dispatch "${id}" is ${dispatch.status} and cannot be replayed`,
        );
      }

      requireJob(options.catalog, dispatch.key);

      const insertResult = await options.client
        .from("job_dispatches")
        .insert({
          job_key: dispatch.key,
          payload: toJsonValue(dispatch.payload),
        })
        .select("*")
        .single();

      return mapDispatchRow(
        requireSupabaseData(insertResult, "jobs.replay-dispatch"),
      );
    },
    async replayDispatches(ids) {
      const replayed: PersistentJobDispatchRecord[] = [];

      for (const id of ids) {
        replayed.push(await this.replayDispatch(id));
      }

      return replayed;
    },
    async claimNext() {
      return claimNextDispatch();
    },
    async drainNext() {
      const dispatch = await claimNextDispatch();

      if (!dispatch) {
        return null;
      }

      return drainClaimedDispatch(dispatch);
    },
    async drain(limit = 1) {
      const results: JobDispatchResult[] = [];

      for (let index = 0; index < limit; index += 1) {
        const dispatch = await this.drainNext();
        if (!dispatch) {
          break;
        }
        results.push(dispatch);
      }

      return results;
    },
    async drainMatching(input: PersistentJobDrainInput = {}) {
      const results: JobDispatchResult[] = [];
      const limit = input.limit ?? 1;

      for (let index = 0; index < limit; index += 1) {
        const dispatch = await claimNextDispatch(input.keys);

        if (!dispatch) {
          break;
        }

        results.push(await drainClaimedDispatch(dispatch));
      }

      return results;
    },
  };
}
