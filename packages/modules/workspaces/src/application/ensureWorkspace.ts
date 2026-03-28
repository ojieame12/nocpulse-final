import type { UserId } from "@fieldpulse/platform-db";
import type { CreateWorkspaceInput } from "../contracts/CreateWorkspaceInput";
import type { Workspace } from "../contracts/workspace";

type EnsureWorkspaceRepository = {
  create(input: CreateWorkspaceInput, actorUserId: UserId): Promise<Workspace>;
  listAll(): Promise<readonly Workspace[]>;
};

export type EnsureWorkspaceInput = {
  repository: EnsureWorkspaceRepository;
  actorUserId: UserId;
  workspace: CreateWorkspaceInput;
};

export type EnsureWorkspaceResult = {
  workspace: Workspace;
  action: "created" | "reused";
};

export async function ensureWorkspace(
  input: EnsureWorkspaceInput,
): Promise<EnsureWorkspaceResult> {
  const existingWorkspace = (await input.repository.listAll()).find(
    (workspace) => workspace.slug === input.workspace.slug,
  );

  if (existingWorkspace) {
    return {
      workspace: existingWorkspace,
      action: "reused",
    };
  }

  return {
    workspace: await input.repository.create(input.workspace, input.actorUserId),
    action: "created",
  };
}
