import { jsonError, jsonOk, readJsonObject } from "../../../../../server/http/json";
import { getWebServerRuntime } from "../../../../../server/runtime/getWebServerRuntime";
import {
  RequestContextError,
  resolveRequestActor,
} from "../../../../../server/runtime/resolveRequestContext";
import type { JsonValue } from "@fieldpulse/platform-db";

function hasBodyKey(body: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(body, key);
}

function isRecord(value: unknown): value is Record<string, JsonValue> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readRequiredCropType(body: Record<string, unknown>) {
  const raw =
    typeof body.cropType === "string"
      ? body.cropType
      : typeof body.cropName === "string"
        ? body.cropName
        : "";
  const value = raw.trim();

  if (!value) {
    throw new RequestContextError(
      400,
      "[crop-context] cropType must be a non-empty string.",
    );
  }

  return value;
}

function readOptionalNullableString(value: unknown, label: string) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new RequestContextError(
      400,
      `[crop-context] ${label} must be a string or null.`,
    );
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

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
      "[crop-context] seasonYear must be a valid integer year.",
    );
  }

  return parsed;
}

function validateSeedingDate(value: string | null) {
  if (value == null) {
    return value;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new RequestContextError(
      400,
      "[crop-context] seedingDate must use YYYY-MM-DD format.",
    );
  }

  return value;
}

function resolveSeasonYear(
  requestedSeasonYear: number | undefined,
  seedingDate: string | null,
  fallbackSeasonYear?: number,
) {
  if (requestedSeasonYear) {
    return requestedSeasonYear;
  }

  if (seedingDate) {
    return Number(seedingDate.slice(0, 4));
  }

  if (fallbackSeasonYear) {
    return fallbackSeasonYear;
  }

  return new Date().getUTCFullYear();
}

export async function PATCH(
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

    const current = await runtime.services.fieldCropContext.loadFieldContext({
      workspaceId: actor.workspaceId,
      fieldId,
    });
    const currentMetadata = isRecord(current?.metadata) ? current.metadata : {};
    const nextVariety = hasBodyKey(body, "variety")
      ? readOptionalNullableString(body.variety, "variety")
      : (typeof currentMetadata.variety === "string"
          ? currentMetadata.variety
          : null);
    const nextSeedingDate = validateSeedingDate(
      hasBodyKey(body, "seedingDate")
        ? readOptionalNullableString(body.seedingDate, "seedingDate") ?? null
        : (typeof currentMetadata.seedingDate === "string"
            ? currentMetadata.seedingDate
            : null),
    );
    const sourceKey =
      typeof body.sourceKey === "string" && body.sourceKey.trim().length > 0
        ? body.sourceKey.trim()
        : current?.sourceKey ?? "manual-admin";
    const seasonYear = resolveSeasonYear(
      readOptionalSeasonYear(body.seasonYear),
      nextSeedingDate,
      current?.seasonYear,
    );

    const cropContext = await runtime.services.fieldCropContext.upsertFieldContext({
      workspaceId: actor.workspaceId,
      fieldId,
      seasonYear,
      cropType: readRequiredCropType(body),
      growthStage: current?.growthStage ?? null,
      growthStageSource: current?.growthStageSource ?? "manual",
      accumulatedGdd: current?.accumulatedGdd ?? 0,
      lastGddObservedOn: current?.lastGddObservedOn ?? null,
      lastWeatherSignalSetId: current?.lastWeatherSignalSetId ?? null,
      lastStageUpdatedAt: current?.lastStageUpdatedAt ?? null,
      sourceKey,
      metadata: {
        ...currentMetadata,
        variety: nextVariety ?? null,
        seedingDate: nextSeedingDate,
        source: "edit-field-panel",
      },
    });

    return jsonOk({ cropContext });
  } catch (error) {
    if (error instanceof RequestContextError) {
      return jsonError(error.status, error.message);
    }

    return jsonError(
      500,
      error instanceof Error ? error.message : "Crop context update failed.",
    );
  }
}
