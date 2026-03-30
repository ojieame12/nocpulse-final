"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type EmailSignInFormProps = {
  nextPath?: string;
};

export function EmailSignInForm({
  nextPath = "/preview",
}: EmailSignInFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestAccessHref = (() => {
    const params = new URLSearchParams();

    if (email.trim()) {
      params.set("email", email.trim());
    }

    if (nextPath) {
      params.set("next", nextPath);
    }

    const query = params.toString();
    return query ? `/request-access?${query}` : "/request-access";
  })();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim()) { setError("Email is required."); return; }
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email,
          next: nextPath,
          allowSignup: true,
        }),
      });
      const payload = (await response.json()) as {
        disposition?: "request_access_required";
        message?: string;
        error?: { message?: string };
      };
      if (!response.ok) throw new Error(payload.error?.message ?? "Email sign-in failed.");
      if (payload.disposition === "request_access_required") {
        setError(payload.message ?? "This email has not been provisioned for NocPulse yet.");
        return;
      }
      const target = new URL("/auth/check-email", window.location.origin);
      target.searchParams.set("email", email);
      target.searchParams.set("next", nextPath);
      router.push(`${target.pathname}${target.search}`);
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Email sign-in failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label htmlFor="email" style={{
          fontFamily: "var(--font-body)", fontSize: 11, fontWeight: 700,
          color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.5px",
        }}>
          Email address
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          disabled={pending}
          required
          style={{
            padding: "12px 16px", borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)",
            fontFamily: "var(--font-body)", fontSize: 14, color: "rgba(255,255,255,0.85)",
            outline: "none", transition: "border-color 200ms ease", width: "100%",
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = "#16a34a"; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; }}
        />
      </div>
      <input type="hidden" name="next" value={nextPath} />
      <button type="submit" disabled={pending} style={{
        padding: "14px 28px", borderRadius: 10, border: "none",
        background: pending ? "#003d20" : "#004726", color: "#fff",
        fontFamily: "var(--font-body)", fontSize: 14, fontWeight: 700,
        cursor: pending ? "wait" : "pointer", width: "100%",
        boxShadow: "0 4px 0 #002a15",
        transition: "all 150ms cubic-bezier(.2,.8,.2,1)",
        opacity: pending ? 0.7 : 1,
      }}>
        {pending ? "Sending link…" : "Send Sign-In Link"}
      </button>
      {error && (
        <p style={{
          fontFamily: "var(--font-body)", fontSize: 12, color: "#ef4444",
          margin: 0, padding: "8px 12px", borderRadius: 8,
          background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)",
        }}>
          {error}
        </p>
      )}
      <p style={{
        margin: 0,
        fontFamily: "var(--font-body)",
        fontSize: "var(--text-sm)",
        color: "rgba(255,255,255,0.42)",
        lineHeight: 1.5,
        textAlign: "center",
      }}>
        Need workspace access?{" "}
        <Link
          href={requestAccessHref}
          style={{ color: "#22c55e", textDecoration: "none", fontWeight: 700 }}
        >
          Request access
        </Link>
      </p>
    </form>
  );
}
