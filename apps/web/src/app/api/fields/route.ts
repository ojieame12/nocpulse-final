import {
  jsonError,
  jsonOk,
  jsonServerError,
  readJsonObject,
} from "../../../server/http/json";
import {
  buildActorRateLimitIdentifier,
  buildIpRateLimitRule,
  enforceRouteRateLimits,
} from "../../../server/auth/routeRateLimit";
import { logAuditEvent } from "../../../server/audit/logAuditEvent";
import { createDraftField } from "../../../server/fields/createDraftField";
import { buildManualFieldDraft } from "../../../server/fields/manualFieldDraft";
import {
  finiteNumberInput,
  nullableTrimmedText,
  parseWithSchema,
  positiveNumberInput,
  requiredTrimmedString,
  z,
} from "../../../server/http/validation";
import { getWebServerRuntime } from "../../../server/runtime/getWebServerRuntime";
import {
  RequestContextError,
  resolveRequestActor,
} from "../../../server/runtime/resolveRequestContext";

const FIELD_CREATE_ACTOR_RATE_LIMIT = {
  scope: "fields-create:actor",
  maxAttempts: 12,
  windowSeconds: 15 * 60,
} as const;

const FIELD_CREATE_IP_RATE_LIMIT = {
  scope: "fields-create:ip",
  maxAttempts: 20,
  windowSeconds: 15 * 60,
} as const;

const CreateFieldBodySchema = z.object({
  workspaceId: nullableTrimmedText(),
  name: requiredTrimmedString("Field `name` is required."),
  latitude: finiteNumberInput("Field `latitude` must be a valid number."),
  longitude: finiteNumberInput("Field `longitude` must be a valid number."),
  areaHa: positiveNumberInput("Field `areaHa` must be a positive number."),
  cropType: nullableTrimmedText(),
  variety: nullableTrimmedText(),
  seedingDate: nullableTrimmedText().refine(
    (value) => value == null || /^\d{4}-\d{2}-\d{2}$/.test(value),
    "Field `seedingDate` must use YYYY-MM-DD format.",
  ),
  legalLandDescription: nullableTrimmedText(),
});

export async function POST(request: Request) {
  const body = await readJsonObject(request);

  if (!body) {
    return jsonError(400, "Expected a JSON request body.");
  }

  try {
    const payload = parseWithSchema(CreateFieldBodySchema, body);

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
          ...FIELD_CREATE_IP_RATE_LIMIT,
          message: "Too many field create requests.",
        }),
        {
          ...FIELD_CREATE_ACTOR_RATE_LIMIT,
          identifier: buildActorRateLimitIdentifier({
            workspaceId: actor.workspaceId,
            userId: actor.userId,
          }),
          message: "Too many field create requests.",
        },
      ],
    });

    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const manualDraft = buildManualFieldDraft({
      latitude: payload.latitude,
      longitude: payload.longitude,
      areaHa: payload.areaHa,
    });
    const result = await createDraftField({
      runtime,
      actor,
      name: payload.name,
      boundary: manualDraft.boundary,
      areaHa: manualDraft.areaHa,
      legalLandDescription: payload.legalLandDescription ?? null,
      cropType: payload.cropType ?? null,
      variety: payload.variety ?? null,
      seedingDate: payload.seedingDate ?? null,
      sourceKey: "manual-entry",
      metadata: {
        enteredPoint: {
          latitude: payload.latitude,
          longitude: payload.longitude,
        },
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
      route: "/api/fields",
      metadata: {
        source: "manual-entry",
        name: result.field.name,
        areaHa: result.field.areaHa,
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
      return jsonError(error.status, error.message);
    }

    return jsonServerError(error, {
      status: 400,
      event: "fields-create-route",
      message: "Field create request failed.",
    });
  }
}
