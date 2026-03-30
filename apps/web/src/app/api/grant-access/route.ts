import { createSupabaseDatabaseClient } from "@fieldpulse/platform-db";
import {
  createSupabaseWorkspaceMembershipRepository,
} from "@fieldpulse/module-workspaces";
import { getWebServerRuntime } from "../../../server/runtime/getWebServerRuntime";
import { createSupabaseAdminClient } from "../../../server/auth/createSupabaseAdminClient";
import {
  findSupabaseAuthUserByEmail,
} from "../../../server/auth/workspaceAccessProvisioning";
import {
  listWorkspaceEmailProvisionsByEmail,
  upsertWorkspaceEmailProvision,
} from "../../../server/auth/workspaceEmailProvisioning";
import {
  verifyGrantAccessToken,
  type GrantAccessTokenPayload,
} from "../../../server/auth/grantAccessToken";

export const dynamic = "force-dynamic";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function htmlPage(input: {
  title: string;
  body: string;
  status?: number;
}) {
  return new Response(
    `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(input.title)} — NocPulse</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f8faf8;
      color: #1f2937;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin: 0;
      padding: 24px;
    }
    .card {
      max-width: 560px;
      width: 100%;
      background: #fff;
      border: 1px solid #ebebeb;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 12px 40px rgba(15, 23, 42, 0.08);
    }
    .header {
      padding: 24px 28px;
      border-bottom: 1px solid #ebebeb;
      background: #f4f7f3;
    }
    .eyebrow {
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 1px;
      text-transform: uppercase;
      color: #8a8f98;
    }
    h1 {
      margin: 10px 0 0;
      font-size: 26px;
      font-weight: 500;
      line-height: 1.25;
      color: #111827;
    }
    .body {
      padding: 24px 28px 28px;
      font-size: 15px;
      line-height: 1.6;
      color: #374151;
    }
    .stack > * + * { margin-top: 16px; }
    .kv {
      display: grid;
      grid-template-columns: 160px minmax(0, 1fr);
      gap: 10px 14px;
      padding: 16px;
      background: #f8faf8;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
    }
    .kv .label {
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #8a8f98;
    }
    .kv .value {
      color: #111827;
      word-break: break-word;
    }
    .mono {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 13px;
    }
    .actions {
      display: flex;
      gap: 12px;
      margin-top: 20px;
      flex-wrap: wrap;
    }
    .button, .button-secondary {
      display: inline-block;
      padding: 12px 18px;
      border-radius: 10px;
      text-decoration: none;
      font-weight: 600;
      border: 0;
      cursor: pointer;
      font: inherit;
    }
    .button {
      background: #008f4e;
      color: #fff;
    }
    .button-secondary {
      background: #f4f7f3;
      color: #111827;
      border: 1px solid #d1d5db;
    }
    .note {
      font-size: 13px;
      color: #6b7280;
    }
    .success { color: #008f4e; font-weight: 600; }
    .error { color: #dc2626; font-weight: 600; }
    .warning { color: #b45309; font-weight: 600; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="eyebrow">NocPulse</div>
      <h1>${escapeHtml(input.title)}</h1>
    </div>
    <div class="body">${input.body}</div>
  </div>
</body>
</html>`,
    {
      status: input.status ?? 200,
      headers: { "content-type": "text/html; charset=utf-8" },
    },
  );
}

function invalidTokenPage(message: string) {
  return htmlPage({
    title: "Invalid Access Review Link",
    body: `<div class="stack"><p class="error">${escapeHtml(message)}</p><p class="note">Ask for a fresh request-access email if you still need to grant access.</p></div>`,
    status: 400,
  });
}

function renderReviewPage(input: {
  token: string;
  payload: GrantAccessTokenPayload;
  requestRecord: {
    name: string;
    email: string;
    farm_name: string;
    acreage: string | null;
    message: string | null;
    status: string;
    created_at: string;
  };
}) {
  return htmlPage({
    title: "Review Access Request",
    body: `<div class="stack">
      <p>Review this request, then confirm access. Nothing has been provisioned yet.</p>
      <div class="kv">
        <div class="label">Requester</div><div class="value">${escapeHtml(input.requestRecord.name)}</div>
        <div class="label">Email</div><div class="value mono">${escapeHtml(input.requestRecord.email)}</div>
        <div class="label">Farm / Operation</div><div class="value">${escapeHtml(input.requestRecord.farm_name)}</div>
        <div class="label">Approx. Acreage</div><div class="value">${escapeHtml(input.requestRecord.acreage ?? "Not provided")}</div>
        <div class="label">Message</div><div class="value">${escapeHtml(input.requestRecord.message ?? "Not provided")}</div>
        <div class="label">Workspace</div><div class="value mono">${escapeHtml(input.payload.workspaceId)}</div>
        <div class="label">Role</div><div class="value">${escapeHtml(input.payload.role)}</div>
        <div class="label">Expires</div><div class="value">${escapeHtml(new Date(input.payload.expiresAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }))}</div>
      </div>
      <p class="note">This link is bound to one request record and one workspace. The actual grant only happens after you press the button below.</p>
      <form method="post">
        <input type="hidden" name="token" value="${escapeHtml(input.token)}" />
        <div class="actions">
          <button class="button" type="submit">Grant Access</button>
        </div>
      </form>
    </div>`,
  });
}

function renderAlreadyHandledPage(input: {
  title: string;
  message: string;
  status?: number;
}) {
  return htmlPage({
    title: input.title,
    body: `<div class="stack"><p class="warning">${escapeHtml(input.message)}</p></div>`,
    status: input.status ?? 200,
  });
}

async function loadVerifiedPayload(request: Request) {
  const runtime = getWebServerRuntime();
  const url = new URL(request.url);
  const token = url.searchParams.get("token")?.trim() ?? "";

  if (runtime.mode !== "supabase") {
    return {
      runtime,
      token,
      verification: {
        ok: false as const,
        reason: "runtime",
      },
    };
  }

  const verification = token
    ? verifyGrantAccessToken(token, runtime.env.supabase.serviceRoleKey!)
    : ({ ok: false as const, reason: "missing" });

  return {
    runtime,
    token,
    verification,
  };
}

async function loadRequestRecord(input: {
  databaseClient: ReturnType<typeof createSupabaseDatabaseClient>;
  requestId: string;
}) {
  const requestResult = await input.databaseClient
    .from("request_access_requests")
    .select("*")
    .eq("id", input.requestId)
    .maybeSingle();

  if (requestResult.error) {
    throw requestResult.error;
  }

  return requestResult.data;
}

async function ensureGrantAuthority(input: {
  databaseClient: ReturnType<typeof createSupabaseDatabaseClient>;
  workspaceId: string;
  grantedByUserId: string;
}) {
  const membershipResult = await input.databaseClient
    .from("workspace_memberships")
    .select("role")
    .eq("workspace_id", input.workspaceId)
    .eq("user_id", input.grantedByUserId)
    .maybeSingle();

  if (membershipResult.error) {
    throw membershipResult.error;
  }

  return membershipResult.data?.role === "owner" ||
    membershipResult.data?.role === "manager";
}

export async function GET(request: Request) {
  try {
    const { runtime, token, verification } = await loadVerifiedPayload(request);

    if (runtime.mode !== "supabase") {
      return invalidTokenPage("Supabase runtime is not configured.");
    }

    if (!verification.ok) {
      return invalidTokenPage(
        verification.reason === "expired"
          ? "This access review link has expired."
          : "This access review link is invalid.",
      );
    }

    const databaseClient = createSupabaseDatabaseClient({
      url: runtime.env.supabase.url!,
      serviceKey: runtime.env.supabase.serviceRoleKey!,
    });
    const requestRecord = await loadRequestRecord({
      databaseClient,
      requestId: verification.payload.requestId,
    });

    if (!requestRecord || requestRecord.email !== verification.payload.requestEmail) {
      return invalidTokenPage(
        "This access review link no longer matches a live request record.",
      );
    }

    if (requestRecord.status === "archived") {
      return renderAlreadyHandledPage({
        title: "Request Archived",
        message: "This request was archived and can no longer be granted from this link.",
        status: 409,
      });
    }

    if (requestRecord.status === "contacted") {
      return renderAlreadyHandledPage({
        title: "Already Granted",
        message: "This request has already been handled.",
      });
    }

    return renderReviewPage({
      token,
      payload: verification.payload,
      requestRecord,
    });
  } catch (error) {
    console.error("[grant-access] review error:", error);
    return htmlPage({
      title: "Access Review Failed",
      body: `<div class="stack"><p class="error">${escapeHtml(error instanceof Error ? error.message : "Access review failed.")}</p></div>`,
      status: 500,
    });
  }
}

export async function POST(request: Request) {
  try {
    const runtime = getWebServerRuntime();

    if (runtime.mode !== "supabase") {
      return invalidTokenPage("Supabase runtime is not configured.");
    }

    const formData = await request.formData();
    const token = typeof formData.get("token") === "string"
      ? String(formData.get("token")).trim()
      : "";

    if (!token) {
      return invalidTokenPage("This access review submission is missing its token.");
    }

    const verification = verifyGrantAccessToken(
      token,
      runtime.env.supabase.serviceRoleKey!,
    );

    if (!verification.ok) {
      return invalidTokenPage(
        verification.reason === "expired"
          ? "This access review link has expired."
          : "This access review link is invalid.",
      );
    }

    const payload = verification.payload;
    const databaseClient = createSupabaseDatabaseClient({
      url: runtime.env.supabase.url!,
      serviceKey: runtime.env.supabase.serviceRoleKey!,
    });
    const requestRecord = await loadRequestRecord({
      databaseClient,
      requestId: payload.requestId,
    });

    if (!requestRecord || requestRecord.email !== payload.requestEmail) {
      return invalidTokenPage(
        "This access review link no longer matches a live request record.",
      );
    }

    if (requestRecord.status === "archived") {
      return renderAlreadyHandledPage({
        title: "Request Archived",
        message: "This request was archived and can no longer be granted from this link.",
        status: 409,
      });
    }

    if (requestRecord.status === "contacted") {
      return renderAlreadyHandledPage({
        title: "Already Granted",
        message: "This request has already been handled.",
      });
    }

    if (!await ensureGrantAuthority({
      databaseClient,
      workspaceId: payload.workspaceId,
      grantedByUserId: payload.grantedByUserId,
    })) {
      return invalidTokenPage(
        "This grant link no longer maps to a workspace owner or manager.",
      );
    }

    const workspaceMemberships = createSupabaseWorkspaceMembershipRepository(
      databaseClient,
    );
    const adminClient = createSupabaseAdminClient({
      url: runtime.env.supabase.url!,
      serviceRoleKey: runtime.env.supabase.serviceRoleKey!,
    });
    const existingUser = await findSupabaseAuthUserByEmail(
      adminClient,
      payload.requestEmail,
    );

    let detailMessage = "";

    if (existingUser) {
      const alreadyMember = await workspaceMemberships.isMember(
        payload.workspaceId,
        existingUser.id,
      );

      if (!alreadyMember) {
        await workspaceMemberships.addMembership({
          workspaceId: payload.workspaceId,
          userId: existingUser.id,
          role: payload.role,
          invitedBy: payload.grantedByUserId,
          createdAt: new Date().toISOString(),
        });
      }

      detailMessage = alreadyMember
        ? "They already had workspace access. The request is now marked handled."
        : "They already have a NocPulse account and can open the app immediately.";
    } else {
      const existingProvision = (await listWorkspaceEmailProvisionsByEmail(
        databaseClient,
        payload.requestEmail,
      )).find((provision) => provision.workspace_id === payload.workspaceId);

      if (!existingProvision || existingProvision.claimed_at == null) {
        await upsertWorkspaceEmailProvision({
          client: databaseClient,
          workspaceId: payload.workspaceId,
          email: payload.requestEmail,
          role: payload.role,
          createdBy: payload.grantedByUserId,
        });
      }

      detailMessage =
        "They do not have a NocPulse account yet. Access has been provisioned and will attach automatically on first sign-in.";
    }

    const updateResult = await databaseClient
      .from("request_access_requests")
      .update({ status: "contacted" })
      .eq("id", payload.requestId)
      .neq("status", "archived")
      .select("id, status")
      .maybeSingle();

    if (updateResult.error) {
      throw updateResult.error;
    }

    return htmlPage({
      title: "Access Granted",
      body: `<div class="stack">
        <p class="success">Access has been granted for <span class="mono">${escapeHtml(payload.requestEmail)}</span>.</p>
        <div class="kv">
          <div class="label">Request ID</div><div class="value mono">${escapeHtml(payload.requestId)}</div>
          <div class="label">Workspace</div><div class="value mono">${escapeHtml(payload.workspaceId)}</div>
          <div class="label">Role</div><div class="value">${escapeHtml(payload.role)}</div>
          <div class="label">Request Status</div><div class="value">${escapeHtml(updateResult.data?.status ?? "contacted")}</div>
        </div>
        <p>${escapeHtml(detailMessage)}</p>
      </div>`,
    });
  } catch (error) {
    console.error("[grant-access] consume error:", error);
    return htmlPage({
      title: "Grant Access Failed",
      body: `<div class="stack"><p class="error">${escapeHtml(error instanceof Error ? error.message : "Grant access failed.")}</p></div>`,
      status: 500,
    });
  }
}
