import type {
  PersistentJobAttemptStatus,
  JobKey,
  PersistentJobDispatchRecord,
  PersistentJobDispatchStatus,
  PersistentJobPhaseRunStatus,
} from "@fieldpulse/platform-jobs";
import type { ParsedCliArgs } from "./parseCliArgs";
import { readCsvFlag } from "./parseCliArgs";

export const ALLOWED_JOB_STATUSES: readonly PersistentJobDispatchStatus[] = [
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
] as const;

export const ALLOWED_PHASE_RUN_STATUSES: readonly PersistentJobPhaseRunStatus[] = [
  "running",
  "completed",
  "failed",
  "cancelled",
  "interrupted",
] as const;

export const ALLOWED_ATTEMPT_STATUSES: readonly PersistentJobAttemptStatus[] = [
  "running",
  "completed",
  "failed",
  "cancelled",
  "interrupted",
] as const;

export function readJobStatuses(
  args: ParsedCliArgs,
  context: string,
): PersistentJobDispatchStatus[] | undefined {
  const values = readCsvFlag(args, "status");

  if (values.length === 0) {
    return undefined;
  }

  for (const value of values) {
    if (!ALLOWED_JOB_STATUSES.includes(value as PersistentJobDispatchStatus)) {
      throw new Error(
        `[${context}] invalid status "${value}". Expected one of: ${ALLOWED_JOB_STATUSES.join(", ")}`,
      );
    }
  }

  return values as PersistentJobDispatchStatus[];
}

export function readJobKeys(
  args: ParsedCliArgs,
  allowedKeys: readonly JobKey[],
  context: string,
): JobKey[] | undefined {
  const values = readCsvFlag(args, "key");

  if (values.length === 0) {
    return undefined;
  }

  for (const value of values) {
    if (!allowedKeys.includes(value as JobKey)) {
      throw new Error(
        `[${context}] invalid job key "${value}". Expected one of: ${allowedKeys.join(", ")}`,
      );
    }
  }

  return values as JobKey[];
}

export function readPhaseRunStatuses(
  args: ParsedCliArgs,
  context: string,
): PersistentJobPhaseRunStatus[] | undefined {
  const values = readCsvFlag(args, "status");

  if (values.length === 0) {
    return undefined;
  }

  for (const value of values) {
    if (!ALLOWED_PHASE_RUN_STATUSES.includes(value as PersistentJobPhaseRunStatus)) {
      throw new Error(
        `[${context}] invalid phase status "${value}". Expected one of: ${ALLOWED_PHASE_RUN_STATUSES.join(", ")}`,
      );
    }
  }

  return values as PersistentJobPhaseRunStatus[];
}

export function readAttemptStatuses(
  args: ParsedCliArgs,
  context: string,
): PersistentJobAttemptStatus[] | undefined {
  const values = readCsvFlag(args, "status");

  if (values.length === 0) {
    return undefined;
  }

  for (const value of values) {
    if (!ALLOWED_ATTEMPT_STATUSES.includes(value as PersistentJobAttemptStatus)) {
      throw new Error(
        `[${context}] invalid attempt status "${value}". Expected one of: ${ALLOWED_ATTEMPT_STATUSES.join(", ")}`,
      );
    }
  }

  return values as PersistentJobAttemptStatus[];
}

function shorten(value: string | null, length = 120) {
  if (!value) {
    return "";
  }

  return value.length <= length ? value : `${value.slice(0, length - 1)}…`;
}

function formatAgeSeconds(value: string | null) {
  if (!value) {
    return "";
  }

  const ageMs = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(ageMs)) {
    return "";
  }

  return Math.max(0, Math.round(ageMs / 1_000));
}

export function formatDispatchTableRows(
  dispatches: readonly PersistentJobDispatchRecord[],
) {
  return dispatches.map((dispatch) => ({
    id: dispatch.id,
    key: dispatch.key,
    status: dispatch.status,
    attempts: dispatch.attempts,
    availableAt: dispatch.availableAt,
    lockedBy: dispatch.lockedBy ?? "",
    attemptStartedAt: dispatch.attemptStartedAt ?? "",
    runningAgeSeconds: formatAgeSeconds(dispatch.attemptStartedAt),
    lastHeartbeatAt: dispatch.lastHeartbeatAt ?? "",
    heartbeatAgeSeconds: formatAgeSeconds(dispatch.lastHeartbeatAt),
    activePhaseKey: dispatch.activePhaseKey ?? "",
    activePhaseLabel: dispatch.activePhaseLabel ?? "",
    activePhaseStartedAt: dispatch.activePhaseStartedAt ?? "",
    activePhaseAgeSeconds: formatAgeSeconds(dispatch.activePhaseStartedAt),
    lastAttemptDurationMs: dispatch.lastAttemptDurationMs ?? "",
    cancelRequestedAt: dispatch.cancelRequestedAt ?? "",
    cancelRequestedBy: dispatch.cancelRequestedBy ?? "",
    cancelReason: dispatch.cancelReason ?? "",
    cancelledAt: dispatch.cancelledAt ?? "",
    progressPct: dispatch.progressPct ?? "",
    progressMessage: dispatch.progressMessage ?? "",
    updatedAt: dispatch.updatedAt,
    lastError: shorten(dispatch.lastError),
  }));
}
