'use client';

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { resolveMetricHint, type HintContext, type MetricHintDef } from './metricHints';

/* ═══════════════════════════════════════════════════════════════════
   MetricHintProvider
   ───────────────────────────────────────────────────────────────────
   Singleton floating tooltip that explains any metric the user hovers.

   How to use:
   1. Wrap your panel content with <MetricHintProvider>…</MetricHintProvider>
   2. On any metric element, add data attributes:
        data-metric-hint="ndvi"          ← metric key (resolves via metricHints.ts)
        data-metric-value="0.72"         ← current value (for contextual interpret)
        data-metric-crop="canola"        ← optional crop type
        data-metric-stage="flowering"    ← optional crop stage

   No imports or hooks needed in the leaf components.

   The provider uses event delegation — one listener on the container
   detects hovers on any descendant with [data-metric-hint].
   ═══════════════════════════════════════════════════════════════════ */

interface HintState {
  hint: MetricHintDef;
  value: string;
  context?: HintContext;
  anchorRect: DOMRect;
}

const SHOW_DELAY = 380;
const HIDE_DELAY = 140;
const CONTENT_FADE = 130; // ms for content crossfade

export function MetricHintProvider({ children }: { children: ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const [active, setActive] = useState<HintState | null>(null);
  const [visible, setVisible] = useState(false);
  const [contentKey, setContentKey] = useState(0);
  const [contentVisible, setContentVisible] = useState(false);

  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearAllTimers = useCallback(() => {
    if (showTimer.current) { clearTimeout(showTimer.current); showTimer.current = null; }
    if (hideTimer.current) { clearTimeout(hideTimer.current); hideTimer.current = null; }
    if (fadeTimer.current) { clearTimeout(fadeTimer.current); fadeTimer.current = null; }
  }, []);

  // Find the nearest ancestor with [data-metric-hint]
  const findHintTarget = useCallback((el: HTMLElement): HTMLElement | null => {
    let node: HTMLElement | null = el;
    while (node && node !== containerRef.current) {
      if (node.dataset.metricHint) return node;
      node = node.parentElement;
    }
    return null;
  }, []);

  const showHint = useCallback((target: HTMLElement) => {
    const key = target.dataset.metricHint!;
    const hint = resolveMetricHint(key);
    if (!hint) return;

    const value = target.dataset.metricValue ?? '';
    const context: HintContext = {
      cropType: target.dataset.metricCrop,
      cropStage: target.dataset.metricStage,
    };

    const anchorRect = target.getBoundingClientRect();
    const next: HintState = { hint, value, anchorRect, context };

    // Cancel pending hide
    if (hideTimer.current) { clearTimeout(hideTimer.current); hideTimer.current = null; }

    if (visible) {
      // Already showing — crossfade content, glide position
      if (active && active.hint.label !== hint.label) {
        // Different metric: quick crossfade
        setContentVisible(false);
        if (fadeTimer.current) clearTimeout(fadeTimer.current);
        fadeTimer.current = setTimeout(() => {
          setActive(next);
          setContentKey((k) => k + 1);
          setContentVisible(true);
          fadeTimer.current = null;
        }, CONTENT_FADE);
      } else {
        // Same metric, maybe updated value
        setActive(next);
      }
    } else {
      // Not yet visible — set content, delay reveal
      setActive(next);
      setContentKey((k) => k + 1);
      if (showTimer.current) clearTimeout(showTimer.current);
      showTimer.current = setTimeout(() => {
        setVisible(true);
        setContentVisible(true);
        showTimer.current = null;
      }, SHOW_DELAY);
    }
  }, [visible, active]);

  const hideHint = useCallback(() => {
    if (showTimer.current) { clearTimeout(showTimer.current); showTimer.current = null; }
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      setVisible(false);
      setContentVisible(false);
      hideTimer.current = null;
    }, HIDE_DELAY);
  }, []);

  // Event delegation
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onOver = (e: MouseEvent) => {
      const target = findHintTarget(e.target as HTMLElement);
      if (target) showHint(target);
    };

    const onOut = (e: MouseEvent) => {
      const from = findHintTarget(e.target as HTMLElement);
      const to = findHintTarget(e.relatedTarget as HTMLElement);
      // Only hide if we're leaving a hint target and not entering another
      if (from && !to) hideHint();
    };

    container.addEventListener('mouseover', onOver);
    container.addEventListener('mouseout', onOut);
    return () => {
      container.removeEventListener('mouseover', onOver);
      container.removeEventListener('mouseout', onOut);
    };
  }, [findHintTarget, showHint, hideHint]);

  // Cleanup timers on unmount
  useEffect(() => clearAllTimers, [clearAllTimers]);

  // Compute position
  const pos = useComputePosition(active, containerRef, cardRef);

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {children}
      <div
        ref={cardRef}
        className={`metric-hint${visible ? ' metric-hint--visible' : ''}`}
        style={
          pos
            ? { transform: `translate(${pos.x}px, ${pos.y}px) translate(-50%, -100%)` }
            : { transform: 'translate(-9999px, -9999px)' }
        }
      >
        <div
          key={contentKey}
          className={`metric-hint__inner${contentVisible ? ' metric-hint__inner--visible' : ''}`}
        >
          {active && (
            <>
              <span className="metric-hint__label">{active.hint.label}</span>
              <p className="metric-hint__definition">{active.hint.definition}</p>
              {active.hint.interpret && (
                <>
                  <span className="metric-hint__divider" />
                  <p className="metric-hint__interpretation">
                    {active.hint.interpret(active.value, active.context)}
                  </p>
                </>
              )}
            </>
          )}
        </div>
        <div className="metric-hint__arrow" />
      </div>
    </div>
  );
}

/* ── Position calculation ── */

function useComputePosition(
  state: HintState | null,
  containerRef: React.RefObject<HTMLDivElement | null>,
  cardRef: React.RefObject<HTMLDivElement | null>,
) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!state || !containerRef.current) {
      setPos(null);
      return;
    }

    const containerRect = containerRef.current.getBoundingClientRect();
    const { anchorRect } = state;

    // Center on anchor, above it
    let x = anchorRect.left - containerRect.left + anchorRect.width / 2;
    let y = anchorRect.top - containerRect.top - 8;

    // Clamp X so card stays inside container
    const cardWidth = cardRef.current?.offsetWidth ?? 280;
    const halfCard = cardWidth / 2;
    const pad = 12;
    x = Math.max(halfCard + pad, Math.min(x, containerRect.width - halfCard - pad));

    // If too close to the top, flip below anchor
    const cardHeight = cardRef.current?.offsetHeight ?? 120;
    if (y - cardHeight - 8 < 0) {
      y = anchorRect.bottom - containerRect.top + 8 + cardHeight;
    }

    setPos({ x, y });
  }, [state, containerRef, cardRef]);

  return pos;
}
