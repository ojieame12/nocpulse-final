import { createClient } from "@supabase/supabase-js";
import type { WorkspaceId } from "@fieldpulse/platform-db";
import type { ResolveActorByUserId } from "../contracts/ResolveActorByUserId";
import type { AuthProvider } from "./AuthProvider";

export class SupabaseSessionError extends Error {
  readonly code: "missing-token" | "invalid-session" | "unmapped-user";

  constructor(
    code: SupabaseSessionError["code"],
    message: string,
  ) {
    super(message);
    this.code = code;
  }
}

export type CreateSupabaseAccessTokenAuthProviderInput = {
  supabaseUrl: string;
  supabaseAnonKey: string;
  accessToken?: string;
  preferredWorkspaceId?: WorkspaceId;
  resolveActorByUserId: ResolveActorByUserId;
};

export function createSupabaseAccessTokenAuthProvider(
  input: CreateSupabaseAccessTokenAuthProviderInput,
): AuthProvider {
  return {
    async resolveActor() {
      if (!input.accessToken) {
        throw new SupabaseSessionError(
          "missing-token",
          "[auth] no Supabase access token was provided",
        );
      }

      const client = createClient(input.supabaseUrl, input.supabaseAnonKey, {
        auth: {
          autoRefreshToken: false,
          detectSessionInUrl: false,
          persistSession: false,
        },
      });

      const result = await client.auth.getUser(input.accessToken);

      if (result.error || !result.data.user) {
        throw new SupabaseSessionError(
          "invalid-session",
          result.error?.message ?? "[auth] Supabase session could not be verified",
        );
      }

      const actor = await input.resolveActorByUserId({
        userId: result.data.user.id,
        preferredWorkspaceId: input.preferredWorkspaceId,
      });

      if (!actor) {
        throw new SupabaseSessionError(
          "unmapped-user",
          `[auth] Supabase user ${result.data.user.id} is not mapped to a workspace actor`,
        );
      }

      return actor;
    },
  };
}
