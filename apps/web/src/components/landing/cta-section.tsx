"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export function CTASection() {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { threshold: 0.3 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={ref}
      style={{
        padding: "clamp(60px, 10vw, 120px) clamp(24px, 4vw, 64px)",
        maxWidth: 900,
        margin: "0 auto",
      }}
    >
      <div
        style={{
          position: "relative",
          overflow: "hidden",
          borderRadius: 20,
          padding: "clamp(40px, 6vw, 72px) clamp(24px, 4vw, 56px)",
          backgroundColor: "var(--ds-green-900)",
          textAlign: "center",
          opacity: visible ? 1 : 0,
          transform: visible ? "scale(1)" : "scale(0.96)",
          transition: "all 0.7s cubic-bezier(0.22,1,0.36,1)",
        }}
      >
        {/* Glow */}
        <div
          style={{
            position: "absolute",
            top: -100,
            right: -80,
            width: 400,
            height: 400,
            borderRadius: "50%",
            background: "radial-gradient(circle, var(--ds-green-400) 0%, transparent 70%)",
            opacity: 0.15,
            pointerEvents: "none",
          }}
        />

        <h2
          style={{
            fontFamily: "var(--font-mackinac), Georgia, serif",
            fontWeight: 300,
            fontSize: "clamp(1.4rem, 3vw, 2rem)",
            lineHeight: 1.3,
            color: "#fff",
            position: "relative",
          }}
        >
          Start monitoring your fields today.
        </h2>

        <p
          style={{
            fontFamily: "var(--font-sintony), sans-serif",
            fontSize: 14,
            lineHeight: 1.7,
            color: "rgba(255,255,255,0.7)",
            maxWidth: 400,
            margin: "16px auto 0",
            position: "relative",
          }}
        >
          Set up in minutes. No hardware. Add your boundaries and let the
          satellites do the rest.
        </p>

        <div
          className="landing-cta-buttons"
          style={{
            marginTop: 32,
            position: "relative",
          }}
        >
          <Link
            href="/request-access"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "14px 28px",
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 700,
              fontFamily: "var(--font-sintony), sans-serif",
              backgroundColor: "#fff",
              color: "var(--ds-green-800)",
              textDecoration: "none",
              boxShadow: "0 4px 0 rgba(0,0,0,0.15)",
              minHeight: 44,
            }}
          >
            Request access
            <span style={{ fontSize: 16 }}>→</span>
          </Link>
          <a
            href="#features"
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "14px 28px",
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 700,
              fontFamily: "var(--font-sintony), sans-serif",
              backgroundColor: "transparent",
              color: "rgba(255,255,255,0.9)",
              border: "1.5px solid rgba(255,255,255,0.3)",
              textDecoration: "none",
              minHeight: 44,
            }}
          >
            Learn more
          </a>
        </div>
      </div>
    </section>
  );
}
