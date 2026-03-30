"use client";

import { useEffect, useState } from "react";
import { Copy, Link2, ShieldX } from "lucide-react";
import { Card, Lbl, Mono, Sub } from "./fieldDetailCardPrimitives";

type FieldShareCardProps = {
  workspaceId?: string | null;
  fieldId?: string | null;
  fieldName?: string | null;
};

type CreateShareResponse = {
  result?: {
    shareId: string;
    shareUrl: string;
    expiresAt: string;
    createdAt?: string;
    fieldName?: string;
  };
  error?: {
    message?: string;
  };
};

type CurrentShareResponse = {
  result?: {
    shareId: string;
    shareUrl: string | null;
    expiresAt: string;
    createdAt?: string;
    lastAccessedAt?: string | null;
  } | null;
  error?: {
    message?: string;
  };
};

type RevokeShareResponse = {
  result?: {
    shareId: string;
    revokedAt: string | null;
  };
  error?: {
    message?: string;
  };
};

function formatExpiry(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = Date.parse(value);

  if (Number.isNaN(parsed)) {
    return "Expires soon";
  }

  return `Expires ${new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(parsed))}`;
}

function buildShareQuery(workspaceId?: string | null, fieldId?: string | null) {
  const params = new URLSearchParams();

  if (workspaceId) {
    params.set("workspaceId", workspaceId);
  }

  if (fieldId) {
    params.set("fieldId", fieldId);
  }

  const query = params.toString();
  return query ? `/api/share?${query}` : "/api/share";
}

export function FieldShareCard({
  workspaceId = null,
  fieldId = null,
  fieldName = null,
}: FieldShareCardProps) {
  const [shareId, setShareId] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [loadingCurrentShare, setLoadingCurrentShare] = useState(false);
  const [loading, setLoading] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!workspaceId || !fieldId) {
      setShareId(null);
      setShareUrl(null);
      setExpiresAt(null);
      setLoadingCurrentShare(false);
      return;
    }

    async function loadCurrentShare() {
      setLoadingCurrentShare(true);
      setError(null);

      try {
        const response = await fetch(buildShareQuery(workspaceId, fieldId), {
          cache: "no-store",
        });
        const payload = (await response.json()) as CurrentShareResponse;

        if (!response.ok) {
          throw new Error(
            payload.error?.message ?? "The shared link state could not be loaded.",
          );
        }

        if (cancelled) {
          return;
        }

        setShareId(payload.result?.shareId ?? null);
        setShareUrl(payload.result?.shareUrl ?? null);
        setExpiresAt(payload.result?.expiresAt ?? null);
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "The shared link state could not be loaded.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingCurrentShare(false);
        }
      }
    }

    void loadCurrentShare();

    return () => {
      cancelled = true;
    };
  }, [fieldId, workspaceId]);

  async function handleGenerate() {
    if (!workspaceId || !fieldId) {
      setError("Open a field before generating a shared link.");
      return;
    }

    setLoading(true);
    setError(null);
    setNotice(null);

    try {
      const hadActiveShare = shareId != null;
      const response = await fetch("/api/share", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          workspaceId,
          fieldId,
        }),
      });
      const payload = (await response.json()) as CreateShareResponse;

      if (!response.ok || !payload.result) {
        throw new Error(
          payload.error?.message ?? "The shared link could not be created.",
        );
      }

      setShareId(payload.result.shareId);
      setShareUrl(payload.result.shareUrl);
      setExpiresAt(payload.result.expiresAt);
      setNotice(
        hadActiveShare
          ? "Previous guest link revoked. A new one-day link is active."
          : "One-day guest link generated.",
      );
    } catch (shareError) {
      setError(
        shareError instanceof Error
          ? shareError.message
          : "The shared link could not be created.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleRevoke() {
    if (!workspaceId || !shareId) {
      return;
    }

    setRevoking(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch("/api/share", {
        method: "DELETE",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          workspaceId,
          shareId,
        }),
      });
      const payload = (await response.json()) as RevokeShareResponse;

      if (!response.ok || !payload.result) {
        throw new Error(
          payload.error?.message ?? "The shared link could not be revoked.",
        );
      }

      setShareId(null);
      setShareUrl(null);
      setExpiresAt(null);
      setNotice("Guest link revoked.");
    } catch (revokeError) {
      setError(
        revokeError instanceof Error
          ? revokeError.message
          : "The shared link could not be revoked.",
      );
    } finally {
      setRevoking(false);
    }
  }

  async function handleCopy() {
    if (!shareUrl) {
      return;
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      setNotice("Shared link copied to clipboard.");
      setError(null);
    } catch {
      setError("The link could not be copied automatically.");
    }
  }

  return (
    <Card span={-1} style={{ gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Link2 size={14} style={{ color: "var(--text-muted)" }} />
        <Lbl>SHARED DEMO ACCESS</Lbl>
      </div>

      <Sub>
        Generate a one-day read-only link for {fieldName ?? "this field"}.
      </Sub>

      {loadingCurrentShare ? (
        <Sub>Loading current guest link…</Sub>
      ) : shareId ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            padding: "10px 12px",
            borderRadius: 8,
            background: "var(--section-bg)",
          }}
        >
          {shareUrl ? (
            <Mono>{shareUrl}</Mono>
          ) : (
            <Sub>
              An active guest link already exists for this field. For security,
              the full URL is only shown when a new link is generated.
            </Sub>
          )}
          <Sub>{formatExpiry(expiresAt)}</Sub>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {shareUrl ? (
              <button
                type="button"
                onClick={handleCopy}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  width: "fit-content",
                  minHeight: 34,
                  padding: "0 14px",
                  border: "1px solid var(--border-light)",
                  borderRadius: 10,
                  background: "var(--surface-white)",
                  color: "var(--text-primary)",
                  fontFamily: "var(--font-body)",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                <Copy size={14} />
                Copy link
              </button>
            ) : null}
            <button
              type="button"
              onClick={handleRevoke}
              disabled={revoking}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                width: "fit-content",
                minHeight: 34,
                padding: "0 14px",
                border: "1px solid rgba(239,68,68,0.18)",
                borderRadius: 10,
                background: "rgba(239,68,68,0.08)",
                color: "var(--status-danger)",
                fontFamily: "var(--font-body)",
                fontSize: 13,
                fontWeight: 700,
                cursor: revoking ? "progress" : "pointer",
                opacity: revoking ? 0.72 : 1,
              }}
            >
              <ShieldX size={14} />
              {revoking ? "Revoking..." : "Revoke link"}
            </button>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={handleGenerate}
        disabled={loading || revoking}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: "fit-content",
          minHeight: 36,
          padding: "0 18px",
          border: "none",
          borderRadius: 10,
          background: "var(--btn-fill-primary, #004726)",
          color: "var(--btn-text-primary, #ffffff)",
          fontFamily: "var(--font-body)",
          fontSize: 13,
          fontWeight: 700,
          cursor: loading ? "progress" : "pointer",
          opacity: loading ? 0.72 : 1,
          boxShadow: "0 4px 0 #002a15",
        }}
      >
        {loading
          ? "Generating..."
          : shareId
            ? "Generate new link"
            : "Generate share link"}
      </button>

      {notice ? (
        <span
          style={{
            color: "var(--status-positive)",
            fontFamily: "var(--font-body)",
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          {notice}
        </span>
      ) : null}
      {error ? (
        <span
          style={{
            color: "var(--status-danger)",
            fontFamily: "var(--font-body)",
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          {error}
        </span>
      ) : null}
    </Card>
  );
}
