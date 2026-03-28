"use client";

import { useRouter } from "next/navigation";
import { TopBar } from "./TopBar";
import { Sidebar, type SidebarFieldItem } from "./Sidebar";
import type { ReactNode } from "react";

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
  /** Right-side panel (optional) */
  panel?: ReactNode;
  /** Main content area */
  children: ReactNode;
}

export function WorkspaceShell({
  fields,
  activeFieldId,
  activeNav,
  onNavChange,
  onAlertsBell,
  panel,
  children,
}: WorkspaceShellProps) {
  const router = useRouter();

  function handleFieldSelect(id: string) {
    router.push(`/fields/${id}`);
  }

  return (
    <div className="app-shell">
      <TopBar activeNav={activeNav} onNavChange={onNavChange} onAlertsBell={onAlertsBell} />
      <div className="app-body">
        <Sidebar
          fields={fields}
          activeFieldId={activeFieldId}
          onFieldSelect={handleFieldSelect}
        />
        <div className="map-area">
          {children}
          {panel}
        </div>
      </div>
    </div>
  );
}
