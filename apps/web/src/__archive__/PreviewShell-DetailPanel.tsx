/**
 * ARCHIVED: 2026-03-29
 *
 * Dead DetailPanel component extracted from PreviewShell.tsx (lines 99–167).
 * This was the original tab-based detail view before FieldDetailPanel replaced it.
 * Never called — `<DetailPanel` had zero JSX references in the file.
 *
 * Also includes the supporting DETAIL_TABS constant and DetailTab type (lines 101–102).
 *
 * Note: EmptyState (line 169) is NOT archived — it's still used at lines 751 and 759.
 *
 * Kept for reference in case the tab layout or wiring logic is needed later.
 */

// Original supporting constants (lines 101–102):
const DETAIL_TABS = ['Summary', 'Report', 'Action', 'Notes', 'Crops', 'Market'] as const;
type DetailTab = (typeof DETAIL_TABS)[number];

// Original component (lines 104–167):
function DetailPanel({
  fieldName,
  summary,
  report,
  action,
  notes,
  market,
}: {
  fieldName: string;
  summary: FieldSummaryProps | null;
  report: FieldReportProps | null;
  action: FieldActionProps | null;
  notes: FieldNotesProps | null;
  market: FieldMarketProps | null;
}) {
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
      case 'Summary':
        return summary ? <SummaryTab field={summary} /> : <EmptyState label="No summary data" />;
      case 'Report':
        return report ? <ReportTab field={report} /> : <EmptyState label="No report data" />;
      case 'Action':
        return action ? <ActionTab field={action} /> : <ActionTab />;
      case 'Notes':
        return notes ? <NotesTab field={notes} /> : <EmptyState label="No scout notes" />;
      case 'Crops':
        return <CropTab />;
      case 'Market':
        return market ? <MarketTab field={market} /> : <MarketTab />;
    }
  })();

  return (
    <div className="panel">
      <PanelHeader title={fieldName.toUpperCase()} />
      <div style={{ padding: '8px 16px 0' }}>
        <PillTabBar
          tabs={DETAIL_TABS as unknown as string[]}
          activeTab={tab}
          onTabChange={handleTabChange}
        />
      </div>
      <div className="panel__body">
        <div key={animKey} className={`panel__tab-content--slide-${slideDir}`}>
          {tabContent}
        </div>
      </div>
    </div>
  );
}
