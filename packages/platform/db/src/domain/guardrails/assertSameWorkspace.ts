import type { WorkspaceId } from "../../contracts/ids";

export function assertSameWorkspace(
  expectedWorkspaceId: WorkspaceId,
  actualWorkspaceId: WorkspaceId,
) {
  if (expectedWorkspaceId !== actualWorkspaceId) {
    throw new Error("Cross-workspace access is not allowed.");
  }
}
