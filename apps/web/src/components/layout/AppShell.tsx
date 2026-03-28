"use client";

import type { ReactNode } from "react";

interface AppShellProps {
  children: ReactNode;
  sidebar: ReactNode;
  panel?: ReactNode;
  topBar: ReactNode;
}

export function AppShell({ children, sidebar, panel, topBar }: AppShellProps) {
  return (
    <div className="app-shell">
      {topBar}
      <div className="app-body">
        {sidebar}
        <main className="map-area">{children}</main>
        {panel}
      </div>
    </div>
  );
}
