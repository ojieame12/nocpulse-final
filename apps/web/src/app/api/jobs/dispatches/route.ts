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
import {
  nullableTrimmedText,
  parseWithSchema,
  requiredTrimmedString,
  z,
} from "../../../../server/http/validation";
import { getWebServerRuntime } from "../../../../server/runtime/getWebServerRuntime";
import {
  RequestContextError,
  resolveRequestActor,
} from "../../../../server/runtime/resolveRequestContext";
import { listWorkspaceJobDispatchesByIds } from "../../../../server/jobs/jobDispatchLookup";
import { createServerDatabaseClient } from "../../../../server/runtime/createServerDatabaseClient";

const JOB_DISPATCH_LOOKUP_ACTOR_RATE_LIMIT = {
  scope: "job-dispatches:actor",
  maxAttempts: 60,
  windowSeconds: 5 * 60,
} as const;

const JOB_DISPATCH_LOOKUP_IP_RATE_LIMIT = {
  scope: "job-dispatches:ip",
  maxAttempts: 120,
  windowSeconds: 5 * 60,
} as const;

const JobDispatchLookupBodySchema = z.object({
  workspaceId: nullableTrimmedText(),
  ids: z
    .array(
      requiredTrimmedString("Dispatch ids must be non-empty strings."),
    )
    .min(1, "At least one dispatch id is required."),
});

export async function POST(request: Request) {
  const body = await readJsonObject(request);

  if (!body) {
    return jsonError(400, "Expected a JSON request body.");
  }

  try {
    const payload = parseWithSchema(JobDispatchLookupBodySchema, body);
    const runtime = getWebServerRuntime();

    if (runtime.mode !== "supabase") {
      return jsonError(503, "Supabase runtime is not configured.");
    }

    const actor = await resolveRequestActor(request, runtime, {
      allowDevelopmentFallback: true,
      preferredWorkspaceId: payload.workspaceId ?? null,
    });
    const rateLimitResponse = await enforceRouteRateLimits({
      runtime,
      rules: [
        buildIpRateLimitRule({
          request,
          ...JOB_DISPATCH_LOOKUP_IP_RATE_LIMIT,
          message: "Too many job dispatch lookup requests.",
        }),
        {
          ...JOB_DISPATCH_LOOKUP_ACTOR_RATE_LIMIT,
          identifier: buildActorRateLimitIdentifier({
            workspaceId: actor.workspaceId,
            userId: actor.userId,
          }),
          message: "Too many job dispatch lookup requests.",
        },
      ],
    });

    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const client = createServerDatabaseClient(runtime);
    const dispatches = await listWorkspaceJobDispatchesByIds({
      client,
      ids: payload.ids,
      workspaceId: actor.workspaceId,
    });

    return jsonOk({
      result: {
        workspaceId: actor.workspaceId,
        dispatches,
      },
    });
  } catch (error) {
    if (error instanceof RequestContextError) {
      return jsonError(error.status, error.message);
    }

    return jsonServerError(error, {
      event: "job-dispatches-route",
      message: "Job dispatch lookup failed.",
    });
  }
}
