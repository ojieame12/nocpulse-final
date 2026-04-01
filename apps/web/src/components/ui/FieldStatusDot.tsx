'use client';

import { useEffect, useRef, useState } from 'react';

/* ── Types ── */

export type FieldHealthStatus = 'healthy' | 'stressed' | 'warning' | 'pending';

export interface FieldStatusDotProps {
  /** Static health status — shown when not onboarding. */
  status: FieldHealthStatus;
  /** 0–100 progress during onboarding. Undefined = not onboarding. */
  progressPct?: number;
  /** Dot diameter in px. Default 8. */
  size?: number;
}

/* ── Status color map (matches FieldStrip STATUS_COLORS) ── */

const STATUS_COLORS: Record<FieldHealthStatus, string> = {
  healthy: '#16a34a',
  stressed: '#dc2626',
  warning: '#d97706',
  pending: '#94a3b8',
};

/* ── Component ── */

/**
 * FieldStatusDot — a tiny circle that doubles as a progress ring.
 *
 * In static mode: solid 8px dot colored by health status.
 * During onboarding (progressPct defined): a conic-gradient ring that fills
 * clockwise, animating between poll updates with ease-out-expo.
 * On completion (100%): ring fills, holds 300ms, crossfades to solid dot.
 */
export function FieldStatusDot({
  status,
  progressPct,
  size = 8,
}: FieldStatusDotProps) {
  const isOnboarding = progressPct != null && progressPct < 100;
  const isComplete = progressPct != null && progressPct >= 100;

  /* Track "just completed" for the crossfade animation. */
  const [showCompletionFade, setShowCompletionFade] = useState(false);
  const prevProgressRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const prev = prevProgressRef.current;
    prevProgressRef.current = progressPct;

    if (prev != null && prev < 100 && progressPct != null && progressPct >= 100) {
      setShowCompletionFade(true);
      const timer = setTimeout(() => setShowCompletionFade(false), 500);
      return () => clearTimeout(timer);
    }
  }, [progressPct]);

  const solidColor = STATUS_COLORS[status];
  const trackColor = 'var(--color-slate-200, #e2e8f0)';
  const fillColor = 'var(--status-positive, #16a34a)';

  /* Static dot — no onboarding. */
  if (!isOnboarding && !showCompletionFade) {
    return (
      <span
        className="field-status-dot"
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: solidColor,
          display: 'inline-block',
          flexShrink: 0,
          transition: 'background 200ms ease',
        }}
      />
    );
  }

  /* Completion crossfade: ring → solid dot. */
  if (showCompletionFade && !isOnboarding) {
    return (
      <span
        className="field-status-dot field-status-dot--completing"
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: solidColor,
          display: 'inline-block',
          flexShrink: 0,
          animation: 'fieldDotComplete 500ms var(--ease-in-out-smooth, ease) forwards',
        }}
      />
    );
  }

  /* Active onboarding: conic-gradient ring. */
  const pct = Math.min(100, Math.max(0, progressPct ?? 0));

  return (
    <span
      className="field-status-dot field-status-dot--ring"
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        display: 'inline-block',
        flexShrink: 0,
        /* Conic gradient: filled arc + track. The transition on --progress
           is handled by the CSS transition on background via a trick:
           we transition the entire background property. */
        background: `conic-gradient(${fillColor} ${pct * 3.6}deg, ${trackColor} ${pct * 3.6}deg)`,
        transition: 'background 400ms cubic-bezier(0.16, 1, 0.3, 1)',
        /* Hollow out the center to make it a ring, not a pie. */
        mask: `radial-gradient(circle at center, transparent ${size * 0.3}px, black ${size * 0.3 + 0.5}px)`,
        WebkitMask: `radial-gradient(circle at center, transparent ${size * 0.3}px, black ${size * 0.3 + 0.5}px)`,
      }}
    />
  );
}
