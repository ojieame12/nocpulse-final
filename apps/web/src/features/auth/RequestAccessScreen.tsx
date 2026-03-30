"use client";

import Link from "next/link";
import { Leaf } from "lucide-react";
import { useState, type FormEvent } from "react";

/**
 * Request-access screen — lead-capture form for users who want full
 * NocPulse access after a shared preview or expired token.
 */
export function RequestAccessScreen() {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);

    const form = e.currentTarget;
    const data = {
      name: (form.elements.namedItem("name") as HTMLInputElement).value,
      email: (form.elements.namedItem("email") as HTMLInputElement).value,
      farmName: (form.elements.namedItem("farmName") as HTMLInputElement).value,
      acreage: (form.elements.namedItem("acreage") as HTMLInputElement).value,
      message: (form.elements.namedItem("message") as HTMLTextAreaElement)
        .value,
    };

    try {
      // Placeholder endpoint — will be wired to an actual API later
      await fetch("/api/request-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    } catch {
      // Silently succeed for now — endpoint doesn't exist yet
    }

    setSubmitting(false);
    setSubmitted(true);
  }

  return (
    <main style={styles.page}>
      <div style={styles.card}>
        {/* ── Icon ── */}
        <div style={styles.iconWrap}>
          <Leaf
            size={48}
            color="var(--accent-green, #008f4e)"
            strokeWidth={1.5}
          />
        </div>

        {/* ── Heading ── */}
        <h1 style={styles.heading}>Request Access to NocPulse</h1>
        <p style={styles.subtitle}>
          Get precision agriculture intelligence for your fields
        </p>

        {submitted ? (
          /* ── Success state ── */
          <div style={styles.successBox}>
            <p style={styles.successText}>
              Your request has been submitted. We typically respond within one
              business day.
            </p>
            <Link href="/auth/sign-in" style={styles.secondaryLink}>
              Sign in with an existing account
            </Link>
          </div>
        ) : (
          /* ── Form ── */
          <form onSubmit={handleSubmit} style={styles.form}>
            {/* Name */}
            <label style={styles.label}>
              <span style={styles.labelText}>Name</span>
              <input
                name="name"
                type="text"
                required
                autoComplete="name"
                placeholder="Jane Doe"
                style={styles.input}
              />
            </label>

            {/* Email */}
            <label style={styles.label}>
              <span style={styles.labelText}>Email</span>
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="jane@example.com"
                style={styles.input}
              />
            </label>

            {/* Farm / Operation Name */}
            <label style={styles.label}>
              <span style={styles.labelText}>Farm / Operation Name</span>
              <input
                name="farmName"
                type="text"
                required
                placeholder="Doe Family Farms"
                style={styles.input}
              />
            </label>

            {/* Approximate Acreage */}
            <label style={styles.label}>
              <span style={styles.labelText}>Approximate Acreage (ha)</span>
              <input
                name="acreage"
                type="text"
                inputMode="decimal"
                placeholder="e.g. 450"
                style={styles.input}
              />
            </label>

            {/* Message */}
            <label style={styles.label}>
              <span style={styles.labelText}>
                Message{" "}
                <span style={{ fontWeight: 400, color: "rgba(255,255,255,0.3)" }}>
                  (optional)
                </span>
              </span>
              <textarea
                name="message"
                rows={3}
                placeholder="Tell us about your operation or what you're looking for..."
                style={{ ...styles.input, ...styles.textarea }}
              />
            </label>

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting}
              style={{
                ...styles.primaryBtn,
                opacity: submitting ? 0.65 : 1,
                cursor: submitting ? "not-allowed" : "pointer",
              }}
            >
              {submitting ? "Submitting..." : "Request Access"}
            </button>
          </form>
        )}

        {/* ── Secondary link ── */}
        {!submitted && (
          <Link href="/auth/sign-in" style={styles.secondaryLink}>
            Already have an account? Sign in
          </Link>
        )}

        {/* ── Footer ── */}
        <p style={styles.footer}>
          We typically respond within one business day
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
    maxWidth: 480,
    background: "rgba(255, 255, 255, 0.04)",
    border: "1px solid rgba(255, 255, 255, 0.08)",
    borderRadius: 18,
    padding: "44px 36px 36px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 14,
    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.35)",
  },

  iconWrap: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 80,
    height: 80,
    borderRadius: "50%",
    background: "rgba(0, 143, 78, 0.1)",
    marginBottom: 2,
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

  subtitle: {
    fontSize: "var(--text-base, 14px)",
    lineHeight: 1.5,
    color: "rgba(255, 255, 255, 0.5)",
    textAlign: "center" as const,
    margin: 0,
    maxWidth: 320,
  },

  form: {
    width: "100%",
    display: "flex",
    flexDirection: "column",
    gap: 16,
    marginTop: 8,
  },

  label: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },

  labelText: {
    fontSize: "var(--text-sm, 13px)",
    fontWeight: 700,
    color: "rgba(255, 255, 255, 0.65)",
    letterSpacing: "0.02em",
  },

  input: {
    width: "100%",
    padding: "12px 14px",
    background: "rgba(255, 255, 255, 0.06)",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    borderRadius: 10,
    color: "#ffffff",
    fontSize: "var(--text-base, 14px)",
    fontFamily: "var(--font-body, 'Sintony', sans-serif)",
    outline: "none",
    transition: "border-color 0.15s ease, background 0.15s ease",
    boxSizing: "border-box" as const,
  },

  textarea: {
    resize: "vertical" as const,
    minHeight: 72,
    lineHeight: 1.5,
  },

  primaryBtn: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    padding: "14px 28px",
    marginTop: 4,
    background: "var(--btn-fill-primary, #004726)",
    color: "var(--btn-text-primary, #ffffff)",
    fontFamily: "var(--font-body, 'Sintony', sans-serif)",
    fontSize: "var(--btn-font-size, 14px)",
    fontWeight: 700,
    border: "none",
    borderRadius: "var(--btn-radius, 10px)",
    letterSpacing: "0.01em",
    transition: "background 0.15s ease, opacity 0.15s ease",
  },

  secondaryLink: {
    fontSize: "var(--text-sm, 13px)",
    color: "var(--accent-green-bright, #22c55e)",
    textDecoration: "none",
    marginTop: 2,
  },

  successBox: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 16,
    padding: "24px 0",
  },

  successText: {
    fontSize: "var(--text-base, 14px)",
    lineHeight: 1.6,
    color: "rgba(255, 255, 255, 0.6)",
    textAlign: "center" as const,
    margin: 0,
    maxWidth: 320,
  },

  footer: {
    fontSize: "var(--text-xs, 11px)",
    color: "rgba(255, 255, 255, 0.3)",
    margin: "8px 0 0",
    textAlign: "center" as const,
  },
};
