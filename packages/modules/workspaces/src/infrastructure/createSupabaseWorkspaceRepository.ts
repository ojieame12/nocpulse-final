import {
  requireSupabaseData,
  type DatabaseClient,
  type DatabaseSchema,
  type UserId,
  type WorkspaceId,
} from "@fieldpulse/platform-db";
import type { CreateWorkspaceInput } from "../contracts/CreateWorkspaceInput";
import type { Workspace } from "../contracts/workspace";
import type { WorkspaceRepository } from "./WorkspaceRepository";

type WorkspaceRow = DatabaseSchema["app"]["Tables"]["workspaces"]["Row"];

function mapWorkspace(row: WorkspaceRow): Workspace {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createSupabaseWorkspaceRepository(
  client: DatabaseClient,
): WorkspaceRepository {
  return {
    async create(input: CreateWorkspaceInput, actorUserId: UserId) {
      const result = await client
        .rpc("create_workspace_with_owner_membership", {
          workspace_name: input.name,
          workspace_slug: input.slug,
          actor_user_id: actorUserId,
        })
        .single();

      return mapWorkspace(
        requireSupabaseData(result, "workspaces.create"),
      );
    },

    async getById(workspaceId: WorkspaceId) {
      const result = await client
        .from("workspaces")
        .select("*")
        .eq("id", workspaceId)
        .maybeSingle();

      if (result.error) {
        throw result.error;
      }

      return result.data ? mapWorkspace(result.data) : null;
    },

    async listAll() {
      const result = await client
        .from("workspaces")
        .select("*")
        .order("name", { ascending: true });

      return requireSupabaseData(
        result,
        "workspaces.listAll",
      ).map(mapWorkspace);
    },

    async listByUser(userId: UserId) {
      const membershipResult = await client
        .from("workspace_memberships")
        .select("workspace_id")
        .eq("user_id", userId);

      const memberships = requireSupabaseData(
        membershipResult,
        "workspaces.listByUser.memberships",
      );

      if (memberships.length === 0) {
        return [];
      }

      const result = await client
        .from("workspaces")
        .select("*")
        .in(
          "id",
          memberships.map((membership) => membership.workspace_id),
        )
        .order("name", { ascending: true });

      return requireSupabaseData(
        result,
        "workspaces.listByUser",
      ).map(mapWorkspace);
    },
  };
}
