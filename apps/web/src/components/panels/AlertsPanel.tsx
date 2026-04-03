'use client';

import React, { useEffect, useState } from 'react';
import { BellOff, X, AlertTriangle, Droplets, Thermometer, Bug, Wind, TrendingDown, Zap, Clock } from 'lucide-react';
import { Card, Lbl, LblM, Big, Sub, Mono } from './fieldDetailCardPrimitives';
import { PanelEmptyState } from '../ui/PanelEmptyState';

/* ── Types ── */

export interface AlertItem {
  id: string;
  title: string;
  severity: 'critical' | 'warning' | 'low' | 'medium';
  subtitle: string;
  time: string;
  trackedZoneIds: readonly string[];
  acknowledgedAt?: string | null;
}

export interface ResolvedAlertItem {
  id: string;
  title: string;
  subtitle: string;
  time: string;
  trackedZoneIds: readonly string[];
  status?: 'resolved' | 'dismissed';
}

export interface AlertsPanelProps {
  activeAlerts: AlertItem[];
  resolvedAlerts: ResolvedAlertItem[];
  activeCount: number;
  criticalCount: number;
  weekCount: number;
  contextLabel?: string;
  emptyStateTitle?: string;
  emptyStateDescription?: string;
  focusedZoneId?: string | null;
  demoFallback?: boolean;
  actionsEnabled?: boolean;
  onAlertSelect?: (zoneId: string | null) => void;
  onAlertsChanged?: (() => void | Promise<void>) | null;
  onClose?: () => void;
}

/* ── Demo fallback when backend has no alerts ── */

const DEMO_ALERTS: AlertItem[] = [
  { id: 'demo-1', title: 'Root Zone Moisture Below Threshold', severity: 'critical', subtitle: 'NW quadrant drying faster than canola stress threshold. Root zone at 18% — action within 48h.', time: '2h ago', trackedZoneIds: [] },
  { id: 'demo-2', title: 'Frost Risk — Overnight Low −3°C', severity: 'warning', subtitle: 'Forecast models show sub-zero overnight temps. East-facing slopes most exposed. Monitor canopy damage.', time: '6h ago', trackedZoneIds: [] },
  { id: 'demo-3', title: 'Crop-Health Decline Detected', severity: 'warning', subtitle: 'Crop-health index dropped 4.2% since last pass. Concentrated in cells R12-C04 through R12-C07.', time: '1d ago', trackedZoneIds: [] },
  { id: 'demo-4', title: 'Blackleg Disease Pressure Rising', severity: 'medium', subtitle: 'Warm + humid conditions favorable for Leptosphaeria. Risk elevated in dense canopy zones.', time: '2d ago', trackedZoneIds: [] },
];
const DEMO_RESOLVED: ResolvedAlertItem[] = [
  { id: 'demo-r1', title: 'Irrigation Schedule Completed', subtitle: 'All pivot zones received target application depth.', time: '5h ago', trackedZoneIds: [] },
  { id: 'demo-r2', title: 'SAR Data Gap Resolved', subtitle: 'Sentinel-1 pass restored coverage after 4-day gap.', time: '1d ago', trackedZoneIds: [] },
];

/* ── Helpers ── */

type FilterKey = 'all' | 'critical' | 'warning' | 'resolved';

function sevColor(s: string): string {
  if (s === 'critical') return '#ef4444';
  if (s === 'warning' || s === 'medium') return '#f59e0b';
  if (s === 'low') return '#16a34a';
  return 'var(--text-muted)';
}

function sevBg(s: string): string {
  if (s === 'critical') return 'rgba(239, 68, 68, 0.12)';
  if (s === 'warning' || s === 'medium') return 'rgba(245, 158, 11, 0.12)';
  if (s === 'low') return 'rgba(22, 163, 74, 0.12)';
  return 'rgba(148, 163, 184, 0.10)';
}

function sevIcon(title: string) {
  const t = title.toLowerCase();
  if (t.includes('moisture') || t.includes('drought') || t.includes('water') || t.includes('root zone')) return Droplets;
  if (t.includes('frost') || t.includes('temp') || t.includes('cold')) return Thermometer;
  if (t.includes('disease') || t.includes('pest') || t.includes('blight') || t.includes('blackleg')) return Bug;
  if (t.includes('wind') || t.includes('storm')) return Wind;
  if (t.includes('ndvi') || t.includes('decline') || t.includes('drop')) return TrendingDown;
  return AlertTriangle;
}

function urgencyLabel(s: string): string {
  if (s === 'critical') return 'Action within 24h';
  if (s === 'warning' || s === 'medium') return 'Monitor closely';
  if (s === 'low') return 'Watch';
  return '';
}

/* ── Component ── */

export function AlertsPanel({
  activeAlerts: rawActive,
  resolvedAlerts: rawResolved,
  activeCount: _rawActiveCount,
  criticalCount: _rawCriticalCount,
  weekCount: _rawWeekCount,
  contextLabel,
  emptyStateTitle,
  emptyStateDescription,
  focusedZoneId,
  demoFallback = false,
  actionsEnabled = true,
  onAlertSelect,
  onAlertsChanged,
  onClose,
}: AlertsPanelProps) {
  const useDemoData =
    demoFallback &&
    rawActive.length === 0 &&
    rawResolved.length === 0 &&
    !emptyStateTitle;
  const activeAlerts = useDemoData ? DEMO_ALERTS : rawActive;
  const resolvedAlerts = useDemoData ? DEMO_RESOLVED : rawResolved;
  const [filter, setFilter] = useState<FilterKey>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeItems, setActiveItems] = useState<AlertItem[]>(activeAlerts);
  const [resolvedItemsState, setResolvedItemsState] =
    useState<ResolvedAlertItem[]>(resolvedAlerts);
  const [pendingAlertId, setPendingAlertId] = useState<string | null>(null);

  useEffect(() => {
    setActiveItems(activeAlerts);
  }, [activeAlerts]);

  useEffect(() => {
    setResolvedItemsState(resolvedAlerts);
  }, [resolvedAlerts]);

  const activeCount = useDemoData ? DEMO_ALERTS.length : activeItems.length;
  const criticalCount = useDemoData
    ? DEMO_ALERTS.filter((alert) => alert.severity === 'critical').length
    : activeItems.filter((alert) => alert.severity === 'critical').length;
  const weekCount = useDemoData
    ? DEMO_ALERTS.length + DEMO_RESOLVED.length
    : activeItems.length + resolvedItemsState.length;

  const isEmpty = activeItems.length === 0 && resolvedItemsState.length === 0;

  const filtered = filter === 'critical'
    ? activeItems.filter(a => a.severity === 'critical')
    : filter === 'warning'
      ? activeItems.filter(a => a.severity === 'warning' || a.severity === 'medium')
      : filter === 'resolved' ? [] : activeItems;

  const showResolved = filter === 'all' || filter === 'resolved';

  async function mutateAlert(alertId: string, action: 'acknowledge' | 'dismiss' | 'resolve') {
    if (!actionsEnabled || useDemoData) {
      return;
    }

    setPendingAlertId(alertId);

    try {
      const response = await fetch(`/api/alerts/${alertId}`, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({ action }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          typeof payload?.error === 'string' ? payload.error : 'Alert update failed.',
        );
      }

      if (action === 'acknowledge') {
        setActiveItems((items) =>
          items.map((item) =>
            item.id === alertId
              ? { ...item, acknowledgedAt: new Date().toISOString() }
            : item,
          ),
        );
        void onAlertsChanged?.();
        return;
      }

      const clearedAlert = activeItems.find((item) => item.id === alertId) ?? null;
      setActiveItems((items) => items.filter((item) => item.id !== alertId));

      if (clearedAlert) {
        setResolvedItemsState((items) => [
          {
            id: clearedAlert.id,
            title: clearedAlert.title,
            subtitle: clearedAlert.subtitle,
            time: 'just now',
            trackedZoneIds: clearedAlert.trackedZoneIds,
            status: action === 'dismiss' ? 'dismissed' : 'resolved',
          },
          ...items,
        ]);
      }

      void onAlertsChanged?.();
    } catch (error) {
      console.error('[alerts-panel] failed to update alert', error);
    } finally {
      setPendingAlertId((current) => (current === alertId ? null : current));
    }
  }

  return (
    <div className="fdp" style={{ position: 'absolute', top: 'var(--space-lg)', right: 'var(--space-lg)', bottom: 'var(--space-xl)' }}>
      {/* ── Header ── */}
      <div className="fdp__header">
        <div className="fdp__header-top">
          <div>
            <h1 className="fdp__field-name">Alerts</h1>
            <p className="fdp__field-meta">
              {isEmpty ? 'No active alerts' : `${activeCount} active · ${criticalCount} critical · ${weekCount} this week`}
            </p>
          </div>
          {onClose && (
            <button type="button" onClick={onClose} style={{
              background: 'var(--surface-white)', border: '1px solid var(--border-light)', borderRadius: '50%',
              width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'var(--text-muted)', flexShrink: 0, transition: 'all 200ms cubic-bezier(.2,.8,.2,1)',
            }}><X size={14} /></button>
          )}
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '6px 16px 16px',
        display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, alignContent: 'start',
      }}>
        {isEmpty ? (
          <div style={{ gridColumn: '1 / -1' }}>
            <PanelEmptyState
              icon={BellOff}
              title={emptyStateTitle ?? 'No active alerts'}
              description={
                emptyStateDescription ??
                'Field alerts will appear here when detections, weather risk, or agronomic thresholds trigger.'
              }
            />
          </div>
        ) : (
          <>
            {/* ── Vitals ── */}
            <Card>
              <LblM>Active</LblM>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <Big size={28} color={activeCount > 0 ? '#f59e0b' : undefined}>{activeCount}</Big>
                <Sub>alerts</Sub>
              </div>
            </Card>
            <Card>
              <LblM>Critical</LblM>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <Big size={28} color={criticalCount > 0 ? '#ef4444' : undefined}>{criticalCount}</Big>
                <Sub>need action</Sub>
              </div>
            </Card>
            <Card>
              <LblM>This Week</LblM>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <Big size={28}>{weekCount}</Big>
                <Sub>total</Sub>
              </div>
            </Card>
            <Card>
              <LblM>Resolved</LblM>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <Big size={28} color={resolvedItemsState.length > 0 ? '#16a34a' : undefined}>{resolvedItemsState.length}</Big>
                <Sub>cleared</Sub>
              </div>
            </Card>

            {/* ── Filter pills ── */}
            <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 4, padding: '4px 0' }}>
              {(['all', 'critical', 'warning', 'resolved'] as const).map(key => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilter(key)}
                  style={{
                    padding: '5px 12px', borderRadius: 'var(--radius-full)', border: 'none',
                    fontFamily: 'var(--font-body)', fontSize: 10, fontWeight: filter === key ? 700 : 400,
                    color: filter === key ? 'var(--text-primary)' : 'var(--text-muted)',
                    background: filter === key ? 'var(--surface-white)' : 'transparent',
                    boxShadow: filter === key ? '0 1px 3px rgba(0,0,0,0.07)' : 'none',
                    cursor: 'pointer', transition: 'all 200ms cubic-bezier(.2,.8,.2,1)',
                    textTransform: 'capitalize',
                  }}
                >
                  {key}
                </button>
              ))}
            </div>

            {contextLabel && (
              <Card span={-1} className="fdp-card--muted"><Sub>{contextLabel}</Sub></Card>
            )}

            {/* ── Active alerts ── */}
            {filtered.length > 0 && (
              <>
                <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <LblM>ACTIVE</LblM>
                  <Mono>{filtered.length} alerts</Mono>
                </div>
                {filtered.map(alert => {
                  const color = sevColor(alert.severity);
                  const Icon = sevIcon(alert.title);
                  const isFocused = focusedZoneId != null && alert.trackedZoneIds.includes(focusedZoneId);
                  const isExpanded = expandedId === alert.id;

                  return (
                    <Card
                      key={alert.id}
                      span={-1}
                      accent={color}
                      onClick={() => setExpandedId(isExpanded ? null : alert.id)}
                      style={isFocused ? { boxShadow: `inset 0 0 0 1px ${color}` } : undefined}
                    >
                      {/* Title row */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: 8,
                          background: sevBg(alert.severity),
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        }}>
                          <Icon size={16} style={{ color }} />
                        </div>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                            {alert.title}
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Clock size={10} style={{ color: 'var(--text-muted)' }} />
                            <Mono>{alert.time}</Mono>
                          </div>
                        </div>
                        <span className="fdp-mono" style={{
                          fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                          textTransform: 'uppercase', flexShrink: 0,
                          background: sevBg(alert.severity), color,
                        }}>{alert.severity}</span>
                        {alert.acknowledgedAt ? (
                          <span className="fdp-mono" style={{
                            fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                            textTransform: 'uppercase', flexShrink: 0,
                            background: 'rgba(22, 163, 74, 0.12)', color: '#16a34a',
                          }}>reviewed</span>
                        ) : null}
                      </div>

                      {/* Detail section */}
                      <Sub>{alert.subtitle}</Sub>

                      {/* Urgency + zone chips */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          fontSize: 9, fontWeight: 700, color,
                        }}>
                          <Zap size={10} />
                          {urgencyLabel(alert.severity)}
                        </span>
                        {alert.trackedZoneIds.length > 0 && (
                          <span className="fdp__chip" style={{ fontSize: 9, cursor: 'pointer' }}
                            onClick={(e) => { e.stopPropagation(); onAlertSelect?.(isFocused ? null : alert.trackedZoneIds[0] ?? null); }}>
                            {alert.trackedZoneIds.length} zone{alert.trackedZoneIds.length > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>

                      {actionsEnabled && !useDemoData ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            className="fdp__chip"
                            disabled={pendingAlertId === alert.id || !!alert.acknowledgedAt}
                            onClick={(event) => {
                              event.stopPropagation();
                              void mutateAlert(alert.id, 'acknowledge');
                            }}
                            style={{
                              fontSize: 9,
                              cursor:
                                pendingAlertId === alert.id || !!alert.acknowledgedAt
                                  ? 'default'
                                  : 'pointer',
                              opacity: pendingAlertId === alert.id ? 0.6 : 1,
                            }}
                          >
                            {alert.acknowledgedAt
                              ? 'Reviewed'
                              : pendingAlertId === alert.id
                                ? 'Saving…'
                                : 'Mark reviewed'}
                          </button>
                          <button
                            type="button"
                            className="fdp__chip"
                            disabled={pendingAlertId === alert.id}
                            onClick={(event) => {
                              event.stopPropagation();
                              void mutateAlert(alert.id, 'resolve');
                            }}
                            style={{
                              fontSize: 9,
                              cursor: pendingAlertId === alert.id ? 'default' : 'pointer',
                              opacity: pendingAlertId === alert.id ? 0.6 : 1,
                            }}
                          >
                            Resolve
                          </button>
                          <button
                            type="button"
                            className="fdp__chip"
                            disabled={pendingAlertId === alert.id}
                            onClick={(event) => {
                              event.stopPropagation();
                              void mutateAlert(alert.id, 'dismiss');
                            }}
                            style={{
                              fontSize: 9,
                              cursor: pendingAlertId === alert.id ? 'default' : 'pointer',
                              opacity: pendingAlertId === alert.id ? 0.6 : 1,
                            }}
                          >
                            Dismiss
                          </button>
                        </div>
                      ) : null}

                      {/* Expanded detail */}
                      {isExpanded && (
                        <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: 10, marginTop: 4, display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Sub>Severity</Sub><Mono color={color}>{alert.severity}</Mono>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Sub>Detected</Sub><Mono>{alert.time}</Mono>
                          </div>
                          {alert.trackedZoneIds.length > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <Sub>Linked zones</Sub><Mono>{alert.trackedZoneIds.join(', ')}</Mono>
                            </div>
                          )}
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Sub>Response</Sub><Mono>{urgencyLabel(alert.severity)}</Mono>
                          </div>
                        </div>
                      )}
                    </Card>
                  );
                })}
              </>
            )}

            {filtered.length === 0 && filter !== 'resolved' && (
              <Card span={-1} className="fdp-card--muted">
                <Sub>No {filter} alerts active right now.</Sub>
              </Card>
            )}

            {/* ── Resolved ── */}
            {showResolved && resolvedItemsState.length > 0 && (
              <>
                <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                  <LblM>RESOLVED</LblM>
                  <Mono>{resolvedItemsState.length} cleared</Mono>
                </div>
                {resolvedItemsState.map(alert => (
                  <Card key={alert.id} span={-1} className="fdp-card--muted">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', opacity: 0.6 }}>
                          {alert.title}
                        </span>
                        <Sub>{alert.subtitle}</Sub>
                      </div>
                      <span className="fdp-mono" style={{
                        fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                        textTransform: 'uppercase', flexShrink: 0,
                        background: alert.status === 'dismissed' ? 'rgba(148, 163, 184, 0.12)' : 'rgba(22, 163, 74, 0.12)',
                        color: alert.status === 'dismissed' ? 'var(--text-muted)' : '#16a34a',
                      }}>{alert.status === 'dismissed' ? 'dismissed' : 'resolved'}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Clock size={10} style={{ color: 'var(--text-muted)' }} />
                      <Mono>{alert.time}</Mono>
                    </div>
                  </Card>
                ))}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
