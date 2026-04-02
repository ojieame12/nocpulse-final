import {
  jsonOk,
  readJsonObject,
} from "../../../../../server/http/json";
import {
  buildActorRateLimitIdentifier,
  buildIpRateLimitRule,
  enforceRouteRateLimits,
} from "../../../../../server/auth/routeRateLimit";
import { logAuditEvent } from "../../../../../server/audit/logAuditEvent";
import {
  nullableTrimmedText,
  parseWithSchema,
  requiredTrimmedString,
  z,
} from "../../../../../server/http/validation";
import { getWebServerRuntime } from "../../../../../server/runtime/getWebServerRuntime";
import {
  RequestContextError,
  resolveRequestActor,
} from "../../../../../server/runtime/resolveRequestContext";
import {
  handleFieldIntakeRouteError,
  jsonFieldIntakeError,
  withFieldIntakeRateLimitCode,
} from "../../_shared/intakeErrors";

const FIELD_INTAKE_HYDRATION_RETRY_ACTOR_RATE_LIMIT = {
  scope: "field-intake-hydration-retry:actor",
  maxAttempts: 12,
  windowSeconds: 10 * 60,
} as const;

const FIELD_INTAKE_HYDRATION_RETRY_IP_RATE_LIMIT = {
  scope: "field-intake-hydration-retry:ip",
  maxAttempts: 20,
  windowSeconds: 10 * 60,
} as const;

const HydrationRetryBodySchema = z.object({
  workspaceId: nullableTrimmedText(),
  fieldId: requiredTrimmedString("Field `fieldId` is required."),
  fieldName: requiredTrimmedString("Field `fieldName` is required."),
  fieldAction: z.enum(["created", "reused"]).optional(),
  cropType: nullableTrimmedText(),
  legalLandDescriptions: z
    .array(
      requiredTrimmedString(
        "Field `legalLandDescriptions` entries must be non-empty strings.",
      ),
    )
    .optional(),
});

export async function POST(request: Request) {
  const body = await readJsonObject(request);

  if (!body) {
    return jsonFieldIntakeError({
      status: 400,
      code: "invalid_request_body",
      message: "We could not read that hydration retry request.",
    });
  }

  try {
    const payload = parseWithSchema(HydrationRetryBodySchema, body);
    const runtime = getWebServerRuntime({
      jobDispatcher: "persistent",
    });

    if (runtime.mode !== "supabase") {
      return jsonFieldIntakeError({
        status: 503,
        code: "runtime_unavailable",
        message: "Field intake is temporarily unavailable.",
      });
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
          ...FIELD_INTAKE_HYDRATION_RETRY_IP_RATE_LIMIT,
          message: "Too many hydration retry requests.",
        }),
        {
          ...FIELD_INTAKE_HYDRATION_RETRY_ACTOR_RATE_LIMIT,
          identifier: buildActorRateLimitIdentifier({
            workspaceId: actor.workspaceId,
            userId: actor.userId,
            resourceId: payload.fieldId,
          }),
          message: "Too many hydration retry requests.",
        },
      ],
    });

    if (rateLimitResponse) {
      return withFieldIntakeRateLimitCode(rateLimitResponse);
    }

    const legalLandDescriptions =
      payload.legalLandDescriptions?.filter((entry) => entry.length > 0) ?? [];

    const replayResult =
      legalLandDescriptions.length > 0
        ? await runtime.services.fieldIntake.replayFieldHydration({
            workspaceId: actor.workspaceId,
            fieldId: payload.fieldId,
            fieldName: payload.fieldName,
            cropType: payload.cropType ?? undefined,
            legalLandDescriptions,
          })
        : null;

    const receipts = await runtime.services.fieldOnboarding.dispatchRefreshPlan({
      workspaceId: actor.workspaceId,
      fieldId: payload.fieldId,
      fieldName: payload.fieldName,
      dryRun: false,
      cropType: payload.cropType ?? undefined,
      legalLandDescriptions:
        legalLandDescriptions.length > 0 ? legalLandDescriptions : undefined,
    });

    await logAuditEvent({
      runtime,
      action: "field-intake.hydration_retried",
      actorUserId: actor.userId,
      workspaceId: actor.workspaceId,
      resourceType: "field",
      resourceId: payload.fieldId,
      route: "/api/field-intake/hydration/retry",
      metadata: {
        fieldAction: payload.fieldAction ?? null,
        cropType: payload.cropType ?? null,
        legalLandDescriptionCount: legalLandDescriptions.length,
        replayAction: replayResult?.action ?? null,
        replayReason: replayResult?.reason ?? null,
        onboardingDispatchCount: receipts.length,
      },
    });

    return jsonOk({
      result: {
        replayResult,
        onboardingDispatches: [
          {
            fieldId: payload.fieldId,
            action: payload.fieldAction ?? "reused",
            receipts,
          },
        ],
      },
    });
  } catch (error) {
    if (error instanceof RequestContextError) {
      return handleFieldIntakeRouteError(error, {
        event: "field-intake-hydration-retry-route",
        code: "hydration_retry_failed",
        message: "We could not retry hydration for that field.",
        status: error.status,
      });
    }

    return handleFieldIntakeRouteError(error, {
      event: "field-intake-hydration-retry-route",
      code: "hydration_retry_failed",
      message: "We could not retry hydration for that field.",
      status: 400,
    });
  }
}
