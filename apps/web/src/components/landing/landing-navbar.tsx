"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export function LandingNavbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 100);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 clamp(1.5rem, 4vw, 4rem)",
        height: scrolled ? 52 : 60,
        backdropFilter: scrolled ? "blur(16px)" : "none",
        backgroundColor: scrolled ? "var(--nav-scrolled-bg)" : "transparent",
        borderBottom: scrolled ? "1px solid var(--nav-scrolled-border)" : "1px solid transparent",
        transition: "all 0.4s cubic-bezier(0.22, 1, 0.36, 1)",
      }}
    >
      <Link href="/">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-light.svg" alt="NocPulse" style={{ height: 18, opacity: 0.9 }} />
      </Link>

      <div className="landing-nav-links">
        <a
          href="#features"
          style={{
            fontSize: 13,
            color: scrolled ? "var(--ds-text-body)" : "var(--ds-text-primary)",
            fontFamily: "var(--font-sintony), sans-serif",
            textDecoration: "none",
            transition: "color 0.2s",
          }}
        >
          Features
        </a>
        <a
          href="#how-it-works"
          style={{
            fontSize: 13,
            color: scrolled ? "var(--ds-text-body)" : "var(--ds-text-primary)",
            fontFamily: "var(--font-sintony), sans-serif",
            textDecoration: "none",
            transition: "color 0.2s",
          }}
        >
          How It Works
        </a>
        <LandingAuthControls />
      </div>
    </nav>
  );
}

function LandingAuthControls() {
  const secondaryButtonStyle = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    height: 36,
    padding: "0 14px",
    borderRadius: 999,
    border: "1px solid var(--nav-btn-secondary-border)",
    backgroundColor: "var(--nav-btn-secondary-bg)",
    color: "var(--ds-text-primary)",
    fontFamily: "var(--font-sintony), sans-serif",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
  } as const;

  const primaryButtonStyle = {
    ...secondaryButtonStyle,
    border: "1px solid transparent",
    backgroundColor: "var(--ds-green-800)",
    color: "var(--ds-text-on-dark)",
    boxShadow: "0 2px 0 #002A15",
  } as const;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <Link href="/auth/sign-in" style={secondaryButtonStyle}>
        Sign in
      </Link>
      <Link href="/request-access" style={primaryButtonStyle}>
        Request access
      </Link>
    </div>
  );
}
