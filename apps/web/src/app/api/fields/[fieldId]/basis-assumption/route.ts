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
  optionalFiniteNumberInput,
  optionalTrimmedText,
  optionalYearInput,
  parseWithSchema,
  z,
} from "../../../../../server/http/validation";

const FIELD_BASIS_RATE_LIMIT = {
  scope: "field-basis-assumption:actor",
  maxAttempts: 40,
  windowSeconds: 5 * 60,
} as const;

const FIELD_BASIS_IP_RATE_LIMIT = {
  scope: "field-basis-assumption:ip",
  maxAttempts: 80,
  windowSeconds: 5 * 60,
} as const;

const BasisAssumptionBodySchema = z
  .object({
    basisCadPerTonne: optionalFiniteNumberInput(
      "[basis-assumption] basisCadPerTonne must be a number.",
    ),
    basis: optionalFiniteNumberInput(
      "[basis-assumption] basisCadPerTonne must be a number.",
    ),
    seasonYear: optionalYearInput(
      "[basis-assumption] seasonYear must be a valid integer year.",
    ),
    cropSymbol: nullableTrimmedText(),
    sourceKey: optionalTrimmedText(),
    source: optionalTrimmedText(),
    noteText: nullableTrimmedText(),
    assumedAt: optionalTrimmedText(),
  })
  .refine(
    (value) =>
      value.basisCadPerTonne !== undefined || value.basis !== undefined,
    {
      message: "[basis-assumption] basisCadPerTonne must be a number.",
      path: ["basisCadPerTonne"],
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
        "[basis-assumption] seasonYear must be a valid integer year.",
      ),
      searchParams.get("seasonYear"),
    );
    const cropSymbol = searchParams.get("cropSymbol")?.trim().toUpperCase() || undefined;
    const assumption = await runtime.services.market.latestFieldBasisAssumption({
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
      event: "field-basis-assumption-get-route",
      message: "Field basis assumption lookup failed.",
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
    const payload = parseWithSchema(BasisAssumptionBodySchema, body);
    const rateLimitResponse = await enforceRouteRateLimits({
      runtime,
      rules: [
        buildIpRateLimitRule({
          request,
          ...FIELD_BASIS_IP_RATE_LIMIT,
          message: "Too many basis assumption updates.",
        }),
        {
          ...FIELD_BASIS_RATE_LIMIT,
          identifier: buildActorRateLimitIdentifier({
            workspaceId: actor.workspaceId,
            userId: actor.userId,
            resourceId: fieldId,
          }),
          message: "Too many basis assumption updates.",
        },
      ],
    });

    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const basisCadPerTonne = payload.basisCadPerTonne ?? payload.basis;

    const assumption = await runtime.services.market.upsertFieldBasisAssumption({
      workspaceId: actor.workspaceId,
      fieldId,
      seasonYear: payload.seasonYear,
      cropSymbol: payload.cropSymbol?.toUpperCase() ?? null,
      basisCadPerTonne: basisCadPerTonne!,
      sourceKey: payload.sourceKey ?? payload.source ?? "manual-admin",
      noteText: payload.noteText ?? null,
      assumedAt: payload.assumedAt,
    });

    await logAuditEvent({
      runtime,
      action: "field.basis_assumption_upserted",
      actorUserId: actor.userId,
      workspaceId: actor.workspaceId,
      resourceType: "field-basis-assumption",
      resourceId: assumption.id,
      route: "/api/fields/[fieldId]/basis-assumption",
      metadata: {
        fieldId,
        seasonYear: assumption.seasonYear,
        cropSymbol: assumption.cropSymbol,
        basisCadPerTonne: assumption.basisCadPerTonne,
      },
    });

    return jsonOk({ assumption }, { status: 201 });
  } catch (error) {
    if (error instanceof RequestContextError) {
      return jsonError(error.status, error.message);
    }

    return jsonServerError(error, {
      event: "field-basis-assumption-post-route",
      message: "Field basis assumption upsert failed.",
    });
  }
}
