"use client";

import { useEffect, useRef, useState } from "react";

const ALERTS = [
  {
    icon: "💧",
    severity: "Watch",
    severityBg: "var(--ds-green-100)",
    severityColor: "var(--ds-green-800)",
    borderColor: "var(--ds-amber-500)",
    title: "Moisture stress rising on NW-12-34-05 W3",
    body: "Soil depletion crossed 60% at 0-28 cm. Consider irrigation scheduling within 48 hours.",
    time: "Today, 5:42 AM",
  },
  {
    icon: "💨",
    severity: "Action",
    severityBg: "var(--ds-green-100)",
    severityColor: "var(--ds-green-800)",
    borderColor: "var(--ds-green-600)",
    title: "Spray window opening Thursday 0600-1000",
    body: "Wind 12 km/h, no precipitation, 18°C. Conditions won't repeat until Monday.",
    time: "Today, 6:15 AM",
  },
  {
    icon: "❄️",
    severity: "Critical",
    severityBg: "var(--ds-red-100)",
    severityColor: "var(--ds-red-600)",
    borderColor: "var(--ds-red-500)",
    title: "Frost probability 41%, canola at tillering",
    body: "Damage threshold −2°C. Ensemble model flags Friday overnight low. Monitor or prepare frost mitigation.",
    time: "Yesterday, 9:00 PM",
  },
];

export function OneAction() {
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
      { threshold: 0.12 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={ref}
      id="one-action"
      style={{
        padding: "clamp(60px, 10vw, 120px) clamp(24px, 4vw, 64px)",
        backgroundColor: "var(--ds-green-50)",
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        {/* Centered header */}
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
            How you&apos;ll hear from us
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
            One action, not a dashboard.
          </h2>
          <p
            style={{
              fontFamily: "var(--font-sintony), sans-serif",
              fontSize: 15,
              lineHeight: 1.5,
              color: "var(--ds-text-body)",
              marginTop: 16,
            }}
          >
            When something actually changes on your field, you get one alert.
            What changed. Why it matters. What to do. By when.
          </p>
        </div>

        {/* Alert cards row */}
        <div className="landing-alerts-grid" style={{ marginTop: 48 }}>
          {ALERTS.map((a, i) => (
            <div
              key={a.title}
              style={{
                opacity: visible ? 1 : 0,
                transform: visible ? "translateY(0)" : "translateY(16px)",
                transition: `all 0.5s cubic-bezier(0.22,1,0.36,1) ${300 + i * 150}ms`,
                padding: 16,
                borderRadius: 8,
                backgroundColor: "var(--ds-surface-white)",
                borderLeft: `3px solid ${a.borderColor}`,
                borderTop: "1px solid var(--ds-border-light)",
                borderRight: "1px solid var(--ds-border-light)",
                borderBottom: "1px solid var(--ds-border-light)",
                display: "flex",
                flexDirection: "column" as const,
                gap: 8,
              }}
            >
              {/* Top row — icon + severity */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span style={{ fontSize: 14 }}>{a.icon}</span>
                <span
                  style={{
                    fontFamily: "var(--font-sintony), sans-serif",
                    fontSize: 9,
                    fontWeight: 700,
                    color: a.severityColor,
                    backgroundColor: a.severityBg,
                    borderRadius: 999,
                    padding: "3px 8px",
                  }}
                >
                  {a.severity}
                </span>
              </div>

              {/* Title */}
              <p
                style={{
                  fontFamily: "var(--font-sintony), sans-serif",
                  fontSize: 13,
                  fontWeight: 700,
                  color: "var(--ds-text-primary)",
                  lineHeight: 1.4,
                }}
              >
                {a.title}
              </p>

              {/* Body */}
              <p
                style={{
                  fontFamily: "var(--font-sintony), sans-serif",
                  fontSize: 11,
                  lineHeight: 1.6,
                  color: "var(--ds-text-body)",
                }}
              >
                {a.body}
              </p>

              {/* Timestamp */}
              <p
                style={{
                  fontFamily: "var(--font-plex-mono), monospace",
                  fontSize: 9,
                  color: "var(--ds-text-muted)",
                }}
              >
                {a.time}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
