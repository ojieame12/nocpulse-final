'use client';

import { useEffect, useState } from 'react';

/* ── Props ── */

export interface HydrationToastProps {
  /** The message to display (e.g. "Main Farm is ready" or "All 32 fields ready"). */
  message: string;
  /** Optional subtitle (e.g. "Total time: 8 min 23 sec"). */
  subtitle?: string | null;
  /** Auto-dismiss after this many ms. Default 3000. */
  duration?: number;
  /** Called when the toast finishes dismissing. */
  onDismiss?: () => void;
}

/**
 * HydrationToast — minimal completion toast.
 *
 * Appears bottom-right with a green left border accent.
 * Stays for `duration` ms, then fades out.
 * Uses design system tokens throughout.
 */
export function HydrationToast({
  message,
  subtitle,
  duration = 3000,
  onDismiss,
}: HydrationToastProps) {
  const [phase, setPhase] = useState<'entering' | 'visible' | 'exiting'>('entering');

  useEffect(() => {
    // Enter
    const enterTimer = setTimeout(() => setPhase('visible'), 20);
    return () => clearTimeout(enterTimer);
  }, []);

  useEffect(() => {
    if (phase !== 'visible') return;
    const exitTimer = setTimeout(() => setPhase('exiting'), duration);
    return () => clearTimeout(exitTimer);
  }, [phase, duration]);

  useEffect(() => {
    if (phase !== 'exiting') return;
    const dismissTimer = setTimeout(() => onDismiss?.(), 300);
    return () => clearTimeout(dismissTimer);
  }, [phase, onDismiss]);

  return (
    <div
      className={`hydration-toast hydration-toast--${phase}`}
      role="status"
      aria-live="polite"
    >
      <span className="hydration-toast__check">✓</span>
      <div className="hydration-toast__body">
        <span className="hydration-toast__message">{message}</span>
        {subtitle && (
          <span className="hydration-toast__subtitle">{subtitle}</span>
        )}
      </div>
    </div>
  );
}
