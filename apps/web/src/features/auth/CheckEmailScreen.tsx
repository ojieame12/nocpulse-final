import Link from "next/link";
import { Mail } from "lucide-react";

type CheckEmailScreenProps = {
  email?: string;
  nextPath?: string;
};

export function CheckEmailScreen({
  email,
  nextPath = "/preview",
}: CheckEmailScreenProps) {
  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "#0c120e", padding: "24px",
    }}>
      <div style={{
        width: "100%", maxWidth: 400, display: "flex", flexDirection: "column",
        alignItems: "center", gap: 24, padding: "40px 32px", borderRadius: 20,
        background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 8px 40px rgba(0,0,0,0.4), 0 2px 10px rgba(0,0,0,0.2)",
        textAlign: "center",
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center" }}>
          <img src="/logo-light.svg" alt="NocPulse" style={{ height: 14, opacity: 0.6 }} />
        </div>

        {/* Mail icon */}
        <div style={{
          width: 64, height: 64, borderRadius: "50%",
          background: "rgba(22,163,74,0.1)", display: "flex",
          alignItems: "center", justifyContent: "center",
        }}>
          <Mail size={28} style={{ color: "#16a34a" }} />
        </div>

        {/* Heading */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <h1 style={{ fontFamily: "var(--font-heading)", fontSize: 24, fontWeight: 400, color: "rgba(255,255,255,0.85)", margin: 0 }}>
            Check your email
          </h1>
          <p style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "rgba(255,255,255,0.42)", margin: 0, lineHeight: 1.5 }}>
            We sent a sign-in link to
          </p>
          {email && (
            <span style={{
              fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 500,
              color: "rgba(255,255,255,0.72)", padding: "6px 12px", borderRadius: 8,
              background: "rgba(255,255,255,0.06)",
            }}>
              {email}
            </span>
          )}
        </div>

        {/* Instructions */}
        <p style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "rgba(255,255,255,0.35)", margin: 0, lineHeight: 1.5 }}>
          Click the link in your email to sign in. It expires in 10 minutes.
        </p>

        {/* Actions */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%", paddingTop: 8 }}>
          <Link
            href={`/auth/sign-in?next=${encodeURIComponent(nextPath)}`}
            style={{
              fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 600,
              color: "#16a34a", textDecoration: "none",
            }}
          >
            Didn&apos;t receive it? Resend
          </Link>
          <Link
            href={nextPath}
            style={{
              fontFamily: "var(--font-body)", fontSize: 12,
              color: "rgba(255,255,255,0.25)", textDecoration: "none",
            }}
          >
            Return to app
          </Link>
        </div>
      </div>
    </div>
  );
}
