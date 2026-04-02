import {
  jsonOk,
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
  z,
} from "../../../../../server/http/validation";
import {
  MAX_BOUNDARY_UPLOAD_BYTES,
  readUploadedFile,
} from "../../../../../server/http/uploads";
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

const FIELD_INTAKE_GEOFILE_ACTOR_RATE_LIMIT = {
  scope: "field-intake-geofile-create:actor",
  maxAttempts: 12,
  windowSeconds: 15 * 60,
} as const;

const FIELD_INTAKE_GEOFILE_IP_RATE_LIMIT = {
  scope: "field-intake-geofile-create:ip",
  maxAttempts: 20,
  windowSeconds: 15 * 60,
} as const;

const GeofileCreateFormSchema = z.object({
  workspaceId: nullableTrimmedText(),
  suggestedFieldName: nullableTrimmedText(),
  cropType: nullableTrimmedText(),
  variety: nullableTrimmedText(),
  seedingDate: nullableTrimmedText().refine(
    (value) => value == null || /^\d{4}-\d{2}-\d{2}$/.test(value),
    "Field `seedingDate` must use YYYY-MM-DD format.",
  ),
});

export async function POST(request: Request) {
  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return jsonFieldIntakeError({
      status: 400,
      code: "invalid_request_body",
      message: "We could not read that boundary field request.",
    });
  }

  try {
    const file = readUploadedFile(formData, "file", {
      maxBytes: MAX_BOUNDARY_UPLOAD_BYTES,
    });
    const payload = parseWithSchema(GeofileCreateFormSchema, {
      workspaceId: formData.get("workspaceId"),
      suggestedFieldName: formData.get("suggestedFieldName"),
      cropType: formData.get("cropType"),
      variety: formData.get("variety"),
      seedingDate: formData.get("seedingDate"),
    });
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
          ...FIELD_INTAKE_GEOFILE_IP_RATE_LIMIT,
          message: "Too many geofile field create requests.",
        }),
        {
          ...FIELD_INTAKE_GEOFILE_ACTOR_RATE_LIMIT,
          identifier: buildActorRateLimitIdentifier({
            workspaceId: actor.workspaceId,
            userId: actor.userId,
          }),
          message: "Too many geofile field create requests.",
        },
      ],
    });

    if (rateLimitResponse) {
      return withFieldIntakeRateLimitCode(rateLimitResponse);
    }

    const parsed = await runtime.services.fieldIntake.parseBoundaryFile({
      content: await file.text(),
      fileName: file.name,
      mimeType: file.type || undefined,
      suggestedFieldName: payload.suggestedFieldName ?? undefined,
    });
    const result = await createDraftField({
      runtime,
      actor,
      name: parsed.draft.name,
      boundary: parsed.draft.boundary,
      areaHa: parsed.draft.areaHa,
      legalLandDescription: null,
      cropType: payload.cropType ?? null,
      variety: payload.variety ?? null,
      seedingDate: payload.seedingDate ?? null,
      sourceKey: "field-intake:geofile-create",
      metadata: {
        intakeMethod: "geofile",
        fileName: file.name,
        mimeType: file.type || null,
        format: parsed.format,
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
      route: "/api/field-intake/geofile/create",
      metadata: {
        source: "field-intake:geofile-create",
        format: parsed.format,
        fileName: file.name,
        hasCropContext: result.cropContext !== null,
        onboardingDispatchCount: result.onboardingDispatches.length,
      },
    });

    return jsonOk(
      {
        result,
      },
      {
        status: result.action === "created" ? 201 : 200,
      },
    );
  } catch (error) {
    if (error instanceof RequestContextError) {
      return handleFieldIntakeRouteError(error, {
        event: "field-intake-geofile-create-route",
        code: "boundary_create_failed",
        message: "We could not create that field from the boundary file.",
        status: error.status,
      });
    }

    return handleFieldIntakeRouteError(error, {
      event: "field-intake-geofile-create-route",
      code: "boundary_create_failed",
      message: "We could not create that field from the boundary file.",
      status: 400,
    });
  }
}
