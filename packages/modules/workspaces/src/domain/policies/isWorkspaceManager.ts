import type { WorkspaceMembership } from "../../contracts/workspace";

export function isWorkspaceManager(membership: WorkspaceMembership) {
  return membership.role === "owner" || membership.role === "manager";
}
