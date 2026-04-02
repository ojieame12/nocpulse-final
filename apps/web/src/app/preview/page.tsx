import Link from 'next/link';
import { redirect } from 'next/navigation';
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

  // Infrastructure-level failures still get a minimal shell
  if (viewModel.status === 'no-runtime') {
    return <PreviewEmptyShell status="no-runtime" />;
  }

  if (viewModel.status === 'unauthenticated') {
    return <PreviewEmptyShell status="unauthenticated" />;
  }

  if (viewModel.status === 'pending-access') {
    redirect(
      `/auth/pending-access?next=${encodeURIComponent(
        `/preview${requestedFieldId ? `?fieldId=${requestedFieldId}` : ''}`,
      )}`,
    );
  }

  // "ready" — includes empty workspaces (shell renders with empty states)
  const vm = viewModel as Extract<typeof viewModel, { status: 'ready' }>;
  const initial: FieldViewModel = {
    workspaceId: vm.workspaceId,
    fieldId: vm.fieldId,
    fieldName: vm.fieldName,
    areaHaLabel: vm.areaHaLabel,
    cropContext: vm.cropContext ?? null,
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
      <PreviewShell
        initial={initial}
        initialPanelsPromise={vm.panelsPromise}
        viewer={vm.viewer ?? null}
        guestSession={vm.guestSession ?? null}
      />
    </ErrorBoundary>
  );
}
