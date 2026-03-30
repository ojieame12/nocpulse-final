'use client';

import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface PanelEmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  ctaLabel?: string;
  onCtaClick?: () => void;
  variant?: 'tab' | 'panel';
}

export function PanelEmptyState({
  icon: Icon,
  title,
  description,
  ctaLabel,
  onCtaClick,
}: PanelEmptyStateProps) {
  return (
    <div className="panel-empty">
      <Icon size={40} strokeWidth={1.5} className="panel-empty__icon" />
      <span className="panel-empty__title">{title}</span>
      <p className="panel-empty__desc">{description}</p>
      {ctaLabel && (
        <button type="button" className="btn btn--primary" style={{ padding: '10px 20px' }} onClick={onCtaClick}>
          {ctaLabel}
        </button>
      )}
    </div>
  );
}
