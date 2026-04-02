'use client';

import { useState, useEffect } from 'react';
import { MapPin, Upload, FileSpreadsheet } from 'lucide-react';

/**
 * WelcomeModal — shown once to new users with an empty workspace.
 * Guides them to add their first field. Dismissible, won't show again
 * once a field exists or the user closes it.
 */
export function WelcomeModal({
  onAddField,
  onDismiss,
}: {
  onAddField: () => void;
  onDismiss: () => void;
}) {
  const [visible, setVisible] = useState(false);

  // Stagger entrance
  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  function handleAddField() {
    setVisible(false);
    setTimeout(onAddField, 200);
  }

  function handleDismiss() {
    setVisible(false);
    setTimeout(onDismiss, 200);
  }

  return (
    <div
      className={`welcome-modal__backdrop${visible ? ' welcome-modal__backdrop--visible' : ''}`}
      onClick={handleDismiss}
    >
      <div
        className={`welcome-modal__card${visible ? ' welcome-modal__card--visible' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Accent bar */}
        <div className="welcome-modal__accent" />

        {/* Content */}
        <div className="welcome-modal__body">
          {/* Icon */}
          <div className="welcome-modal__icon-wrap">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <circle cx="16" cy="16" r="15" stroke="rgba(22,163,74,0.3)" strokeWidth="1" />
              <circle cx="16" cy="16" r="10" stroke="rgba(22,163,74,0.15)" strokeWidth="1" />
              <circle cx="16" cy="16" r="4" fill="#16a34a" opacity="0.8" />
            </svg>
          </div>

          {/* Heading */}
          <h2 className="welcome-modal__title">Welcome to NocPulse</h2>
          <p className="welcome-modal__subtitle">
            Add your first field to start monitoring crop health, moisture levels, and weather conditions.
          </p>

          {/* Methods */}
          <div className="welcome-modal__methods">
            <div className="welcome-modal__method">
              <MapPin size={14} strokeWidth={2} />
              <span>LLD lookup</span>
            </div>
            <div className="welcome-modal__method">
              <FileSpreadsheet size={14} strokeWidth={2} />
              <span>Upload CSV</span>
            </div>
            <div className="welcome-modal__method">
              <Upload size={14} strokeWidth={2} />
              <span>Upload KML</span>
            </div>
          </div>

          {/* CTA */}
          <button
            type="button"
            className="welcome-modal__cta"
            onClick={handleAddField}
          >
            Add your first field
          </button>

          {/* Dismiss */}
          <button
            type="button"
            className="welcome-modal__dismiss"
            onClick={handleDismiss}
          >
            I&apos;ll do this later
          </button>
        </div>
      </div>
    </div>
  );
}
