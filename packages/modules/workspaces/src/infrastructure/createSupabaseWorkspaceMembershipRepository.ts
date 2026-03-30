import {
  requireSupabaseData,
  type DatabaseClient,
  type DatabaseSchema,
  type UserId,
  type WorkspaceId,
} from "@fieldpulse/platform-db";
import type { WorkspaceMembership } from "../contracts/workspace";
import type { WorkspaceMembershipRepository } from "./WorkspaceMembershipRepository";

type WorkspaceMembershipRow =
  DatabaseSchema["app"]["Tables"]["workspace_memberships"]["Row"];

function mapWorkspaceMembership(
  row: WorkspaceMembershipRow,
): WorkspaceMembership {
  return {
    workspaceId: row.workspace_id,
    userId: row.user_id,
    role: row.role,
    invitedBy: row.invited_by,
    createdAt: row.created_at,
  };
}

export function createSupabaseWorkspaceMembershipRepository(
  client: DatabaseClient,
): WorkspaceMembershipRepository {
  return {
    async addMembership(membership) {
      const result = await client
        .from("workspace_memberships")
        .insert({
          workspace_id: membership.workspaceId,
          user_id: membership.userId,
          role: membership.role,
          invited_by: membership.invitedBy,
          created_at: membership.createdAt,
        })
        .select("*")
        .single();

      return mapWorkspaceMembership(
        requireSupabaseData(result, "workspaceMemberships.addMembership"),
      );
    },

    async isMember(workspaceId: WorkspaceId, userId: UserId) {
      const result = await client
        .from("workspace_memberships")
        .select("workspace_id")
        .eq("workspace_id", workspaceId)
        .eq("user_id", userId)
        .maybeSingle();

      if (result.error) {
        throw result.error;
      }

      return result.data != null;
    },

    async getByWorkspaceAndUser(workspaceId: WorkspaceId, userId: UserId) {
      const result = await client
        .from("workspace_memberships")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("user_id", userId)
        .maybeSingle();

      if (result.error) {
        throw result.error;
      }

      return result.data ? mapWorkspaceMembership(result.data) : null;
    },

    async listByUser(userId: UserId) {
      const result = await client
        .from("workspace_memberships")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: true });

      return requireSupabaseData(
        result,
        "workspaceMemberships.listByUser",
      ).map(mapWorkspaceMembership);
    },

    async listByWorkspace(workspaceId: WorkspaceId) {
      const result = await client
        .from("workspace_memberships")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: true });

      return requireSupabaseData(
        result,
        "workspaceMemberships.listByWorkspace",
      ).map(mapWorkspaceMembership);
    },
  };
}
