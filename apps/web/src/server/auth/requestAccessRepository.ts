import type { DatabaseClient, DatabaseSchema } from "@fieldpulse/platform-db";
import type { WorkspaceRole } from "@fieldpulse/module-workspaces";
import type { RequestAccessSubmission } from "./requestAccess";
import { createSupabaseAdminClient } from "./createSupabaseAdminClient";
import { findSupabaseAuthUserByEmail } from "./workspaceAccessProvisioning";

type SupabaseAdminClient = ReturnType<typeof createSupabaseAdminClient>;

export type RequestAccessRecord =
  DatabaseSchema["app"]["Tables"]["request_access_requests"]["Row"];

export async function createRequestAccessRecord(input: {
  client: DatabaseClient;
  submission: RequestAccessSubmission;
}) {
  const insertResult = await input.client
    .from("request_access_requests")
    .insert({
      name: input.submission.name,
      email: input.submission.email,
      farm_name: input.submission.farmName,
      acreage: input.submission.acreage,
      message: input.submission.message,
    })
    .select("*")
    .single();

  if (insertResult.error || !insertResult.data) {
    throw new Error(
      insertResult.error?.message ?? "Request access insert failed.",
    );
  }

  return insertResult.data;
}

export async function loadRequestAccessRecord(input: {
  client: DatabaseClient;
  requestId: string;
}) {
  const result = await input.client
    .from("request_access_requests")
    .select("*")
    .eq("id", input.requestId)
    .maybeSingle();

  if (result.error) {
    throw result.error;
  }

  return result.data;
}

export async function markRequestAccessRecordContacted(input: {
  client: DatabaseClient;
  requestId: string;
}) {
  const result = await input.client
    .from("request_access_requests")
    .update({ status: "contacted" })
    .eq("id", input.requestId)
    .neq("status", "archived")
    .select("id, status")
    .maybeSingle();

  if (result.error) {
    throw result.error;
  }

  return result.data;
}

export async function hasWorkspaceGrantAuthority(input: {
  client: DatabaseClient;
  workspaceId: string;
  grantedByUserId: string;
}) {
  const membershipResult = await input.client
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

export async function resolveSingleGrantAccessContext(input: {
  client: DatabaseClient;
  adminClient: SupabaseAdminClient;
  recipientEmail: string | null;
  role: WorkspaceRole;
}) {
  if (!input.recipientEmail) {
    return null;
  }

  const recipientUser = await findSupabaseAuthUserByEmail(
    input.adminClient,
    input.recipientEmail,
  );

  if (!recipientUser) {
    return null;
  }

  const membershipResult = await input.client
    .from("workspace_memberships")
    .select("workspace_id, user_id, role, created_at")
    .eq("user_id", recipientUser.id)
    .in("role", ["owner", "manager"])
    .order("created_at", { ascending: true })
    .limit(2);

  if (membershipResult.error) {
    throw membershipResult.error;
  }

  if (membershipResult.data.length !== 1) {
    return null;
  }

  const membership = membershipResult.data[0];

  return {
    workspaceId: membership.workspace_id,
    grantedByUserId: membership.user_id,
    recipientEmail: input.recipientEmail,
    role: input.role,
  };
}
