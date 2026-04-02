import {
  jsonOk,
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
import {
  handleFieldIntakeRouteError,
  jsonFieldIntakeError,
  withFieldIntakeRateLimitCode,
} from "../../_shared/intakeErrors";

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
    return jsonFieldIntakeError({
      status: 400,
      code: "invalid_request_body",
      message: "We could not read that spreadsheet save request.",
    });
  }

  try {
    const payload = parseWithSchema(SpreadsheetBatchBodySchema, body);
    const runtime = getWebServerRuntime();

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
      return withFieldIntakeRateLimitCode(rateLimitResponse);
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
      return handleFieldIntakeRouteError(error, {
        event: "field-intake-spreadsheet-batches-route",
        code: "import_batch_save_failed",
        message: "We could not save that spreadsheet preview.",
        status: error.status,
      });
    }

    return handleFieldIntakeRouteError(error, {
      event: "field-intake-spreadsheet-batches-route",
      code: "import_batch_save_failed",
      message: "We could not save that spreadsheet preview.",
      status: 400,
    });
  }
}
