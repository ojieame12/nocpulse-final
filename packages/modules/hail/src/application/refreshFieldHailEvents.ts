import type { FieldHailEvent } from "../contracts/FieldHailEvent";
import type { FieldHailRefreshRun } from "../contracts/FieldHailRefreshRun";
import type { RefreshFieldHailEventsInput, RefreshFieldHailEventsResult } from "../contracts/RefreshFieldHailEventsInput";
import type {
  HailMultiPolygonGeoJson,
  HailProviderClient,
} from "../contracts/HailProviderClient";
import type { UpsertFieldHailRefreshRunInput } from "../contracts/UpsertFieldHailRefreshRunInput";

type UpsertFieldHailEventRepository = {
  upsertEvent(input: {
    workspaceId: string;
    fieldId: string;
    providerKey: FieldHailEvent["providerKey"];
    sourceKey: string;
    sourceEventKey: string;
    dedupeKey: string;
    eventType: FieldHailEvent["eventType"];
    severity: FieldHailEvent["severity"];
    reportedAt: string;
    windowStart?: string | null;
    windowEnd?: string | null;
    headline: string;
    summary?: string | null;
    hailSizeMm?: number | null;
    coverageGeoJson?: unknown;
    provenance?: unknown;
  }): Promise<FieldHailEvent>;
};

type UpsertFieldHailRefreshRunRepository = {
  upsertRun(input: UpsertFieldHailRefreshRunInput): Promise<FieldHailRefreshRun>;
};

export type RefreshFieldHailEventsUseCaseInput = {
  provider: HailProviderClient;
  repository: UpsertFieldHailEventRepository;
  refreshRuns: UpsertFieldHailRefreshRunRepository;
  field: {
    workspaceId: string;
    fieldId: string;
    boundary: HailMultiPolygonGeoJson;
  };
  requestedAt?: string;
  limit?: number;
};

export async function refreshFieldHailEvents(
  input: RefreshFieldHailEventsUseCaseInput,
): Promise<RefreshFieldHailEventsResult> {
  const requestedAt = input.requestedAt ?? new Date().toISOString();
  try {
    const fetched = await input.provider.fetchFieldHailEvents({
      boundary: input.field.boundary,
      requestedAt,
      limit: input.limit,
    });

    const events = await Promise.all(
      fetched.events.map((event) =>
        input.repository.upsertEvent({
          workspaceId: input.field.workspaceId,
          fieldId: input.field.fieldId,
          providerKey: fetched.providerKey,
          sourceKey: fetched.sourceKey,
          sourceEventKey: event.sourceEventKey,
          dedupeKey: event.dedupeKey,
          eventType: event.eventType,
          severity: event.severity,
          reportedAt: event.reportedAt,
          windowStart: event.windowStart ?? null,
          windowEnd: event.windowEnd ?? null,
          headline: event.headline,
          summary: event.summary ?? null,
          hailSizeMm: event.hailSizeMm ?? null,
          coverageGeoJson: event.coverageGeoJson ?? null,
          provenance: event.provenance ?? {},
        }),
      ),
    );

    const run = await input.refreshRuns.upsertRun({
      workspaceId: input.field.workspaceId,
      fieldId: input.field.fieldId,
      providerKey: fetched.providerKey,
      sourceKey: fetched.sourceKey,
      requestedAt: fetched.requestedAt,
      completedAt: new Date().toISOString(),
      status: "completed",
      matchedEventCount: events.length,
      latestMatchedReportedAt:
        events.length > 0
          ? events.reduce(
              (latest, event) =>
                latest == null || latest.localeCompare(event.reportedAt) < 0
                  ? event.reportedAt
                  : latest,
              null as string | null,
            )
          : null,
      provenance: {
        requestedLimit: input.limit ?? null,
        matchedEventIds: events.map((event) => event.id),
      },
    });

    return {
      workspaceId: input.field.workspaceId,
      fieldId: input.field.fieldId,
      providerKey: fetched.providerKey,
      sourceKey: fetched.sourceKey,
      requestedAt: fetched.requestedAt,
      run,
      events,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    await input.refreshRuns.upsertRun({
      workspaceId: input.field.workspaceId,
      fieldId: input.field.fieldId,
      providerKey: input.provider.providerKey,
      sourceKey: input.provider.providerKey,
      requestedAt,
      completedAt: new Date().toISOString(),
      status: "failed",
      matchedEventCount: 0,
      latestMatchedReportedAt: null,
      errorMessage: message,
      provenance: {
        requestedLimit: input.limit ?? null,
      },
    });

    throw error;
  }
}
