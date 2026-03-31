import { createSupabaseWorkspaceRepository } from "@fieldpulse/module-workspaces";
import { NextResponse } from "next/server";
import {
  buildIpRateLimitRule,
  enforceRouteRateLimits,
} from "../../../../server/auth/routeRateLimit";
import { createRouteHandlerSupabaseClient } from "../../../../server/auth/createRouteHandlerSupabaseClient";
import { sanitizeNextPath } from "../../../../server/auth/sanitizeNextPath";
import { resolveUniqueWorkspaceSlug } from "../../../../server/auth/workspaceProvisioning";
import {
  jsonError,
  jsonOk,
  jsonServerError,
  readJsonObject,
} from "../../../../server/http/json";
import {
  optionalTrimmedText,
  parseWithSchema,
  requiredTrimmedString,
  z,
} from "../../../../server/http/validation";
import { getWebServerRuntime } from "../../../../server/runtime/getWebServerRuntime";
import { RequestContextError } from "../../../../server/runtime/resolveRequestContext";
import { createServerDatabaseClient } from "../../../../server/runtime/createServerDatabaseClient";

const WORKSPACE_CREATE_IP_RATE_LIMIT = {
  scope: "auth-workspace-create:ip",
  maxAttempts: 5,
  windowSeconds: 15 * 60,
} as const;

const CreateWorkspaceBodySchema = z.object({
  name: requiredTrimmedString("Workspace name is required."),
  next: optionalTrimmedText(),
});

export async function POST(request: Request) {
  const body = await readJsonObject(request);

  if (!body) {
    return jsonError(400, "Expected a JSON request body.");
  }

  try {
    const payload = parseWithSchema(CreateWorkspaceBodySchema, body);
    const runtime = getWebServerRuntime();

    if (runtime.mode !== "supabase") {
      return jsonError(503, "Supabase runtime is not configured.");
    }

    const rateLimitResponse = await enforceRouteRateLimits({
      runtime,
      rules: [
        buildIpRateLimitRule({
          request,
          ...WORKSPACE_CREATE_IP_RATE_LIMIT,
          message: "Too many workspace provisioning requests.",
        }),
      ],
    });

    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const workspaceName = payload.name;
    const nextPath = sanitizeNextPath(payload.next);
    const response = NextResponse.next();
    const { client } = createRouteHandlerSupabaseClient(request, response);
    const userResult = await client.auth.getUser();

    if (userResult.error || !userResult.data.user) {
      return jsonError(
        401,
        userResult.error?.message ?? "A valid Supabase session is required.",
      );
    }

    const existingActor = await runtime.services.auth.resolveActor({
      userId: userResult.data.user.id,
    });

    if (existingActor) {
      return jsonError(
        409,
        "This account already has workspace access. Continue into the app instead of provisioning a new workspace here.",
      );
    }

    const databaseClient = createServerDatabaseClient(runtime);
    const workspaceRepository = createSupabaseWorkspaceRepository(databaseClient);
    const { slug, adjusted } = resolveUniqueWorkspaceSlug(
      await workspaceRepository.listAll(),
      workspaceName,
    );
    const workspace = await workspaceRepository.create(
      {
        name: workspaceName,
        slug,
      },
      userResult.data.user.id,
    );

    return jsonOk(
      {
        result: {
          workspace,
          next: nextPath,
          slugAdjusted: adjusted,
        },
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    if (error instanceof RequestContextError) {
      return jsonError(error.status, error.message);
    }

    return jsonServerError(error, {
      event: "auth-workspace-route",
      message: "Workspace provisioning failed.",
    });
  }
}
