'use client';

interface BadgeProps {
  variant: 'positive' | 'warning' | 'danger' | 'neutral';
  children: React.ReactNode;
  dot?: boolean;
  className?: string;
}

export function Badge({ variant, children, dot, className }: BadgeProps) {
  return (
    <span className={`badge badge--${variant}${className ? ` ${className}` : ''}`}>
      {dot && <span className="badge__dot" />}
      {children}
    </span>
  );
}
