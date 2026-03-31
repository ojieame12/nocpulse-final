import {
  jsonError,
  jsonOk,
  jsonServerError,
  readJsonObject,
} from "../../../../../server/http/json";
import {
  buildActorRateLimitIdentifier,
  buildIpRateLimitRule,
  enforceRouteRateLimits,
} from "../../../../../server/auth/routeRateLimit";
import {
  nullableTrimmedText,
  parseWithSchema,
  z,
} from "../../../../../server/http/validation";
import { getWebServerRuntime } from "../../../../../server/runtime/getWebServerRuntime";
import {
  RequestContextError,
  resolveRequestActor,
} from "../../../../../server/runtime/resolveRequestContext";

const FIELD_INTAKE_SPREADSHEET_PREVIEW_ACTOR_RATE_LIMIT = {
  scope: "field-intake-spreadsheet-preview:actor",
  maxAttempts: 20,
  windowSeconds: 10 * 60,
} as const;

const FIELD_INTAKE_SPREADSHEET_PREVIEW_IP_RATE_LIMIT = {
  scope: "field-intake-spreadsheet-preview:ip",
  maxAttempts: 30,
  windowSeconds: 10 * 60,
} as const;

const SpreadsheetBatchBodySchema = z.object({
  workspaceId: nullableTrimmedText(),
  preview: z.record(z.unknown()),
});

export async function POST(request: Request) {
  const body = await readJsonObject(request);

  if (!body) {
    return jsonError(400, "Expected a JSON request body.");
  }

  try {
    const payload = parseWithSchema(SpreadsheetBatchBodySchema, body);
    const runtime = getWebServerRuntime();

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
          ...FIELD_INTAKE_SPREADSHEET_PREVIEW_IP_RATE_LIMIT,
          message: "Too many spreadsheet preview save requests.",
        }),
        {
          ...FIELD_INTAKE_SPREADSHEET_PREVIEW_ACTOR_RATE_LIMIT,
          identifier: buildActorRateLimitIdentifier({
            workspaceId: actor.workspaceId,
            userId: actor.userId,
          }),
          message: "Too many spreadsheet preview save requests.",
        },
      ],
    });

    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const result = await runtime.services.fieldIntake.saveSpreadsheetImportPreview({
      actorUserId: actor.userId,
      workspaceId: actor.workspaceId,
      preview: payload.preview as Parameters<
        typeof runtime.services.fieldIntake.saveSpreadsheetImportPreview
      >[0]["preview"],
    });

    return jsonOk(
      {
        result,
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    if (error instanceof RequestContextError) {
      return jsonError(error.status, error.message);
    }

    return jsonServerError(error, {
      status: 400,
      event: "field-intake-spreadsheet-batches-route",
      message: "Import batch save failed.",
    });
  }
}
