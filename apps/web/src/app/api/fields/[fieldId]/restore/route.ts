import { jsonError, jsonOk, jsonServerError } from "../../../../../server/http/json";
import {
  buildActorRateLimitIdentifier,
  buildIpRateLimitRule,
  enforceRouteRateLimits,
} from "../../../../../server/auth/routeRateLimit";
import { logAuditEvent } from "../../../../../server/audit/logAuditEvent";
import { getWebServerRuntime } from "../../../../../server/runtime/getWebServerRuntime";
import {
  RequestContextError,
  resolveRequestActor,
} from "../../../../../server/runtime/resolveRequestContext";
import { canManageWorkspace } from "../../../../../features/settings/workspaceAccess";

const FIELD_MUTATION_ACTOR_RATE_LIMIT = {
  scope: "field-mutation:actor",
  maxAttempts: 40,
  windowSeconds: 5 * 60,
} as const;

const FIELD_MUTATION_IP_RATE_LIMIT = {
  scope: "field-mutation:ip",
  maxAttempts: 80,
  windowSeconds: 5 * 60,
} as const;

export async function POST(
  request: Request,
  context: { params: Promise<{ fieldId: string }> },
) {
  try {
    const runtime = getWebServerRuntime();

    if (runtime.mode !== "supabase") {
      return jsonError(503, "Supabase runtime is not configured.");
    }

    const actor = await resolveRequestActor(request, runtime, {
      allowDevelopmentFallback: true,
    });
    if (!canManageWorkspace(actor.role)) {
      return jsonError(403, "Manager access is required to restore fields.");
    }

    const { fieldId } = await context.params;
    const rateLimitResponse = await enforceRouteRateLimits({
      runtime,
      rules: [
        buildIpRateLimitRule({
          request,
          ...FIELD_MUTATION_IP_RATE_LIMIT,
          message: "Too many field restore requests.",
        }),
        {
          ...FIELD_MUTATION_ACTOR_RATE_LIMIT,
          identifier: buildActorRateLimitIdentifier({
            workspaceId: actor.workspaceId,
            userId: actor.userId,
            resourceId: fieldId,
          }),
          message: "Too many field restore requests.",
        },
      ],
    });

    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const field = await runtime.services.fields.restoreField({
      workspaceId: actor.workspaceId,
      fieldId,
    });
    await logAuditEvent({
      runtime,
      action: "field.restored",
      actorUserId: actor.userId,
      workspaceId: actor.workspaceId,
      resourceType: "field",
      resourceId: fieldId,
      route: "/api/fields/[fieldId]/restore",
      metadata: {
        name: field.name,
      },
    });

    return jsonOk({
      result: {
        field: {
          id: field.id,
          workspaceId: field.workspaceId,
          name: field.name,
          areaHa: field.areaHa,
          legalLandDescription: field.legalLandDescription,
        },
      },
    });
  } catch (error) {
    if (error instanceof RequestContextError) {
      return jsonError(error.status, error.message);
    }

    return jsonServerError(error, {
      event: "field-restore-route",
      message: "Field restore failed.",
    });
  }
}
