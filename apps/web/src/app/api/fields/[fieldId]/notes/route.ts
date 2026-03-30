import { jsonError, jsonOk, readJsonObject } from "../../../../../server/http/json";
import { getWebServerRuntime } from "../../../../../server/runtime/getWebServerRuntime";
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

    return jsonError(
      500,
      error instanceof Error ? error.message : "Scout note lookup failed.",
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

    const outcome = typeof body.outcome === "string" ? body.outcome.trim() : null;
    const noteText = typeof body.noteText === "string" ? body.noteText.trim() : null;
    const findingId = typeof body.findingId === "string" ? body.findingId.trim() : null;
    const zoneId = typeof body.zoneId === "string" ? body.zoneId.trim() : null;
    const cellKey = typeof body.cellKey === "string" ? body.cellKey.trim() : null;
    const observedAt = typeof body.observedAt === "string" ? body.observedAt.trim() : undefined;

    if (!outcome || !isValidOutcome(outcome)) {
      return jsonError(400, "[notes] outcome must be one of confirmed, not_confirmed, resolved, or monitor.");
    }

    if (!noteText) {
      return jsonError(400, "[notes] noteText is required.");
    }

    const note = await runtime.services.scouting.createFieldNote({
      workspaceId: actor.workspaceId,
      fieldId,
      findingId,
      zoneId,
      cellKey,
      outcome,
      noteText,
      observedAt,
      createdByUserId: actor.userId,
    });

    return jsonOk({ note }, { status: 201 });
  } catch (error) {
    if (error instanceof RequestContextError) {
      return jsonError(error.status, error.message);
    }

    return jsonError(
      500,
      error instanceof Error ? error.message : "Scout note creation failed.",
    );
  }
}
