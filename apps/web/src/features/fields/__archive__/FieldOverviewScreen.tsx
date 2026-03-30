import Link from "next/link";
import { buildFieldOverviewViewModel } from "../buildFieldOverviewViewModel";
import { FieldPageShell } from "../FieldPageShell";

type FieldOverviewScreenProps = {
  fieldId: string;
};

export async function FieldOverviewScreen({
  fieldId,
}: FieldOverviewScreenProps) {
  const viewModel = await buildFieldOverviewViewModel(fieldId);

  if (viewModel.status === "unauthenticated") {
    const nextPath = `/fields/${fieldId}`;

    return (
      <main>
        <div className="shell">
          <section className="hero">
            <span className="pill">Authentication required</span>
            <h1>Sign in to view this field</h1>
            <p>{viewModel.authMessage}</p>
            <p>
              <Link href={`/auth/sign-in?next=${encodeURIComponent(nextPath)}`}>
                Continue to sign in
              </Link>
            </p>
          </section>
        </div>
      </main>
    );
  }

  if (viewModel.status === "not-found") {
    return (
      <main>
        <div className="shell">
          <section className="hero">
            <span className="pill">Field not found</span>
            <h1>No field matched this route</h1>
            <p>{viewModel.workspaceLabel}</p>
            <p>
              <Link href="/">Return home</Link>
            </p>
          </section>
        </div>
      </main>
    );
  }

  return (
    <FieldPageShell
      fields={viewModel.sidebarFields}
      activeFieldId={viewModel.fieldId}
      activeFieldName={viewModel.fieldName}
      summary={viewModel.summary}
      report={viewModel.reportPanel}
      action={viewModel.actionPanel}
      notes={viewModel.notesPanel}
      market={viewModel.marketPanel}
      crop={viewModel.cropPanel}
      alerts={viewModel.alertsPanel}
      activity={viewModel.activityPanel}
      mapModel={viewModel.mapPreview}
      cellInspector={viewModel.cellInspector}
    />
  );
}
