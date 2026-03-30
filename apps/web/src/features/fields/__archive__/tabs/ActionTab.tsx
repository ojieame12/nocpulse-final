"use client";

import { useState } from "react";
import {
  ChevronRight,
  ChevronDown,
  ClipboardCheck,
} from "lucide-react";

/* ── Demo Data ── */

const DEMO = {
  fieldName: "Quarter SE 25 010 17 W4",
  subtitle: "SE 25-010-17 W4M  \u00b7  Legal Land Description",
  recommendation:
    "Scout east corner for waterlogging damage. Prioritize drainage assessment before next rain event.",
  dueDate: "Mar 29, 2026",
  context:
    "North Quarter A is showing early moisture stress in the eastern section. NDVI dropped 3.2% over the last capture cycle. Root zone moisture is declining at a rate of 3% per week, approaching the Canola stress threshold. Combined with forecast frost risk overnight, immediate scouting is recommended.",
  severity: {
    level: "Urgent",
    confidence: "High confidence",
    signals: "3 signals",
  },
  evidenceChips: [
    { label: "NDVI drop \u22123.2%", variant: "red" as const },
    { label: "Frost risk active", variant: "amber" as const },
    { label: "Drying trend 7d", variant: "amber" as const },
  ],
  questions: [
    {
      question: "Should I scout this week?",
      answer: "",
      badges: [] as string[],
    },
    {
      question: "Is the moisture trend reversing?",
      answer:
        "No. Root zone moisture has declined steadily over the past 3 captures. The SAR data shows consistent drying at 3%/week. Rain forecast in 18 hours may slow the decline but is insufficient to reverse it based on historical crop water uptake at the Flowering stage.",
      badges: ["SAR", "NDVI History"],
    },
    {
      question: "What\u2019s the yield impact if this continues?",
      answer: "",
      badges: [] as string[],
    },
  ],
};

/* ── Component ── */

export function ActionTab() {
  const [openIndex, setOpenIndex] = useState<number | null>(1);
  const [reviewed, setReviewed] = useState(false);

  const toggle = (i: number) =>
    setOpenIndex((prev) => (prev === i ? null : i));

  return (
    <div className="at__container">
      {/* 1 ── Field Title Block ── */}
      <div className="at__title-section">
        <h2 className="at__field-name">{DEMO.fieldName}</h2>
        <span className="at__subtitle">{DEMO.subtitle}</span>
      </div>

      {/* 2 ── Recommendation ── */}
      <div className="at__recommendation">
        <p className="at__recommendation-text">{DEMO.recommendation}</p>
        <span className="at__due-date">Due by: {DEMO.dueDate}</span>
      </div>

      {/* 3 ── Context paragraph ── */}
      <p className="at__context">{DEMO.context}</p>

      {/* 4 ── Severity Row ── */}
      <div className="at__sev-row">
        <span className="at__sev-dot" />
        <span className="at__sev-label">{DEMO.severity.level}</span>
        <span className="at__sev-divider" />
        <span className="at__sev-conf">{DEMO.severity.confidence}</span>
        <span className="at__sev-divider" />
        <span className="at__sev-signals">{DEMO.severity.signals}</span>
      </div>

      {/* 5 ── Evidence Chips ── */}
      <div className="at__evidence-chips">
        {DEMO.evidenceChips.map((chip) => (
          <span
            key={chip.label}
            className={`at__evidence-chip at__evidence-chip--${chip.variant}`}
          >
            {chip.label}
          </span>
        ))}
      </div>

      {/* 6 ── Contextual Questions ── */}
      <div className="at__questions">
        <span className="at__questions-label">CONTEXTUAL QUESTIONS</span>
        {DEMO.questions.map((q, i) => {
          const isOpen = openIndex === i;
          return (
            <div
              key={i}
              className={`at__question${isOpen ? " at__question--open" : ""}`}
            >
              <button
                type="button"
                className="at__question-toggle"
                onClick={() => toggle(i)}
                aria-expanded={isOpen}
              >
                {isOpen ? (
                  <ChevronDown size={14} color="#004726" />
                ) : (
                  <ChevronRight size={14} color="#004726" />
                )}
                <span className="at__question-title">{q.question}</span>
              </button>
              {isOpen && q.answer && (
                <div className="at__question-answer">
                  <p>{q.answer}</p>
                  {q.badges.length > 0 && (
                    <div className="at__answer-badges">
                      {q.badges.map((b) => (
                        <span key={b} className="at__answer-badge">
                          {b}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 7 ── Mark Reviewed Button ── */}
      <button
        type="button"
        className="at__mark-reviewed"
        onClick={() => setReviewed((r) => !r)}
      >
        <ClipboardCheck size={16} color="#004726" />
        {reviewed ? "Reviewed" : "Mark reviewed"}
      </button>
    </div>
  );
}
