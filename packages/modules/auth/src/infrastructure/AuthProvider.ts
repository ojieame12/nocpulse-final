import type { AuthenticatedActor } from "../contracts/AuthenticatedActor";

export type AuthProvider = {
  resolveActor(): Promise<AuthenticatedActor | null>;
};
