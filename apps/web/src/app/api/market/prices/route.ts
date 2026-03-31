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
  optionalFiniteNumberInput,
  optionalTrimmedText,
  parseWithSchema,
  positiveNumberInput,
  z,
} from "../../../../server/http/validation";
import {
  RequestContextError,
  resolveRequestActor,
} from "../../../../server/runtime/resolveRequestContext";

const MARKET_PRICE_RATE_LIMIT = {
  scope: "market-prices:actor",
  maxAttempts: 40,
  windowSeconds: 5 * 60,
} as const;

const MARKET_PRICE_IP_RATE_LIMIT = {
  scope: "market-prices:ip",
  maxAttempts: 80,
  windowSeconds: 5 * 60,
} as const;

const MarketPriceBodySchema = z
  .object({
    cropSymbol: z.preprocess(
      (value) =>
        typeof value === "string" ? value.trim().toUpperCase() : value,
      z.string().min(1, "[market] cropSymbol is required."),
    ),
    closePriceCadPerTonne: z.union([
      positiveNumberInput(
        "[market] closePriceCadPerTonne must be a positive number.",
      ),
      z.undefined(),
    ]),
    price: z.union([
      positiveNumberInput(
        "[market] closePriceCadPerTonne must be a positive number.",
      ),
      z.undefined(),
    ]),
    basisCadPerTonne: optionalFiniteNumberInput(
      "[market] basisCadPerTonne must be a number.",
    ),
    basis: optionalFiniteNumberInput(
      "[market] basisCadPerTonne must be a number.",
    ),
    sourceKey: optionalTrimmedText(),
    source: optionalTrimmedText(),
    capturedAt: optionalTrimmedText(),
    "captured-at": optionalTrimmedText(),
  })
  .refine(
    (value) =>
      value.closePriceCadPerTonne !== undefined || value.price !== undefined,
    {
      message: "[market] closePriceCadPerTonne must be a positive number.",
      path: ["closePriceCadPerTonne"],
    },
  );

function readRequiredCropSymbol(request: Request) {
  const { searchParams } = new URL(request.url);
  const cropSymbol = searchParams.get("cropSymbol")?.trim().toUpperCase();

  if (!cropSymbol) {
    throw new RequestContextError(
      400,
      "[market] cropSymbol is required for market price routes.",
    );
  }

  return cropSymbol;
}

export async function GET(request: Request) {
  try {
    const runtime = getWebServerRuntime();

    if (runtime.mode !== "supabase") {
      return jsonError(503, "Supabase runtime is not configured.");
    }

    await resolveRequestActor(request, runtime, {
      allowDevelopmentFallback: true,
    });
    const cropSymbol = readRequiredCropSymbol(request);
    const snapshot = await runtime.services.market.latestPrice({
      cropSymbol,
    });

    return jsonOk({ snapshot });
  } catch (error) {
    if (error instanceof RequestContextError) {
      return jsonError(error.status, error.message);
    }

    return jsonServerError(error, {
      event: "market-prices-get-route",
      message: "Market price lookup failed.",
    });
  }
}

export async function POST(request: Request) {
  try {
    const runtime = getWebServerRuntime();

    if (runtime.mode !== "supabase") {
      return jsonError(503, "Supabase runtime is not configured.");
    }

    const actor = await resolveRequestActor(request, runtime, {
      allowDevelopmentFallback: true,
    });
    const body = await readJsonObject(request);

    if (!body) {
      return jsonError(400, "Expected a JSON request body.");
    }
    const payload = parseWithSchema(MarketPriceBodySchema, body);
    const rateLimitResponse = await enforceRouteRateLimits({
      runtime,
      rules: [
        buildIpRateLimitRule({
          request,
          ...MARKET_PRICE_IP_RATE_LIMIT,
          message: "Too many market price updates.",
        }),
        {
          ...MARKET_PRICE_RATE_LIMIT,
          identifier: buildActorRateLimitIdentifier({
            workspaceId: actor.workspaceId,
            userId: actor.userId,
            resourceId: payload.cropSymbol,
          }),
          message: "Too many market price updates.",
        },
      ],
    });

    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const snapshot = await runtime.services.market.upsertPrice({
      cropSymbol: payload.cropSymbol,
      closePriceCadPerTonne:
        payload.closePriceCadPerTonne ?? payload.price ?? 0,
      basisCadPerTonne: payload.basisCadPerTonne ?? payload.basis,
      sourceKey: payload.sourceKey ?? payload.source ?? "manual-admin",
      capturedAt: payload.capturedAt ?? payload["captured-at"],
    });

    await logAuditEvent({
      runtime,
      action: "market.price_upserted",
      actorUserId: actor.userId,
      workspaceId: actor.workspaceId,
      resourceType: "market-price",
      resourceId: snapshot.id,
      route: "/api/market/prices",
      metadata: {
        cropSymbol: snapshot.cropSymbol,
        closePriceCadPerTonne: snapshot.closePriceCadPerTonne,
        basisCadPerTonne: snapshot.basisCadPerTonne ?? null,
      },
    });

    return jsonOk({ snapshot }, { status: 201 });
  } catch (error) {
    if (error instanceof RequestContextError) {
      return jsonError(error.status, error.message);
    }

    return jsonServerError(error, {
      event: "market-prices-post-route",
      message: "Market price upsert failed.",
    });
  }
}
