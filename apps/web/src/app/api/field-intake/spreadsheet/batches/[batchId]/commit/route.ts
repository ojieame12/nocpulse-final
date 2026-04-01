import {
  jsonError,
  jsonOk,
  jsonServerError,
  readJsonObject,
} from "../../../../../../../server/http/json";
import {
  buildActorRateLimitIdentifier,
  buildIpRateLimitRule,
  enforceRouteRateLimits,
} from "../../../../../../../server/auth/routeRateLimit";
import { logAuditEvent } from "../../../../../../../server/audit/logAuditEvent";
import {
  nullableTrimmedText,
  parseWithSchema,
  z,
} from "../../../../../../../server/http/validation";
import { getWebServerRuntime } from "../../../../../../../server/runtime/getWebServerRuntime";
import {
  RequestContextError,
  resolveRequestActor,
} from "../../../../../../../server/runtime/resolveRequestContext";

type RouteContext = {
  params: Promise<{
    batchId: string;
  }>;
};

const FIELD_INTAKE_SPREADSHEET_COMMIT_ACTOR_RATE_LIMIT = {
  scope: "field-intake-spreadsheet-commit:actor",
  maxAttempts: 8,
  windowSeconds: 10 * 60,
} as const;

const FIELD_INTAKE_SPREADSHEET_COMMIT_IP_RATE_LIMIT = {
  scope: "field-intake-spreadsheet-commit:ip",
  maxAttempts: 12,
  windowSeconds: 10 * 60,
} as const;

const SpreadsheetBatchCommitBodySchema = z.object({
  workspaceId: nullableTrimmedText(),
  onboardingDryRun: z.boolean().optional(),
});

export async function POST(request: Request, context: RouteContext) {
  const body = await readJsonObject(request);

  if (!body) {
    return jsonError(400, "Expected a JSON request body.");
  }

  try {
    const payload = parseWithSchema(SpreadsheetBatchCommitBodySchema, body);
    const { batchId } = await context.params;

    if (!batchId) {
      return jsonError(400, "Route param `batchId` is required.");
    }

    const runtime = getWebServerRuntime({
      jobDispatcher: "persistent",
    });

    if (runtime.mode !== "supabase") {
      return jsonError(503, "Supabase runtime is not configured.");
    }

    const actor = await resolveRequestActor(request, runtime, {
      allowDevelopmentFallback: true,
      preferredWorkspaceId: payload.workspaceId ?? null,
    });
    const rateLimitResponse = await enforceRouteRateLimits({
      runtime,
      rules: [
        buildIpRateLimitRule({
          request,
          ...FIELD_INTAKE_SPREADSHEET_COMMIT_IP_RATE_LIMIT,
          message: "Too many spreadsheet import commit requests.",
        }),
        {
          ...FIELD_INTAKE_SPREADSHEET_COMMIT_ACTOR_RATE_LIMIT,
          identifier: buildActorRateLimitIdentifier({
            workspaceId: actor.workspaceId,
            userId: actor.userId,
            resourceId: batchId,
          }),
          message: "Too many spreadsheet import commit requests.",
        },
      ],
    });

    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const result = await runtime.services.fieldIntake.commitSpreadsheetImportBatch({
      actorUserId: actor.userId,
      workspaceId: actor.workspaceId,
      batchId,
      onboardingDryRun: payload.onboardingDryRun,
    });

    await logAuditEvent({
      runtime,
      action: "field-import.batch_committed",
      actorUserId: actor.userId,
      workspaceId: actor.workspaceId,
      resourceType: "field-import-batch",
      resourceId: result.batch.id,
      route: "/api/field-intake/spreadsheet/batches/[batchId]/commit",
      metadata: {
        batchId: result.batch.id,
        sourceType: result.batch.sourceType,
        candidateCount: result.candidates.length,
        createdCount: result.candidates.filter((candidate) => candidate.action === "created").length,
        reusedCount: result.candidates.filter((candidate) => candidate.action === "reused").length,
        onboardingDispatchCount: result.onboardingDispatches.length,
        hydrationCompletedCount: result.batchHydrationSummary.completedFields,
        hydrationQueuedCount: result.batchHydrationSummary.queuedFields,
        highConfidenceFieldCount: result.batchHydrationSummary.highConfidenceFields,
        mediumConfidenceFieldCount: result.batchHydrationSummary.mediumConfidenceFields,
        lowConfidenceFieldCount: result.batchHydrationSummary.lowConfidenceFields,
        onboardingDryRun: payload.onboardingDryRun ?? false,
      },
    });

    return jsonOk({
      result,
    });
  } catch (error) {
    if (error instanceof RequestContextError) {
      return jsonError(error.status, error.message);
    }

    return jsonServerError(error, {
      status: 400,
      event: "field-intake-spreadsheet-batch-commit-route",
      message: "Import batch commit failed.",
    });
  }
}
