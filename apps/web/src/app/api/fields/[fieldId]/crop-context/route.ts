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
  nullableTrimmedText,
  optionalTrimmedText,
  optionalYearInput,
  parseWithSchema,
  z,
} from "../../../../../server/http/validation";
import {
  RequestContextError,
  resolveRequestActor,
} from "../../../../../server/runtime/resolveRequestContext";
import type { JsonValue } from "@fieldpulse/platform-db";

const FIELD_CROP_CONTEXT_RATE_LIMIT = {
  scope: "field-crop-context:actor",
  maxAttempts: 30,
  windowSeconds: 5 * 60,
} as const;

const FIELD_CROP_CONTEXT_IP_RATE_LIMIT = {
  scope: "field-crop-context:ip",
  maxAttempts: 60,
  windowSeconds: 5 * 60,
} as const;

const CropContextBodySchema = z
  .object({
    cropType: nullableTrimmedText(),
    cropName: nullableTrimmedText(),
    variety: nullableTrimmedText(),
    seedingDate: nullableTrimmedText(),
    growthStage: z
      .enum(["pre-seed", "vegetative", "flowering", "ripening"], {
        errorMap: () => ({
          message:
            "[crop-context] growthStage must be one of pre-seed, vegetative, flowering, or ripening.",
        }),
      })
      .nullable()
      .optional(),
    seasonYear: optionalYearInput(
      "[crop-context] seasonYear must be a valid integer year.",
    ),
    sourceKey: optionalTrimmedText(),
  })
  .refine(
    (value) => (value.cropType ?? value.cropName ?? null) != null,
    {
      message: "[crop-context] cropType must be a non-empty string.",
      path: ["cropType"],
    },
  )
  .refine(
    (value) =>
      value.seedingDate == null || /^\d{4}-\d{2}-\d{2}$/.test(value.seedingDate),
    {
      message: "[crop-context] seedingDate must use YYYY-MM-DD format.",
      path: ["seedingDate"],
    },
  );

function isRecord(value: unknown): value is Record<string, JsonValue> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

    const actor = await resolveRequestActor(request, runtime, {
      allowDevelopmentFallback: true,
    });
    const { fieldId } = await context.params;
    const body = await readJsonObject(request);

    if (!body) {
      return jsonError(400, "Expected a JSON request body.");
    }
    const payload = parseWithSchema(CropContextBodySchema, body);
    const rateLimitResponse = await enforceRouteRateLimits({
      runtime,
      rules: [
        buildIpRateLimitRule({
          request,
          ...FIELD_CROP_CONTEXT_IP_RATE_LIMIT,
          message: "Too many crop context updates.",
        }),
        {
          ...FIELD_CROP_CONTEXT_RATE_LIMIT,
          identifier: buildActorRateLimitIdentifier({
            workspaceId: actor.workspaceId,
            userId: actor.userId,
            resourceId: fieldId,
          }),
          message: "Too many crop context updates.",
        },
      ],
    });

    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const current = await runtime.services.fieldCropContext.loadFieldContext({
      workspaceId: actor.workspaceId,
      fieldId,
    });
    const currentMetadata = isRecord(current?.metadata) ? current.metadata : {};
    const currentSeedingDate =
      typeof currentMetadata.seedingDate === "string"
        ? currentMetadata.seedingDate
        : null;
    const nextVariety = body.variety !== undefined
      ? payload.variety ?? null
      : (typeof currentMetadata.variety === "string"
          ? currentMetadata.variety
          : null);
    const nextSeedingDate =
      body.seedingDate !== undefined
        ? payload.seedingDate ?? null
        : currentSeedingDate;
    const seedingDateChanged =
      body.seedingDate !== undefined && nextSeedingDate !== currentSeedingDate;
    const sourceKey = payload.sourceKey ?? current?.sourceKey ?? "manual-admin";
    const seasonYear = resolveSeasonYear(
      payload.seasonYear,
      nextSeedingDate,
      current?.seasonYear,
    );

    let cropContext = await runtime.services.fieldCropContext.upsertFieldContext({
      workspaceId: actor.workspaceId,
      fieldId,
      seasonYear,
      cropType: payload.cropType ?? payload.cropName ?? "",
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

    if (body.growthStage !== undefined) {
      const requestedAt = new Date().toISOString();

      if (payload.growthStage == null) {
        cropContext =
          (await runtime.services.fieldCropContext.clearGrowthStageOverride({
            workspaceId: actor.workspaceId,
            fieldId,
            requestedAt,
          })) ?? cropContext;
      } else {
        cropContext = await runtime.services.fieldCropContext.setGrowthStageOverride({
          workspaceId: actor.workspaceId,
          fieldId,
          growthStage: payload.growthStage,
          requestedAt,
        });
      }
    }

    if (seedingDateChanged) {
      cropContext =
        (await runtime.services.fieldCropContext.refreshGrowthStage({
          workspaceId: actor.workspaceId,
          fieldId,
          requestedAt: new Date().toISOString(),
        })) ?? cropContext;
    }

    await logAuditEvent({
      runtime,
      action: "field.crop_context_updated",
      actorUserId: actor.userId,
      workspaceId: actor.workspaceId,
      resourceType: "field",
      resourceId: fieldId,
      route: "/api/fields/[fieldId]/crop-context",
      metadata: {
        cropType: cropContext.cropType,
        seasonYear: cropContext.seasonYear,
        sourceKey,
        hasVariety: nextVariety !== null,
        hasSeedingDate: nextSeedingDate !== null,
        seedingDateChanged,
        growthStage: cropContext.growthStage,
        growthStageSource: cropContext.growthStageSource,
        manualGrowthStageOverride: cropContext.growthStageSource === "manual",
      },
    });

    return jsonOk({ cropContext });
  } catch (error) {
    if (error instanceof RequestContextError) {
      return jsonError(error.status, error.message);
    }

    return jsonServerError(error, {
      event: "field-crop-context-route",
      message: "Crop context update failed.",
    });
  }
}
