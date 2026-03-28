"use client";

import { WorkspaceShell } from "../../components/layout/WorkspaceShell";
import type { SidebarFieldItem } from "../../components/layout/Sidebar";
import type { ReactNode } from "react";

export interface HomePageShellProps {
  fields: SidebarFieldItem[];
  children: ReactNode;
}

export function HomePageShell({ fields, children }: HomePageShellProps) {
  return (
    <WorkspaceShell fields={fields} activeNav="Map">
      {children}
    </WorkspaceShell>
  );
}
