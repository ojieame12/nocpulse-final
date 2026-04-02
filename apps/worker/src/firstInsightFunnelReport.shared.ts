type RequestAccessStatus = "new" | "reviewed" | "contacted" | "archived";

export type RequestAccessFunnelSourceRow = {
  id: string;
  email: string;
  farmName: string;
  status: RequestAccessStatus;
  createdAt: string;
};

export type RequestAccessFunnelAuditRow = {
  action: string;
  workspaceId: string | null;
  resourceId: string | null;
  createdAt: string;
  metadata: unknown;
};

export type FirstInsightFunnelRow = {
  requestId: string;
  email: string;
  farmName: string;
  requestStatus: RequestAccessStatus;
  submittedAt: string;
  grantedAt: string | null;
  workspaceId: string | null;
  firstFieldActivityAt: string | null;
  firstFieldActivityType: string | null;
  firstInsightAt: string | null;
  reachedFirstInsight: boolean;
};

export type FirstInsightFunnelReport = {
  generatedAt: string;
  requestCount: number;
  grantedCount: number;
  firstFieldActivityCount: number;
  firstInsightCount: number;
  averageHoursToGrant: number | null;
  averageHoursToFirstFieldActivity: number | null;
  averageHoursToFirstInsight: number | null;
  dailyCounts: Array<{
    date: string;
    submitted: number;
    granted: number;
    firstFieldActivity: number;
    firstInsight: number;
  }>;
  rows: FirstInsightFunnelRow[];
};

type GrantEvent = {
  at: string;
  workspaceId: string | null;
};

function parseObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function readMetadataWorkspaceId(value: unknown) {
  const metadata = parseObject(value);
  const workspaceId = metadata?.createdWorkspaceId;
  return typeof workspaceId === "string" ? workspaceId : null;
}

function toDay(value: string) {
  return value.slice(0, 10);
}

function average(values: number[]) {
  if (values.length === 0) {
    return null;
  }

  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2));
}

function hoursBetween(startIso: string, endIso: string) {
  const start = Date.parse(startIso);
  const end = Date.parse(endIso);

  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    return null;
  }

  return (end - start) / (1000 * 60 * 60);
}

export function buildFirstInsightFunnelReport(input: {
  requests: RequestAccessFunnelSourceRow[];
  auditEvents: RequestAccessFunnelAuditRow[];
  generatedAt?: string;
}): FirstInsightFunnelReport {
  const grantsByRequestId = new Map<string, GrantEvent>();
  const workspaceEvents = new Map<string, RequestAccessFunnelAuditRow[]>();

  for (const event of input.auditEvents) {
    if (event.action === "request-access.granted" && event.resourceId) {
      const existing = grantsByRequestId.get(event.resourceId);
      if (!existing || event.createdAt < existing.at) {
        grantsByRequestId.set(event.resourceId, {
          at: event.createdAt,
          workspaceId: event.workspaceId ?? readMetadataWorkspaceId(event.metadata),
        });
      }
      continue;
    }

    if (!event.workspaceId) {
      continue;
    }

    const bucket = workspaceEvents.get(event.workspaceId) ?? [];
    bucket.push(event);
    workspaceEvents.set(event.workspaceId, bucket);
  }

  const rows = input.requests
    .map<FirstInsightFunnelRow>((request) => {
      const grant = grantsByRequestId.get(request.id) ?? null;
      const workspaceId = grant?.workspaceId ?? null;
      const relevantWorkspaceEvents =
        workspaceId != null
          ? (workspaceEvents.get(workspaceId) ?? []).filter(
            (event) => event.createdAt >= (grant?.at ?? request.createdAt),
          )
          : [];

      const firstFieldActivity = relevantWorkspaceEvents
        .filter((event) =>
          event.action === "field.created"
          || event.action === "field.reused"
          || event.action === "field-import.batch_committed"
        )
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt))[0] ?? null;

      const firstInsight = relevantWorkspaceEvents
        .filter((event) => event.action === "preview.first_insight_surfaced")
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt))[0] ?? null;

      return {
        requestId: request.id,
        email: request.email,
        farmName: request.farmName,
        requestStatus: request.status,
        submittedAt: request.createdAt,
        grantedAt: grant?.at ?? null,
        workspaceId,
        firstFieldActivityAt: firstFieldActivity?.createdAt ?? null,
        firstFieldActivityType: firstFieldActivity?.action ?? null,
        firstInsightAt: firstInsight?.createdAt ?? null,
        reachedFirstInsight: firstInsight != null,
      };
    })
    .sort((left, right) => right.submittedAt.localeCompare(left.submittedAt));

  const dailyCounts = new Map<
    string,
    {
      submitted: number;
      granted: number;
      firstFieldActivity: number;
      firstInsight: number;
    }
  >();

  const hoursToGrant: number[] = [];
  const hoursToFirstFieldActivity: number[] = [];
  const hoursToFirstInsight: number[] = [];

  for (const row of rows) {
    const submittedDay = toDay(row.submittedAt);
    const existingSubmitted = dailyCounts.get(submittedDay) ?? {
      submitted: 0,
      granted: 0,
      firstFieldActivity: 0,
      firstInsight: 0,
    };
    existingSubmitted.submitted += 1;
    dailyCounts.set(submittedDay, existingSubmitted);

    if (row.grantedAt) {
      const grantedDay = toDay(row.grantedAt);
      const existingGranted = dailyCounts.get(grantedDay) ?? {
        submitted: 0,
        granted: 0,
        firstFieldActivity: 0,
        firstInsight: 0,
      };
      existingGranted.granted += 1;
      dailyCounts.set(grantedDay, existingGranted);

      const hours = hoursBetween(row.submittedAt, row.grantedAt);
      if (hours != null) {
        hoursToGrant.push(hours);
      }
    }

    if (row.firstFieldActivityAt) {
      const fieldActivityDay = toDay(row.firstFieldActivityAt);
      const existingFieldActivity = dailyCounts.get(fieldActivityDay) ?? {
        submitted: 0,
        granted: 0,
        firstFieldActivity: 0,
        firstInsight: 0,
      };
      existingFieldActivity.firstFieldActivity += 1;
      dailyCounts.set(fieldActivityDay, existingFieldActivity);

      const start = row.grantedAt ?? row.submittedAt;
      const hours = hoursBetween(start, row.firstFieldActivityAt);
      if (hours != null) {
        hoursToFirstFieldActivity.push(hours);
      }
    }

    if (row.firstInsightAt) {
      const insightDay = toDay(row.firstInsightAt);
      const existingFirstInsight = dailyCounts.get(insightDay) ?? {
        submitted: 0,
        granted: 0,
        firstFieldActivity: 0,
        firstInsight: 0,
      };
      existingFirstInsight.firstInsight += 1;
      dailyCounts.set(insightDay, existingFirstInsight);

      const start = row.grantedAt ?? row.submittedAt;
      const hours = hoursBetween(start, row.firstInsightAt);
      if (hours != null) {
        hoursToFirstInsight.push(hours);
      }
    }
  }

  return {
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    requestCount: rows.length,
    grantedCount: rows.filter((row) => row.grantedAt != null).length,
    firstFieldActivityCount: rows.filter((row) => row.firstFieldActivityAt != null).length,
    firstInsightCount: rows.filter((row) => row.firstInsightAt != null).length,
    averageHoursToGrant: average(hoursToGrant),
    averageHoursToFirstFieldActivity: average(hoursToFirstFieldActivity),
    averageHoursToFirstInsight: average(hoursToFirstInsight),
    dailyCounts: [...dailyCounts.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([date, counts]) => ({
        date,
        ...counts,
      })),
    rows,
  };
}
