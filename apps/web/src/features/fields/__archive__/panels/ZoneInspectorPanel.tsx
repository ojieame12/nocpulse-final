'use client';

import {
  AlertTriangle,
  Info,
  AlertCircle,
  CheckCircle2,
  Circle,
} from 'lucide-react';
import { Badge, PanelHeader } from '../../../components/ui';

/* ── Types ── */

type CellStatus = 'healthy' | 'stress' | 'critical';
type FindingSeverity = 'moderate' | 'warning' | 'info';
type ActionPriority = 'urgent' | 'active' | 'normal';

interface CellEntry {
  id: string;
  status: CellStatus;
}

interface Finding {
  id: string;
  title: string;
  subtitle: string;
  severity: FindingSeverity;
}

interface ActionItem {
  id: string;
  label: string;
  priority: ActionPriority;
  done: boolean;
}

/* ── Static data ── */

const CELLS: CellEntry[] = [
  { id: 'C11', status: 'stress' },
  { id: 'C12', status: 'stress' },
  { id: 'D6', status: 'healthy' },
  { id: 'D7', status: 'healthy' },
  { id: 'C07', status: 'critical' },
  { id: 'C08', status: 'stress' },
  { id: 'D8', status: 'healthy' },
  { id: 'D9', status: 'healthy' },
  { id: 'C04', status: 'critical' },
  { id: 'C05', status: 'stress' },
  { id: 'D10', status: 'healthy' },
  { id: 'D11', status: 'stress' },
  { id: 'E3', status: 'healthy' },
  { id: 'E4', status: 'healthy' },
  { id: 'E5', status: 'stress' },
  { id: 'E6', status: 'healthy' },
  { id: 'C09', status: 'stress' },
  { id: 'C10', status: 'healthy' },
];

const FINDINGS: Finding[] = [
  {
    id: '1',
    title: 'Persistent dry stress detected',
    subtitle: 'Moisture levels below optimal for 3+ weeks',
    severity: 'moderate',
  },
  {
    id: '2',
    title: 'Below threshold for 5 readings',
    subtitle: 'Consecutive readings indicate declining trend',
    severity: 'warning',
  },
  {
    id: '3',
    title: 'Soil compaction risk in C04, C11',
    subtitle: 'Drainage patterns suggest compaction layer',
    severity: 'info',
  },
];

const ACTIONS: ActionItem[] = [
  { id: '1', label: 'Increase irrigation NW quadrant', priority: 'urgent', done: false },
  { id: '2', label: 'Schedule soil probe inspection', priority: 'active', done: false },
  { id: '3', label: 'Review drainage patterns', priority: 'normal', done: false },
];

const TREND_WEEKS: { label: string; value: number; color: string }[] = [
  { label: 'W1', value: 72, color: 'var(--status-positive)' },
  { label: 'W2', value: 68, color: 'var(--status-positive)' },
  { label: 'W3', value: 65, color: 'var(--status-positive)' },
  { label: 'W4', value: 55, color: 'var(--status-warning)' },
  { label: 'W5', value: 50, color: 'var(--status-warning)' },
  { label: 'W6', value: 48, color: '#f97316' },
  { label: 'W7', value: 52, color: 'var(--status-warning)' },
  { label: 'W8', value: 45, color: '#f97316' },
  { label: 'W9', value: 42, color: '#f97316' },
  { label: 'W10', value: 50, color: 'var(--status-warning)' },
  { label: 'W11', value: 47, color: '#f97316' },
  { label: 'W12', value: 44, color: '#f97316' },
];

/* ── Sub-components ── */

function CellBadge({ cell }: { cell: CellEntry }) {
  return (
    <span className={`zone-inspector__cell zone-inspector__cell--${cell.status}`}>
      {cell.id}
    </span>
  );
}

function FindingIcon({ severity }: { severity: FindingSeverity }) {
  if (severity === 'moderate') return <AlertTriangle size={16} className="zone-inspector__finding-icon zone-inspector__finding-icon--moderate" />;
  if (severity === 'warning') return <AlertCircle size={16} className="zone-inspector__finding-icon zone-inspector__finding-icon--warning" />;
  return <Info size={16} className="zone-inspector__finding-icon zone-inspector__finding-icon--info" />;
}

function FindingCard({ finding }: { finding: Finding }) {
  const badgeVariant = finding.severity === 'moderate'
    ? 'warning'
    : finding.severity === 'warning'
      ? 'warning'
      : 'neutral';

  const badgeLabel = finding.severity === 'moderate'
    ? 'Moderate'
    : finding.severity === 'warning'
      ? 'Warning'
      : 'Info';

  return (
    <div className="zone-inspector__finding">
      <div className="zone-inspector__finding-top">
        <FindingIcon severity={finding.severity} />
        <span className="zone-inspector__finding-title">{finding.title}</span>
        <Badge variant={badgeVariant}>{badgeLabel}</Badge>
      </div>
      <span className="zone-inspector__finding-sub">{finding.subtitle}</span>
    </div>
  );
}

function ActionRow({ action }: { action: ActionItem }) {
  const priorityClass = `zone-inspector__priority zone-inspector__priority--${action.priority}`;
  const priorityLabel = action.priority === 'urgent'
    ? 'Urgent'
    : action.priority === 'active'
      ? 'Active'
      : 'Normal';

  return (
    <div className="zone-inspector__action">
      {action.done
        ? <CheckCircle2 size={16} className="zone-inspector__action-check zone-inspector__action-check--done" />
        : <Circle size={16} className="zone-inspector__action-check" />
      }
      <span className="zone-inspector__action-label">{action.label}</span>
      <span className={priorityClass}>{priorityLabel}</span>
    </div>
  );
}

/* ── Main panel ── */

interface ZoneInspectorPanelProps {
  onClose?: () => void;
  onMaximize?: () => void;
}

export function ZoneInspectorPanel({ onClose, onMaximize }: ZoneInspectorPanelProps) {
  const maxBar = Math.max(...TREND_WEEKS.map((w) => w.value));

  return (
    <div className="zone-inspector">
      <PanelHeader title="ZONE INSPECTOR" onClose={onClose} onMaximize={onMaximize} />

      <div className="panel__body zone-inspector__body">
        {/* ── Zone ID + Badge ── */}
        <div className="zone-inspector__identity">
          <div className="zone-inspector__identity-row">
            <span className="zone-inspector__zone-id">NW-3</span>
            <span className="zone-inspector__stress-badge">Moisture Stress</span>
          </div>
          <span className="zone-inspector__identity-sub">Est. est. R07 cell</span>
        </div>

        {/* ── Severity ── */}
        <div className="zone-inspector__section">
          <span className="zone-inspector__section-label">SEVERITY</span>
          <span className="zone-inspector__severity-value">Moderate</span>

          <div className="zone-inspector__severity-bar">
            <div className="zone-inspector__severity-track">
              <div className="zone-inspector__severity-seg zone-inspector__severity-seg--low" />
              <div className="zone-inspector__severity-seg zone-inspector__severity-seg--mod" />
              <div className="zone-inspector__severity-seg zone-inspector__severity-seg--high" />
            </div>
            <div className="zone-inspector__severity-marker" style={{ left: '50%' }} />
          </div>
          <div className="zone-inspector__severity-labels">
            <span className="zone-inspector__severity-label zone-inspector__severity-label--low">Low</span>
            <span className="zone-inspector__severity-label zone-inspector__severity-label--mod">Moderate</span>
            <span className="zone-inspector__severity-label zone-inspector__severity-label--high">High</span>
          </div>

          <div className="zone-inspector__severity-info">
            <span>5 consecutive readings</span>
            <span>First seen: Mar 16, 2025</span>
          </div>
        </div>

        {/* ── Affected Cells ── */}
        <div className="zone-inspector__section">
          <span className="zone-inspector__section-label">AFFECTED CELLS <span className="zone-inspector__section-count">(18 cells active)</span></span>
          <div className="zone-inspector__cells-grid">
            {CELLS.map((cell) => (
              <CellBadge key={cell.id} cell={cell} />
            ))}
          </div>
        </div>

        {/* ── Zone Trend ── */}
        <div className="zone-inspector__section">
          <span className="zone-inspector__section-label">ZONE TREND (12 WK)</span>
          <div className="zone-inspector__trend">
            {TREND_WEEKS.map((week) => (
              <div key={week.label} className="zone-inspector__trend-col">
                <div className="zone-inspector__trend-bar-wrap">
                  <div
                    className="zone-inspector__trend-bar"
                    style={{
                      height: `${(week.value / maxBar) * 100}%`,
                      backgroundColor: week.color,
                    }}
                  />
                </div>
                <span className="zone-inspector__trend-label">{week.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Findings ── */}
        <div className="zone-inspector__section">
          <span className="zone-inspector__section-label">FINDINGS ({FINDINGS.length})</span>
          <div className="zone-inspector__findings">
            {FINDINGS.map((f) => (
              <FindingCard key={f.id} finding={f} />
            ))}
          </div>
        </div>

        {/* ── Recommended Actions ── */}
        <div className="zone-inspector__section">
          <span className="zone-inspector__section-label">RECOMMENDED ACTIONS</span>
          <div className="zone-inspector__actions">
            {ACTIONS.map((a) => (
              <ActionRow key={a.id} action={a} />
            ))}
          </div>
        </div>

        {/* ── Footer timestamp ── */}
        <div className="zone-inspector__footer">
          UPDATED MAR 12, 2025, 11:24 AM
        </div>
      </div>
    </div>
  );
}
