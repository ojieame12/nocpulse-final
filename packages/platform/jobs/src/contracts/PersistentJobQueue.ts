import type { TimestampIso } from "@fieldpulse/platform-db";
import type { JobDispatchResult, JobQueueAdapter } from "./JobCatalog";
import type { JobKey } from "./RegisteredJob";

export type PersistentJobDispatchStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export type PersistentJobPhaseRunStatus =
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | "interrupted";

export type PersistentJobAttemptStatus =
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | "interrupted";

export type PersistentJobDispatchRecord = {
  id: string;
  key: JobKey;
  status: PersistentJobDispatchStatus;
  payload: unknown;
  attempts: number;
  availableAt: TimestampIso;
  lockedAt: TimestampIso | null;
  lockedBy: string | null;
  attemptStartedAt: TimestampIso | null;
  lastHeartbeatAt: TimestampIso | null;
  activePhaseKey: string | null;
  activePhaseLabel: string | null;
  activePhaseStartedAt: TimestampIso | null;
  lastAttemptDurationMs: number | null;
  progressPct: number | null;
  progressMessage: string | null;
  progressUpdatedAt: TimestampIso | null;
  cancelRequestedAt: TimestampIso | null;
  cancelRequestedBy: string | null;
  cancelReason: string | null;
  cancelledAt: TimestampIso | null;
  completedAt: TimestampIso | null;
  failedAt: TimestampIso | null;
  result: unknown;
  lastError: string | null;
  createdAt: TimestampIso;
  updatedAt: TimestampIso;
};

export type PersistentJobPhaseRunRecord = {
  id: string;
  dispatchId: string;
  attempt: number;
  phaseKey: string;
  phaseLabel: string;
  status: PersistentJobPhaseRunStatus;
  workerName: string | null;
  startedAt: TimestampIso;
  endedAt: TimestampIso | null;
  durationMs: number | null;
  latestProgressPct: number | null;
  latestProgressMessage: string | null;
  createdAt: TimestampIso;
  updatedAt: TimestampIso;
};

export type PersistentJobPhaseTimingSummaryRecord = {
  key: JobKey;
  phaseKey: string;
  phaseLabel: string;
  runCount: number;
  runningCount: number;
  completedCount: number;
  cancelledCount: number;
  failedCount: number;
  interruptedCount: number;
  averageDurationMs: number | null;
  minDurationMs: number | null;
  maxDurationMs: number | null;
  latestEndedAt: TimestampIso | null;
  latestUpdatedAt: TimestampIso | null;
};

export type PersistentJobAttemptTimelineRecord = {
  dispatchId: string;
  key: JobKey;
  attempt: number;
  attemptStatus: PersistentJobAttemptStatus;
  attemptStartedAt: TimestampIso | null;
  attemptEndedAt: TimestampIso | null;
  phaseRunCount: number;
  runningPhaseCount: number;
  completedPhaseCount: number;
  cancelledPhaseCount: number;
  failedPhaseCount: number;
  interruptedPhaseCount: number;
  totalPhaseDurationMs: number | null;
  latestPhaseUpdatedAt: TimestampIso | null;
};

export type PersistentJobAttemptTimingSummaryRecord = {
  key: JobKey;
  attemptStatus: PersistentJobAttemptStatus;
  runCount: number;
  averageDurationMs: number | null;
  minDurationMs: number | null;
  maxDurationMs: number | null;
  latestEndedAt: TimestampIso | null;
  latestUpdatedAt: TimestampIso | null;
};

export type PersistentJobDispatchListInput = {
  ids?: readonly string[];
  keys?: readonly JobKey[];
  statuses?: readonly PersistentJobDispatchStatus[];
  lockedBy?: string | null;
  limit?: number;
};

export type PersistentJobDispatchSummaryInput = {
  keys?: readonly JobKey[];
  statuses?: readonly PersistentJobDispatchStatus[];
  limit?: number;
};

export type PersistentJobPhaseRunListInput = {
  dispatchId: string;
  attempt?: number;
};

export type PersistentJobPhaseTimingSummaryInput = {
  keys?: readonly JobKey[];
  statuses?: readonly PersistentJobPhaseRunStatus[];
  limit?: number;
};

export type PersistentJobAttemptTimelineListInput = {
  dispatchIds?: readonly string[];
  keys?: readonly JobKey[];
  attempts?: readonly number[];
  statuses?: readonly PersistentJobAttemptStatus[];
  limit?: number;
};

export type PersistentJobAttemptTimingSummaryInput = {
  keys?: readonly JobKey[];
  statuses?: readonly PersistentJobAttemptStatus[];
  limit?: number;
};

export type PersistentJobDispatchSummaryRecord = {
  key: JobKey;
  status: PersistentJobDispatchStatus;
  dispatchCount: number;
  oldestCreatedAt: TimestampIso | null;
  latestCreatedAt: TimestampIso | null;
  latestUpdatedAt: TimestampIso | null;
  activeCancellationCount: number;
};

export type PersistentJobQueueHealthSnapshot = {
  totalCount: number;
  queuedCount: number;
  runningCount: number;
  completedCount: number;
  failedCount: number;
  cancelledCount: number;
  staleRunningCount: number;
  cancellationRequestedCount: number;
  oldestQueuedAt: TimestampIso | null;
  oldestRunningAt: TimestampIso | null;
  latestUpdatedAt: TimestampIso | null;
};

export type PersistentJobCancelInput = {
  requestedBy?: string | null;
  reason?: string | null;
};

export type PersistentJobRecoverStaleInput = {
  limit?: number;
  requestedBy?: string | null;
  forceRequeue?: boolean;
};

export type PersistentJobRetryPolicy = {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
};

export type PersistentJobLeasePolicy = {
  staleAfterSeconds: number;
  heartbeatIntervalMs: number;
};

export type PersistentJobDrainInput = {
  limit?: number;
  keys?: readonly JobKey[];
};

export type PersistentJobWorkerLoopOptions<TContext = unknown> = {
  queue: PersistentJobQueueAdapter<TContext>;
  batchSize?: number;
  idleDelayMs?: number;
  errorDelayMs?: number;
  signal?: AbortSignal;
  onDispatch?: (result: JobDispatchResult) => Promise<void> | void;
  onIdle?: () => Promise<void> | void;
  onError?: (error: unknown) => Promise<void> | void;
};

export type PersistentJobQueueAdapter<TContext = unknown> = JobQueueAdapter<TContext> & {
  getDispatchById(id: string): Promise<PersistentJobDispatchRecord | null>;
  listDispatches(
    input?: PersistentJobDispatchListInput,
  ): Promise<readonly PersistentJobDispatchRecord[]>;
  listPhaseRuns(
    input: PersistentJobPhaseRunListInput,
  ): Promise<readonly PersistentJobPhaseRunRecord[]>;
  listPhaseTimingSummary(
    input?: PersistentJobPhaseTimingSummaryInput,
  ): Promise<readonly PersistentJobPhaseTimingSummaryRecord[]>;
  listAttemptTimelines(
    input?: PersistentJobAttemptTimelineListInput,
  ): Promise<readonly PersistentJobAttemptTimelineRecord[]>;
  listAttemptTimingSummary(
    input?: PersistentJobAttemptTimingSummaryInput,
  ): Promise<readonly PersistentJobAttemptTimingSummaryRecord[]>;
  listDispatchSummary(
    input?: PersistentJobDispatchSummaryInput,
  ): Promise<readonly PersistentJobDispatchSummaryRecord[]>;
  getQueueHealth(): Promise<PersistentJobQueueHealthSnapshot>;
  cancelDispatch(
    id: string,
    input?: PersistentJobCancelInput,
  ): Promise<PersistentJobDispatchRecord>;
  cancelDispatches(
    ids: readonly string[],
    input?: PersistentJobCancelInput,
  ): Promise<readonly PersistentJobDispatchRecord[]>;
  recoverStaleDispatches(
    input?: PersistentJobRecoverStaleInput,
  ): Promise<readonly PersistentJobDispatchRecord[]>;
  replayDispatch(id: string): Promise<PersistentJobDispatchRecord>;
  replayDispatches(ids: readonly string[]): Promise<readonly PersistentJobDispatchRecord[]>;
  claimNext(): Promise<PersistentJobDispatchRecord | null>;
  drainNext(): Promise<JobDispatchResult | null>;
  drain(limit?: number): Promise<JobDispatchResult[]>;
  drainMatching(input?: PersistentJobDrainInput): Promise<JobDispatchResult[]>;
};
