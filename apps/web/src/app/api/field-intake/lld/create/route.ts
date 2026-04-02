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
import { createDraftField } from "../../../../../server/fields/createDraftField";
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

const FIELD_INTAKE_LLD_ACTOR_RATE_LIMIT = {
  scope: "field-intake-lld-create:actor",
  maxAttempts: 12,
  windowSeconds: 15 * 60,
} as const;

const FIELD_INTAKE_LLD_IP_RATE_LIMIT = {
  scope: "field-intake-lld-create:ip",
  maxAttempts: 20,
  windowSeconds: 15 * 60,
} as const;

const LldCreateBodySchema = z.object({
  workspaceId: nullableTrimmedText(),
  code: requiredTrimmedString("Field `code` is required."),
  suggestedFieldName: nullableTrimmedText(),
  cropType: nullableTrimmedText(),
  variety: nullableTrimmedText(),
  seedingDate: nullableTrimmedText().refine(
    (value) => value == null || /^\d{4}-\d{2}-\d{2}$/.test(value),
    "Field `seedingDate` must use YYYY-MM-DD format.",
  ),
});

export async function POST(request: Request) {
  const body = await readJsonObject(request);

  if (!body) {
    return jsonFieldIntakeError({
      status: 400,
      code: "invalid_request_body",
      message: "We could not read that field creation request.",
    });
  }

  try {
    const payload = parseWithSchema(LldCreateBodySchema, body);
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
          ...FIELD_INTAKE_LLD_IP_RATE_LIMIT,
          message: "Too many LLD field create requests.",
        }),
        {
          ...FIELD_INTAKE_LLD_ACTOR_RATE_LIMIT,
          identifier: buildActorRateLimitIdentifier({
            workspaceId: actor.workspaceId,
            userId: actor.userId,
          }),
          message: "Too many LLD field create requests.",
        },
      ],
    });

    if (rateLimitResponse) {
      return withFieldIntakeRateLimitCode(rateLimitResponse);
    }

    const lookup = await runtime.services.fieldIntake.lookupLldBoundary({
      code: payload.code,
      suggestedFieldName: payload.suggestedFieldName ?? undefined,
    });
    const result = await createDraftField({
      runtime,
      actor,
      name: lookup.draft.name,
      boundary: lookup.draft.boundary,
      areaHa: lookup.draft.areaHa,
      legalLandDescription: lookup.parsed.normalized,
      cropType: payload.cropType ?? null,
      variety: payload.variety ?? null,
      seedingDate: payload.seedingDate ?? null,
      sourceKey: "field-intake:lld-create",
      metadata: {
        intakeMethod: "lld",
        lldCode: lookup.parsed.normalized,
        lldResolution: lookup.resolution,
      },
      dispatchOnboarding: true,
    });

    await logAuditEvent({
      runtime,
      action: result.action === "created" ? "field.created" : "field.reused",
      actorUserId: actor.userId,
      workspaceId: actor.workspaceId,
      resourceType: "field",
      resourceId: result.field.id,
      route: "/api/field-intake/lld/create",
      metadata: {
        source: "field-intake:lld-create",
        resolution: lookup.resolution,
        lldCode: lookup.parsed.normalized,
        hasCropContext: result.cropContext !== null,
        onboardingDispatchCount: result.onboardingDispatches.length,
      },
    });

    return jsonOk(
      {
        result: {
          ...result,
          intakeMetadata: {
            method: "lld",
            lldResolution: lookup.resolution,
            boundaryConfidenceLabel:
              lookup.resolution === "cached"
                ? "Cached parcel geometry"
                : "Synthetic DLS geometry",
          },
        },
      },
      {
        status: result.action === "created" ? 201 : 200,
      },
    );
  } catch (error) {
    if (error instanceof RequestContextError) {
      return handleFieldIntakeRouteError(error, {
        event: "field-intake-lld-create-route",
        code: "lld_create_failed",
        message: "We could not create that field from the legal land description.",
        status: error.status,
      });
    }

    return handleFieldIntakeRouteError(error, {
      event: "field-intake-lld-create-route",
      code: "lld_create_failed",
      message: "We could not create that field from the legal land description.",
      status: 400,
    });
  }
}
