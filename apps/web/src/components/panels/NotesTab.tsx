'use client';

import { useState } from 'react';
import { Send, CircleAlert, CircleX, CircleCheck, Eye } from 'lucide-react';
import { Button } from '../ui/Button';

const OUTCOME_OPTIONS = [
  {
    id: 'confirmed',
    icon: CircleAlert,
    iconColor: '#ef4444',
    title: 'Confirmed',
    desc: 'Stress or damage is visible in the field',
    selectedBorder: '#ef4444',
  },
  {
    id: 'not-confirmed',
    icon: CircleX,
    iconColor: '#6b7280',
    title: 'Not Confirmed',
    desc: 'Issue not visible from the ground',
    selectedBorder: undefined,
  },
  {
    id: 'resolved',
    icon: CircleCheck,
    iconColor: '#16a34a',
    title: 'Resolved',
    desc: 'Issue was present but has been managed',
    selectedBorder: undefined,
  },
  {
    id: 'monitor',
    icon: Eye,
    iconColor: '#f59e0b',
    title: 'Monitor',
    desc: 'Inconclusive. Check again on next capture',
    selectedBorder: undefined,
  },
] as const;

const PREVIOUS_ENTRIES = [
  {
    date: 'Mar 22, 2026',
    status: 'Confirmed' as const,
    statusColor: '#ef4444',
    badgeBg: '#fef2f2',
    text: 'Yellowing visible along east drainage. Soil compacted from recent rain. Recommend tile drainage assessment.',
  },
  {
    date: 'Mar 15, 2026',
    status: 'Resolved' as const,
    statusColor: '#16a34a',
    badgeBg: '#f0fdf4',
    text: 'Applied fungicide to west section. Crop recovering well. NDVI trending back up since treatment.',
  },
];

export function NotesTab() {
  const [selected, setSelected] = useState('confirmed');
  const [notes, setNotes] = useState('');

  return (
    <div className="panel__body">
      {/* Title Section */}
      <div className="panel__title-section">
        <h2 className="panel__title-main">Quarter SE 25 010 17 W4</h2>
        <span className="panel__title-sub">SE 25-010-17 W4M  &middot;  Legal Land Description</span>
      </div>

      {/* Inspection Target */}
      <div className="notes__inspection-target">
        <div className="notes__inspection-header">
          <span className="notes__inspection-label">Inspection Target</span>
          <span className="notes__inspection-date">Mar 26 capture</span>
        </div>
        <span className="notes__inspection-name">East Corner &middot; Possible waterlogging</span>
        <span className="notes__inspection-coord">52.1842&deg;N, &minus;110.6398&deg;W</span>
      </div>

      {/* What did you find? */}
      <h3 className="notes__outcome-heading">What did you find?</h3>

      {/* Outcome options */}
      <div className="notes__outcome-grid">
        {OUTCOME_OPTIONS.map((option) => {
          const isSelected = selected === option.id;
          const Icon = option.icon;
          return (
            <button
              key={option.id}
              type="button"
              className={`notes__outcome-card${isSelected ? ' notes__outcome-card--selected' : ''}`}
              onClick={() => setSelected(option.id)}
              style={isSelected && option.selectedBorder ? { borderColor: option.selectedBorder } : undefined}
            >
              <Icon size={20} style={{ color: option.iconColor, flexShrink: 0 }} />
              <div className="notes__outcome-text">
                <span className="notes__outcome-title">{option.title}</span>
                <span className="notes__outcome-desc">{option.desc}</span>
              </div>
              {isSelected && (
                <span className="notes__outcome-check" style={{ background: option.selectedBorder || 'var(--primary-green)' }} />
              )}
            </button>
          );
        })}
      </div>

      {/* Scout Notes */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span className="notes__field-label">Scout Notes</span>
        <textarea
          className="textarea-field"
          placeholder="Describe what you observed in the field..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      {/* Submit button */}
      <Button variant="panel-primary" icon={Send} onClick={() => {}}>
        Submit Scout Report
      </Button>

      {/* Previous entries section */}
      <div className="notes__history-section">
        <span className="notes__history-link">Edit previous entries</span>

        <div className="notes__history-block">
          <span className="notes__history-header">Field notes (2)</span>
          <div className="notes__history-list">
            {PREVIOUS_ENTRIES.map((entry) => (
              <div key={entry.date} className="notes__history-card">
                <div className="notes__history-card-top">
                  <span className="notes__history-date">{entry.date}</span>
                  <span
                    className="notes__history-badge"
                    style={{ color: entry.statusColor, background: entry.badgeBg }}
                  >
                    {entry.status}
                  </span>
                </div>
                <p className="notes__history-body">{entry.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
