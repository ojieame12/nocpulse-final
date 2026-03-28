import type { Workspace } from "../contracts/workspace";

type ListAllWorkspacesRepository = {
  listAll(): Promise<readonly Workspace[]>;
};

export type ListAllWorkspacesInput = {
  repository: ListAllWorkspacesRepository;
};

export async function listAllWorkspaces(
  input: ListAllWorkspacesInput,
): Promise<readonly Workspace[]> {
  return input.repository.listAll();
}
