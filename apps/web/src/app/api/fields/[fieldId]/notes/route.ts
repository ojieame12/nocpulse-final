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
  parseWithSchema,
  requiredTrimmedString,
  z,
} from "../../../../../server/http/validation";
import {
  RequestContextError,
  resolveRequestActor,
} from "../../../../../server/runtime/resolveRequestContext";

const VALID_OUTCOMES = [
  "confirmed",
  "not_confirmed",
  "resolved",
  "monitor",
] as const;

type ValidOutcome = (typeof VALID_OUTCOMES)[number];

function isValidOutcome(value: string): value is ValidOutcome {
  return (VALID_OUTCOMES as readonly string[]).includes(value);
}

const FIELD_NOTES_RATE_LIMIT = {
  scope: "field-notes:actor",
  maxAttempts: 60,
  windowSeconds: 5 * 60,
} as const;

const FIELD_NOTES_IP_RATE_LIMIT = {
  scope: "field-notes:ip",
  maxAttempts: 120,
  windowSeconds: 5 * 60,
} as const;

const FieldNoteBodySchema = z.object({
  outcome: requiredTrimmedString(
    "[notes] outcome must be one of confirmed, not_confirmed, resolved, or monitor.",
  ).refine(
    (value) => isValidOutcome(value),
    "[notes] outcome must be one of confirmed, not_confirmed, resolved, or monitor.",
  ),
  noteText: requiredTrimmedString("[notes] noteText is required."),
  findingId: nullableTrimmedText(),
  zoneId: nullableTrimmedText(),
  cellKey: nullableTrimmedText(),
  observedAt: optionalTrimmedText(),
});

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
    const limitValue = searchParams.get("limit")?.trim();
    const limit =
      typeof limitValue === "string" && limitValue.length > 0
        ? Number(limitValue)
        : undefined;

    if (limitValue && (!Number.isFinite(limit) || Number(limit) <= 0)) {
      return jsonError(400, "[notes] limit must be a positive number.");
    }

    const notes = await runtime.services.scouting.listFieldNotes({
      workspaceId: actor.workspaceId,
      fieldId,
      limit,
    });

    return jsonOk({ notes });
  } catch (error) {
    if (error instanceof RequestContextError) {
      return jsonError(error.status, error.message);
    }

    return jsonServerError(error, {
      event: "field-notes-get-route",
      message: "Scout note lookup failed.",
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
    const payload = parseWithSchema(FieldNoteBodySchema, body);
    const rateLimitResponse = await enforceRouteRateLimits({
      runtime,
      rules: [
        buildIpRateLimitRule({
          request,
          ...FIELD_NOTES_IP_RATE_LIMIT,
          message: "Too many note updates.",
        }),
        {
          ...FIELD_NOTES_RATE_LIMIT,
          identifier: buildActorRateLimitIdentifier({
            workspaceId: actor.workspaceId,
            userId: actor.userId,
            resourceId: fieldId,
          }),
          message: "Too many note updates.",
        },
      ],
    });

    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const note = await runtime.services.scouting.createFieldNote({
      workspaceId: actor.workspaceId,
      fieldId,
      findingId: payload.findingId ?? null,
      zoneId: payload.zoneId ?? null,
      cellKey: payload.cellKey ?? null,
      outcome: payload.outcome,
      noteText: payload.noteText,
      observedAt: payload.observedAt,
      createdByUserId: actor.userId,
    });

    await logAuditEvent({
      runtime,
      action: "field.note_created",
      actorUserId: actor.userId,
      workspaceId: actor.workspaceId,
      resourceType: "field-note",
      resourceId: note.id,
      route: "/api/fields/[fieldId]/notes",
      metadata: {
        fieldId,
        outcome: note.outcome,
        hasFindingId: note.findingId !== null,
        hasZoneId: note.zoneId !== null,
        hasCellKey: note.cellKey !== null,
      },
    });

    return jsonOk({ note }, { status: 201 });
  } catch (error) {
    if (error instanceof RequestContextError) {
      return jsonError(error.status, error.message);
    }

    return jsonServerError(error, {
      event: "field-notes-post-route",
      message: "Scout note creation failed.",
    });
  }
}
