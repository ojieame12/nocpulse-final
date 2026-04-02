"use client";

import { useEffect, useRef, useState } from "react";

const CROPS = [
  { name: "Canola", gdd: "5°C" },
  { name: "Spring Wheat", gdd: "0°C" },
  { name: "Durum", gdd: "0°C" },
  { name: "Barley", gdd: "0°C" },
  { name: "Oats", gdd: "5°C" },
  { name: "Flax", gdd: "5°C" },
  { name: "Lentils", gdd: "5°C" },
  { name: "Peas", gdd: "5°C" },
  { name: "Chickpeas", gdd: "5°C" },
  { name: "Soybeans", gdd: "10°C" },
  { name: "Winter Wheat", gdd: "0°C" },
  { name: "Rye", gdd: "0°C" },
];

export function PrairieCrops() {
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
      { threshold: 0.15 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={ref}
      id="crops"
      style={{
        padding: "clamp(60px, 10vw, 120px) clamp(24px, 4vw, 64px)",
        maxWidth: 1100,
        margin: "0 auto",
      }}
    >
      {/* Left-aligned header */}
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
          Prairie Crop Profiles
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
          12 crops. Your thresholds.
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
          Every crop has different frost damage thresholds, disease
          susceptibility windows, and growth stage progressions. We model all of
          them — not a generic &ldquo;crop.&rdquo;
        </p>
      </div>

      {/* 4-col crop grid */}
      <div className="landing-crop-grid" style={{ marginTop: 40 }}>
        {CROPS.map((c, i) => (
          <div
            key={c.name}
            style={{
              opacity: visible ? 1 : 0,
              transform: visible ? "translateY(0)" : "translateY(12px)",
              transition: `all 0.4s cubic-bezier(0.22,1,0.36,1) ${150 + i * 60}ms`,
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "12px 16px",
              borderRadius: 10,
              backgroundColor: "var(--ds-surface-subtle)",
              border: "1px solid var(--ds-border-light)",
            }}
          >
            <div style={{ flex: 1 }}>
              <p
                style={{
                  fontFamily: "var(--font-sintony), sans-serif",
                  fontSize: 13,
                  fontWeight: 700,
                  color: "var(--ds-text-primary)",
                  lineHeight: 1.3,
                }}
              >
                {c.name}
              </p>
              <p
                style={{
                  fontFamily: "var(--font-plex-mono), monospace",
                  fontSize: 10,
                  color: "var(--ds-text-muted)",
                  marginTop: 2,
                }}
              >
                GDD base {c.gdd}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
