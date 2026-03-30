'use client';

import { useState, useCallback } from 'react';
import {
  ClipboardCheck,
  ChevronRight,
  ChevronDown,
  Zap,
  AlertTriangle,
} from 'lucide-react';
import {
  Button,
  SectionHeader,
} from '../ui';
import { useAppTheme } from '../layout/WorkspaceShell';

/* ── Types ── */

export interface ActionTag {
  label: string;
  color: 'green' | 'red' | 'yellow';
  detail?: string;
}

export interface ActionQAItem {
  question: string;
  answer?: string;
  tags?: ActionTag[];
}

export interface FieldActionProps {
  name: string;
  lld: string;
  recommendation: string;
  dueDate: string;
  explanation: string;
  urgency: string;
  confidence: string;
  signalCount: number;
  signals: ActionTag[];
  questions: ActionQAItem[];
}

/* ── Component ── */

interface ActionTabProps {
  field?: FieldActionProps;
}

export function ActionTab({ field }: ActionTabProps) {
  const theme = useAppTheme();
  const isDark = theme === 'dark';
  const [expanded, setExpanded] = useState<Record<number, boolean>>({ 1: true });

  const toggle = useCallback(
    (idx: number) => setExpanded((prev) => ({ ...prev, [idx]: !prev[idx] })),
    [],
  );

  const chevronColor = isDark ? 'rgba(74, 222, 128, 0.7)' : 'var(--primary-green)';
  const urgencyIcon = field?.urgency === 'Urgent';

  if (!field) {
    return (
      <div className="panel__body">
        <div className="panel__title-section">
          <h2 className="panel__title-main">No action context</h2>
          <span className="panel__title-sub">
            No live recommendation is available for this field right now.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="panel__body">
      {/* Title */}
      <div className="action__title-section">
        <h2 className="action__title-main">{field.name}</h2>
        <span className="panel__title-sub">
          {field.lld} &middot; Legal Land Description
        </span>
      </div>

      {/* AI Recommendation card */}
      <div className="ai-recommendation">
        {urgencyIcon && (
          <Zap
            size={16}
            className="ai-recommendation__icon"
            style={{ color: isDark ? 'rgba(252, 211, 77, 0.85)' : 'var(--status-warning)', flexShrink: 0 }}
          />
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
          <p className="ai-recommendation__text">
            {field.recommendation}
          </p>
          <span className="ai-recommendation__due">
            Due by: {field.dueDate}
          </span>
        </div>
      </div>

      {/* Explanation text */}
      <p className="action__explanation">
        {field.explanation}
      </p>

      {/* Urgency indicators */}
      <div className="urgency-row">
        <span className="urgency-dot" />
        <span className="urgency-text urgency-text--danger">{field.urgency}</span>
        <span className="urgency-separator" />
        <span className="urgency-text urgency-text--secondary">{field.confidence}</span>
        <span className="urgency-separator" />
        <span className="urgency-text urgency-text--mono">{field.signalCount} signals</span>
      </div>

      {/* Signal tags */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {field.signals.map((signal) => (
          <span
            key={signal.label}
            className={`signal-tag signal-tag--${signal.color}`}
            title={signal.detail}
          >
            {signal.label}
          </span>
        ))}
      </div>

      {/* Contextual Questions */}
      <div className="qa-container">
        <SectionHeader label="CONTEXTUAL QUESTIONS" />

        {field.questions.map((qa, idx) => {
          const isOpen = !!expanded[idx];

          return (
            <div className="qa-card" key={idx}>
              <div
                className="qa-item__question"
                onClick={() => toggle(idx)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') toggle(idx);
                }}
              >
                {isOpen ? (
                  <ChevronDown size={14} style={{ flexShrink: 0, color: chevronColor }} />
                ) : (
                  <ChevronRight size={14} style={{ flexShrink: 0, color: chevronColor }} />
                )}
                {qa.question}
              </div>

              {isOpen && qa.answer && (
                <>
                  <p className="qa-item__answer">
                    {qa.answer}
                  </p>
                  {qa.tags && (
                    <div className="qa-item__tags">
                      {qa.tags.map((tag) => (
                        <span
                          key={tag.label}
                          className={`qa-answer-chip qa-answer-chip--${tag.color}`}
                        >
                          {tag.label}
                        </span>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Mark reviewed button */}
      <Button variant="panel-secondary" icon={ClipboardCheck} className="action__review-btn">
        Mark reviewed
      </Button>
    </div>
  );
}
