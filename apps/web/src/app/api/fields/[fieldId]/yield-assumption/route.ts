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
import { logAuditEvent } from "../../../../../server/audit/logAuditEvent";
import { getWebServerRuntime } from "../../../../../server/runtime/getWebServerRuntime";
import {
  RequestContextError,
  resolveRequestActor,
} from "../../../../../server/runtime/resolveRequestContext";
import {
  nullableTrimmedText,
  optionalTrimmedText,
  optionalYearInput,
  parseWithSchema,
  positiveNumberInput,
  z,
} from "../../../../../server/http/validation";

const FIELD_YIELD_RATE_LIMIT = {
  scope: "field-yield-assumption:actor",
  maxAttempts: 40,
  windowSeconds: 5 * 60,
} as const;

const FIELD_YIELD_IP_RATE_LIMIT = {
  scope: "field-yield-assumption:ip",
  maxAttempts: 80,
  windowSeconds: 5 * 60,
} as const;

const YieldAssumptionBodySchema = z
  .object({
    yieldTonnesPerHa: z.union([
      positiveNumberInput(
        "[yield-assumption] yieldTonnesPerHa must be a positive number.",
      ),
      z.undefined(),
    ]),
    yield: z.union([
      positiveNumberInput(
        "[yield-assumption] yieldTonnesPerHa must be a positive number.",
      ),
      z.undefined(),
    ]),
    seasonYear: optionalYearInput(
      "[yield-assumption] seasonYear must be a valid integer year.",
    ),
    cropSymbol: nullableTrimmedText(),
    sourceKey: optionalTrimmedText(),
    source: optionalTrimmedText(),
    noteText: nullableTrimmedText(),
    assumedAt: optionalTrimmedText(),
  })
  .refine(
    (value) =>
      value.yieldTonnesPerHa !== undefined || value.yield !== undefined,
    {
      message: "[yield-assumption] yieldTonnesPerHa must be a positive number.",
      path: ["yieldTonnesPerHa"],
    },
  );

export async function GET(
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
    const { fieldId } = await context.params;
    const { searchParams } = new URL(request.url);
    const seasonYear = parseWithSchema(
      optionalYearInput(
        "[yield-assumption] seasonYear must be a valid integer year.",
      ),
      searchParams.get("seasonYear"),
    );
    const cropSymbol = searchParams.get("cropSymbol")?.trim().toUpperCase() || undefined;
    const assumption = await runtime.services.market.latestFieldYieldAssumption({
      workspaceId: actor.workspaceId,
      fieldId,
      seasonYear,
      cropSymbol,
    });

    return jsonOk({ assumption });
  } catch (error) {
    if (error instanceof RequestContextError) {
      return jsonError(error.status, error.message);
    }

    return jsonServerError(error, {
      event: "field-yield-assumption-get-route",
      message: "Field yield assumption lookup failed.",
    });
  }
}

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
    const { fieldId } = await context.params;
    const body = await readJsonObject(request);

    if (!body) {
      return jsonError(400, "Expected a JSON request body.");
    }
    const payload = parseWithSchema(YieldAssumptionBodySchema, body);
    const rateLimitResponse = await enforceRouteRateLimits({
      runtime,
      rules: [
        buildIpRateLimitRule({
          request,
          ...FIELD_YIELD_IP_RATE_LIMIT,
          message: "Too many yield assumption updates.",
        }),
        {
          ...FIELD_YIELD_RATE_LIMIT,
          identifier: buildActorRateLimitIdentifier({
            workspaceId: actor.workspaceId,
            userId: actor.userId,
            resourceId: fieldId,
          }),
          message: "Too many yield assumption updates.",
        },
      ],
    });

    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const yieldTonnesPerHa = payload.yieldTonnesPerHa ?? payload.yield;

    const assumption = await runtime.services.market.upsertFieldYieldAssumption({
      workspaceId: actor.workspaceId,
      fieldId,
      seasonYear: payload.seasonYear,
      cropSymbol: payload.cropSymbol?.toUpperCase() ?? null,
      yieldTonnesPerHa: yieldTonnesPerHa!,
      sourceKey: payload.sourceKey ?? payload.source ?? "manual-admin",
      noteText: payload.noteText ?? null,
      assumedAt: payload.assumedAt,
    });

    await logAuditEvent({
      runtime,
      action: "field.yield_assumption_upserted",
      actorUserId: actor.userId,
      workspaceId: actor.workspaceId,
      resourceType: "field-yield-assumption",
      resourceId: assumption.id,
      route: "/api/fields/[fieldId]/yield-assumption",
      metadata: {
        fieldId,
        seasonYear: assumption.seasonYear,
        cropSymbol: assumption.cropSymbol,
        yieldTonnesPerHa: assumption.yieldTonnesPerHa,
      },
    });

    return jsonOk({ assumption }, { status: 201 });
  } catch (error) {
    if (error instanceof RequestContextError) {
      return jsonError(error.status, error.message);
    }

    return jsonServerError(error, {
      event: "field-yield-assumption-post-route",
      message: "Field yield assumption upsert failed.",
    });
  }
}
