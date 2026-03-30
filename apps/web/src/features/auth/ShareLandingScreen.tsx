import Link from "next/link";
import { Loader2, AlertCircle } from "lucide-react";

type ShareLandingScreenProps = {
  token: string;
  /** Set to true to show the invalid-link state instead of the loading state. */
  invalid?: boolean;
};

/**
 * Share landing page — shown when someone opens a shared field-view link.
 * Displays a centered loading card while the token is validated.
 * If the token is invalid/expired, shows an error state inline.
 *
 * Token validation will be wired in a future pass; for now both UI states
 * are built and the `invalid` prop toggles between them.
 */
export function ShareLandingScreen({
  token,
  invalid = false,
}: ShareLandingScreenProps) {
  return (
    <main style={styles.page}>
      <div style={styles.card}>
        {/* ── Logo mark ── */}
        <div style={styles.logoRow}>
          <svg
            width="32"
            height="32"
            viewBox="0 0 32 32"
            fill="none"
            aria-hidden="true"
            style={{ flexShrink: 0 }}
          >
            <rect width="32" height="32" rx="8" fill="#004726" />
            <path
              d="M16 6c-1 4-4 7-8 9 2 1 4 3 5 6 1-3 4-6 8-8-2-1-4-4-5-7z"
              fill="#22c55e"
            />
            <circle cx="20" cy="22" r="3" fill="#6ee7a0" opacity="0.6" />
          </svg>
          <span style={styles.logoText}>NocPulse</span>
        </div>

        {invalid ? (
          /* ── Invalid / expired state ── */
          <>
            <div style={styles.iconWrap}>
              <AlertCircle size={48} color="#ef4444" strokeWidth={1.5} />
            </div>

            <h1 style={styles.heading}>Invalid link</h1>

            <p style={styles.body}>
              This shared access link is not valid. It may have expired or been
              revoked. Please contact the workspace owner for a new link.
            </p>

            <div style={styles.actions}>
              <Link href="/auth/sign-in" style={styles.secondaryLink}>
                Sign in with an existing account
              </Link>
            </div>
          </>
        ) : (
          /* ── Loading / validating state ── */
          <>
            <h1 style={styles.heading}>Shared Field View</h1>

            <div style={styles.spinnerRow}>
              <Loader2
                size={22}
                color="var(--accent-green-bright, #22c55e)"
                strokeWidth={2}
                style={{ animation: "nocpulse-spin 1.1s linear infinite" }}
              />
              <span style={styles.spinnerLabel}>
                Validating your access token&hellip;
              </span>
            </div>

            <p style={styles.tokenHint}>
              Token: <code style={styles.mono}>{maskToken(token)}</code>
            </p>
          </>
        )}
      </div>

      {/* Inline keyframes for the spinner */}
      <style>{`
        @keyframes nocpulse-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </main>
  );
}

/* ── Helpers ── */

/** Mask most of the token for display, showing only first 6 and last 4 chars. */
function maskToken(token: string): string {
  if (token.length <= 12) return token;
  return `${token.slice(0, 6)}${"*".repeat(Math.min(token.length - 10, 8))}${token.slice(-4)}`;
}

/* ── Inline styles (CSS-variable-driven, dark-theme default) ── */

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px 16px",
    background: "#0c120e",
    fontFamily: "var(--font-body, 'Sintony', sans-serif)",
  },

  card: {
    width: "100%",
    maxWidth: 440,
    background: "rgba(255, 255, 255, 0.04)",
    border: "1px solid rgba(255, 255, 255, 0.08)",
    borderRadius: 18,
    padding: "40px 36px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 20,
    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.35)",
  },

  logoRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 4,
  },

  logoText: {
    fontFamily: "var(--font-heading, 'P22 Mackinac', Georgia, serif)",
    fontSize: 20,
    fontWeight: 500,
    color: "rgba(255, 255, 255, 0.9)",
    letterSpacing: "-0.01em",
  },

  iconWrap: {
    marginTop: 4,
  },

  heading: {
    fontFamily: "var(--font-heading, 'P22 Mackinac', Georgia, serif)",
    fontSize: "var(--text-2xl, 28px)",
    fontWeight: 500,
    color: "#ffffff",
    margin: 0,
    textAlign: "center" as const,
    lineHeight: 1.2,
  },

  body: {
    fontSize: "var(--text-base, 14px)",
    lineHeight: 1.6,
    color: "rgba(255, 255, 255, 0.55)",
    textAlign: "center" as const,
    margin: 0,
    maxWidth: 340,
  },

  spinnerRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },

  spinnerLabel: {
    fontSize: "var(--text-md, 16px)",
    color: "rgba(255, 255, 255, 0.6)",
  },

  tokenHint: {
    fontSize: "var(--text-sm, 13px)",
    color: "rgba(255, 255, 255, 0.3)",
    margin: 0,
  },

  mono: {
    fontFamily: "var(--font-mono, 'IBM Plex Mono', monospace)",
    fontSize: "var(--text-xs, 11px)",
    background: "rgba(255, 255, 255, 0.06)",
    padding: "2px 6px",
    borderRadius: 4,
    color: "rgba(255, 255, 255, 0.45)",
  },

  actions: {
    marginTop: 8,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 12,
  },

  secondaryLink: {
    fontSize: "var(--text-sm, 13px)",
    color: "var(--accent-green-bright, #22c55e)",
    textDecoration: "none",
  },
};
