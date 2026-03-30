import { createSupabaseDatabaseClient } from "@fieldpulse/platform-db";
import type { ServerRuntime } from "@fieldpulse/platform-runtime";
import type { WorkspaceRole } from "@fieldpulse/module-workspaces";
import { formatWorkspaceRoleLabel } from "../../features/settings/workspaceAccess";
import { extractSupabaseAccessToken } from "./extractSupabaseAccessToken";
import { createSupabasePublicAuthClient } from "./createSupabasePublicAuthClient";
import { resolveRequestActor } from "../runtime/resolveRequestContext";

type SupabaseRuntime = Extract<ServerRuntime, { mode: "supabase" }>;

export type AuthViewer = {
  displayName: string;
  email: string | null;
  initials: string;
  workspaceRole: WorkspaceRole;
  workspaceRoleLabel: string;
  workspaceName: string | null;
};

export type ResolvedAuthViewer = {
  actor: Awaited<ReturnType<typeof resolveRequestActor>>;
  viewer: AuthViewer;
};

function readUserMetadataString(
  metadata: Record<string, unknown> | undefined,
  keys: readonly string[],
) {
  if (!metadata) {
    return null;
  }

  for (const key of keys) {
    const value = metadata[key];

    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
}

function humanizeEmailLocalPart(email: string | null) {
  if (!email) {
    return null;
  }

  const localPart = email.split("@")[0]?.trim();

  if (!localPart) {
    return null;
  }

  const words = localPart
    .split(/[._-]+/)
    .map((word) => word.trim())
    .filter(Boolean);

  if (words.length === 0) {
    return localPart;
  }

  return words
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function buildViewerDisplayName(input: {
  email: string | null;
  metadata?: Record<string, unknown>;
}) {
  return (
    readUserMetadataString(input.metadata, [
      "full_name",
      "name",
      "display_name",
      "preferred_name",
    ]) ??
    humanizeEmailLocalPart(input.email) ??
    "NocPulse user"
  );
}

function buildViewerInitials(displayName: string, email: string | null) {
  const source = displayName.trim().length > 0 ? displayName.trim() : email ?? "N";
  const words = source
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean);

  if (words.length >= 2) {
    return `${words[0][0] ?? ""}${words[1][0] ?? ""}`.toUpperCase();
  }

  return source.replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase() || "NP";
}

async function resolveWorkspaceName(
  runtime: SupabaseRuntime,
  workspaceId: string,
) {
  const client = createSupabaseDatabaseClient({
    url: runtime.env.supabase.url!,
    serviceKey: runtime.env.supabase.serviceRoleKey!,
  });
  const result = await client
    .from("workspaces")
    .select("name")
    .eq("id", workspaceId)
    .maybeSingle();

  if (result.error) {
    return null;
  }

  return result.data?.name ?? null;
}

async function resolveSessionUser(input: {
  request: Request;
  runtime: SupabaseRuntime;
}) {
  const accessToken = extractSupabaseAccessToken(input.request, {
    projectRef: input.runtime.env.supabase.projectRef,
  });

  if (!accessToken) {
    return null;
  }

  const authClient = createSupabasePublicAuthClient();
  const userResult = await authClient.auth.getUser(accessToken);

  if (userResult.error || !userResult.data.user) {
    return null;
  }

  return userResult.data.user;
}

export async function resolveRequestAuthViewer(input: {
  request: Request;
  runtime: ServerRuntime;
  preferredWorkspaceId?: string | null;
}): Promise<ResolvedAuthViewer> {
  if (input.runtime.mode !== "supabase") {
    throw new Error("Supabase runtime is required to resolve an auth viewer.");
  }

  const actor = await resolveRequestActor(input.request, input.runtime, {
    allowDevelopmentFallback: false,
    preferredWorkspaceId: input.preferredWorkspaceId,
  });
  const [sessionUser, workspaceName] = await Promise.all([
    resolveSessionUser({
      request: input.request,
      runtime: input.runtime,
    }),
    resolveWorkspaceName(input.runtime, actor.workspaceId),
  ]);
  const email = sessionUser?.email ?? null;
  const metadata =
    sessionUser?.user_metadata &&
    typeof sessionUser.user_metadata === "object"
      ? (sessionUser.user_metadata as Record<string, unknown>)
      : undefined;
  const displayName = buildViewerDisplayName({
    email,
    metadata,
  });

  return {
    actor,
    viewer: {
      displayName,
      email,
      initials: buildViewerInitials(displayName, email),
      workspaceRole: actor.role,
      workspaceRoleLabel: formatWorkspaceRoleLabel(actor.role),
      workspaceName,
    },
  };
}
