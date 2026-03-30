'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, TriangleAlert } from 'lucide-react';

/* ── Types ── */

type ZoneStatus = 'healthy' | 'stressed' | 'critical';

type ZoneCardExpanded = {
  id: string;
  name: string;
  status: ZoneStatus;
  subtitle: string;
  ndvi: string;
  ndviColor?: string;
  moisture: string;
  moistureColor?: string;
  trend: string;
  trendColor?: string;
  alert?: { color: string; text: string };
  collapsed?: false;
};

type ZoneCardCollapsed = {
  id: string;
  name: string;
  status: ZoneStatus;
  inlineSubtitle: string;
  collapsed: true;
};

type ZoneCard = ZoneCardExpanded | ZoneCardCollapsed;

type DetectionRow = {
  label: string;
  value: string;
  valueFont?: string;
  valueFontSize?: number;
  valueColor?: string;
  valueFontWeight?: number;
};

/* ── Status config ── */

const STATUS_CONFIG: Record<
  ZoneStatus,
  { label: string; dotColor: string; textColor: string; bg: string }
> = {
  healthy:  { label: 'Healthy',  dotColor: '#16a34a', textColor: '#16a34a', bg: '#dcfce7' },
  stressed: { label: 'Stressed', dotColor: '#f59e0b', textColor: '#f59e0b', bg: '#fef3c7' },
  critical: { label: 'Critical', dotColor: '#ef4444', textColor: '#ef4444', bg: '#fef2f2' },
};

/* ── Demo data ── */

const DEMO_ZONES: ZoneCard[] = [
  {
    id: 'z1',
    name: 'Zone NW-3',
    status: 'healthy',
    subtitle: 'Northwest quadrant · 12 cells',
    ndvi: '0.72',
    moisture: '42%',
    trend: '+0.03',
    trendColor: '#16a34a',
  },
  {
    id: 'z2',
    name: 'Zone NE-2',
    status: 'stressed',
    subtitle: 'Northeast sector · 14 cells',
    ndvi: '0.51',
    ndviColor: '#f59e0b',
    moisture: '28%',
    moistureColor: '#f59e0b',
    trend: '-0.08',
    trendColor: '#ef4444',
    alert: { color: '#f59e0b', text: 'Moisture stress detected — 3 cells below threshold' },
  },
  {
    id: 'z3',
    name: 'Zone SW-1',
    status: 'critical',
    subtitle: 'Southwest corner · 8 cells',
    ndvi: '0.38',
    ndviColor: '#ef4444',
    moisture: '18%',
    moistureColor: '#ef4444',
    trend: '-0.14',
    trendColor: '#ef4444',
    alert: { color: '#ef4444', text: 'NDVI drop >20% in 7 days — investigate immediately' },
  },
  {
    id: 'z4',
    name: 'Zone SE-4',
    status: 'healthy',
    inlineSubtitle: 'Southeast · 10 cells · NDVI 0.69',
    collapsed: true,
  },
  {
    id: 'z5',
    name: 'Zone N-5',
    status: 'healthy',
    inlineSubtitle: 'North strip · 16 cells · NDVI 0.74',
    collapsed: true,
  },
  {
    id: 'z6',
    name: 'Zone S-6',
    status: 'healthy',
    inlineSubtitle: 'South edge · 12 cells · NDVI 0.66',
    collapsed: true,
  },
];

const DEMO_DETECTION: DetectionRow[] = [
  { label: 'Algorithm',       value: 'DBSCAN clustering' },
  { label: 'Grid resolution', value: '10m × 10m cells' },
  { label: 'Probe cells',     value: '72 total' },
  { label: 'Last computed',   value: 'Mar 27, 11:34 AM' },
  {
    label: 'Classification',
    value: '4 new · 1 persistent · 1 recovering',
    valueFont: 'Sintony, sans-serif',
    valueFontSize: 10,
    valueColor: '#8a8f98',
    valueFontWeight: 400,
  },
];

/* ── Component ── */

export function ZonesTab() {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    DEMO_ZONES.forEach((z) => {
      if (!z.collapsed) initial.add(z.id);
    });
    return initial;
  });

  const toggleZone = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="zt">
      {/* ── 1. Title Section ── */}
      <div className="zt__title-block">
        <h2 className="zt__field-name">Zone Overview</h2>
        <p className="zt__field-sub">6 active zones &middot; 72 probe cells &middot; Quarter SE 25</p>
      </div>

      {/* ── 2. Zone Summary ── */}
      <div className="zt__overview-card">
        <div className="zt__section-label">ZONE SUMMARY</div>
        <div className="zt__summary-row">
          <div className="zt__stat-block">
            <span className="zt__stat-num">6</span>
            <span className="zt__stat-lbl">Total</span>
          </div>
          <div className="zt__stat-block">
            <span className="zt__stat-num" style={{ color: '#16a34a' }}>4</span>
            <span className="zt__stat-lbl">Healthy</span>
          </div>
          <div className="zt__stat-block">
            <span className="zt__stat-num" style={{ color: '#f59e0b' }}>1</span>
            <span className="zt__stat-lbl">Stressed</span>
          </div>
          <div className="zt__stat-block">
            <span className="zt__stat-num" style={{ color: '#ef4444' }}>1</span>
            <span className="zt__stat-lbl">Critical</span>
          </div>
        </div>
      </div>

      {/* ── 3. Detected Zones ── */}
      <div className="zt__zone-list">
        <div className="zt__section-label">DETECTED ZONES</div>
        {DEMO_ZONES.map((zone) => {
          const expanded = expandedIds.has(zone.id);
          const sc = STATUS_CONFIG[zone.status];

          if (zone.collapsed) {
            return (
              <div key={zone.id} className="zt__card zt__card--collapsed">
                <div className="zt__card-collapsed-left">
                  <span className="zt__card-collapsed-name">{zone.name}</span>
                  <span className="zt__card-collapsed-sub">{zone.inlineSubtitle}</span>
                </div>
                <span
                  className="zt__status-badge"
                  style={{ background: sc.bg, color: sc.textColor }}
                >
                  <span className="zt__status-dot" style={{ background: sc.dotColor }} />
                  {sc.label}
                </span>
              </div>
            );
          }

          return (
            <div key={zone.id} className="zt__card">
              <div className="zt__card-row1">
                <span className="zt__card-name">{zone.name}</span>
                <span
                  className="zt__status-badge"
                  style={{ background: sc.bg, color: sc.textColor }}
                >
                  <span className="zt__status-dot" style={{ background: sc.dotColor }} />
                  {sc.label}
                </span>
              </div>

              <p className="zt__card-subtitle">{zone.subtitle}</p>

              <div className="zt__card-metrics">
                <div className="zt__metric-box">
                  <span
                    className="zt__metric-val"
                    style={zone.ndviColor ? { color: zone.ndviColor } : undefined}
                  >
                    {zone.ndvi}
                  </span>
                  <span className="zt__metric-lbl">NDVI</span>
                </div>
                <div className="zt__metric-box">
                  <span
                    className="zt__metric-val"
                    style={zone.moistureColor ? { color: zone.moistureColor } : undefined}
                  >
                    {zone.moisture}
                  </span>
                  <span className="zt__metric-lbl">Moisture</span>
                </div>
                <div className="zt__metric-box">
                  <span
                    className="zt__metric-val"
                    style={zone.trendColor ? { color: zone.trendColor } : undefined}
                  >
                    {zone.trend}
                  </span>
                  <span className="zt__metric-lbl">Trend</span>
                </div>
              </div>

              {zone.alert && (
                <div
                  className="zt__card-alert"
                  style={{ color: zone.alert.color }}
                >
                  <TriangleAlert size={12} color={zone.alert.color} />
                  <span className="zt__card-alert-text">{zone.alert.text}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── 4. Detection Method ── */}
      <div className="zt__detection">
        <div className="zt__section-label">DETECTION METHOD</div>
        {DEMO_DETECTION.map((row) => (
          <div key={row.label} className="zt__detection-row">
            <span className="zt__detection-key">{row.label}</span>
            <span
              className="zt__detection-val"
              style={row.valueFont || row.valueFontSize || row.valueColor || row.valueFontWeight ? {
                fontFamily: row.valueFont,
                fontSize: row.valueFontSize,
                color: row.valueColor,
                fontWeight: row.valueFontWeight,
              } : undefined}
            >
              {row.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
