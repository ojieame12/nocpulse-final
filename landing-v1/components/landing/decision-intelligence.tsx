"use client";

import { useEffect, useRef, useState } from "react";

const DECISIONS = [
  {
    number: "01",
    title: "Frost probability",
    verdict: "37% chance of −2°C by Thursday",
    body: "51 weather models run overnight. By morning you see the probability your field drops below damage threshold — not a generic forecast, a per-field verdict.",
  },
  {
    number: "02",
    title: "Spray windows",
    verdict: "Thu 0600–1000 · Wind 12 km/h · No precip",
    body: "Four consecutive hours where wind stays under 18 km/h, precipitation probability below 20%, and temperature between 10–30°C. We find them. You pick one.",
  },
  {
    number: "03",
    title: "Seeding verdict",
    verdict: "Seed Now · Soil 8°C at 6cm · 0% frost 7d",
    body: "Seed Now, Hold, or Too Early. Based on soil temperature at 6 cm, 7-day frost window, and field fitness — not a calendar date.",
  },
  {
    number: "04",
    title: "Disease risk",
    verdict: "Sclerotinia risk HIGH · Canola · Flowering",
    body: "Crop-specific models for sclerotinia, fusarium, ascochyta, and white mold. Not generic stress — named pathogens with conditions you can verify.",
  },
];

export function DecisionIntelligence() {
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
      { threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={ref}
      id="decisions"
      style={{
        padding: "clamp(60px, 10vw, 120px) clamp(24px, 4vw, 64px)",
        maxWidth: 1100,
        margin: "0 auto",
      }}
    >
      {/* Section header — left-aligned, editorial */}
      <div
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0)" : "translateY(20px)",
          transition: "all 0.6s cubic-bezier(0.22,1,0.36,1)",
          maxWidth: 560,
        }}
      >
        <p
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "var(--ds-green-600)",
            fontFamily: "var(--font-sintony), sans-serif",
          }}
        >
          Decision Intelligence
        </p>
        <h2
          style={{
            fontFamily: "var(--font-mackinac), Georgia, serif",
            fontWeight: 300,
            fontSize: "clamp(1.5rem, 3vw, 2.2rem)",
            lineHeight: 1.2,
            color: "var(--ds-text-primary)",
            marginTop: 12,
          }}
        >
          Beyond monitoring.
          <br />
          Decisions.
        </h2>
        <p
          style={{
            fontFamily: "var(--font-sintony), sans-serif",
            fontSize: 15,
            lineHeight: 1.5,
            color: "var(--ds-text-body)",
            marginTop: 16,
            maxWidth: 520,
          }}
        >
          Every other tool shows you what&apos;s happening. We tell you what to
          do about it — with thresholds you can verify and timing you can act on.
        </p>
      </div>

      {/* 2×2 decision card grid */}
      <div className="landing-decision-grid" style={{ marginTop: 48 }}>
        {DECISIONS.map((d, i) => (
          <div
            key={d.number}
            className="landing-decision-card"
            style={{
              opacity: visible ? 1 : 0,
              transform: visible ? "translateY(0)" : "translateY(20px)",
              transition: `all 0.5s cubic-bezier(0.22,1,0.36,1) ${200 + i * 120}ms`,
              padding: 24,
              borderRadius: 10,
              backgroundColor: "var(--ds-surface-subtle)",
              border: "1px solid var(--ds-border-light)",
            }}
          >
            {/* Number */}
            <span
              style={{
                fontFamily: "var(--font-plex-mono), monospace",
                fontSize: 11,
                fontWeight: 500,
                color: "var(--ds-green-500)",
                letterSpacing: "0.05em",
              }}
            >
              {d.number}
            </span>

            {/* Title */}
            <h3
              style={{
                fontFamily: "var(--font-mackinac), Georgia, serif",
                fontWeight: 300,
                fontSize: 18,
                color: "var(--ds-text-primary)",
                marginTop: 10,
                lineHeight: 1.3,
              }}
            >
              {d.title}
            </h3>

            {/* Verdict — monospace, looks like real data */}
            <p
              style={{
                fontFamily: "var(--font-plex-mono), monospace",
                fontSize: 12,
                fontWeight: 500,
                color: "var(--ds-green-800)",
                marginTop: 12,
                lineHeight: 1.5,
              }}
            >
              {d.verdict}
            </p>

            {/* Body */}
            <p
              style={{
                fontFamily: "var(--font-sintony), sans-serif",
                fontSize: 13,
                lineHeight: 1.7,
                color: "var(--ds-text-body)",
                marginTop: 8,
              }}
            >
              {d.body}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
