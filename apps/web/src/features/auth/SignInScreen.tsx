import { Leaf } from "lucide-react";
import { EmailSignInForm } from "./EmailSignInForm";

type SignInScreenProps = {
  nextPath?: string;
};

export function SignInScreen({ nextPath = "/preview" }: SignInScreenProps) {
  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "#0c120e", padding: "24px",
    }}>
      <div style={{
        width: "100%", maxWidth: 400, display: "flex", flexDirection: "column",
        gap: 32, padding: "40px 32px", borderRadius: 20,
        background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 8px 40px rgba(0,0,0,0.4), 0 2px 10px rgba(0,0,0,0.2)",
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Leaf size={24} strokeWidth={2.25} style={{ color: "#16a34a" }} />
          <span style={{ fontFamily: "var(--font-body)", fontSize: 18, fontWeight: 700, color: "rgba(255,255,255,0.78)" }}>
            NocPulse
          </span>
        </div>

        {/* Heading */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <h1 style={{ fontFamily: "var(--font-heading)", fontSize: 28, fontWeight: 400, color: "rgba(255,255,255,0.85)", margin: 0, lineHeight: 1.2 }}>
            Sign in
          </h1>
          <p style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "rgba(255,255,255,0.42)", margin: 0, lineHeight: 1.5 }}>
            Enter your email to receive a secure sign-in link
          </p>
        </div>

        {/* Form */}
        <EmailSignInForm nextPath={nextPath} />

        {/* Footer */}
        <p style={{ fontFamily: "var(--font-body)", fontSize: 11, color: "rgba(255,255,255,0.2)", margin: 0, textAlign: "center" }}>
          Agricultural intelligence for precision farming
        </p>
      </div>
    </div>
  );
}
