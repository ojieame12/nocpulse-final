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
import { getWebServerRuntime } from "../../../../server/runtime/getWebServerRuntime";
import {
  optionalTrimmedText,
  parseWithSchema,
  z,
} from "../../../../server/http/validation";
import {
  RequestContextError,
  resolveRequestActor,
} from "../../../../server/runtime/resolveRequestContext";

const ALERT_MUTATION_ACTOR_RATE_LIMIT = {
  scope: "alert-mutation:actor",
  maxAttempts: 40,
  windowSeconds: 5 * 60,
} as const;

const ALERT_MUTATION_IP_RATE_LIMIT = {
  scope: "alert-mutation:ip",
  maxAttempts: 80,
  windowSeconds: 5 * 60,
} as const;

const AlertMutationBodySchema = z.object({
  action: z.enum(["acknowledge", "dismiss", "resolve"]),
  resolutionNote: optionalTrimmedText(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ alertId: string }> },
) {
  try {
    const runtime = getWebServerRuntime();

    if (runtime.mode !== "supabase") {
      return jsonError(503, "Supabase runtime is not configured.");
    }

    const actor = await resolveRequestActor(request, runtime, {
      allowDevelopmentFallback: true,
    });
    const { alertId } = await context.params;
    const body = await readJsonObject(request);

    if (!body) {
      return jsonError(400, "Expected a JSON request body.");
    }

    const payload = parseWithSchema(AlertMutationBodySchema, body);
    const rateLimitResponse = await enforceRouteRateLimits({
      runtime,
      rules: [
        buildIpRateLimitRule({
          request,
          ...ALERT_MUTATION_IP_RATE_LIMIT,
          message: "Too many alert update requests.",
        }),
        {
          ...ALERT_MUTATION_ACTOR_RATE_LIMIT,
          identifier: buildActorRateLimitIdentifier({
            workspaceId: actor.workspaceId,
            userId: actor.userId,
            resourceId: alertId,
          }),
          message: "Too many alert update requests.",
        },
      ],
    });

    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const alert =
      payload.action === "acknowledge"
        ? await runtime.services.alerts.acknowledgeFieldAlert({
            workspaceId: actor.workspaceId,
            alertId,
            acknowledgedByUserId: actor.userId,
          })
        : await runtime.services.alerts.resolveFieldAlert({
            workspaceId: actor.workspaceId,
            alertId,
            actorUserId: actor.userId,
            status: payload.action === "dismiss" ? "dismissed" : "resolved",
            resolutionNote: payload.resolutionNote ?? null,
          });

    if (!alert) {
      return jsonError(404, "Alert was not found.");
    }

    await logAuditEvent({
      runtime,
      action:
        payload.action === "acknowledge"
          ? "alert.acknowledged"
          : payload.action === "dismiss"
            ? "alert.dismissed"
            : "alert.resolved",
      actorUserId: actor.userId,
      workspaceId: actor.workspaceId,
      resourceType: "field_alert",
      resourceId: alertId,
      route: "/api/alerts/[alertId]",
      metadata: {
        status: alert.status,
        fieldId: alert.fieldId,
      },
    });

    return jsonOk({ alert });
  } catch (error) {
    if (error instanceof RequestContextError) {
      return jsonError(error.status, error.message);
    }

    return jsonServerError(error, {
      event: "alert-mutation-route",
      message: "Alert update failed.",
    });
  }
}
