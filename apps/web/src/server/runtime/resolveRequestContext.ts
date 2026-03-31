import {
  createSupabaseAccessTokenAuthProvider,
  SupabaseSessionError,
} from "@fieldpulse/module-auth";
import type { ServerRuntime } from "@fieldpulse/platform-runtime";
import {
  isDevelopmentFallbackRequestAllowed,
  requestHasValidDevelopmentFallbackToken,
  resolveDevelopmentFallbackActorUserId,
} from "../auth/developmentFallback";
import { extractSupabaseAccessToken } from "../auth/extractSupabaseAccessToken";

const WORKSPACE_ID_HEADER = "x-fieldpulse-workspace-id";
const PLACEHOLDER_WORKSPACE_IDS = new Set(["__empty__", "_empty_"]);

type SupabaseServerRuntime = Extract<ServerRuntime, { mode: "supabase" }>;
type ResolvedRequestActor = NonNullable<
  Awaited<ReturnType<SupabaseServerRuntime["services"]["auth"]["resolveActor"]>>
>;

export class RequestContextError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function requireSupabaseRuntime(runtime: ServerRuntime) {
  if (runtime.mode !== "supabase") {
    throw new Error(
      "[web] Supabase runtime is not configured for this server request",
    );
  }

  return runtime;
}

export function resolveRequestedWorkspaceId(
  request: Request,
  fallbackWorkspaceId?: string | null,
) {
  const headerValue = request.headers.get(WORKSPACE_ID_HEADER);
  const normalizedHeaderValue = headerValue?.trim() ?? "";

  if (
    normalizedHeaderValue &&
    !PLACEHOLDER_WORKSPACE_IDS.has(normalizedHeaderValue)
  ) {
    return normalizedHeaderValue;
  }

  const normalizedFallbackWorkspaceId = fallbackWorkspaceId?.trim() ?? "";

  if (
    normalizedFallbackWorkspaceId &&
    !PLACEHOLDER_WORKSPACE_IDS.has(normalizedFallbackWorkspaceId)
  ) {
    return normalizedFallbackWorkspaceId;
  }

  return null;
}

export async function resolveRequestActor(
  request: Request,
  runtime: ServerRuntime,
  options: {
    allowDevelopmentFallback?: boolean;
    preferredWorkspaceId?: string | null;
  } = {},
): Promise<ResolvedRequestActor> {
  const configured = requireSupabaseRuntime(runtime);
  const allowDevelopmentFallback =
    options.allowDevelopmentFallback ?? false;
  const preferredWorkspaceId =
    resolveRequestedWorkspaceId(request, options.preferredWorkspaceId) ??
    configured.env.devWorkspaceId ??
    undefined;
  const accessToken = extractSupabaseAccessToken(request, {
    projectRef: configured.env.supabase.projectRef,
  });

  if (accessToken && configured.env.supabase.anonKey) {
    const provider = createSupabaseAccessTokenAuthProvider({
      supabaseUrl: configured.env.supabase.url!,
      supabaseAnonKey: configured.env.supabase.anonKey,
      accessToken,
      preferredWorkspaceId,
      resolveActorByUserId: configured.services.auth.resolveActor,
    });

    try {
      const actor = await provider.resolveActor();

      if (!actor) {
        throw new RequestContextError(
          401,
          "[auth] Supabase session did not resolve to an application actor",
        );
      }

      return actor;
    } catch (error) {
      if (error instanceof SupabaseSessionError) {
        if (error.code === "unmapped-user") {
          throw new RequestContextError(403, error.message);
        }

        throw new RequestContextError(401, error.message);
      }

      throw error;
    }
  }

  const canUseFallback =
    allowDevelopmentFallback &&
    isDevelopmentFallbackRequestAllowed({
      nodeEnv: configured.env.nodeEnv,
      request,
    }) &&
    await requestHasValidDevelopmentFallbackToken({
      request,
      serviceRoleKey: configured.env.supabase.serviceRoleKey,
      devActorUserId: configured.env.devActorUserId,
    });

  if (!canUseFallback) {
    throw new RequestContextError(
      401,
      "[auth] No Supabase session was provided for this request.",
    );
  }

  const actorUserId = resolveDevelopmentFallbackActorUserId({
    devActorUserId: configured.env.devActorUserId,
  });
  const actor = await configured.services.auth.resolveActor({
    userId: actorUserId,
    preferredWorkspaceId,
  });

  if (!actor) {
    if (preferredWorkspaceId) {
      throw new RequestContextError(
        403,
        `Actor ${actorUserId} does not have access to workspace ${preferredWorkspaceId}.`,
      );
    }

    throw new RequestContextError(
      403,
      `Actor ${actorUserId} does not have access to any workspace.`,
    );
  }

  return actor;
}
