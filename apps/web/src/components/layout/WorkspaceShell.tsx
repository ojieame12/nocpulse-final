"use client";

import { createContext, useContext, useState } from "react";
import { useRouter } from "next/navigation";
import { TopBar } from "./TopBar";
import { Sidebar, type SidebarFieldItem } from "./Sidebar";
import type { ReactNode } from "react";
import { AppShellErrorBoundary } from "./AppShellErrorBoundary";

export type AppTheme = "light" | "dark";

export const ThemeContext = createContext<AppTheme>("dark");
export function useAppTheme() {
  return useContext(ThemeContext);
}

export interface WorkspaceShellProps {
  /** Sidebar field list */
  fields: SidebarFieldItem[];
  /** Currently selected field (if any) */
  activeFieldId?: string;
  /** Active top nav item */
  activeNav?: string;
  /** Callback when top nav changes */
  onNavChange?: (nav: string) => void;
  /** Callback when alerts bell is clicked */
  onAlertsBell?: () => void;
  /** Callback when add-field is clicked */
  onAddField?: () => void;
  /** Right-side panel (optional) */
  panel?: ReactNode;
  /** Whether the panel is hidden / collapsed */
  panelHidden?: boolean;
  /** Main content area */
  children: ReactNode;
}

export function WorkspaceShell({
  fields,
  activeFieldId,
  activeNav,
  onNavChange,
  onAlertsBell,
  onAddField,
  panel,
  panelHidden,
  children,
}: WorkspaceShellProps) {
  const router = useRouter();
  const [theme, setTheme] = useState<AppTheme>("dark");

  function handleFieldSelect(id: string) {
    router.push(`/fields/${id}`);
  }

  return (
    <ThemeContext.Provider value={theme}>
      <div className="app-shell" data-theme={theme} {...(panelHidden ? { "data-panel-hidden": "true" } : {})}>
        <TopBar
          activeNav={activeNav}
          onNavChange={onNavChange}
          onAlertsBell={onAlertsBell}
          onAddField={onAddField}
          theme={theme}
          onThemeToggle={() => setTheme(theme === "dark" ? "light" : "dark")}
        />
        <div className="app-body">
          <Sidebar
            fields={fields}
            activeFieldId={activeFieldId}
            onFieldSelect={handleFieldSelect}
          />
          <div className="map-area">
            <AppShellErrorBoundary
              resetKey={`${activeFieldId ?? "workspace"}:${panelHidden ? "closed" : "open"}`}
              title="Workspace shell recovered"
              description="A render path inside the field shell failed. Reload the shell to recover the map and panel."
            >
              {children}
              {panel ? <div className="map-area__panel-layer">{panel}</div> : null}
            </AppShellErrorBoundary>
          </div>
        </div>
      </div>
    </ThemeContext.Provider>
  );
}
