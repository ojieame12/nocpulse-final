# NocPulse (FieldPulse v3)

Agricultural intelligence platform for farmers and agronomists.

## Design System

**Read `apps/web/DESIGN-SYSTEM.md` before making any UI changes.** It contains exact tokens, spacing rules, typography, color system, component anatomy, and animation specs derived from the canonical `nocpulse-final.pen` design file.

Key rules:
- Always use CSS custom properties from `:root` tokens — never hardcode values
- P22 Mackinac (serif) for hero values only. Sintony for all UI. IBM Plex Mono for data.
- Panel body padding is `48px 32px 24px 32px`. Section gap is `24px`. These are non-negotiable.
- Status colors map to agricultural semantics: green = healthy, red = stress, amber = watch
- Read exact values from the `.pen` file via Pencil MCP `batch_get` with `resolveVariables: true` — never guess from screenshots

## Pencil MCP

The design source of truth is a `.pen` file edited in the Pencil app. Use `get_editor_state()` to find the active file, then `batch_get` with `resolveVariables: true` and `readDepth: 3+` to read exact property values. Never take screenshots to understand values.

## Tech Stack

- Next.js 15 (App Router) + React 19 + TypeScript
- Monorepo: `apps/web` (frontend), `apps/worker`, `packages/*`
- CSS: Global stylesheet at `apps/web/src/app/globals.css` with custom properties
- Modular tab CSS at `apps/web/src/styles/tabs/*.css`
- Maps: MapLibre GL via `@fieldpulse/map` package
- Icons: Lucide React only

## Key Paths

- Live app: `apps/web/src/app/page.tsx` → `features/home/HomeScreen.tsx`
- Field view: `apps/web/src/app/fields/[fieldId]/page.tsx` → `features/fields/FieldPageShell.tsx`
- Preview: `apps/web/src/app/preview/page.tsx` (demo data, all panels)
- Panel components: `apps/web/src/components/panels/`
- Tab components: `apps/web/src/features/fields/tabs/`
- UI primitives: `apps/web/src/components/ui/`
- Layout: `apps/web/src/components/layout/`
