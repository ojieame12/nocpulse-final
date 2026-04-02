"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function Hero() {
  const [phase, setPhase] = useState(0);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 200),   // headline line 1
      setTimeout(() => setPhase(2), 700),   // headline line 2
      setTimeout(() => setPhase(3), 1200),  // subtitle
      setTimeout(() => setPhase(4), 1600),  // buttons
      setTimeout(() => setPhase(5), 2000),  // illustration
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  const reveal = (step: number, extra?: React.CSSProperties): React.CSSProperties => ({
    opacity: phase >= step ? 1 : 0,
    transform: phase >= step ? "translateY(0)" : "translateY(28px)",
    filter: phase >= step ? "blur(0)" : "blur(6px)",
    transition: "opacity 0.8s cubic-bezier(0.22,1,0.36,1), transform 0.8s cubic-bezier(0.22,1,0.36,1), filter 0.8s cubic-bezier(0.22,1,0.36,1)",
    ...extra,
  });

  return (
    <section
      ref={sectionRef}
      style={{
        position: "relative",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden",
        padding: "clamp(80px, 15vw, 120px) 20px clamp(40px, 8vw, 60px)",
        background: "linear-gradient(180deg, var(--ds-surface-white) 0%, var(--ds-green-50) 50%, var(--ds-surface-white) 100%)",
      }}
    >
      {/* Ambient green glow */}
      <div
        style={{
          position: "absolute",
          top: "20%",
          left: "50%",
          transform: "translateX(-50%)",
          width: 800,
          height: 800,
          borderRadius: "50%",
          background: "radial-gradient(circle, var(--ds-green-500) 0%, transparent 65%)",
          filter: "blur(140px)",
          opacity: 0.15,
          pointerEvents: "none",
          animation: "blobBreathe 8s ease-in-out infinite",
        }}
      />

      {/* Grain texture */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat",
          backgroundSize: 200,
          pointerEvents: "none",
          zIndex: 1,
        }}
      />

      {/* Content */}
      <div style={{ position: "relative", zIndex: 2, maxWidth: 720, textAlign: "center" }}>
        {/* Eyebrow */}
        <p
          style={{
            ...reveal(1),
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "var(--ds-green-600)",
            fontFamily: "var(--font-sintony), sans-serif",
            marginBottom: 24,
          }}
        >
          Field Intelligence for Growers
        </p>

        {/* Headline line 1 */}
        <h1
          style={{
            ...reveal(1),
            fontFamily: "var(--font-mackinac), Georgia, serif",
            fontWeight: 300,
            fontSize: "clamp(2rem, 4.5vw, 3.2rem)",
            lineHeight: 1.2,
            color: "var(--ds-text-primary)",
            margin: 0,
          }}
        >
          Know what&apos;s happening
          <br />
          in your field.
        </h1>

        {/* Headline line 2 — lighter, italic feel */}
        <p
          style={{
            ...reveal(2),
            fontFamily: "var(--font-mackinac), Georgia, serif",
            fontWeight: 300,
            fontStyle: "italic",
            fontSize: "clamp(1.1rem, 2vw, 1.4rem)",
            lineHeight: 1.5,
            color: "var(--ds-text-muted)",
            marginTop: 12,
          }}
        >
          Without driving out to check.
        </p>

        {/* Subtitle */}
        <p
          style={{
            ...reveal(3),
            fontFamily: "var(--font-sintony), sans-serif",
            fontSize: 15,
            lineHeight: 1.7,
            color: "var(--ds-text-body)",
            maxWidth: 460,
            margin: "28px auto 0",
          }}
        >
          Add a field by LLD in under two minutes. See satellite health
          scores on the next clear pass. Get one explainable action when
          something changes.
        </p>

        {/* CTA row */}
        <div
          className="landing-hero-cta"
          style={{
            ...reveal(4),
            marginTop: 36,
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
              backgroundColor: "var(--ds-green-800)",
              color: "var(--ds-text-on-dark)",
              textDecoration: "none",
              boxShadow: "0 4px 0 var(--ds-green-950)",
              transition: "transform 0.15s, box-shadow 0.15s",
              minHeight: 44,
            }}
          >
            Request access
            <ArrowRight size={16} strokeWidth={2.5} />
          </Link>
          <a
            href="#how-it-works"
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "14px 28px",
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 700,
              fontFamily: "var(--font-sintony), sans-serif",
              backgroundColor: "transparent",
              color: "var(--ds-green-800)",
              border: "1.5px solid var(--ds-green-800)",
              textDecoration: "none",
              boxShadow: "0 4px 0 var(--ds-green-800)",
              transition: "transform 0.15s, box-shadow 0.15s",
              minHeight: 44,
            }}
          >
            See how it works
          </a>
        </div>
      </div>

      {/* Farm illustration */}
      <div
        style={{
          ...reveal(5),
          position: "relative",
          zIndex: 2,
          width: "100%",
          maxWidth: 900,
          marginTop: "clamp(32px, 6vw, 64px)",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/farm-illustration.svg"
          alt="Farm fields monitored from space"
          className="landing-farm-illustration"
          style={{ width: "100%", display: "block" }}
        />
      </div>

      {/* Decorative divider */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 1,
          background: "linear-gradient(90deg, transparent, var(--ds-green-500), transparent)",
          opacity: 0.2,
        }}
      />
    </section>
  );
}
