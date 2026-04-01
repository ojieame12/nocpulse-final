'use client';

import { useEffect, useRef, useState } from 'react';

/* ── Stage definitions ── */

export type HydrationStageKey = 'soil' | 'weather' | 'imagery' | 'moisture';
export type HydrationStageState = 'pending' | 'active' | 'completed' | 'failed';

export interface HydrationStage {
  key: HydrationStageKey;
  label: string;
  state: HydrationStageState;
  statusText: string;
}

export interface PrebuiltStage {
  key: 'soil' | 'weather' | 'imagery' | 'moisture';
  label: string;
  state: 'pending' | 'completed';
  statusText: string;
}

const STAGE_DEFS: { key: HydrationStageKey; label: string; completedText: string }[] = [
  { key: 'soil', label: 'Soil properties', completedText: 'Fetched' },
  { key: 'weather', label: 'Weather observations', completedText: 'Collected' },
  { key: 'imagery', label: 'Satellite imagery', completedText: 'Acquired' },
  { key: 'moisture', label: 'Moisture model', completedText: 'Computed' },
];

/**
 * Map worker `progressMessage` strings to stage keys.
 * The worker emits these exact phrases — we match substrings.
 */
const PROGRESS_MATCHERS: { pattern: string; stage: HydrationStageKey }[] = [
  { pattern: 'soil', stage: 'soil' },
  { pattern: 'weather', stage: 'weather' },
  { pattern: 'imagery', stage: 'imagery' },
  { pattern: 'moisture', stage: 'moisture' },
];

/**
 * Derive the current active stage from a progressMessage string.
 * Returns the matched stage key, or null if no match.
 */
function parseActiveStage(progressMessage: string | null | undefined): HydrationStageKey | null {
  if (!progressMessage) return null;
  const lower = progressMessage.toLowerCase();
  for (const m of PROGRESS_MATCHERS) {
    if (lower.includes(m.pattern)) return m.stage;
  }
  return null;
}

/* ── Props ── */

export interface HydrationStageTrackerProps {
  /** Field display name shown in the header. */
  fieldName: string;
  /** Current onboarding status from PreviewShell. Null = not onboarding. */
  onboardingStatus: {
    status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
    progressPct: number | null;
    phaseLabel: string | null;
  } | null;
  /** Raw progressMessage from the dispatch snapshot, if available. */
  progressMessage?: string | null;
  /** Pre-built stage array from the commit response's `fieldHydrationSummaries`. */
  prebuiltStages?: readonly PrebuiltStage[] | null;
}

function fromPrebuiltStages(
  prebuilt: readonly PrebuiltStage[],
  onboardingStatus: HydrationStageTrackerProps['onboardingStatus'],
): HydrationStage[] {
  const isComplete = onboardingStatus?.status === 'completed';

  return STAGE_DEFS.map((def) => {
    const match = prebuilt.find((s) => s.key === def.key);
    if (!match) {
      return { key: def.key, label: def.label, state: 'pending' as const, statusText: 'Queued' };
    }

    if (match.state === 'completed' || isComplete) {
      return {
        key: def.key,
        label: match.label || def.label,
        state: 'completed' as const,
        statusText: match.statusText || def.completedText,
      };
    }

    return {
      key: def.key,
      label: match.label || def.label,
      state: 'pending' as const,
      statusText: match.statusText || 'Queued',
    };
  });
}

/**
 * Derive stage states from the onboarding status + progressMessage.
 *
 * Logic:
 * - If onboarding is complete → all stages completed
 * - Otherwise, parse the progressMessage to find the active stage
 * - Stages before the active one are completed
 * - The active stage is active
 * - Stages after are pending
 */
function deriveStages(
  onboardingStatus: HydrationStageTrackerProps['onboardingStatus'],
  progressMessage: string | null | undefined,
): HydrationStage[] {
  const isComplete = onboardingStatus?.status === 'completed';
  const isFailed = onboardingStatus?.status === 'failed';

  if (isComplete) {
    return STAGE_DEFS.map((def) => ({
      key: def.key,
      label: def.label,
      state: 'completed' as const,
      statusText: def.completedText,
    }));
  }

  // Parse which stage is currently active from the progressMessage
  const activeStageKey = parseActiveStage(progressMessage ?? onboardingStatus?.phaseLabel);
  const stageOrder: HydrationStageKey[] = ['soil', 'weather', 'imagery', 'moisture'];
  const activeIdx = activeStageKey ? stageOrder.indexOf(activeStageKey) : -1;

  return STAGE_DEFS.map((def, i) => {
    if (activeIdx < 0) {
      // No active stage parsed — everything is queued/pending
      return {
        key: def.key,
        label: def.label,
        state: 'pending' as const,
        statusText: 'Queued',
      };
    }

    if (i < activeIdx) {
      return {
        key: def.key,
        label: def.label,
        state: 'completed' as const,
        statusText: def.completedText,
      };
    }

    if (i === activeIdx) {
      if (isFailed) {
        return {
          key: def.key,
          label: def.label,
          state: 'failed' as const,
          statusText: 'Retry queued',
        };
      }
      const activeLabels: Record<HydrationStageKey, string> = {
        soil: 'Fetching…',
        weather: 'Collecting…',
        imagery: 'Acquiring…',
        moisture: 'Computing…',
      };
      return {
        key: def.key,
        label: def.label,
        state: 'active' as const,
        statusText: activeLabels[def.key],
      };
    }

    return {
      key: def.key,
      label: def.label,
      state: 'pending' as const,
      statusText: 'Queued',
    };
  });
}

/* ── Component ── */

/**
 * HydrationStageTracker — shows the 4-stage onboarding pipeline
 * at the top of the field detail panel while a field is hydrating.
 *
 * Fades out when all stages complete, then unmounts via max-height collapse.
 */
export function HydrationStageTracker({
  fieldName,
  onboardingStatus,
  progressMessage,
  prebuiltStages,
}: HydrationStageTrackerProps) {
  const isOnboarding =
    onboardingStatus != null &&
    onboardingStatus.status !== 'completed' &&
    onboardingStatus.status !== 'cancelled';
  const isComplete = onboardingStatus?.status === 'completed';

  /* Track "just completed" for farewell animation */
  const [showFarewell, setShowFarewell] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const prevStatusRef = useRef(onboardingStatus?.status);

  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = onboardingStatus?.status;

    if (prev != null && prev !== 'completed' && onboardingStatus?.status === 'completed') {
      setShowFarewell(true);
      // Hold completed state for 500ms, then fade out
      const holdTimer = setTimeout(() => {
        setShowFarewell(false);
        // After fade-out animation (400ms), dismiss entirely
        const dismissTimer = setTimeout(() => setDismissed(true), 450);
        return () => clearTimeout(dismissTimer);
      }, 500);
      return () => clearTimeout(holdTimer);
    }
  }, [onboardingStatus?.status]);

  // Reset dismissed state when a new field starts onboarding
  useEffect(() => {
    if (isOnboarding) {
      setDismissed(false);
      setShowFarewell(false);
    }
  }, [isOnboarding]);

  // Don't render if not onboarding and not in farewell
  if (!isOnboarding && !isComplete) return null;
  if (dismissed) return null;

  const stages =
    prebuiltStages && prebuiltStages.length > 0
    ? fromPrebuiltStages(prebuiltStages, onboardingStatus)
    : deriveStages(onboardingStatus, progressMessage);
  const allComplete = stages.every((s) => s.state === 'completed');
  const isFadingOut = allComplete && !showFarewell;

  return (
    <div
      className={`hydration-stage-tracker${isFadingOut ? ' hydration-stage-tracker--exiting' : ''}`}
    >
      <p className="hydration-stage-tracker__title">
        Preparing {fieldName}
      </p>

      <div className="hydration-stage-tracker__stages">
        {stages.map((stage) => (
          <div key={stage.key} className="hydration-stage-tracker__row">
            <span
              className={`hydration-stage-tracker__dot hydration-stage-tracker__dot--${stage.state}`}
            />
            <span
              className="hydration-stage-tracker__label"
              style={{
                opacity: stage.state === 'pending' ? 0.5 : 1,
              }}
            >
              {stage.label}
            </span>
            <span
              className={`hydration-stage-tracker__status hydration-stage-tracker__status--${stage.state}`}
            >
              {stage.statusText}
            </span>
          </div>
        ))}
      </div>

      <p className="hydration-stage-tracker__hint">
        Data appears below as each step completes.
      </p>
    </div>
  );
}
