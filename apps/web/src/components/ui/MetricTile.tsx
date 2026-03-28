'use client';

interface MetricTileProps {
  value: React.ReactNode;
  label: string;
  className?: string;
  valueColor?: string;
}

export function MetricTile({ value, label, className, valueColor }: MetricTileProps) {
  return (
    <div className={`metric-tile${className ? ` ${className}` : ''}`}>
      <div className="metric-tile__value" style={valueColor ? { color: valueColor } : undefined}>{value}</div>
      <div className="metric-tile__label">{label}</div>
    </div>
  );
}
