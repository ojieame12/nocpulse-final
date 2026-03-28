"use client";

import type { CellClickEvent, FieldBoundaryPreviewRenderModel } from "@fieldpulse/map";
import { useCallback, useEffect, useRef, useState } from "react";
import { WorkspaceShell } from "../../components/layout/WorkspaceShell";
import type { SidebarFieldItem } from "../../components/layout/Sidebar";
import { type FieldSummaryProps } from "../../components/panels/SummaryTab";
import { type FieldReportProps } from "../../components/panels/ReportTab";
import { AlertsPanel, type AlertsPanelProps } from "../../components/panels/AlertsPanel";
import { PanelHeader } from "../../components/ui/PanelHeader";
import { PillTabBar } from "../../components/ui/PillTabBar";
import { SummaryTab } from "./tabs/SummaryTab";
import { ReportTab } from "./tabs/ReportTab";
import { ZonesTab } from "./tabs/ZonesTab";
import { ActionTab } from "./tabs/ActionTab";
import { NotesTab } from "./tabs/NotesTab";
import { CropTab } from "./tabs/CropTab";
import { MarketTab } from "./tabs/MarketTab";
import { LazyFieldBoundaryMap } from "./LazyFieldBoundaryMap";
import type { FieldCellInspectorModel } from "./CellInspectorModel";
import { SelectedCellInspector } from "./SelectedCellInspector";
import type { FieldActivityPanelModel } from "./FieldActivityPanelModel";
import { FieldActivityPanel } from "./FieldActivityPanel";
import { ZoneDetailPanel } from "../../components/panels/ZoneDetailPanel";

/* ── Types ── */

export interface FieldPageShellProps {
  /** Sidebar field list */
  fields: SidebarFieldItem[];
  /** Currently active field ID */
  activeFieldId: string;
  /** Active field display name (for panel header) */
  activeFieldName: string;
  /** Summary panel data (null if not yet available) */
  summary: FieldSummaryProps | null;
  /** Report panel data (null if not yet available) */
  report: FieldReportProps | null;
  /** Alerts panel data (null if not yet available) */
  alerts: AlertsPanelProps | null;
  /** Real field map render model */
  mapModel: FieldBoundaryPreviewRenderModel;
  /** Cell-inspector backing data */
  cellInspector: FieldCellInspectorModel | null;
  /** Findings/zones activity panel data */
  activity: FieldActivityPanelModel | null;
}

const DETAIL_TABS = ["Summary", "Report", "Zones", "Crops", "Market"] as const;
type DetailTab = (typeof DETAIL_TABS)[number];

function DetailPanel({
  fieldName,
  focusedZoneId,
  onZoneSelect,
}: {
  fieldName: string;
  summary: FieldSummaryProps | null;
  report: FieldReportProps | null;
  focusedZoneId: string | null;
  onZoneSelect: (zoneId: string | null) => void;
}) {
  const [tab, setTab] = useState<DetailTab>("Summary");
  const [slideDir, setSlideDir] = useState<"left" | "right">("right");
  const [animKey, setAnimKey] = useState(0);
  const prevTabIdx = useRef(0);
  const bodyRef = useRef<HTMLDivElement>(null);

  const handleTabChange = useCallback((t: string) => {
    const newIdx = DETAIL_TABS.indexOf(t as DetailTab);
    setSlideDir(newIdx > prevTabIdx.current ? "right" : "left");
    prevTabIdx.current = newIdx;
    setAnimKey((k) => k + 1);
    setTab(t as DetailTab);
  }, []);

  useEffect(() => {
    bodyRef.current?.scrollTo(0, 0);
  }, [tab]);

  const tabContent = (() => {
    switch (tab) {
      case "Summary": return <SummaryTab fieldName={fieldName} />;
      case "Report": return <ReportTab focusedZoneId={focusedZoneId} onZoneSelect={onZoneSelect} />;
      case "Zones": return <ZonesTab />;
      case "Crops": return <CropTab />;
      case "Market": return <MarketTab />;
    }
  })();

  return (
    <div className="panel">
      <PanelHeader title={fieldName.toUpperCase()} />
      <div style={{ padding: "8px 16px 0" }}>
        <PillTabBar
          tabs={DETAIL_TABS as unknown as string[]}
          activeTab={tab}
          onTabChange={handleTabChange}
        />
      </div>
      <div ref={bodyRef} className="panel__body">
        <div key={animKey} className={`panel__tab-content--slide-${slideDir}`}>
          {tabContent}
        </div>
      </div>
    </div>
  );
}

/* ── Standalone Nav Panels ── */

function ActionPanel({ onClose }: { onClose: () => void }) {
  return (
    <div className="panel">
      <PanelHeader title="ACTION" onClose={onClose} />
      <div className="panel__body">
        <ActionTab />
      </div>
    </div>
  );
}

function NotesPanel({ onClose }: { onClose: () => void }) {
  return (
    <div className="panel">
      <PanelHeader title="NOTES" onClose={onClose} />
      <div className="panel__body">
        <NotesTab />
      </div>
    </div>
  );
}

type PanelView = "detail" | "alerts" | "activity" | "cell" | "action" | "notes" | "zoneDetail";

export function FieldPageShell({
  fields,
  activeFieldId,
  activeFieldName,
  summary,
  report,
  alerts,
  mapModel,
  cellInspector,
  activity,
}: FieldPageShellProps) {
  const [panelView, setPanelView] = useState<PanelView>("detail");
  const [selectedCell, setSelectedCell] = useState<CellClickEvent | null>(null);
  const [focusedZoneId, setFocusedZoneId] = useState<string | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);

  useEffect(() => {
    setPanelView("detail");
    setSelectedCell(null);
    setFocusedZoneId(null);
  }, [activeFieldId]);

  function handleNavChange(nav: string) {
    if (nav === "Zones" && activity) {
      setPanelView("activity");
    } else if (nav === "Action") {
      setPanelView("action");
    } else if (nav === "Notes") {
      setPanelView("notes");
    } else {
      setPanelView("detail");
    }
  }

  function handleAlertsBell() {
    if (panelView === "alerts") {
      setPanelView("detail");
    } else if (alerts) {
      setPanelView("alerts");
    }
  }

  function handleCellClick(event: CellClickEvent) {
    if (event.selected) {
      setSelectedCell(event);
      setFocusedZoneId(event.zoneId);
      setPanelView("cell");
      return;
    }

    setSelectedCell(null);
    setFocusedZoneId(null);
    setPanelView("detail");
  }

  const panel =
    panelView === "alerts" && alerts ? (
      <AlertsPanel
        {...alerts}
        focusedZoneId={focusedZoneId}
        onAlertSelect={setFocusedZoneId}
        onClose={() => setPanelView("detail")}
      />
    ) : panelView === "activity" ? (
      <FieldActivityPanel
        activity={activity}
        focusedZoneId={focusedZoneId}
        onZoneSelect={setFocusedZoneId}
        onZoneDrillDown={(zoneId) => {
          setSelectedZoneId(zoneId);
          setFocusedZoneId(zoneId);
          setPanelView("zoneDetail");
        }}
        onClose={() => setPanelView("detail")}
      />
    ) : panelView === "zoneDetail" ? (
      <ZoneDetailPanel
        onClose={() => {
          setSelectedZoneId(null);
          setPanelView("activity");
        }}
      />
    ) : panelView === "cell" ? (
      <SelectedCellInspector
        selection={selectedCell}
        model={cellInspector}
        focusedZoneId={focusedZoneId}
        onZoneSelect={setFocusedZoneId}
        onClose={() => {
          setSelectedCell(null);
          setFocusedZoneId(null);
          setPanelView("detail");
        }}
      />
    ) : panelView === "action" ? (
      <ActionPanel onClose={() => setPanelView("detail")} />
    ) : panelView === "notes" ? (
      <NotesPanel onClose={() => setPanelView("detail")} />
    ) : (
      <DetailPanel
        fieldName={activeFieldName}
        summary={summary}
        report={report}
        focusedZoneId={focusedZoneId}
        onZoneSelect={setFocusedZoneId}
      />
    );

  return (
    <WorkspaceShell
      fields={fields}
      activeFieldId={activeFieldId}
      activeNav={
        panelView === "activity"
          ? "Zones"
          : panelView === "action"
            ? "Action"
            : panelView === "notes"
              ? "Notes"
              : undefined
      }
      onNavChange={handleNavChange}
      onAlertsBell={handleAlertsBell}
      panel={panel}
    >
      <div className="map-area__canvas">
        <LazyFieldBoundaryMap
          model={{
            ...mapModel,
            focusedZoneId,
          }}
          onCellClick={handleCellClick}
          allowSyntheticOverlays
        />
      </div>
    </WorkspaceShell>
  );
}
