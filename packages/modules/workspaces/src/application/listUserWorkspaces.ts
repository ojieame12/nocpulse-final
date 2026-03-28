import type { UserId } from "@fieldpulse/platform-db";
import type { Workspace } from "../contracts/workspace";

type ListUserWorkspacesRepository = {
  listByUser(userId: UserId): Promise<readonly Workspace[]>;
};

export type ListUserWorkspacesInput = {
  repository: ListUserWorkspacesRepository;
  userId: UserId;
};

export async function listUserWorkspaces(
  input: ListUserWorkspacesInput,
): Promise<readonly Workspace[]> {
  return input.repository.listByUser(input.userId);
}
