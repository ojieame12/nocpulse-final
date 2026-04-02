'use client';

import { useEffect, useRef, useState } from 'react';
import {
  HydrationStageTracker,
  type HydrationStageTrackerProps,
} from './HydrationStageTracker';

export type HydrationOverlayProps = HydrationStageTrackerProps & {
  /** Whether the field is actively onboarding. Controls overlay visibility. */
  active: boolean;
};

/**
 * HydrationOverlay — renders the HydrationStageTracker as a centered
 * overlay above the field detail panel with a backdrop blur. When onboarding
 * completes the overlay fades out and the panel content animates in.
 *
 * Must be rendered as a sibling or absolute-positioned child of the panel
 * container (the `.map-area__panel-layer` div).
 */
export function HydrationOverlay({
  active,
  fieldName,
  onboardingStatus,
  progressMessage,
  prebuiltStages,
}: HydrationOverlayProps) {
  const isComplete = onboardingStatus?.status === 'completed';
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const prevStatusRef = useRef(onboardingStatus?.status);

  // Stagger entrance
  useEffect(() => {
    if (active && !isComplete) {
      const raf = requestAnimationFrame(() => setVisible(true));
      setDismissed(false);
      return () => cancelAnimationFrame(raf);
    }
  }, [active, isComplete]);

  // Handle completion → fade out
  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = onboardingStatus?.status;

    if (prev != null && prev !== 'completed' && isComplete) {
      let dismissTimer: ReturnType<typeof setTimeout> | null = null;
      // Hold the completed state briefly, then fade out
      const holdTimer = setTimeout(() => {
        setVisible(false);
        dismissTimer = setTimeout(() => setDismissed(true), 500);
      }, 800);

      return () => {
        clearTimeout(holdTimer);
        if (dismissTimer) {
          clearTimeout(dismissTimer);
        }
      };
    }
  }, [isComplete, onboardingStatus?.status]);

  // Reset when a new field starts onboarding
  useEffect(() => {
    if (active && !isComplete) {
      setDismissed(false);
    }
  }, [active, isComplete]);

  if (dismissed || (!active && !isComplete)) return null;

  return (
    <div
      className={`hydration-overlay${visible ? ' hydration-overlay--visible' : ''}`}
    >
      <div className="hydration-overlay__card">
        <HydrationStageTracker
          fieldName={fieldName}
          onboardingStatus={onboardingStatus}
          progressMessage={progressMessage}
          prebuiltStages={prebuiltStages}
        />
      </div>
    </div>
  );
}
