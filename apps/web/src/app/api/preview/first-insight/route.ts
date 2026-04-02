import {
  jsonError,
  jsonOk,
  jsonServerError,
  readJsonObject,
} from "../../../../server/http/json";
import {
  buildActorRateLimitIdentifier,
  buildIpRateLimitRule,
  enforceRouteRateLimits,
} from "../../../../server/auth/routeRateLimit";
import { logAuditEvent } from "../../../../server/audit/logAuditEvent";
import {
  parseWithSchema,
  requiredTrimmedString,
  z,
} from "../../../../server/http/validation";
import { getWebServerRuntime } from "../../../../server/runtime/getWebServerRuntime";
import {
  RequestContextError,
  resolveRequestActor,
} from "../../../../server/runtime/resolveRequestContext";

const FIRST_INSIGHT_ACTOR_RATE_LIMIT = {
  scope: "preview-first-insight:actor",
  maxAttempts: 30,
  windowSeconds: 5 * 60,
} as const;

const FIRST_INSIGHT_IP_RATE_LIMIT = {
  scope: "preview-first-insight:ip",
  maxAttempts: 60,
  windowSeconds: 5 * 60,
} as const;

const PreviewFirstInsightBodySchema = z.object({
  workspaceId: requiredTrimmedString("A workspace identifier is required."),
  fieldId: requiredTrimmedString("A field identifier is required."),
  fieldName: requiredTrimmedString("A field name is required."),
  dataQualityLabel: z.enum(["Ready", "Limited"]),
  moistureConfidenceLevel: z.enum(["high", "medium"]),
  moistureDerivationMode: requiredTrimmedString(
    "A moisture derivation mode is required.",
  ),
  workspaceSummaryComparisonCount: z.number().int().nonnegative(),
  focusFieldId: requiredTrimmedString("A focus field identifier is required."),
  focusFieldName: requiredTrimmedString("A focus field name is required."),
});

export async function POST(request: Request) {
  const body = await readJsonObject(request);

  if (!body) {
    return jsonError(400, "Expected a JSON request body.");
  }

  try {
    const payload = parseWithSchema(PreviewFirstInsightBodySchema, body);
    const runtime = getWebServerRuntime();

    if (runtime.mode !== "supabase") {
      return jsonError(503, "Supabase runtime is not configured.");
    }

    const actor = await resolveRequestActor(request, runtime, {
      allowDevelopmentFallback: true,
      preferredWorkspaceId: payload.workspaceId,
    });
    const rateLimitResponse = await enforceRouteRateLimits({
      runtime,
      rules: [
        buildIpRateLimitRule({
          request,
          ...FIRST_INSIGHT_IP_RATE_LIMIT,
          message: "Too many first-insight tracking requests.",
        }),
        {
          ...FIRST_INSIGHT_ACTOR_RATE_LIMIT,
          identifier: buildActorRateLimitIdentifier({
            workspaceId: actor.workspaceId,
            userId: actor.userId,
            resourceId: payload.fieldId,
          }),
          message: "Too many first-insight tracking requests.",
        },
      ],
    });

    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    await logAuditEvent({
      runtime,
      action: "preview.first_insight_surfaced",
      actorUserId: actor.userId,
      workspaceId: actor.workspaceId,
      resourceType: "field",
      resourceId: payload.fieldId,
      route: "/api/preview/first-insight",
      metadata: {
        fieldName: payload.fieldName,
        dataQualityLabel: payload.dataQualityLabel,
        moistureConfidenceLevel: payload.moistureConfidenceLevel,
        moistureDerivationMode: payload.moistureDerivationMode,
        workspaceSummaryComparisonCount:
          payload.workspaceSummaryComparisonCount,
        focusFieldId: payload.focusFieldId,
        focusFieldName: payload.focusFieldName,
      },
    });

    return jsonOk({ result: { recorded: true } });
  } catch (error) {
    if (error instanceof RequestContextError) {
      return jsonError(error.status, error.message);
    }

    return jsonServerError(error, {
      event: "preview-first-insight-route",
      message: "First-insight tracking failed.",
    });
  }
}
