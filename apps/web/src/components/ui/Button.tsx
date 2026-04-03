'use client';

import React from 'react';

import { type LucideIcon } from 'lucide-react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'icon' | 'panel-primary' | 'panel-secondary' | 'danger';

interface ButtonProps {
  variant?: ButtonVariant;
  icon?: LucideIcon;
  children?: React.ReactNode;
  onClick?: () => void;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
}

function getIconSize(variant: ButtonVariant) {
  if (variant === 'icon') return 18;
  if (variant === 'panel-primary' || variant === 'panel-secondary') return 16;
  return 16;
}

export function Button({
  variant = 'primary',
  icon: Icon,
  children,
  onClick,
  className,
  type = 'button',
  disabled,
}: ButtonProps) {
  const iconSize = getIconSize(variant);

  return (
    <button
      type={type}
      className={`btn btn--${variant}${className ? ` ${className}` : ''}`}
      onClick={onClick}
      disabled={disabled}
    >
      {Icon && <Icon size={iconSize} />}
      {children}
    </button>
  );
}
