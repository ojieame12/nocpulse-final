"use client";

import { useEffect, useRef, useState } from "react";

const STEPS = [
  {
    number: "01",
    title: "Add your field",
    body: "Enter a Legal Land Description or upload a KML. Boundaries resolve in seconds.",
  },
  {
    number: "02",
    title: "Get satellite captures",
    body: "On the next clear pass, your field is imaged and scored for vegetation health automatically.",
  },
  {
    number: "03",
    title: "Review and act",
    body: "See what changed, why it matters, and what to do next. Every recommendation is explainable.",
  },
];

export function HowItWorks() {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { threshold: 0.2 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={ref}
      id="how-it-works"
      style={{
        padding: "clamp(60px, 10vw, 120px) clamp(24px, 4vw, 64px)",
        backgroundColor: "var(--ds-green-50)",
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        {/* Header */}
        <div
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? "translateY(0)" : "translateY(20px)",
            transition: "all 0.6s cubic-bezier(0.22,1,0.36,1)",
            textAlign: "center",
            maxWidth: 500,
            margin: "0 auto",
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
            How it works
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
            Three steps to field intelligence.
          </h2>
        </div>

        {/* Steps — horizontal on desktop, vertical on mobile */}
        <div
          className="landing-steps-grid"
          style={{
            marginTop: 60,
          }}
        >
          {STEPS.map((step, i) => (
            <div
              key={step.number}
              style={{
                opacity: visible ? 1 : 0,
                transform: visible ? "translateY(0)" : "translateY(24px)",
                transition: `all 0.6s cubic-bezier(0.22,1,0.36,1) ${300 + i * 150}ms`,
                position: "relative",
                paddingLeft: 24,
                borderLeft: "2px solid var(--ds-green-300)",
              }}
            >
              {/* Step indicator dot */}
              <div
                style={{
                  position: "absolute",
                  left: -6,
                  top: 4,
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  backgroundColor: "var(--ds-green-500)",
                }}
              />

              <span
                style={{
                  fontFamily: "var(--font-plex-mono), monospace",
                  fontSize: 11,
                  fontWeight: 500,
                  color: "var(--ds-text-muted)",
                }}
              >
                Step {step.number}
              </span>

              <h3
                style={{
                  fontFamily: "var(--font-mackinac), Georgia, serif",
                  fontWeight: 300,
                  fontSize: 20,
                  color: "var(--ds-text-primary)",
                  marginTop: 8,
                  lineHeight: 1.3,
                }}
              >
                {step.title}
              </h3>

              <p
                style={{
                  fontFamily: "var(--font-sintony), sans-serif",
                  fontSize: 13,
                  lineHeight: 1.7,
                  color: "var(--ds-text-body)",
                  marginTop: 8,
                }}
              >
                {step.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
