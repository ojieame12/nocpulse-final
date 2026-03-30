import { createHmac, timingSafeEqual } from "crypto";
import type { WorkspaceRole } from "@fieldpulse/module-workspaces";

const ALGORITHM = "sha256";
const DEFAULT_GRANT_ACCESS_TTL_MS = 3 * 24 * 60 * 60 * 1000;

export type GrantAccessTokenPayload = {
  requestId: string;
  requestEmail: string;
  workspaceId: string;
  grantedByUserId: string;
  role: WorkspaceRole;
  recipientEmail: string | null;
  expiresAt: string;
};

function base64UrlEncode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function normalizePayload(
  payload: Omit<GrantAccessTokenPayload, "requestEmail" | "recipientEmail"> & {
    requestEmail: string;
    recipientEmail?: string | null;
  },
): GrantAccessTokenPayload {
  return {
    requestId: payload.requestId.trim(),
    requestEmail: payload.requestEmail.trim().toLowerCase(),
    workspaceId: payload.workspaceId.trim(),
    grantedByUserId: payload.grantedByUserId.trim(),
    role: payload.role,
    recipientEmail: payload.recipientEmail?.trim().toLowerCase() ?? null,
    expiresAt: payload.expiresAt,
  };
}

function computeSignature(encodedPayload: string, secret: string) {
  return createHmac(ALGORITHM, secret)
    .update(encodedPayload)
    .digest("base64url");
}

function signEncodedPayload(encodedPayload: string, secret: string) {
  const signature = computeSignature(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
}

export function createGrantAccessToken(
  payload: Omit<GrantAccessTokenPayload, "expiresAt"> & {
    expiresAt?: string;
    ttlMs?: number;
  },
  secret: string,
) {
  const normalizedPayload = normalizePayload({
    ...payload,
    expiresAt:
      payload.expiresAt ??
      new Date(
        Date.now() + (payload.ttlMs ?? DEFAULT_GRANT_ACCESS_TTL_MS),
      ).toISOString(),
  });
  const encodedPayload = base64UrlEncode(JSON.stringify(normalizedPayload));
  return signEncodedPayload(encodedPayload, secret);
}

export function verifyGrantAccessToken(token: string, secret: string) {
  const separatorIndex = token.lastIndexOf(".");

  if (separatorIndex <= 0 || separatorIndex === token.length - 1) {
    return {
      ok: false as const,
      reason: "malformed",
    };
  }

  const encodedPayload = token.slice(0, separatorIndex);
  const providedSignature = token.slice(separatorIndex + 1);
  const expectedSignature = computeSignature(encodedPayload, secret);

  if (providedSignature.length !== expectedSignature.length) {
    return {
      ok: false as const,
      reason: "invalid-signature",
    };
  }

  const providedBuffer = Buffer.from(providedSignature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (!timingSafeEqual(providedBuffer, expectedBuffer)) {
    return {
      ok: false as const,
      reason: "invalid-signature",
    };
  }

  try {
    const rawPayload = JSON.parse(
      base64UrlDecode(encodedPayload),
    ) as Partial<GrantAccessTokenPayload>;
    const payload = normalizePayload({
      requestId: String(rawPayload.requestId ?? ""),
      requestEmail: String(rawPayload.requestEmail ?? ""),
      workspaceId: String(rawPayload.workspaceId ?? ""),
      grantedByUserId: String(rawPayload.grantedByUserId ?? ""),
      role: String(rawPayload.role ?? "") as WorkspaceRole,
      recipientEmail:
        rawPayload.recipientEmail == null
          ? null
          : String(rawPayload.recipientEmail),
      expiresAt: String(rawPayload.expiresAt ?? ""),
    });

    if (
      !payload.requestId ||
      !payload.requestEmail ||
      !payload.workspaceId ||
      !payload.grantedByUserId ||
      !payload.role ||
      !payload.expiresAt
    ) {
      return {
        ok: false as const,
        reason: "invalid-payload",
      };
    }

    const expiresAtMs = Date.parse(payload.expiresAt);

    if (!Number.isFinite(expiresAtMs)) {
      return {
        ok: false as const,
        reason: "invalid-expiry",
      };
    }

    if (expiresAtMs <= Date.now()) {
      return {
        ok: false as const,
        reason: "expired",
      };
    }

    return {
      ok: true as const,
      payload,
    };
  } catch {
    return {
      ok: false as const,
      reason: "invalid-payload",
    };
  }
}

export function buildGrantAccessUrl(input: {
  appOrigin: string;
  secret: string;
  payload: Omit<GrantAccessTokenPayload, "expiresAt"> & {
    expiresAt?: string;
    ttlMs?: number;
  };
}) {
  const token = createGrantAccessToken(input.payload, input.secret);
  const url = new URL("/api/grant-access", input.appOrigin);
  url.searchParams.set("token", token);
  return url.toString();
}
