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
  nullableTrimmedText,
  parseWithSchema,
  requiredTrimmedString,
  z,
} from "../../../../server/http/validation";
import {
  RequestContextError,
  resolveRequestActor,
} from "../../../../server/runtime/resolveRequestContext";
import { canManageWorkspace } from "../../../../features/settings/workspaceAccess";

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

const FieldPatchBodySchema = z
  .object({
    name: z.union([
      requiredTrimmedString("[fields] name must be a non-empty string."),
      z.undefined(),
    ]),
    legalLandDescription: nullableTrimmedText(),
  })
  .refine(
    (value) =>
      value.name !== undefined || value.legalLandDescription !== undefined,
    {
      message: "[fields] expected at least one mutable field in the request body.",
    },
  );

export async function PATCH(
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
      return jsonError(403, "Manager access is required to update fields.");
    }
    const { fieldId } = await context.params;
    const body = await readJsonObject(request);

    if (!body) {
      return jsonError(400, "Expected a JSON request body.");
    }
    const payload = parseWithSchema(FieldPatchBodySchema, body);
    const rateLimitResponse = await enforceRouteRateLimits({
      runtime,
      rules: [
        buildIpRateLimitRule({
          request,
          ...FIELD_MUTATION_IP_RATE_LIMIT,
          message: "Too many field update requests.",
        }),
        {
          ...FIELD_MUTATION_ACTOR_RATE_LIMIT,
          identifier: buildActorRateLimitIdentifier({
            workspaceId: actor.workspaceId,
            userId: actor.userId,
            resourceId: fieldId,
          }),
          message: "Too many field update requests.",
        },
      ],
    });

    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    let detail = null;

    if (payload.name !== undefined) {
      detail = await runtime.services.fields.renameField({
        workspaceId: actor.workspaceId,
        fieldId,
        name: payload.name,
      });
      await logAuditEvent({
        runtime,
        action: "field.renamed",
        actorUserId: actor.userId,
        workspaceId: actor.workspaceId,
        resourceType: "field",
        resourceId: fieldId,
        route: "/api/fields/[fieldId]",
        metadata: {
          name: detail.name,
        },
      });
    }

    if (payload.legalLandDescription !== undefined) {
      detail = await runtime.services.fields.setLegalLandDescription({
        workspaceId: actor.workspaceId,
        fieldId,
        legalLandDescription: payload.legalLandDescription ?? null,
      });
      await logAuditEvent({
        runtime,
        action: "field.legal_land_description_updated",
        actorUserId: actor.userId,
        workspaceId: actor.workspaceId,
        resourceType: "field",
        resourceId: fieldId,
        route: "/api/fields/[fieldId]",
        metadata: {
          hasLegalLandDescription: detail.legalLandDescription !== null,
        },
      });
    }

    return jsonOk({ field: detail });
  } catch (error) {
    if (error instanceof RequestContextError) {
      return jsonError(error.status, error.message);
    }

    return jsonServerError(error, {
      event: "field-update-route",
      message: "Field update failed.",
    });
  }
}

export async function DELETE(
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
      return jsonError(403, "Manager access is required to delete fields.");
    }
    const { fieldId } = await context.params;
    const rateLimitResponse = await enforceRouteRateLimits({
      runtime,
      rules: [
        buildIpRateLimitRule({
          request,
          ...FIELD_MUTATION_IP_RATE_LIMIT,
          message: "Too many field deletion requests.",
        }),
        {
          ...FIELD_MUTATION_ACTOR_RATE_LIMIT,
          identifier: buildActorRateLimitIdentifier({
            workspaceId: actor.workspaceId,
            userId: actor.userId,
            resourceId: fieldId,
          }),
          message: "Too many field deletion requests.",
        },
      ],
    });

    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    await runtime.services.fields.deleteField({
      workspaceId: actor.workspaceId,
      fieldId,
    });
    await logAuditEvent({
      runtime,
      action: "field.deleted",
      actorUserId: actor.userId,
      workspaceId: actor.workspaceId,
      resourceType: "field",
      resourceId: fieldId,
      route: "/api/fields/[fieldId]",
    });

    return jsonOk({ deleted: true });
  } catch (error) {
    if (error instanceof RequestContextError) {
      return jsonError(error.status, error.message);
    }

    return jsonServerError(error, {
      event: "field-delete-route",
      message: "Field deletion failed.",
    });
  }
}
