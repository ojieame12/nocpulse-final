'use client';

import { useState } from 'react';
import {
  ClipboardCheck,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import {
  Button,
  SectionHeader,
} from '../ui';

/* ── Types ── */

interface QAItem {
  question: string;
  answer?: string;
  tags?: { label: string; color: 'green' | 'red' | 'yellow' }[];
}

interface FieldAction {
  name: string;
  lld: string;
  recommendation: string;
  dueDate: string;
  explanation: string;
  urgency: string;
  confidence: string;
  signalCount: number;
  signals: { label: string; color: 'red' | 'yellow' | 'green' }[];
  questions: QAItem[];
}

/* ── Demo data ── */

const DEMO: FieldAction = {
  name: 'Quarter SE 25 010 17 W4',
  lld: 'SE 25-010-17 W4M',
  recommendation:
    'Scout east corner for waterlogging damage. Prioritize drainage assessment before next rain event.',
  dueDate: 'Mar 29, 2026',
  explanation:
    'North Quarter A is showing early moisture stress in the eastern section. NDVI dropped 3.2% over the last capture cycle. Root zone moisture is declining at a rate of 3% per week, approaching the Canola stress threshold. Combined with forecast frost risk overnight, immediate scouting is recommended.',
  urgency: 'Urgent',
  confidence: 'High confidence',
  signalCount: 3,
  signals: [
    { label: 'NDVI drop −3.2%', color: 'red' },
    { label: 'Frost risk active', color: 'yellow' },
    { label: 'Drying trend 7d', color: 'yellow' },
  ],
  questions: [
    {
      question: 'Should I scout this week?',
      answer:
        'Yes. The combination of NDVI decline and low root moisture suggests active stress. Scouting within 48 hours will allow you to assess damage before the forecasted rain on Friday, which could worsen waterlogging.',
      tags: [
        { label: 'Time-sensitive', color: 'red' },
        { label: 'Field visit', color: 'green' },
      ],
    },
    {
      question: 'Is the moisture trend reversing?',
      answer:
        'No. Root zone moisture has declined steadily over the past 3 captures. The SAR data shows consistent drying at 3%/week. Rain forecast in 18 hours may slow the decline but is insufficient to reverse it based on historical crop water uptake at the Flowering stage.',
      tags: [
        { label: 'SAR', color: 'green' },
        { label: 'NDVI History', color: 'green' },
      ],
    },
    {
      question: "What's the yield impact if this continues?",
    },
  ],
};

/* ── Component ── */

interface ActionTabProps {
  field?: FieldAction;
}

export function ActionTab({ field = DEMO }: ActionTabProps) {
  const [expanded, setExpanded] = useState<Record<number, boolean>>({ 1: true });

  const toggle = (idx: number) =>
    setExpanded((prev) => ({ ...prev, [idx]: !prev[idx] }));

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
        <p className="ai-recommendation__text">
          {field.recommendation}
        </p>
        <span className="ai-recommendation__due">
          Due by: {field.dueDate}
        </span>
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
                  <ChevronDown size={14} style={{ flexShrink: 0, color: '#004726' }} />
                ) : (
                  <ChevronRight size={14} style={{ flexShrink: 0, color: '#004726' }} />
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
