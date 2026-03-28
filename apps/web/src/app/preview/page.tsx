'use client';

import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import {
  buildFieldBoundaryPreviewRenderModel,
  type FieldAgronomicSurfaceMetricKey,
} from '@fieldpulse/map';
import { TopBar } from '../../components/layout/TopBar';
import { Sidebar, type SidebarFieldItem } from '../../components/layout/Sidebar';
import { LazyFieldBoundaryMap } from '../../features/fields/LazyFieldBoundaryMap';
import { SummaryTab, type FieldSummaryProps } from '../../components/panels/SummaryTab';
import { ReportTab, type FieldReportProps } from '../../components/panels/ReportTab';
import { ActionTab } from '../../components/panels/ActionTab';
import { NotesTab } from '../../components/panels/NotesTab';
import { CropTab } from '../../components/panels/CropTab';
import { MarketTab } from '../../components/panels/MarketTab';
import { AlertsPanel, type AlertsPanelProps } from '../../components/panels/AlertsPanel';
import { CropsPanel } from '../../components/panels/CropsPanel';
import { SettingsPanel } from '../../components/panels/SettingsPanel';
import { ScoutReportPanel } from '../../components/panels/ScoutReportPanel';
import { ZoneDetailPanel } from '../../components/panels/ZoneDetailPanel';
import { EvidencePanel } from '../../components/panels/EvidencePanel';
import { SpotInspectorPanel } from '../../components/panels/SpotInspectorPanel';
import { AddFieldPanel } from '../../components/panels/AddFieldPanel';
import { PanelHeader } from '../../components/ui/PanelHeader';
import { PillTabBar } from '../../components/ui/PillTabBar';

/* ── Demo sidebar fields ── */

const DEMO_FIELDS: SidebarFieldItem[] = [
  { id: '1', name: 'Quarter SE 25 010 17 W4', area: '64.2 ha', crop: 'Canola', alertCount: 2, status: 'stressed' },
  { id: '2', name: 'Quarter SW 22 004 34 W1', area: '64.5 ha', crop: 'Canola', alertCount: 1, status: 'stressed' },
  { id: '3', name: 'Quarter SE 19 037 11 W3', area: '64.5 ha', status: 'healthy' },
  { id: '4', name: 'Quarter NE 12 078 20 W6', area: '65.6 ha', status: 'pending' },
  { id: '5', name: 'Rath West (1)', area: '64.8 ha', crop: 'Faba bean', status: 'pending' },
  { id: '6', name: 'Rath West (2)', area: '64.6 ha', crop: 'Faba Bean', status: 'pending' },
  { id: '7', name: 'Harvey Barn (1)', area: '64.8 ha', crop: 'Canola', status: 'pending' },
  { id: '8', name: 'Harvey Barn (2)', area: '64.6 ha', crop: 'Canola', status: 'pending' },
];

/* ── Demo field boundary (Saskatchewan quarter section) ── */

const DEMO_BOUNDARY = {
  type: "MultiPolygon" as const,
  coordinates: [[[
    [-104.6635, 50.4585] as const,
    [-104.6505, 50.4585] as const,
    [-104.6505, 50.448] as const,
    [-104.6635, 50.448] as const,
    [-104.6635, 50.4585] as const,
  ]]] as const,
} as const;

const DEMO_LABEL_POINT = [-104.657, 50.45325] as const;

/* ── Demo data for SummaryTab ── */

const DEMO_SUMMARY: FieldSummaryProps = {
  name: 'Quarter SE 25 010 17 W4',
  lld: 'SE 25-010-17 W4M',
  crop: 'Faba bean',
  cropStage: 'Pre-Seed / Dormant',
  moisture: 0.22,
  cloudCover: '1%',
  surfaceMoisture: '25%',
  fieldState: 'Very dry',
  fieldStateColor: '#f59e0b',
  rootMoisture: '38.4%',
  rootMoistureSub: 'Adequate',
  trend: 'Drying',
  trendSub: '7d  -3%',
  spread: '0.04',
  spreadSub: 'Low variability',
  confidence: 'High',
  confidenceSub: 'Fresh SAR · 2 passes',
  precipitation: '0.0  mm',
  precipitationSub: 'None currently',
  nextRain: '~18  hrs',
  nextRainSub: 'Thu 6:00 AM',
  rainChance: '28%',
  rainChanceSub: 'Tomorrow AM',
  sevenDayTotal: '4.2  mm',
  sevenDayTotalSub: 'Below normal',
  alerts: [
    { label: 'Moisture Stress', desc: 'Root zone drying below crop threshold', severity: 'danger' },
    { label: 'Frost Risk Watch', desc: 'Overnight low forecast -2°C', severity: 'warning' },
  ],
  outlook: [
    { day: 'Fri', high: 14, low: -8, precip: '0%' },
    { day: 'Sat', high: 13, low: 1, precip: '1%' },
    { day: 'Sun', high: 8, low: -3, precip: '9%' },
    { day: 'Mon', high: 6, low: -2, precip: '28%' },
  ],
};

/* ── Demo data for ReportTab ── */

const DEMO_REPORT: FieldReportProps = {
  name: 'Quarter SE 25 010 17 W4',
  lld: 'SE 25-010-17 W4M',
  updatedDate: 'Mar 27, 2026',
  healthStatus: 'Healthy',
  readings: [
    { iconKey: 'temperature', label: 'Temperature', value: '13.0°C' },
    { iconKey: 'soil-temp', label: 'Soil Temp', value: '8.2°C' },
    { iconKey: 'root-moisture', label: 'Root Moisture', value: '38.4%' },
    { iconKey: 'wind', label: 'Wind', value: '18 km/h' },
    { iconKey: 'ndvi', label: 'NDVI', value: '0.72', valueColor: '#16a34a' },
    { iconKey: 'stress-area', label: 'Stress Area', value: '4.1%', valueColor: '#16a34a' },
  ],
  cropStage: 'Flowering',
  cropParams: [
    { label: 'Root Moisture (%)', value: '20.5%', rangeLow: '12%', rangeHigh: '32%', fillPercent: 41 },
    { label: 'Soil Temp (°C)', value: '20.5%', rangeLow: '12%', rangeHigh: '32%', fillPercent: 41 },
    { label: 'Ambient Temp (°C)', value: '20.5%', rangeLow: '12%', rangeHigh: '32%', fillPercent: 41 },
    { label: 'VPD (kPa)', value: '20.5%', rangeLow: '12%', rangeHigh: '32%', fillPercent: 41 },
  ],
  charts: [
    { title: 'VEGETATION INDEX TREND', subtitle: 'NDVI + NDRE over time' },
    { title: 'SOIL MOISTURE & PRECIPITATION', subtitle: '30-day history · ERA5-Land' },
    { title: 'TEMPERATURE HISTORY', subtitle: 'Surface + root zone · 30 days' },
  ],
  forecast: [
    { day: 'Fri', temp: '14/-8', precip: '0%' },
    { day: 'Sat', temp: '13/1', precip: '1%' },
    { day: 'Sun', temp: '8/-3', precip: '9%' },
    { day: 'Mon', temp: '6/-2', precip: '28%' },
  ],
  alerts: [
    {
      iconKey: 'moisture',
      text: 'Moisture stress — root zone drying',
      severity: 'High',
      trackedZoneIds: ['zone-moisture-nw'],
    },
    {
      iconKey: 'temperature',
      text: 'Frost risk watch — overnight low −2°C',
      severity: 'Med',
      trackedZoneIds: ['zone-frost-east'],
    },
  ],
  findings: [
    {
      id: 'finding-1',
      title: 'Moisture stress pocket',
      summary: 'North-west cells are drying faster than the field average.',
      severity: 'High',
      trackedZoneIds: ['zone-moisture-nw'],
    },
    {
      id: 'finding-2',
      title: 'Frost watch',
      summary: 'East edge remains most exposed to overnight cold.',
      severity: 'Med',
      trackedZoneIds: ['zone-frost-east'],
    },
  ],
  zones: [
    {
      id: 'zone-moisture-nw',
      family: 'moisture_stress',
      trackingKey: 'north-west-pocket',
      status: 'persistent',
      severity: 'High',
      affectedCellCount: 4,
      lastSeenAt: '2h ago',
    },
    {
      id: 'zone-frost-east',
      family: 'weather_risk',
      trackingKey: 'east-edge-frost',
      status: 'new',
      severity: 'Med',
      affectedCellCount: 2,
      lastSeenAt: '45m ago',
    },
  ],
  provenanceText:
    'Field-level summary from Fresh SAR (2 passes). Confidence: High. Root zone moisture derived from C-band backscatter calibrated to Canola crop profile.',
  sources: [{ label: 'Fresh SAR' }, { label: 'ERA5-Land' }],
};

/* ── Tab-based detail panel (Summary/Report/Action/Notes/Market) ── */

const DETAIL_TABS = ['Summary', 'Report', 'Action', 'Notes', 'Crops', 'Market'] as const;
type DetailTab = (typeof DETAIL_TABS)[number];

function DetailPanel() {
  const [tab, setTab] = useState<DetailTab>('Summary');
  const [slideDir, setSlideDir] = useState<'left' | 'right'>('right');
  const [animKey, setAnimKey] = useState(0);
  const prevTabIdx = useRef(0);

  const handleTabChange = useCallback((t: string) => {
    const newIdx = DETAIL_TABS.indexOf(t as DetailTab);
    const oldIdx = prevTabIdx.current;
    setSlideDir(newIdx > oldIdx ? 'right' : 'left');
    prevTabIdx.current = newIdx;
    setAnimKey((k) => k + 1);
    setTab(t as DetailTab);
  }, []);

  const tabContent = (() => {
    switch (tab) {
      case 'Summary': return <SummaryTab field={DEMO_SUMMARY} />;
      case 'Report': return <ReportTab field={DEMO_REPORT} />;
      case 'Action': return <ActionTab />;
      case 'Notes': return <NotesTab />;
      case 'Crops': return <CropTab />;
      case 'Market': return <MarketTab />;
    }
  })();

  return (
    <div className="panel">
      <PanelHeader title="QUARTER SE 25 010 17 W4" />
      <div style={{ padding: '8px 16px 0' }}>
        <PillTabBar
          tabs={DETAIL_TABS as unknown as string[]}
          activeTab={tab}
          onTabChange={handleTabChange}
        />
      </div>
      <div
        key={animKey}
        className={`panel__tab-content--slide-${slideDir}`}
      >
        {tabContent}
      </div>
    </div>
  );
}

/* ── Standalone panels ── */

type PanelView =
  | 'detail'
  | 'alerts'
  | 'crops'
  | 'settings'
  | 'scout'
  | 'zone'
  | 'evidence'
  | 'spot'
  | 'add-field';

const DEMO_ALERTS: AlertsPanelProps = {
  activeAlerts: [
    {
      id: '1',
      title: 'NDVI Drop Detected',
      severity: 'critical',
      subtitle: 'North Quarter A · Zone NW-3',
      time: '3h ago',
      trackedZoneIds: ['zone-moisture-nw'],
    },
    {
      id: '2',
      title: 'Soil Moisture Below Threshold',
      severity: 'warning',
      subtitle: 'South Quarter B · Zone SE-1',
      time: '6h ago',
      trackedZoneIds: ['zone-moisture-nw'],
    },
    {
      id: '3',
      title: 'Frost Risk Overnight',
      severity: 'warning',
      subtitle: 'East Paddock · Zone E-2',
      time: '12h ago',
      trackedZoneIds: ['zone-frost-east'],
    },
  ],
  resolvedAlerts: [
    {
      id: '4',
      title: 'Irrigation Schedule Complete',
      subtitle: 'All Fields',
      time: '1h ago',
      trackedZoneIds: [],
    },
  ],
  activeCount: 3,
  criticalCount: 1,
  weekCount: 7,
};

const PANEL_LABELS: { key: PanelView; label: string }[] = [
  { key: 'detail', label: 'Field Detail' },
  { key: 'alerts', label: 'Alerts' },
  { key: 'crops', label: 'Crops' },
  { key: 'settings', label: 'Settings' },
  { key: 'scout', label: 'Scout Report' },
  { key: 'zone', label: 'Zone Detail' },
  { key: 'evidence', label: 'Evidence' },
  { key: 'spot', label: 'Spot Inspector' },
  { key: 'add-field', label: 'Add Field' },
];

export default function PreviewPage() {
  const [activePanel, setActivePanel] = useState<PanelView>('detail');
  const [panelAnim, setPanelAnim] = useState<'entering' | 'exiting' | ''>('entering');
  const [activeNav, setActiveNav] = useState('Map');
  const [activeLayer, setActiveLayer] = useState<'NDVI' | 'NDRE' | 'NDMI' | 'Moisture'>('Moisture');

  const switchPanel = useCallback((next: PanelView) => {
    if (next === activePanel) return;
    setPanelAnim('exiting');
    setTimeout(() => {
      setActivePanel(next);
      setPanelAnim('entering');
    }, 250);
  }, [activePanel]);

  const handleNavChange = useCallback((nav: string) => {
    setActiveNav(nav);
    if (nav === 'Zones') switchPanel('zone');
    else if (nav === 'Alerts') switchPanel('alerts');
    else if (nav === 'Crops') switchPanel('crops');
    else if (nav === 'Settings') switchPanel('settings');
    else if (nav === 'Action') switchPanel('detail');
    else switchPanel('detail');
  }, [switchPanel]);

  const LAYER_TO_METRIC: Record<typeof activeLayer, FieldAgronomicSurfaceMetricKey> = {
    NDVI: 'ndvi',
    NDRE: 'ndre',
    NDMI: 'ndmi',
    Moisture: 'root-zone-moisture-pct',
  };

  const LAYER_DEMO_VALUES: Record<typeof activeLayer, { value: number; source: string }> = {
    NDVI: { value: 62, source: 'Sentinel-2 NDVI' },
    NDRE: { value: 38, source: 'Sentinel-2 NDRE' },
    NDMI: { value: 44, source: 'Sentinel-2 NDMI' },
    Moisture: { value: 41, source: 'Open-Meteo + SMAP blend' },
  };

  const mapModel = useMemo(
    () => {
      const metric = LAYER_TO_METRIC[activeLayer];
      const demo = LAYER_DEMO_VALUES[activeLayer];

      // Use terrain for moisture, flat for vegetation indices
      const isMoisture = activeLayer === 'Moisture';

      return buildFieldBoundaryPreviewRenderModel({
        fieldId: 'demo-quarter-se-25',
        fieldName: 'QUARTER SE 25 010 17 W4',
        boundary: DEMO_BOUNDARY,
        labelPoint: DEMO_LABEL_POINT,
        lightingPresetId: isMoisture ? 'relief-review' : 'flat-day',
        terrainContextMode: isMoisture ? 'contextual-relief' : 'flat',
        agronomicSurface: {
          metricKey: metric,
          baseValuePct: demo.value,
          confidence: 'medium',
          sourceLabel: demo.source,
        },
      });
    },
    [activeLayer],
  );

  const renderPanel = () => {
    switch (activePanel) {
      case 'detail':
        return <DetailPanel />;
      case 'alerts':
        return <AlertsPanel {...DEMO_ALERTS} />;
      case 'crops':
        return <CropsPanel />;
      case 'settings':
        return <SettingsPanel />;
      case 'scout':
        return <ScoutReportPanel />;
      case 'zone':
        return <ZoneDetailPanel />;
      case 'evidence':
        return <EvidencePanel />;
      case 'spot':
        return <SpotInspectorPanel />;
      case 'add-field':
        return <AddFieldPanel />;
      default:
        return <DetailPanel />;
    }
  };

  const LAYER_TABS = ['NDVI', 'NDRE', 'NDMI', 'Moisture'] as const;

  return (
    <div className="app-shell">
      <TopBar activeNav={activeNav} onNavChange={handleNavChange} />
      <div className="app-body">
        <Sidebar fields={DEMO_FIELDS} activeFieldId="1" />

        {/* Map area */}
        <div className="map-area">
          <div className="map-area__canvas">
            <LazyFieldBoundaryMap model={mapModel} allowSyntheticOverlays />
          </div>

          {/* NDVI floating overlay */}
          <div className="ndvi-overlay">
            <div className="ndvi-overlay__tabs">
              {LAYER_TABS.map((tab) => (
                <button
                  key={tab}
                  className={`ndvi-overlay__tab${activeLayer === tab ? ' ndvi-overlay__tab--active' : ''}`}
                  onClick={() => setActiveLayer(tab)}
                >
                  {tab}
                </button>
              ))}
            </div>
            <div className="ndvi-overlay__card">
              <div className="ndvi-overlay__info">
                <div className="ndvi-overlay__info-text">
                  <span className="ndvi-overlay__title">
                    {activeLayer} · {activeLayer === 'Moisture'
                      ? 'Weather-derived field moisture model'
                      : `Vegetation ${activeLayer} index`}
                  </span>
                  <span className="ndvi-overlay__desc">
                    {activeLayer === 'Moisture'
                      ? 'Open-Meteo + SMAP blend · medium confidence'
                      : `Sentinel-2 ${activeLayer} — last capture Mar 26`}
                  </span>
                </div>
                <div className="ndvi-overlay__value-group">
                  <span className="ndvi-overlay__value">
                    {activeLayer === 'Moisture' ? '41%' : activeLayer === 'NDVI' ? '0.62' : activeLayer === 'NDRE' ? '0.38' : '0.44'}
                  </span>
                </div>
              </div>
              <div className="ndvi-overlay__gradient-row">
                <span className="ndvi-overlay__gradient-label">
                  {activeLayer === 'Moisture' ? 'Drier' : 'Low'}
                </span>
                <div className="ndvi-overlay__gradient-bar" />
                <span className="ndvi-overlay__gradient-label">
                  {activeLayer === 'Moisture' ? 'Wetter' : 'High'}
                </span>
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="map-area__bottom-bar">
            <span>50.4533° N, 104.6570° W</span>
            <span>Sentinel-2 · 10m/px</span>
            <span>Mar 26, 2026</span>
          </div>

          {/* Right panel — floats over map */}
          <div className={panelAnim ? `panel--${panelAnim}` : ''}>
            {renderPanel()}
          </div>
        </div>
      </div>
    </div>
  );
}
