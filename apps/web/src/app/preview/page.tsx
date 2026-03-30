import Link from 'next/link';
import { buildPreviewViewModel } from './buildPreviewViewModel';
import { PreviewShell, type FieldViewModel } from './PreviewShell';
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
    return (
      <main>
        <div className="shell">
          <section className="hero">
            <span className="pill">Runtime unavailable</span>
            <h1>Supabase runtime not configured</h1>
            <p>
              Set <code>SUPABASE_URL</code> and <code>SUPABASE_SERVICE_ROLE_KEY</code> in your
              environment to enable live data.
            </p>
          </section>
        </div>
      </main>
    );
  }

  if (viewModel.status === 'unauthenticated') {
    return (
      <main>
        <div className="shell">
          <section className="hero">
            <span className="pill">Authentication required</span>
            <h1>Sign in to view the preview</h1>
            <p>
              <Link href="/auth/sign-in?next=/preview">Continue to sign in</Link>
            </p>
          </section>
        </div>
      </main>
    );
  }

  if (viewModel.status === 'no-fields') {
    return (
      <main>
        <div className="shell">
          <section className="hero">
            <span className="pill">No fields</span>
            <h1>No fields found in your workspace</h1>
            <p>
              Run <code>corepack pnpm bootstrap:dev-data</code> to seed Hope Creek Farms, or import
              fields from the home page.
            </p>
            <p>
              <Link href="/">Return home</Link>
            </p>
          </section>
        </div>
      </main>
    );
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
      <PreviewShell initial={initial} />
    </ErrorBoundary>
  );
}
