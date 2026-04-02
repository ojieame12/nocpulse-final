"use client";

import { useEffect, useRef, useState } from "react";

export function Footer() {
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
    <footer
      ref={ref}
      style={{
        backgroundColor: "var(--ds-surface-dark)",
        padding: "48px clamp(24px, 4vw, 64px)",
      }}
    >
      <div
        className="landing-footer-inner"
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0)" : "translateY(12px)",
          transition: "all 0.6s cubic-bezier(0.22,1,0.36,1)",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo-light.svg"
          alt="NocPulse"
          style={{ height: 16, opacity: 0.85 }}
        />

        <div style={{ display: "flex", gap: 28 }}>
          {["About", "Privacy", "Contact"].map((label) => (
            <a
              key={label}
              href="#"
              style={{
                fontSize: 12,
                color: "rgba(255,255,255,0.5)",
                fontFamily: "var(--font-sintony), sans-serif",
                textDecoration: "none",
                transition: "color 0.2s",
              }}
              onMouseEnter={(e) => { (e.target as HTMLElement).style.color = "rgba(255,255,255,0.85)"; }}
              onMouseLeave={(e) => { (e.target as HTMLElement).style.color = "rgba(255,255,255,0.5)"; }}
            >
              {label}
            </a>
          ))}
        </div>

        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: "var(--font-sintony), sans-serif" }}>
          &copy; 2026 NocPulse
        </p>
      </div>
    </footer>
  );
}
