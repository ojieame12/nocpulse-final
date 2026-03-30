import { jsonError, jsonOk, readJsonObject } from "../../../../../server/http/json";
import { getWebServerRuntime } from "../../../../../server/runtime/getWebServerRuntime";
import {
  RequestContextError,
  resolveRequestActor,
} from "../../../../../server/runtime/resolveRequestContext";

function readOptionalSeasonYear(value: unknown) {
  if (value == null || value === "") {
    return undefined;
  }

  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value.trim())
        : Number.NaN;

  if (!Number.isInteger(parsed) || parsed < 1900 || parsed > 3000) {
    throw new RequestContextError(
      400,
      "[basis-assumption] seasonYear must be a valid integer year.",
    );
  }

  return parsed;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ fieldId: string }> },
) {
  try {
    const runtime = getWebServerRuntime();

    if (runtime.mode !== "supabase") {
      return jsonError(503, "Supabase runtime is not configured.");
    }

    const actor = await resolveRequestActor(request, runtime);
    const { fieldId } = await context.params;
    const { searchParams } = new URL(request.url);
    const seasonYear = readOptionalSeasonYear(searchParams.get("seasonYear"));
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

    return jsonError(
      500,
      error instanceof Error
        ? error.message
        : "Field basis assumption lookup failed.",
    );
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

    const actor = await resolveRequestActor(request, runtime);
    const { fieldId } = await context.params;
    const body = await readJsonObject(request);

    if (!body) {
      return jsonError(400, "Expected a JSON request body.");
    }

    const basisCadPerTonne =
      typeof body.basisCadPerTonne === "number"
        ? body.basisCadPerTonne
        : typeof body.basis === "number"
          ? body.basis
          : null;
    const seasonYear = readOptionalSeasonYear(body.seasonYear);
    const cropSymbol =
      typeof body.cropSymbol === "string" && body.cropSymbol.trim().length > 0
        ? body.cropSymbol.trim().toUpperCase()
        : null;
    const sourceKey =
      typeof body.sourceKey === "string" && body.sourceKey.trim().length > 0
        ? body.sourceKey.trim()
        : typeof body.source === "string" && body.source.trim().length > 0
          ? body.source.trim()
          : "manual-admin";
    const noteText =
      typeof body.noteText === "string" && body.noteText.trim().length > 0
        ? body.noteText.trim()
        : null;
    const assumedAt =
      typeof body.assumedAt === "string" && body.assumedAt.trim().length > 0
        ? body.assumedAt.trim()
        : undefined;

    if (basisCadPerTonne == null || !Number.isFinite(basisCadPerTonne)) {
      return jsonError(
        400,
        "[basis-assumption] basisCadPerTonne must be a number.",
      );
    }

    const assumption = await runtime.services.market.upsertFieldBasisAssumption({
      workspaceId: actor.workspaceId,
      fieldId,
      seasonYear,
      cropSymbol,
      basisCadPerTonne,
      sourceKey,
      noteText,
      assumedAt,
    });

    return jsonOk({ assumption }, { status: 201 });
  } catch (error) {
    if (error instanceof RequestContextError) {
      return jsonError(error.status, error.message);
    }

    return jsonError(
      500,
      error instanceof Error
        ? error.message
        : "Field basis assumption upsert failed.",
    );
  }
}
