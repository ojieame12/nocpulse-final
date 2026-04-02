import {
  jsonOk,
  readJsonObject,
} from "../../../../../server/http/json";
import {
  buildIpRateLimitRule,
  enforceRouteRateLimits,
} from "../../../../../server/auth/routeRateLimit";
import {
  nullableTrimmedText,
  parseWithSchema,
  requiredTrimmedString,
  z,
} from "../../../../../server/http/validation";
import { getWebServerRuntime } from "../../../../../server/runtime/getWebServerRuntime";
import {
  handleFieldIntakeRouteError,
  jsonFieldIntakeError,
  withFieldIntakeRateLimitCode,
} from "../../_shared/intakeErrors";

const FIELD_INTAKE_LLD_LOOKUP_IP_RATE_LIMIT = {
  scope: "field-intake-lld-lookup:ip",
  maxAttempts: 40,
  windowSeconds: 10 * 60,
} as const;

const LldLookupBodySchema = z.object({
  code: requiredTrimmedString("Field `code` is required."),
  suggestedFieldName: nullableTrimmedText(),
});

export async function POST(request: Request) {
  const body = await readJsonObject(request);

  if (!body) {
    return jsonFieldIntakeError({
      status: 400,
      code: "invalid_request_body",
      message: "We could not read that lookup request.",
    });
  }

  try {
    const payload = parseWithSchema(LldLookupBodySchema, body);
    const runtime = getWebServerRuntime();

    if (runtime.mode !== "supabase") {
      return jsonFieldIntakeError({
        status: 503,
        code: "runtime_unavailable",
        message: "Field intake is temporarily unavailable.",
      });
    }
    const rateLimitResponse = await enforceRouteRateLimits({
      runtime,
      rules: [
        buildIpRateLimitRule({
          request,
          ...FIELD_INTAKE_LLD_LOOKUP_IP_RATE_LIMIT,
          message: "Too many LLD lookup requests.",
        }),
      ],
    });

    if (rateLimitResponse) {
      return withFieldIntakeRateLimitCode(rateLimitResponse);
    }

    const result = await runtime.services.fieldIntake.lookupLldBoundary({
      code: payload.code,
      suggestedFieldName: payload.suggestedFieldName ?? undefined,
    });

    return jsonOk({
      result,
    });
  } catch (error) {
    return handleFieldIntakeRouteError(error, {
      event: "field-intake-lld-lookup-route",
      code: "lld_lookup_failed",
      message: "We could not complete that land lookup.",
      status: 400,
    });
  }
}
