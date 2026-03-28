import type { UserId, WorkspaceId } from "@fieldpulse/platform-db";
import type { Workspace } from "../contracts/workspace";

export type WorkspaceSelectionMode = "actor" | "workspace" | "first-workspace";

type WorkspaceSelectionRepository = {
  getById(workspaceId: WorkspaceId): Promise<Workspace | null>;
  listAll(): Promise<readonly Workspace[]>;
  listByUser(userId: UserId): Promise<readonly Workspace[]>;
};

export type ResolveWorkspaceSelectionInput = {
  repository: WorkspaceSelectionRepository;
  actorUserId?: UserId;
  preferredWorkspaceId?: WorkspaceId;
};

export type ResolvedWorkspaceSelection = {
  selectionMode: WorkspaceSelectionMode;
  workspaces: readonly Workspace[];
  selectedWorkspace: Workspace | null;
};

function selectWorkspace(
  workspaces: readonly Workspace[],
  preferredWorkspaceId: WorkspaceId | undefined,
): Workspace | null {
  if (preferredWorkspaceId) {
    return workspaces.find((workspace) => workspace.id === preferredWorkspaceId) ?? null;
  }

  return workspaces[0] ?? null;
}

export async function resolveWorkspaceSelection(
  input: ResolveWorkspaceSelectionInput,
): Promise<ResolvedWorkspaceSelection> {
  const selectionMode: WorkspaceSelectionMode = input.actorUserId
    ? "actor"
    : input.preferredWorkspaceId
      ? "workspace"
      : "first-workspace";

  const workspaces = input.actorUserId
    ? await input.repository.listByUser(input.actorUserId)
    : await input.repository.listAll();

  const selectedWorkspace =
    selectionMode === "workspace" && input.preferredWorkspaceId
      ? await input.repository.getById(input.preferredWorkspaceId)
      : selectWorkspace(workspaces, input.preferredWorkspaceId);

  return {
    selectionMode,
    workspaces,
    selectedWorkspace,
  };
}
