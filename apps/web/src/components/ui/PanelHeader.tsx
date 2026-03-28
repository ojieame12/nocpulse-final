'use client';

import { ArrowLeft, Maximize2, X } from 'lucide-react';

interface PanelHeaderProps {
  title: string;
  onBack?: () => void;
  onMaximize?: () => void;
  onClose?: () => void;
}

export function PanelHeader({ title, onBack, onMaximize, onClose }: PanelHeaderProps) {
  return (
    <div className="panel__header">
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {onBack && (
          <button type="button" className="panel__header-btn" onClick={onBack}>
            <ArrowLeft size={14} />
          </button>
        )}
        <span className="panel__header-title">{title}</span>
      </div>
      <div className="panel__header-actions">
        {onMaximize && (
          <button type="button" className="panel__header-btn" onClick={onMaximize}>
            <Maximize2 size={14} />
          </button>
        )}
        {onClose && (
          <button type="button" className="panel__header-btn" onClick={onClose}>
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
