import {
  jsonError,
  jsonOk,
  jsonServerError,
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
    return jsonError(400, "Expected a JSON request body.");
  }

  try {
    const payload = parseWithSchema(LldLookupBodySchema, body);
    const runtime = getWebServerRuntime();

    if (runtime.mode !== "supabase") {
      return jsonError(503, "Supabase runtime is not configured.");
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
      return rateLimitResponse;
    }

    const result = await runtime.services.fieldIntake.lookupLldBoundary({
      code: payload.code,
      suggestedFieldName: payload.suggestedFieldName ?? undefined,
    });

    return jsonOk({
      result,
    });
  } catch (error) {
    return jsonServerError(error, {
      status: 400,
      event: "field-intake-lld-lookup-route",
      message: "LLD lookup failed.",
    });
  }
}
