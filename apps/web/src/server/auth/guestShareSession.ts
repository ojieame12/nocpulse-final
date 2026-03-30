import {
  createSupabaseDatabaseClient,
  type DatabaseClient,
  type DatabaseSchema,
} from "@fieldpulse/platform-db";

export const GUEST_SHARE_COOKIE_NAME = "fieldpulse_guest_share";
export const GUEST_SHARE_TTL_MS = 24 * 60 * 60 * 1000;

type WorkspaceShareTokenRow = Pick<
  DatabaseSchema["app"]["Tables"]["workspace_share_tokens"]["Row"],
  "id" | "workspace_id" | "field_id" | "created_at" | "expires_at" | "revoked_at"
>;

type ManagedWorkspaceShareRow = Pick<
  DatabaseSchema["app"]["Tables"]["workspace_share_tokens"]["Row"],
  | "id"
  | "workspace_id"
  | "field_id"
  | "created_at"
  | "expires_at"
  | "revoked_at"
  | "last_accessed_at"
>;

export type GuestShareCookiePayload = {
  token: string;
  expiresAt: string;
};

export type ResolvedGuestShareSession = {
  id: string;
  workspaceId: string;
  fieldId: string;
  expiresAt: string;
  revokedAt: string | null;
  createdAt: string;
};

export type ManagedWorkspaceShare = ResolvedGuestShareSession & {
  lastAccessedAt: string | null;
};

type WorkspaceShareLookupResult =
  | {
      status: "active";
      share: ResolvedGuestShareSession;
    }
  | {
      status: "expired";
      share: ResolvedGuestShareSession;
    }
  | {
      status: "revoked";
      share: ResolvedGuestShareSession;
    }
  | {
      status: "invalid";
  };

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function mapWorkspaceShareRow(
  row: WorkspaceShareTokenRow,
): ResolvedGuestShareSession {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    fieldId: row.field_id,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    createdAt: row.created_at,
  };
}

function mapManagedWorkspaceShareRow(
  row: ManagedWorkspaceShareRow,
): ManagedWorkspaceShare {
  return {
    ...mapWorkspaceShareRow(row),
    lastAccessedAt: row.last_accessed_at,
  };
}

function parseCookieHeader(cookieHeader: string | null) {
  if (!cookieHeader) {
    return new Map<string, string>();
  }

  return new Map(
    cookieHeader
      .split(";")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => {
        const separatorIndex = entry.indexOf("=");

        if (separatorIndex === -1) {
          return [entry, ""] as const;
        }

        return [
          entry.slice(0, separatorIndex).trim(),
          entry.slice(separatorIndex + 1).trim(),
        ] as const;
      }),
  );
}

export function generateWorkspaceShareToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

export async function hashWorkspaceShareToken(token: string) {
  const encoded = new TextEncoder().encode(token.trim());
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return bytesToHex(new Uint8Array(digest));
}

export function buildGuestShareCookieValue(payload: GuestShareCookiePayload) {
  return JSON.stringify(payload);
}

export function parseGuestShareCookieValue(
  value: string | null | undefined,
): GuestShareCookiePayload | null {
  if (!value) {
    return null;
  }

  try {
    let decoded = value;

    for (let index = 0; index < 2; index += 1) {
      const next = decodeURIComponent(decoded);

      if (next === decoded) {
        break;
      }

      decoded = next;
    }

    const parsed = JSON.parse(decoded) as Partial<GuestShareCookiePayload>;

    if (
      typeof parsed.token !== "string" ||
      parsed.token.trim().length === 0 ||
      typeof parsed.expiresAt !== "string" ||
      Number.isNaN(Date.parse(parsed.expiresAt))
    ) {
      return null;
    }

    return {
      token: parsed.token.trim(),
      expiresAt: parsed.expiresAt,
    };
  } catch {
    return null;
  }
}

export function readGuestShareCookie(
  request: Pick<Request, "headers">,
): GuestShareCookiePayload | null {
  return parseGuestShareCookieValue(
    parseCookieHeader(request.headers.get("cookie")).get(GUEST_SHARE_COOKIE_NAME),
  );
}

export function hasActiveGuestShareCookie(
  value: string | null | undefined,
  now = Date.now(),
) {
  const payload = parseGuestShareCookieValue(value);

  if (!payload) {
    return false;
  }

  return Date.parse(payload.expiresAt) > now;
}

export function buildGuestShareCookieAttributes(expiresAt: string) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(expiresAt),
  };
}

export function buildGuestShareCookiePayload(
  token: string,
  expiresAt: string,
): GuestShareCookiePayload {
  return {
    token: token.trim(),
    expiresAt,
  };
}

export async function createWorkspaceShareToken(input: {
  client: DatabaseClient;
  workspaceId: string;
  fieldId: string;
  createdBy: string;
  expiresAt?: string;
}) {
  const token = generateWorkspaceShareToken();
  const expiresAt =
    input.expiresAt ?? new Date(Date.now() + GUEST_SHARE_TTL_MS).toISOString();
  const tokenHash = await hashWorkspaceShareToken(token);
  const result = await input.client
    .from("workspace_share_tokens")
    .insert({
      workspace_id: input.workspaceId,
      field_id: input.fieldId,
      token_hash: tokenHash,
      created_by: input.createdBy,
      expires_at: expiresAt,
    })
    .select(
      "id, workspace_id, field_id, created_at, expires_at, revoked_at, last_accessed_at",
    )
    .single();

  if (result.error || !result.data) {
    throw result.error ?? new Error("Workspace share token could not be created.");
  }

  return {
    token,
    share: mapWorkspaceShareRow(result.data),
  };
}

export async function getActiveWorkspaceShare(input: {
  client: DatabaseClient;
  workspaceId: string;
  fieldId: string;
  now?: string;
}) {
  const now = input.now ?? new Date().toISOString();
  const result = await input.client
    .from("workspace_share_tokens")
    .select(
      "id, workspace_id, field_id, created_at, expires_at, revoked_at, last_accessed_at",
    )
    .eq("workspace_id", input.workspaceId)
    .eq("field_id", input.fieldId)
    .is("revoked_at", null)
    .gt("expires_at", now)
    .order("created_at", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  if (result.error) {
    throw result.error;
  }

  return result.data ? mapManagedWorkspaceShareRow(result.data) : null;
}

export async function revokeWorkspaceSharesForField(input: {
  client: DatabaseClient;
  workspaceId: string;
  fieldId: string;
  excludedShareId?: string | null;
  revokedAt?: string;
}) {
  const revokedAt = input.revokedAt ?? new Date().toISOString();
  let query = input.client
    .from("workspace_share_tokens")
    .update({
      revoked_at: revokedAt,
    })
    .eq("workspace_id", input.workspaceId)
    .eq("field_id", input.fieldId)
    .is("revoked_at", null)
    .gt("expires_at", revokedAt);

  if (input.excludedShareId) {
    query = query.neq("id", input.excludedShareId);
  }

  const result = await query;

  if (result.error) {
    throw result.error;
  }
}

export async function revokeWorkspaceShareById(input: {
  client: DatabaseClient;
  workspaceId: string;
  shareId: string;
  revokedAt?: string;
}) {
  const revokedAt = input.revokedAt ?? new Date().toISOString();
  const result = await input.client
    .from("workspace_share_tokens")
    .update({
      revoked_at: revokedAt,
    })
    .eq("workspace_id", input.workspaceId)
    .eq("id", input.shareId)
    .is("revoked_at", null)
    .gt("expires_at", revokedAt)
    .select(
      "id, workspace_id, field_id, created_at, expires_at, revoked_at, last_accessed_at",
    )
    .maybeSingle();

  if (result.error) {
    throw result.error;
  }

  return result.data ? mapManagedWorkspaceShareRow(result.data) : null;
}

export async function lookupWorkspaceShareToken(input: {
  client: DatabaseClient;
  token: string;
  now?: number;
}): Promise<WorkspaceShareLookupResult> {
  const normalizedToken = input.token.trim();

  if (!normalizedToken) {
    return { status: "invalid" };
  }

  const tokenHash = await hashWorkspaceShareToken(normalizedToken);
  const result = await input.client
    .from("workspace_share_tokens")
    .select(
      "id, workspace_id, field_id, created_at, expires_at, revoked_at, last_accessed_at",
    )
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (result.error) {
    throw result.error;
  }

  if (!result.data) {
    return { status: "invalid" };
  }

  const share = mapWorkspaceShareRow(result.data);

  if (share.revokedAt) {
    return {
      status: "revoked",
      share,
    };
  }

  if (Date.parse(share.expiresAt) <= (input.now ?? Date.now())) {
    return {
      status: "expired",
      share,
    };
  }

  return {
    status: "active",
    share,
  };
}

export async function touchWorkspaceShareToken(input: {
  client: DatabaseClient;
  shareId: string;
}) {
  const result = await input.client
    .from("workspace_share_tokens")
    .update({
      last_accessed_at: new Date().toISOString(),
    })
    .eq("id", input.shareId);

  if (result.error) {
    throw result.error;
  }
}

export async function resolveGuestShareSessionFromRequest(input: {
  request: Request;
  runtime: {
    mode: "supabase" | string;
    env: {
      supabase: {
        url?: string;
        serviceRoleKey?: string;
      };
    };
  };
}) {
  const payload = readGuestShareCookie(input.request);

  if (!payload || Date.parse(payload.expiresAt) <= Date.now()) {
    return null;
  }

  if (input.runtime.mode !== "supabase") {
    return null;
  }

  const client = createSupabaseDatabaseClient({
    url: input.runtime.env.supabase.url!,
    serviceKey: input.runtime.env.supabase.serviceRoleKey!,
  });
  const lookup = await lookupWorkspaceShareToken({
    client,
    token: payload.token,
  });

  return lookup.status === "active" ? lookup.share : null;
}
