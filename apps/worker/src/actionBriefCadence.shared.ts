import type {
  JobDispatchResult,
  JobKey,
  PersistentJobDispatchRecord,
} from "@fieldpulse/platform-jobs";
import type { FieldIntelligenceFinding } from "@fieldpulse/module-crop-intelligence";

export const ACTION_BRIEF_WEATHER_JOB_KEYS = [
  "weather.schedule-workspace-refresh",
  "weather.refresh-field",
] as const;

export const ACTION_BRIEF_INTELLIGENCE_JOB_KEYS = [
  "intelligence.schedule-workspace-action-brief",
  "intelligence.generate-action-brief",
] as const;

export type ActionBriefCadenceTarget = {
  workspaceId: string;
  workspaceSlug: string;
};

export type ActionBriefCadenceSummary = {
  workspaceId: string;
  workspaceSlug: string;
  activeFindingCount: number;
  activeFieldCount: number;
  topFindings: readonly {
    fieldId: string;
    title: string;
    severity: string;
    updatedAt: string;
  }[];
};

export type ActionBriefCadenceQueue = {
  enqueue(
    input:
      | {
          key: "weather.schedule-workspace-refresh";
          payload: {
            workspaceId: string;
            requestedAt: string;
            fieldIds?: readonly string[];
            limit?: number;
            forecastHours?: number;
          };
        }
      | {
          key: "intelligence.schedule-workspace-action-brief";
          payload: {
            workspaceId: string;
            requestedAt: string;
            fieldIds?: readonly string[];
            limit?: number;
          };
        },
  ): Promise<JobDispatchResult>;
  drainMatching(input: {
    limit: number;
    keys: readonly JobKey[];
  }): Promise<readonly JobDispatchResult[]>;
};

export type RunActionBriefCadenceInput = {
  queue: ActionBriefCadenceQueue;
  targets: readonly ActionBriefCadenceTarget[];
  requestedAt: string;
  workspaceId?: string;
  fieldId?: string;
  limit?: number;
  forecastHours?: number;
  drainLimit: number;
  reportLimit: number;
  loadWorkspaceFindings: (input: {
    workspaceId: string;
    limit?: number;
    status?: "active";
    family?: "action_brief";
    updatedAfter?: string;
  }) => Promise<readonly FieldIntelligenceFinding[]>;
  sleepFn?: (ms: number) => Promise<void>;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isPersistentDispatchRecord(
  value: unknown,
): value is PersistentJobDispatchRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    "key" in value &&
    "status" in value &&
    "availableAt" in value &&
    "createdAt" in value &&
    "updatedAt" in value
  );
}

function toScheduledDispatchRecord(
  dispatch: JobDispatchResult,
): PersistentJobDispatchRecord {
  if (isPersistentDispatchRecord(dispatch.result)) {
    return dispatch.result;
  }

  throw new Error(
    "[worker-action-brief-cadence] persistent queue enqueue did not return a dispatch record",
  );
}

async function drainMatchingWithRetry(input: {
  queue: ActionBriefCadenceQueue;
  limit: number;
  keys: readonly JobKey[];
  sleepFn?: (ms: number) => Promise<void>;
}) {
  const drained = await input.queue.drainMatching({
    limit: input.limit,
    keys: [...input.keys],
  });

  if (drained.length > 0) {
    return drained;
  }

  await (input.sleepFn ?? sleep)(350);

  return input.queue.drainMatching({
    limit: input.limit,
    keys: [...input.keys],
  });
}

export async function runActionBriefCadence(
  input: RunActionBriefCadenceInput,
) {
  const scheduledWeatherDispatches = [];

  for (const target of input.targets) {
    const dispatch = await input.queue.enqueue({
      key: "weather.schedule-workspace-refresh",
      payload: {
        workspaceId: target.workspaceId,
        requestedAt: input.requestedAt,
        fieldIds: input.fieldId ? [input.fieldId] : undefined,
        limit: input.limit,
        forecastHours: input.forecastHours,
      },
    });

    scheduledWeatherDispatches.push({
      workspaceId: target.workspaceId,
      workspaceSlug: target.workspaceSlug,
      requestedAt: input.requestedAt,
      dispatch: toScheduledDispatchRecord(dispatch),
    });
  }

  const drainedWeatherDispatches = await drainMatchingWithRetry({
    queue: input.queue,
    limit: input.drainLimit,
    keys: ACTION_BRIEF_WEATHER_JOB_KEYS,
    sleepFn: input.sleepFn,
  });

  const scheduledActionBriefDispatches = [];

  for (const target of input.targets) {
    const dispatch = await input.queue.enqueue({
      key: "intelligence.schedule-workspace-action-brief",
      payload: {
        workspaceId: target.workspaceId,
        requestedAt: input.requestedAt,
        fieldIds: input.fieldId ? [input.fieldId] : undefined,
        limit: input.limit,
      },
    });

    scheduledActionBriefDispatches.push({
      workspaceId: target.workspaceId,
      workspaceSlug: target.workspaceSlug,
      requestedAt: input.requestedAt,
      dispatch: toScheduledDispatchRecord(dispatch),
    });
  }

  const drainedActionBriefDispatches = await drainMatchingWithRetry({
    queue: input.queue,
    limit: input.drainLimit,
    keys: ACTION_BRIEF_INTELLIGENCE_JOB_KEYS,
    sleepFn: input.sleepFn,
  });

  const summaries = await Promise.all(
    input.targets.map(async (target) => {
      const findings = await input.loadWorkspaceFindings({
        workspaceId: target.workspaceId,
        limit: input.reportLimit,
        status: "active",
        family: "action_brief",
        updatedAfter: input.requestedAt,
      });
      const activeFieldIds = new Set(findings.map((finding) => finding.fieldId));

      return {
        workspaceId: target.workspaceId,
        workspaceSlug: target.workspaceSlug,
        activeFindingCount: findings.length,
        activeFieldCount: activeFieldIds.size,
        topFindings: findings.slice(0, 10).map((finding) => ({
          fieldId: finding.fieldId,
          title: finding.title,
          severity: finding.severity,
          updatedAt: finding.updatedAt,
        })),
      } satisfies ActionBriefCadenceSummary;
    }),
  );

  return {
    requestedAt: input.requestedAt,
    scheduledWeatherDispatches,
    drainedWeatherDispatches,
    scheduledActionBriefDispatches,
    drainedActionBriefDispatches,
    summaries,
  };
}
