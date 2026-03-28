'use client';

import type { LucideIcon } from 'lucide-react';

interface PanelEmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  ctaLabel?: string;
  onCtaClick?: () => void;
  /** 'tab' for 420×420 panel tab empties, 'panel' for 420×600 standalone panel empties */
  variant?: 'tab' | 'panel';
}

export function PanelEmptyState({
  icon: Icon,
  title,
  description,
  ctaLabel,
  onCtaClick,
  variant = 'panel',
}: PanelEmptyStateProps) {
  return (
    <div className={`panel-empty panel-empty--${variant}`}>
      <Icon size={48} strokeWidth={1.5} className="panel-empty__icon" />
      <span className="panel-empty__title">{title}</span>
      <p className="panel-empty__desc">{description}</p>
      {ctaLabel && (
        <button type="button" className="btn btn--primary" onClick={onCtaClick}>
          {ctaLabel}
        </button>
      )}
    </div>
  );
}
