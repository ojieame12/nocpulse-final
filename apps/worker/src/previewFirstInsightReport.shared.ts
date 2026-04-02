export type PreviewFirstInsightEvent = {
  createdAt: string;
  actorUserId: string;
  workspaceId: string | null;
  fieldId: string;
  fieldName: string;
  dataQualityLabel: "Ready" | "Limited";
  moistureConfidenceLevel: "high" | "medium";
  moistureDerivationMode: string;
  workspaceSummaryComparisonCount: number;
  focusFieldId: string;
  focusFieldName: string;
};

export type PreviewFirstInsightDailySummary = {
  date: string;
  eventCount: number;
  uniqueActorCount: number;
  uniqueFieldCount: number;
};

export type PreviewFirstInsightFieldSummary = {
  fieldId: string;
  fieldName: string;
  eventCount: number;
  uniqueActorCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  allowlisted: boolean;
};

export type PreviewFirstInsightReport = {
  generatedAt: string;
  workspaceFilter: string | null;
  workspaceId: string | null;
  workspaceSlug: string | null;
  lookbackDays: number;
  eventCount: number;
  uniqueActorCount: number;
  uniqueFieldCount: number;
  allowlistedEventCount: number;
  nonAllowlistedEventCount: number;
  averageWorkspaceSummaryComparisonCount: number | null;
  daily: PreviewFirstInsightDailySummary[];
  topFields: PreviewFirstInsightFieldSummary[];
  recentEvents: Array<
    PreviewFirstInsightEvent & {
      allowlisted: boolean;
    }
  >;
};

export const WORKSPACE_FIRST_INSIGHT_ALLOWLIST: Readonly<
  Record<string, readonly string[]>
> = {
  "8f2afceb-aefe-4e90-a24e-7ab07c4423fe": [
    "Main Farm",
    "Rath",
    "Rath West",
    "Robbie",
    "Roman East Q",
    "Roman Yard",
    "Sigurson",
    "Solomon",
    "Towes",
    "Towes Dugout",
  ],
};

export function getWorkspaceFirstInsightAllowlist(workspaceId?: string | null) {
  if (!workspaceId) {
    return null;
  }

  return WORKSPACE_FIRST_INSIGHT_ALLOWLIST[workspaceId] ?? null;
}

function normalizeFieldName(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? null;
}

function isoDate(isoTimestamp: string) {
  return isoTimestamp.slice(0, 10);
}

function isAllowlistedField(
  workspaceId: string | null,
  fieldName: string,
) {
  if (!workspaceId) {
    return false;
  }

  const allowlist = getWorkspaceFirstInsightAllowlist(workspaceId);
  if (!allowlist || allowlist.length === 0) {
    return false;
  }

  const normalizedFieldName = normalizeFieldName(fieldName);
  return allowlist.some(
    (entry) => normalizeFieldName(entry) === normalizedFieldName,
  );
}

export function buildPreviewFirstInsightReport(input: {
  generatedAt?: string;
  workspaceFilter?: string | null;
  workspaceId?: string | null;
  workspaceSlug?: string | null;
  lookbackDays: number;
  events: readonly PreviewFirstInsightEvent[];
  recentLimit?: number;
}): PreviewFirstInsightReport {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const events = [...input.events].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt),
  );
  const recentLimit = input.recentLimit ?? 20;

  const uniqueActors = new Set(events.map((event) => event.actorUserId));
  const uniqueFields = new Set(events.map((event) => event.fieldId));
  const allowlistedFlags = events.map((event) =>
    isAllowlistedField(event.workspaceId, event.focusFieldName),
  );

  const byDate = new Map<
    string,
    { eventCount: number; actors: Set<string>; fields: Set<string> }
  >();
  const byField = new Map<
    string,
    {
      fieldId: string;
      fieldName: string;
      eventCount: number;
      actors: Set<string>;
      firstSeenAt: string;
      lastSeenAt: string;
      allowlisted: boolean;
    }
  >();

  for (const event of events) {
    const date = isoDate(event.createdAt);
    const daily = byDate.get(date) ?? {
      eventCount: 0,
      actors: new Set<string>(),
      fields: new Set<string>(),
    };
    daily.eventCount += 1;
    daily.actors.add(event.actorUserId);
    daily.fields.add(event.fieldId);
    byDate.set(date, daily);

    const field = byField.get(event.focusFieldId) ?? {
      fieldId: event.focusFieldId,
      fieldName: event.focusFieldName,
      eventCount: 0,
      actors: new Set<string>(),
      firstSeenAt: event.createdAt,
      lastSeenAt: event.createdAt,
      allowlisted: isAllowlistedField(event.workspaceId, event.focusFieldName),
    };
    field.eventCount += 1;
    field.actors.add(event.actorUserId);
    if (event.createdAt < field.firstSeenAt) {
      field.firstSeenAt = event.createdAt;
    }
    if (event.createdAt > field.lastSeenAt) {
      field.lastSeenAt = event.createdAt;
    }
    byField.set(event.focusFieldId, field);
  }

  const averageWorkspaceSummaryComparisonCount =
    events.length > 0
      ? Math.round(
          (events.reduce(
            (sum, event) => sum + event.workspaceSummaryComparisonCount,
            0,
          ) /
            events.length) *
            100,
        ) / 100
      : null;

  return {
    generatedAt,
    workspaceFilter: input.workspaceFilter ?? null,
    workspaceId: input.workspaceId ?? null,
    workspaceSlug: input.workspaceSlug ?? null,
    lookbackDays: input.lookbackDays,
    eventCount: events.length,
    uniqueActorCount: uniqueActors.size,
    uniqueFieldCount: uniqueFields.size,
    allowlistedEventCount: allowlistedFlags.filter(Boolean).length,
    nonAllowlistedEventCount: allowlistedFlags.filter((flag) => !flag).length,
    averageWorkspaceSummaryComparisonCount,
    daily: [...byDate.entries()]
      .map(([date, value]) => ({
        date,
        eventCount: value.eventCount,
        uniqueActorCount: value.actors.size,
        uniqueFieldCount: value.fields.size,
      }))
      .sort((left, right) => left.date.localeCompare(right.date)),
    topFields: [...byField.values()]
      .map((field) => ({
        fieldId: field.fieldId,
        fieldName: field.fieldName,
        eventCount: field.eventCount,
        uniqueActorCount: field.actors.size,
        firstSeenAt: field.firstSeenAt,
        lastSeenAt: field.lastSeenAt,
        allowlisted: field.allowlisted,
      }))
      .sort((left, right) => {
        if (right.eventCount !== left.eventCount) {
          return right.eventCount - left.eventCount;
        }

        if (right.uniqueActorCount !== left.uniqueActorCount) {
          return right.uniqueActorCount - left.uniqueActorCount;
        }

        return left.fieldName.localeCompare(right.fieldName);
      }),
    recentEvents: events.slice(0, recentLimit).map((event) => ({
      ...event,
      allowlisted: isAllowlistedField(event.workspaceId, event.focusFieldName),
    })),
  };
}
