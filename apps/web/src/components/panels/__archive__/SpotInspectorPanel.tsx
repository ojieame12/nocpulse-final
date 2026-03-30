'use client';

import {
  MapPin,
  AlertTriangle,
  Circle,
  Shovel,
  Camera,
  Crosshair,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { PanelHeader } from '../ui/PanelHeader';
import { useAppTheme } from '../layout/WorkspaceShell';

interface SpotInspectorPanelProps {
  onClose?: () => void;
}

export function SpotInspectorPanel({ onClose }: SpotInspectorPanelProps) {
  const theme = useAppTheme();
  const isDark = theme === 'dark';
  const alertBg = isDark ? 'rgba(239, 68, 68, 0.08)' : '#fef2f2';
  const zoneBadgeBg = isDark ? 'rgba(22, 163, 74, 0.12)' : '#e6f4ea';
  const textBody = isDark ? 'rgba(255, 255, 255, 0.5)' : '#374151';

  return (
    <div className="panel">
      <PanelHeader title="SPOT INSPECTOR" onClose={onClose} />
      <div className="panel__body" style={{ padding: '16px 32px' }}>
        {/* Zone badge + Title */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span
            className="badge badge--positive"
            style={{
              alignSelf: 'flex-start',
              borderRadius: '20px',
              padding: '4px 10px',
              background: zoneBadgeBg,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <MapPin size={12} />
            Zone NW-3
          </span>
          <h2
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '24px',
              fontWeight: 400,
              margin: 0,
            }}
          >
            North Quarter A
          </h2>
        </div>

        {/* COORDINATES (styled section) */}
        <div className="styled-section">
          <span className="styled-section__header">COORDINATES</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '46px' }}>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '16px',
                fontWeight: 700,
              }}
            >
              51.0452&deg;N
            </span>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '16px',
                fontWeight: 700,
              }}
            >
              110.6792&deg;W
            </span>
          </div>
          <div className="filter-pills" style={{ width: 'fit-content' }}>
            <button className="filter-pill">Copy</button>
            <button className="filter-pill">Google Maps</button>
            <button className="filter-pill">Apple Maps</button>
          </div>
        </div>

        {/* WHAT CHANGED (styled section) */}
        <div className="styled-section">
          <span className="styled-section__header">WHAT CHANGED</span>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 10px',
              borderRadius: '6px',
              background: alertBg,
            }}
          >
            <AlertTriangle size={14} style={{ color: 'var(--status-danger)' }} />
            <span style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--text-primary)' }}>
              NDVI dropped below threshold
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
            <div style={{ textAlign: 'center' }}>
              <span
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '9px',
                  fontWeight: 700,
                  letterSpacing: '1px',
                  textTransform: 'uppercase',
                  color: 'var(--text-muted)',
                  display: 'block',
                }}
              >
                START
              </span>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '16px',
                  fontWeight: 700,
                }}
              >
                0.72
              </div>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--text-muted)' }}>
                Feb 28
              </span>
            </div>
            <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '9px',
                  fontWeight: 700,
                  letterSpacing: '1px',
                  textTransform: 'uppercase',
                  color: 'var(--text-muted)',
                  display: 'block',
                }}
              >
                DELTA
              </span>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '16px',
                  fontWeight: 700,
                  color: 'var(--status-danger)',
                }}
              >
                -0.12
              </div>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--text-muted)' }}>
                16.7%
              </span>
            </div>
            <div style={{ textAlign: 'center' }}>
              <span
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '9px',
                  fontWeight: 700,
                  letterSpacing: '1px',
                  textTransform: 'uppercase',
                  color: 'var(--text-muted)',
                  display: 'block',
                }}
              >
                END
              </span>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '16px',
                  fontWeight: 700,
                }}
              >
                0.60
              </div>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--text-muted)' }}>
                Mar 21
              </span>
            </div>
          </div>
        </div>

        {/* WHY IT MATTERS (styled section) */}
        <div className="styled-section" style={{ gap: '8px' }}>
          <span className="styled-section__header">WHY IT MATTERS</span>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '12px',
              lineHeight: 1.5,
              color: textBody,
              margin: 0,
            }}
          >
            This zone shows a sustained NDVI decline over three consecutive captures, dropping below the 0.65 stress threshold. The pattern is consistent with early-stage moisture stress or possible pest pressure. Without intervention, yield loss in this zone could reach 12&ndash;18% based on historical correlations.
          </p>
        </div>

        {/* WHAT TO DO (styled section) */}
        <div className="styled-section">
          <span className="styled-section__header">WHAT TO DO</span>
          <div className="action-item">
            <div className="action-item__icon-wrap">
              <Circle size={14} />
            </div>
            <div className="action-item__content">
              Scout the zone on foot — check for wilting, discoloration, or pest damage near row markers
            </div>
          </div>
          <div className="action-item">
            <div className="action-item__icon-wrap">
              <Shovel size={14} />
            </div>
            <div className="action-item__content">
              Pull a soil moisture sample at 15cm depth and compare to last reading.
            </div>
          </div>
          <div className="action-item">
            <div className="action-item__icon-wrap">
              <Camera size={14} />
            </div>
            <div className="action-item__content">
              Photograph affected plants and tag location for the next drone pass
            </div>
          </div>
        </div>

        {/* Bottom actions */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '34px' }}>
          <Button variant="panel-primary" icon={Crosshair}>
            Start Inspection
          </Button>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'var(--font-body)',
              fontSize: '13px',
              color: 'var(--text-secondary)',
              textAlign: 'center',
              width: '100%',
              padding: '0',
            }}
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
