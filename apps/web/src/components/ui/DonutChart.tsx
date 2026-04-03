'use client';

import React from 'react';

interface DonutChartProps {
  value: number;
  label?: string;
  caption?: string;
  size?: number;
  color?: string;
  className?: string;
}

export function DonutChart({
  value,
  label,
  caption,
  size = 150,
  color = '#16a34a',
  className,
}: DonutChartProps) {
  const strokeWidth = size * 0.035;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - value);
  const percent = Math.round(value * 100);

  return (
    <div className={`donut-chart${className ? ` ${className}` : ''}`} style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--border-light, #ebebeb)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <text
          x={size / 2}
          y={caption ? size / 2 - 12 : size / 2}
          textAnchor="middle"
          dominantBaseline="central"
          className="donut-chart__label"
        >
          {label ?? `${percent}%`}
        </text>
        {caption && (
          <text
            x={size / 2}
            y={size / 2 + 20}
            textAnchor="middle"
            dominantBaseline="central"
            className="donut-chart__caption"
          >
            {caption}
          </text>
        )}
      </svg>
    </div>
  );
}
