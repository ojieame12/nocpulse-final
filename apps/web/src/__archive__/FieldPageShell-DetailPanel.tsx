/**
 * ARCHIVED: 2026-03-29
 *
 * Dead DetailPanel component extracted from FieldPageShell.tsx (lines 92–277).
 * This was the original tab-based detail view before FieldDetailPanel replaced it.
 * Never called — `<DetailPanel` had zero JSX references in the file.
 *
 * Also includes the dead `detailTab` state (line 1272) which only fed this component.
 *
 * Kept for reference in case the tab layout or wiring logic is needed later.
 */

// Original supporting constants (lines 92–93):
const DETAIL_TABS = ["Summary", "Report", "Zones", "Crops", "Market"] as const;
type DetailTab = (typeof DETAIL_TABS)[number];

// Original component (lines 133–277):
function DetailPanel({
  fieldName,
  summary,
  report,
  market,
  crop,
  activity,
  activityContextLabel,
  activityScopeLabel,
  zonePreview,
  zonePreviewContextLabel,
  tab,
  focusedZoneId,
  onTabChange,
  onZoneSelect,
  onZoneDrillDown,
}: {
  fieldName: string;
  summary: FieldSummaryProps | null;
  report: FieldReportProps | null;
  market: FieldMarketProps | null;
  crop: FieldCropProps | null;
  activity: FieldActivityPanelModel | null;
  activityContextLabel?: string;
  activityScopeLabel?: string;
  zonePreview?: {
    zone: ZoneDetailPanelZone;
    cells: readonly ZoneDetailPanelCell[];
    findings: readonly ZoneDetailPanelFinding[];
  } | null;
  zonePreviewContextLabel?: string;
  tab: DetailTab;
  focusedZoneId: string | null;
  onTabChange: (tab: DetailTab) => void;
  onZoneSelect: (zoneId: string | null) => void;
  onZoneDrillDown: (zoneId: string) => void;
}) {
  const [slideDir, setSlideDir] = useState<"left" | "right">("right");
  const [animKey, setAnimKey] = useState(0);
  const prevTabIdx = useRef(0);
  const bodyRef = useRef<HTMLDivElement>(null);

  const handleTabChange = useCallback(
    (nextTab: string) => {
      const resolvedTab = nextTab as DetailTab;
      const newIdx = DETAIL_TABS.indexOf(resolvedTab);
      setSlideDir(newIdx > prevTabIdx.current ? "right" : "left");
      prevTabIdx.current = newIdx;
      setAnimKey((key) => key + 1);
      onTabChange(resolvedTab);
    },
    [onTabChange],
  );

  useEffect(() => {
    bodyRef.current?.scrollTo(0, 0);
  }, [tab]);

  const tabContent = (() => {
    switch (tab) {
      case "Summary":
        return summary ? (
          <SummaryPanel field={summary} />
        ) : (
          <UnavailableTab
            icon={BarChart3}
            title="Summary unavailable"
            description="The field summary has not been generated for this field yet."
          />
        );
      case "Report":
        return report ? (
          <ReportPanel
            field={report}
            focusedZoneId={focusedZoneId}
            onZoneSelect={onZoneSelect}
          />
        ) : (
          <UnavailableTab
            icon={FileText}
            title="Report unavailable"
            description="The latest field report has not been generated for this field yet."
          />
        );
      case "Zones":
        return zonePreview ? (
          <ZoneDetailPanel
            zone={zonePreview.zone}
            cells={zonePreview.cells}
            findings={zonePreview.findings}
            contextLabel={zonePreviewContextLabel}
            showHeader={false}
          />
        ) : (
          <FieldActivityPanel
            activity={activity}
            contextLabel={activityContextLabel}
            scopeLabel={activityScopeLabel}
            focusedZoneId={focusedZoneId}
            onZoneSelect={onZoneSelect}
            onZoneDrillDown={onZoneDrillDown}
            showHeader={false}
          />
        );
      case "Crops":
        return crop ? (
          <CropTab field={crop} />
        ) : (
          <UnavailableTab
            icon={TrendingUp}
            title="Crop profile unavailable"
            description="Crop context has not been derived for this field yet."
          />
        );
      case "Market":
        return market ? (
          <MarketPanel field={market} />
        ) : (
          <UnavailableTab
            icon={BarChart3}
            title="Market data unavailable"
            description="The live market path is not wired for this field yet."
          />
        );
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

// Dead state in the main component (line 1272):
// const [detailTab, setDetailTab] = useState<DetailTab>("Summary");
