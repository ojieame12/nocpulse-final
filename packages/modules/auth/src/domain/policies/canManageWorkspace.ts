import type { AuthenticatedActor } from "../../contracts/AuthenticatedActor";

export function canManageWorkspace(actor: AuthenticatedActor) {
  return actor.role === "owner" || actor.role === "manager";
}
