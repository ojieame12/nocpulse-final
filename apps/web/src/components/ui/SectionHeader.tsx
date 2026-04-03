'use client';

import React from 'react';

interface SectionHeaderProps {
  label: string;
  meta?: React.ReactNode;
}

export function SectionHeader({ label, meta }: SectionHeaderProps) {
  return (
    <div className="panel__section-header">
      <span className="panel__section-label">{label}</span>
      {meta && <span className="panel__section-meta">{meta}</span>}
    </div>
  );
}
