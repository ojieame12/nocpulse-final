import Link from "next/link";
import { Clock } from "lucide-react";

/**
 * Access-expired screen — shown when a shared field-view token has passed
 * its 24-hour validity window.
 */
export function AccessExpiredScreen() {
  return (
    <main style={styles.page}>
      <div style={styles.card}>
        {/* ── Icon ── */}
        <div style={styles.iconWrap}>
          <Clock
            size={48}
            color="var(--status-warning, #f59e0b)"
            strokeWidth={1.5}
          />
        </div>

        {/* ── Heading ── */}
        <h1 style={styles.heading}>Access expired</h1>

        {/* ── Description ── */}
        <p style={styles.body}>
          This shared link is no longer valid. Access tokens expire after
          24&nbsp;hours.
        </p>

        {/* ── Primary CTA ── */}
        <Link href="/request-access" style={styles.primaryBtn}>
          Request Full Access
        </Link>

        {/* ── Secondary link ── */}
        <Link href="/auth/sign-in" style={styles.secondaryLink}>
          Sign in with existing account
        </Link>

        {/* ── Footer ── */}
        <p style={styles.footer}>
          Contact your agronomist for a new link
        </p>
      </div>
    </main>
  );
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
    padding: "48px 36px 40px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 16,
    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.35)",
  },

  iconWrap: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 80,
    height: 80,
    borderRadius: "50%",
    background: "rgba(245, 158, 11, 0.08)",
    marginBottom: 4,
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
    maxWidth: 320,
  },

  primaryBtn: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    maxWidth: 300,
    padding: "14px 28px",
    marginTop: 8,
    background: "var(--btn-fill-primary, #004726)",
    color: "var(--btn-text-primary, #ffffff)",
    fontFamily: "var(--font-body, 'Sintony', sans-serif)",
    fontSize: "var(--btn-font-size, 14px)",
    fontWeight: 700,
    borderRadius: "var(--btn-radius, 10px)",
    textDecoration: "none",
    letterSpacing: "0.01em",
    transition: "background 0.15s ease",
  },

  secondaryLink: {
    fontSize: "var(--text-sm, 13px)",
    color: "var(--accent-green-bright, #22c55e)",
    textDecoration: "none",
    marginTop: 2,
  },

  footer: {
    fontSize: "var(--text-xs, 11px)",
    color: "rgba(255, 255, 255, 0.3)",
    margin: "12px 0 0",
    textAlign: "center" as const,
  },
};
