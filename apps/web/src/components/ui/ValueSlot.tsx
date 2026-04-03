'use client';

import React, { useEffect, useRef, useState } from 'react';

/**
 * ValueSlot — wraps a data cell value and applies onboarding animations.
 *
 * When `children` is a placeholder ("—" or empty), renders a gentle pulse line.
 * When `children` transitions from placeholder → real value, plays the
 * value-arrived translateY(4px) entrance.
 *
 * Zero-config: drop in around any `.panel__data-cell-value` content.
 */
export function ValueSlot({
  children,
  className,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const isEmpty = isPlaceholder(children);
  const wasEmptyRef = useRef(isEmpty);
  const [showArrival, setShowArrival] = useState(false);

  useEffect(() => {
    if (wasEmptyRef.current && !isEmpty) {
      setShowArrival(true);
      const t = setTimeout(() => setShowArrival(false), 300);
      return () => clearTimeout(t);
    }
    wasEmptyRef.current = isEmpty;
  }, [isEmpty]);

  const animClass = isEmpty
    ? 'value-placeholder'
    : showArrival
      ? 'value-arrived'
      : '';

  return (
    <span className={`${className ?? ''}${animClass ? ` ${animClass}` : ''}`} style={style}>
      {children}
    </span>
  );
}

function isPlaceholder(children: React.ReactNode): boolean {
  if (children == null || children === '') return true;
  if (typeof children === 'string') return children.trim() === '—' || children.trim() === '';
  return false;
}
