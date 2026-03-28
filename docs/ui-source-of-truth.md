# UI Source Of Truth

The canonical design source for the current FieldPulse v3 UI is the repo-local
Pencil document at:

- `/Users/ojieame/FieldPulse-v3/designs/pencil/nocpulse.pen`

Today that repo path is a symlink to the original local Pencil file in:

- `/Users/ojieame/Downloads/nocpulse`

That symlink exists because the current shell environment is blocked by macOS
privacy restrictions from reading `Downloads` directly enough to vendor the raw
bytes into git. Even so, the repo-local path is now the canonical way to open
the design in Pencil, and any UI work must be validated against this document
instead of inferred from the existing React code alone.

## Canonical Code Mirror

The codebase that should mirror the Pencil design is:

- `apps/web`

The main design-aligned preview surface is:

- `src/app/preview/page.tsx`

The live field workspace is:

- `src/app/fields/[fieldId]/page.tsx`

The preview route may use fixture/demo data to mirror the design, but layout,
spacing, structure, and component behavior should be checked against the Pencil
document before any UI edits are made.

## Current Verified Mapping

The active Pencil document contains frames/components that correspond directly
to the current web implementation:

- `SpXSB` -> Summary panel view
- `yJDC8` -> Report panel view
- `3bJXa` -> Alerts view
- `C3oW8` -> Top bar
- `B7AFk` -> Sidebar field item

These map to:

- `src/components/panels/SummaryTab.tsx`
- `src/components/panels/ReportTab.tsx`
- `src/components/panels/AlertsPanel.tsx`
- `src/components/layout/TopBar.tsx`
- `src/components/layout/Sidebar.tsx`

## Working Rules

- Do not make inferred UI changes without checking the Pencil file first.
- Treat `apps/web` as the only frontend implementation target for this design.
- Do not use `NocFarm` UI components as a source of truth for new FieldPulse v3
  UI work.
- If a UI behavior exists in code but not in the Pencil file, assume it needs
  confirmation before changing adjacent layout or interaction.

## Port Sanity

When local ports are confused, run the real FieldPulse v3 app from:

- `/Users/ojieame/FieldPulse-v3/apps/web`

A clean launch can use any free port. During the latest verification pass, the
canonical fresh instance was:

- `http://localhost:3010`
- `http://localhost:3010/preview`

If multiple Next.js servers are running, prefer shutting down the others and
restarting `apps/web` on a fresh port rather than trusting an older dev server.
