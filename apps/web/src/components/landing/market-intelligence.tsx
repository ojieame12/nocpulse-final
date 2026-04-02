"use client";

import { useEffect, useRef, useState } from "react";

const SOURCES = ["ICE / CBOT Futures", "Johnston's Grain Bids", "Bank of Canada FX"];

export function MarketIntelligence() {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={ref}
      id="market"
      style={{
        padding: "clamp(60px, 10vw, 100px) clamp(24px, 4vw, 64px)",
        backgroundColor: "var(--ds-green-900)",
      }}
    >
      <div
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0)" : "translateY(20px)",
          transition: "all 0.7s cubic-bezier(0.22,1,0.36,1)",
          textAlign: "center",
        }}
      >
        {/* Eyebrow */}
        <p
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "var(--ds-green-300)",
            fontFamily: "var(--font-sintony), sans-serif",
          }}
        >
          Market Intelligence
        </p>

        {/* Headline */}
        <h2
          style={{
            fontFamily: "var(--font-mackinac), Georgia, serif",
            fontWeight: 300,
            fontSize: "clamp(1.5rem, 3vw, 2.2rem)",
            lineHeight: 1.25,
            color: "var(--ds-text-on-dark)",
            marginTop: 12,
          }}
        >
          Revenue impact, not just field health.
        </h2>

        {/* Subtitle */}
        <p
          style={{
            fontFamily: "var(--font-sintony), sans-serif",
            fontSize: 15,
            lineHeight: 1.7,
            color: "var(--ds-text-on-dark-muted)",
            maxWidth: 520,
            margin: "16px auto 0",
          }}
        >
          Live commodity futures from ICE and CBOT. Western Canada cash bids.
          Bank of Canada FX. Tied to your yield assumptions so you see per-acre
          revenue alongside every agronomic decision.
        </p>

        {/* Source pills */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 12,
            marginTop: 32,
            flexWrap: "wrap" as const,
          }}
        >
          {SOURCES.map((s) => (
            <span
              key={s}
              style={{
                fontFamily: "var(--font-sintony), sans-serif",
                fontSize: 11,
                fontWeight: 700,
                color: "var(--ds-text-on-dark-muted)",
                backgroundColor: "var(--ds-surface-on-dark-subtle)",
                border: "1px solid var(--ds-border-on-dark)",
                borderRadius: 999,
                padding: "8px 16px",
              }}
            >
              {s}
            </span>
          ))}
        </div>

        {/* Price example */}
        <div
          className="landing-price-row"
          style={{
            marginTop: 40,
            opacity: visible ? 1 : 0,
            transform: visible ? "translateY(0)" : "translateY(12px)",
            transition: "all 0.6s cubic-bezier(0.22,1,0.36,1) 400ms",
          }}
        >
          {/* Canola price */}
          <div style={{ textAlign: "center" }}>
            <p
              style={{
                fontFamily: "var(--font-sintony), sans-serif",
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: "0.1em",
                color: "var(--ds-text-on-dark-faint)",
                textTransform: "uppercase",
              }}
            >
              Canola
            </p>
            <p
              style={{
                fontFamily: "var(--font-mackinac), Georgia, serif",
                fontWeight: 300,
                fontSize: "clamp(28px, 4vw, 36px)",
                color: "var(--ds-text-on-dark)",
                marginTop: 4,
              }}
            >
              $682.40
            </p>
            <p
              style={{
                fontFamily: "var(--font-plex-mono), monospace",
                fontSize: 10,
                color: "var(--ds-text-on-dark-faint)",
                marginTop: 4,
              }}
            >
              CAD / tonne
            </p>
          </div>

          {/* Divider */}
          <div
            style={{
              width: 1,
              height: 48,
              backgroundColor: "var(--ds-divider-on-dark)",
            }}
          />

          {/* Per-acre revenue */}
          <div style={{ textAlign: "center" }}>
            <p
              style={{
                fontFamily: "var(--font-sintony), sans-serif",
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: "0.1em",
                color: "var(--ds-text-on-dark-faint)",
                textTransform: "uppercase",
              }}
            >
              Your Field · NW-12-34-05 W3
            </p>
            <p
              style={{
                fontFamily: "var(--font-mackinac), Georgia, serif",
                fontWeight: 300,
                fontSize: "clamp(28px, 4vw, 36px)",
                color: "var(--ds-green-300)",
                marginTop: 4,
              }}
            >
              $348 /ac
            </p>
            <p
              style={{
                fontFamily: "var(--font-plex-mono), monospace",
                fontSize: 10,
                color: "var(--ds-text-on-dark-faint)",
                marginTop: 4,
              }}
            >
              at 42 bu/ac yield assumption
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
