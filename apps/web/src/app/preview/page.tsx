import { buildPreviewViewModel } from './buildPreviewViewModel';
import { PreviewShell, type FieldViewModel } from './PreviewShell';
import { PreviewEmptyShell } from './PreviewEmptyShell';
import { ErrorBoundary } from '../../components/layout/ErrorBoundary';
export const dynamic = 'force-dynamic';

type PreviewPageProps = {
  searchParams?: Promise<{
    fieldId?: string;
  }>;
};

export default async function PreviewPage({ searchParams }: PreviewPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const requestedFieldId = resolvedSearchParams.fieldId?.trim() || undefined;
  const viewModel = await buildPreviewViewModel(requestedFieldId);

  if (viewModel.status === 'no-runtime') {
    return <PreviewEmptyShell status="no-runtime" />;
  }

  if (viewModel.status === 'unauthenticated') {
    return <PreviewEmptyShell status="unauthenticated" />;
  }

  if (viewModel.status === 'no-fields') {
    return <PreviewEmptyShell status="no-fields" />;
  }

  // viewModel.status === 'ready' — pass all data to the client shell
  const vm = viewModel as Extract<typeof viewModel, { status: 'ready' }>;
  const initial: FieldViewModel = {
    workspaceId: vm.workspaceId,
    fieldId: vm.fieldId,
    fieldName: vm.fieldName,
    areaHaLabel: vm.areaHaLabel,
    mapPreview: vm.mapPreview,
    sidebarFields: vm.sidebarFields,
    summary: vm.summary ?? null,
    reportPanel: vm.reportPanel ?? null,
    actionPanel: vm.actionPanel ?? null,
    notesPanel: vm.notesPanel ?? null,
    marketPanel: vm.marketPanel ?? null,
    cropPanel: vm.cropPanel ?? null,
    alertsPanel: vm.alertsPanel ?? null,
    activityPanel: vm.activityPanel ?? null,
    cellInspector: vm.cellInspector ?? null,
  };

  return (
    <ErrorBoundary fallbackMessage="The preview environment crashed unexpectedly.">
      <PreviewShell initial={initial} initialPanelsPromise={vm.panelsPromise} />
    </ErrorBoundary>
  );
}
