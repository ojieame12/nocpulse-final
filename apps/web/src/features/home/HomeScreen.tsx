import Link from "next/link";
import { redirect } from "next/navigation";
import { SignOutButton } from "../auth/SignOutButton";
import { buildHomeViewModel } from "./buildHomeViewModel";
import { HomePageShell } from "./HomePageShell";

export async function HomeScreen() {
  const viewModel = await buildHomeViewModel();

  /* Auto-select the first field if available */
  if (viewModel.liveFields.length > 0) {
    redirect(`/fields/${viewModel.liveFields[0].id}`);
  }

  return (
    <HomePageShell fields={viewModel.sidebarFields}>
      <div className="shell" style={{ padding: 32 }}>
        <section className="hero">
          <span className="pill">Fresh-slate v3 scaffold</span>
          <h1>{viewModel.appName}</h1>
          <p>
            This workspace is intentionally clean: one app shell, one worker runtime,
            explicit module boundaries, and a rendering contract that treats reliable
            extrusions, lighting, and shading as first-class architecture.
          </p>

          <div className="meta">
            <div className="panel">
              <h2>Workspace</h2>
              <p>{viewModel.workspaceLabel}</p>
            </div>
            <div className="panel">
              <h2>Field</h2>
              <p>{viewModel.fieldLabel}</p>
            </div>
            <div className="panel">
              <h2>Moisture</h2>
              <p>{viewModel.moistureLabel}</p>
            </div>
          </div>
        </section>

        <section className="grid">
          <article className="panel">
            <h2>Auth</h2>
            <p>{viewModel.authStatusLabel}</p>
            <p>{viewModel.authActorLabel}</p>
            {viewModel.authMode === "supabase-session" ? (
              <SignOutButton redirectTo="/auth/sign-in" />
            ) : (
              <p>
                <Link href="/auth/sign-in">Sign in with email</Link>
              </p>
            )}
          </article>

          <article className="panel">
            <h2>Live data</h2>
            <p>{viewModel.liveDataLabel}</p>
            {viewModel.bootstrapHint ? <p>{viewModel.bootstrapHint}</p> : null}
            <ul>
              {viewModel.liveFields.length > 0 ? (
                viewModel.liveFields.map((field) => (
                  <li key={field.id}>
                    <Link href={`/fields/${field.id}`}>{field.name}</Link> · {field.areaHaLabel} · {field.moistureLabel}
                  </li>
                ))
              ) : (
                <li>No live fields available yet.</li>
              )}
            </ul>
          </article>

          <article className="panel">
            <h2>Environment</h2>
            <ul>
              <li>{viewModel.dataRuntimeLabel}</li>
              <li>{viewModel.r2RuntimeLabel}</li>
              <li>{viewModel.databaseUrlPresent ? "DATABASE_URL present" : "DATABASE_URL missing"}</li>
              <li>{viewModel.devSelectorLabel}</li>
            </ul>
          </article>
        </section>
      </div>
    </HomePageShell>
  );
}
