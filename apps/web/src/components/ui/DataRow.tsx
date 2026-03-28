'use client';

import { type LucideIcon } from 'lucide-react';

interface DataRowProps {
  label: string;
  value: React.ReactNode;
  icon?: LucideIcon;
  className?: string;
}

export function DataRow({ label, value, icon: Icon, className }: DataRowProps) {
  const baseClass = Icon ? 'data-row--with-icon' : 'data-row';

  return (
    <div className={`${baseClass}${className ? ` ${className}` : ''}`}>
      {Icon && <Icon size={16} />}
      <span className="data-row__label">{label}</span>
      <span className="data-row__value">{value}</span>
    </div>
  );
}
