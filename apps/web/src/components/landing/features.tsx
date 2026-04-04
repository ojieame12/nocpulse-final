"use client";

import { useEffect, useRef, useState } from "react";

const FEATURES = [
  {
    number: "01",
    title: "Satellite health scores",
    body: "Every clear pass over your field is automatically captured and scored for vegetation health using NDVI analysis. No hardware, no manual checks.",
  },
  {
    number: "02",
    title: "Add fields in minutes",
    body: "Enter a Legal Land Description or upload a KML. Quarter sections resolve instantly to real parcel boundaries.",
  },
  {
    number: "03",
    title: "Explainable alerts",
    body: "When something changes, you get a plain-language alert: what changed, why it matters, what to do, and by when. No black-box decisions.",
  },
  {
    number: "04",
    title: "Spray window detection",
    body: "Weather-aware scheduling surfaces optimal application windows based on wind, temperature, precipitation probability, and forecast horizon.",
  },
  {
    number: "05",
    title: "Compare across time",
    body: "Side-by-side comparison between captures lets you track recovery, seasonal progression, and spot trends before they become problems.",
  },
  {
    number: "06",
    title: "Built for how you farm",
    body: "LLD-first field entry, familiar crop defaults, and workflows designed around real operations, not office dashboards.",
  },
];

export function Features() {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { threshold: 0.15 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={ref}
      id="features"
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
          maxWidth: 480,
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
          What you get
        </p>
        <h2
          style={{
            fontFamily: "var(--font-mackinac), Georgia, serif",
            fontWeight: 300,
            fontSize: "clamp(1.5rem, 3vw, 2.2rem)",
            lineHeight: 1.25,
            color: "var(--ds-text-primary)",
            marginTop: 12,
          }}
        >
          Built for the field,
          <br />
          not the office.
        </h2>
      </div>

      {/* Feature list — numbered, editorial style */}
      <div
        className="landing-features-grid"
        style={{
          marginTop: 56,
          borderTop: "1px solid var(--ds-border-light)",
        }}
      >
        {FEATURES.map((f, i) => (
          <div
            key={f.number}
            style={{
              padding: "32px 24px 32px 0",
              borderBottom: "1px solid var(--ds-border-light)",
              opacity: visible ? 1 : 0,
              transform: visible ? "translateY(0)" : "translateY(16px)",
              transition: `all 0.5s cubic-bezier(0.22,1,0.36,1) ${200 + i * 100}ms`,
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
              {f.number}
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
              {f.title}
            </h3>

            {/* Body */}
            <p
              style={{
                fontFamily: "var(--font-sintony), sans-serif",
                fontSize: 13,
                lineHeight: 1.7,
                color: "var(--ds-text-body)",
                marginTop: 8,
                maxWidth: 380,
              }}
            >
              {f.body}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
