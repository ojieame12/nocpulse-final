import type { ServerRuntime } from "@fieldpulse/platform-runtime";
import { extractSupabaseAccessToken } from "../auth/extractSupabaseAccessToken";
import { createServerComponentRequest } from "./createServerComponentRequest";
import { resolveRequestActor } from "./resolveRequestContext";

type ResolvedRequestActor = Awaited<ReturnType<typeof resolveRequestActor>>;

export type ServerComponentActorContext = {
  actor: ResolvedRequestActor;
  authMode: "supabase-session" | "development-fallback";
  authModeLabel: string;
};

export async function resolveServerComponentActorContext(
  runtime: ServerRuntime,
  options: {
    preferredWorkspaceId?: string | null;
    request?: Request;
  } = {},
): Promise<ServerComponentActorContext> {
  const request = await createServerComponentRequest("/", options.request);
  const hasSupabaseSession =
    runtime.mode === "supabase" &&
    Boolean(
      extractSupabaseAccessToken(request, {
        projectRef: runtime.env.supabase.projectRef,
      }),
    );
  const actor = await resolveRequestActor(request, runtime, {
    allowDevelopmentFallback: true,
    preferredWorkspaceId: options.preferredWorkspaceId,
  });

  return {
    actor,
    authMode: hasSupabaseSession
      ? "supabase-session"
      : "development-fallback",
    authModeLabel: hasSupabaseSession
      ? "Using Supabase session actor"
      : "Using development actor fallback",
  };
}
