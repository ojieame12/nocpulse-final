import type { UserId, WorkspaceId } from "@fieldpulse/platform-db";
import type { AuthenticatedActor } from "./AuthenticatedActor";

export type ResolveActorByUserId = (input: {
  userId: UserId;
  preferredWorkspaceId?: WorkspaceId;
}) => Promise<AuthenticatedActor | null>;
