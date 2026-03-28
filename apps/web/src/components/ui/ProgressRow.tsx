'use client';

import { Check } from 'lucide-react';

interface ProgressRowProps {
  label: string;
  value: string;
  percent: number;
  rangeLow?: number;
  rangeHigh?: number;
  showCheck?: boolean;
  color?: string;
}

export function ProgressRow({
  label,
  value,
  percent,
  rangeLow,
  rangeHigh,
  showCheck,
  color,
}: ProgressRowProps) {
  return (
    <div className="progress-row">
      <div className="progress-row__header">
        <span className="progress-row__label">{label}</span>
        <span className="progress-row__value">
          {value}
          {showCheck && <Check size={14} />}
        </span>
      </div>
      <div className="progress-row__bar">
        <div
          className="progress-row__fill"
          style={{
            width: `${Math.min(percent, 100)}%`,
            backgroundColor: color,
          }}
        />
        {rangeLow != null && rangeHigh != null && (
          <div
            className="progress-row__range"
            style={{
              left: `${rangeLow}%`,
              width: `${rangeHigh - rangeLow}%`,
            }}
          />
        )}
      </div>
    </div>
  );
}
