"use client";

import { useEffect, useState } from "react";

/* ═══════════════════════════════════════════════════════════
   Escape-velocity ripple on cell deselect.

   When a cell is deselected, a ring expands outward from the
   last click position and fades out — "escape velocity" effect.
   ═══════════════════════════════════════════════════════════ */

const RIPPLE_DURATION_MS = 500;

type RippleInstance = {
  id: number;
  x: number;
  y: number;
  createdAt: number;
};

type DeselectRippleProps = {
  /** Screen coordinates of the last deselect event, or null when idle */
  trigger: { x: number; y: number } | null;
};

let rippleCounter = 0;

export function DeselectRipple({ trigger }: DeselectRippleProps) {
  const [ripples, setRipples] = useState<RippleInstance[]>([]);

  useEffect(() => {
    if (!trigger) return;

    const id = ++rippleCounter;
    const instance: RippleInstance = {
      id,
      x: trigger.x,
      y: trigger.y,
      createdAt: Date.now(),
    };

    setRipples((prev) => [...prev, instance]);

    const timer = setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== id));
    }, RIPPLE_DURATION_MS + 50);

    return () => clearTimeout(timer);
  }, [trigger]);

  if (ripples.length === 0) return null;

  return (
    <>
      {ripples.map((r) => (
        <div
          key={r.id}
          style={{
            position: "absolute",
            left: r.x,
            top: r.y,
            width: 0,
            height: 0,
            pointerEvents: "none",
            zIndex: 18,
          }}
        >
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: 20,
              height: 20,
              borderRadius: "50%",
              border: "2px solid rgba(34, 197, 94, 0.6)",
              boxShadow: "0 0 12px rgba(34, 197, 94, 0.3)",
              animation: `deselectRipple ${RIPPLE_DURATION_MS}ms var(--ease-out-expo, cubic-bezier(0.16, 1, 0.3, 1)) forwards`,
            }}
          />
        </div>
      ))}
    </>
  );
}
