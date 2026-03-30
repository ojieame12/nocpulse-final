import { jsonError, jsonOk, readJsonObject } from "../../../../server/http/json";
import { getWebServerRuntime } from "../../../../server/runtime/getWebServerRuntime";
import {
  RequestContextError,
  resolveRequestActor,
} from "../../../../server/runtime/resolveRequestContext";

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

    await resolveRequestActor(request, runtime);
    const cropSymbol = readRequiredCropSymbol(request);
    const snapshot = await runtime.services.market.latestPrice({
      cropSymbol,
    });

    return jsonOk({ snapshot });
  } catch (error) {
    if (error instanceof RequestContextError) {
      return jsonError(error.status, error.message);
    }

    return jsonError(
      500,
      error instanceof Error ? error.message : "Market price lookup failed.",
    );
  }
}

export async function POST(request: Request) {
  try {
    const runtime = getWebServerRuntime();

    if (runtime.mode !== "supabase") {
      return jsonError(503, "Supabase runtime is not configured.");
    }

    await resolveRequestActor(request, runtime);
    const body = await readJsonObject(request);

    if (!body) {
      return jsonError(400, "Expected a JSON request body.");
    }

    const cropSymbol =
      typeof body.cropSymbol === "string" ? body.cropSymbol.trim().toUpperCase() : "";
    const closePriceCadPerTonne =
      typeof body.closePriceCadPerTonne === "number"
        ? body.closePriceCadPerTonne
        : typeof body.price === "number"
          ? body.price
          : null;
    const basisCadPerTonne =
      typeof body.basisCadPerTonne === "number"
        ? body.basisCadPerTonne
        : typeof body.basis === "number"
          ? body.basis
          : undefined;
    const sourceKey =
      typeof body.sourceKey === "string" && body.sourceKey.trim().length > 0
        ? body.sourceKey.trim()
        : typeof body.source === "string" && body.source.trim().length > 0
          ? body.source.trim()
          : "manual-admin";
    const capturedAt =
      typeof body.capturedAt === "string" && body.capturedAt.trim().length > 0
        ? body.capturedAt.trim()
        : typeof body["captured-at"] === "string" &&
            body["captured-at"].trim().length > 0
          ? body["captured-at"].trim()
          : undefined;

    if (!cropSymbol) {
      return jsonError(400, "[market] cropSymbol is required.");
    }

    if (
      closePriceCadPerTonne == null ||
      !Number.isFinite(closePriceCadPerTonne)
    ) {
      return jsonError(400, "[market] closePriceCadPerTonne must be a number.");
    }

    if (
      basisCadPerTonne !== undefined &&
      !Number.isFinite(basisCadPerTonne)
    ) {
      return jsonError(400, "[market] basisCadPerTonne must be a number.");
    }

    const numericClosePriceCadPerTonne: number = closePriceCadPerTonne;
    const snapshot = await runtime.services.market.upsertPrice({
      cropSymbol,
      closePriceCadPerTonne: numericClosePriceCadPerTonne,
      basisCadPerTonne,
      sourceKey,
      capturedAt,
    });

    return jsonOk({ snapshot }, { status: 201 });
  } catch (error) {
    if (error instanceof RequestContextError) {
      return jsonError(error.status, error.message);
    }

    return jsonError(
      500,
      error instanceof Error ? error.message : "Market price upsert failed.",
    );
  }
}
