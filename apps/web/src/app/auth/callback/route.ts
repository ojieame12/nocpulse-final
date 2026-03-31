import { NextResponse } from "next/server";
import { createSupabaseDatabaseClient } from "@fieldpulse/platform-db";
import { createRouteHandlerSupabaseClient } from "../../../server/auth/createRouteHandlerSupabaseClient";
import { sanitizeNextPath } from "../../../server/auth/sanitizeNextPath";
import {
  claimWorkspaceEmailProvisions,
  normalizeWorkspaceProvisionEmail,
  releaseBootstrapWorkspaceOwnerMemberships,
} from "../../../server/auth/workspaceEmailProvisioning";
import { getWebServerRuntime } from "../../../server/runtime/getWebServerRuntime";

const EMAIL_OTP_TYPES = new Set([
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
]);

function copyCookies(source: NextResponse, destination: NextResponse) {
  for (const cookie of source.cookies.getAll()) {
    destination.cookies.set(cookie.name, cookie.value, cookie);
  }

  return destination;
}

function buildAuthErrorUrl(
  requestUrl: URL,
  reason: "missing-code" | "callback-error",
  nextPath: string,
) {
  const target = new URL("/auth/error", requestUrl.origin);
  target.searchParams.set("reason", reason);
  target.searchParams.set("next", nextPath);
  return target;
}

function buildPendingAccessUrl(
  requestUrl: URL,
  nextPath: string,
  email?: string | null,
) {
  const target = new URL("/auth/pending-access", requestUrl.origin);
  target.searchParams.set("next", nextPath);

  if (email) {
    target.searchParams.set("email", email);
  }

  return target;
}

async function listRequestAccessBootstrapOwnersForClaim(input: {
  databaseClient: ReturnType<typeof createSupabaseDatabaseClient>;
  email: string;
  workspaceIds: readonly string[];
}) {
  if (input.workspaceIds.length === 0) {
    return [];
  }

  const normalizedEmail = normalizeWorkspaceProvisionEmail(input.email);
  const workspaceResult = await input.databaseClient
    .from("workspaces")
    .select("id, name, created_by")
    .in("id", [...new Set(input.workspaceIds)]);

  if (workspaceResult.error) {
    throw workspaceResult.error;
  }

  const workspaces = workspaceResult.data ?? [];

  if (workspaces.length === 0) {
    return [];
  }

  const requestResult = await input.databaseClient
    .from("request_access_requests")
    .select("farm_name")
    .eq("email", normalizedEmail)
    .eq("status", "contacted")
    .in(
      "farm_name",
      [...new Set(workspaces.map((workspace) => workspace.name))],
    );

  if (requestResult.error) {
    throw requestResult.error;
  }

  const farmNames = new Set((requestResult.data ?? []).map((request) => request.farm_name));
  return workspaces
    .filter((workspace) => farmNames.has(workspace.name))
    .map((workspace) => ({
      workspaceId: workspace.id,
      bootstrapOwnerUserId: workspace.created_by,
    }));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code")?.trim();
  const tokenHash = url.searchParams.get("token_hash")?.trim();
  const verificationType = url.searchParams.get("type")?.trim();
  const nextPath = sanitizeNextPath(url.searchParams.get("next"), "/preview");

  if (!code && (!tokenHash || !verificationType)) {
    return NextResponse.redirect(buildAuthErrorUrl(url, "missing-code", nextPath));
  }

  const exchangeResponse = NextResponse.next();
  const { client } = createRouteHandlerSupabaseClient(request, exchangeResponse);
  const result = code
    ? await client.auth.exchangeCodeForSession(code)
    : EMAIL_OTP_TYPES.has(verificationType ?? "")
      ? await client.auth.verifyOtp({
          token_hash: tokenHash!,
          type: verificationType! as
            | "signup"
            | "invite"
            | "magiclink"
            | "recovery"
            | "email_change"
            | "email",
        })
      : {
          data: { session: null, user: null },
          error: new Error("Unsupported email verification type."),
        };

  if (result.error) {
    return NextResponse.redirect(buildAuthErrorUrl(url, "callback-error", nextPath));
  }

  const runtime = getWebServerRuntime();
  const resolvedUserId = result.data.user?.id ?? result.data.session?.user?.id;
  const resolvedEmail = result.data.user?.email ?? result.data.session?.user?.email;

  if (runtime.mode === "supabase" && resolvedUserId) {
    let actor = await runtime.services.auth.resolveActor({
      userId: resolvedUserId,
    });

    if (!actor && resolvedEmail) {
      const databaseClient = createSupabaseDatabaseClient({
        url: runtime.env.supabase.url!,
        serviceKey: runtime.env.supabase.serviceRoleKey!,
      });
      const claimed = await claimWorkspaceEmailProvisions({
        client: databaseClient,
        email: resolvedEmail,
        userId: resolvedUserId,
      });

      if (claimed.claimedCount > 0) {
        const bootstrapApprovals =
          await listRequestAccessBootstrapOwnersForClaim({
            databaseClient,
            email: resolvedEmail,
            workspaceIds: claimed.claimedWorkspaceIds,
          });
        await releaseBootstrapWorkspaceOwnerMemberships({
          client: databaseClient,
          approvals: bootstrapApprovals,
          claimedUserId: resolvedUserId,
        });
        actor = await runtime.services.auth.resolveActor({
          userId: resolvedUserId,
        });
      }
    }

    if (!actor) {
      return copyCookies(
        exchangeResponse,
        NextResponse.redirect(
          buildPendingAccessUrl(url, nextPath, resolvedEmail),
        ),
      );
    }
  }

  return copyCookies(
    exchangeResponse,
    NextResponse.redirect(new URL(nextPath, url.origin)),
  );
}
