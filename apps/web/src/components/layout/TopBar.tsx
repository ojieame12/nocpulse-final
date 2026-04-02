"use client";

import type { ComponentPropsWithoutRef, CSSProperties } from "react";
import { Bell, Moon, Plus, SunMedium } from "lucide-react";
import type { AppTheme } from "./WorkspaceShell";

const NAV_ITEMS = ["Crops", "Action", "Notes", "Zones", "Settings"] as const;

interface TopBarProps {
  activeNav?: string;
  onNavChange?: (nav: string) => void;
  onAlertsBell?: () => void;
  onAddField?: () => void;
  theme?: AppTheme;
  onThemeToggle?: () => void;
  showSettingsNav?: boolean;
  showAddField?: boolean;
  showAlertsBell?: boolean;
  showAvatar?: boolean;
  viewer?: {
    displayName: string;
    email: string | null;
    initials: string;
    workspaceRoleLabel: string;
    workspaceName: string | null;
  } | null;
  guestBadgeLabel?: string | null;
  guestCtaHref?: string | null;
  statusBadgeLabel?: string | null;
  statusBadgeTone?: "warning" | "info";
}

function NocPulseLogo(props: ComponentPropsWithoutRef<"img">) {
  return (
    <img
      src="/logo.svg"
      alt="NocPulse"
      {...props}
      className={props.className ?? "app-topbar__brand-logo"}
    />
  );
}

export function TopBar({
  activeNav,
  onNavChange,
  onAlertsBell,
  onAddField,
  theme,
  onThemeToggle,
  showSettingsNav = true,
  showAddField = true,
  showAlertsBell = true,
  showAvatar = true,
  viewer = null,
  guestBadgeLabel = null,
  guestCtaHref = null,
  statusBadgeLabel = null,
  statusBadgeTone = "warning",
}: TopBarProps) {
  const isDark = theme === "dark";
  const navItems = showSettingsNav
    ? NAV_ITEMS
    : NAV_ITEMS.filter((item) => item !== "Settings");
  const guestBadgeStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 30,
    padding: "0 12px",
    borderRadius: 999,
    background: isDark ? "rgba(245, 158, 11, 0.18)" : "rgba(245, 158, 11, 0.12)",
    color: isDark ? "#fcd34d" : "var(--status-warning)",
    fontFamily: "var(--font-body)",
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: "0.01em",
    whiteSpace: "nowrap",
  };
  const guestCtaStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 30,
    padding: "0 14px",
    borderRadius: 8,
    background: isDark
      ? "rgba(0, 71, 38, 0.95)"
      : "var(--btn-fill-primary, var(--primary-green))",
    color: "var(--btn-text-primary, #fff)",
    fontFamily: "var(--font-body)",
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: "0.01em",
    textDecoration: "none",
    whiteSpace: "nowrap",
    boxShadow: "0 4px 0 #002a15",
  };
  const statusBadgeStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 30,
    padding: "0 12px",
    borderRadius: 999,
    background:
      statusBadgeTone === "info"
        ? isDark
          ? "rgba(96, 165, 250, 0.16)"
          : "rgba(59, 130, 246, 0.1)"
        : isDark
          ? "rgba(245, 158, 11, 0.18)"
          : "rgba(245, 158, 11, 0.12)",
    color:
      statusBadgeTone === "info"
        ? isDark
          ? "#bfdbfe"
          : "#1d4ed8"
        : isDark
          ? "#fcd34d"
          : "var(--status-warning)",
    fontFamily: "var(--font-body)",
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: "0.01em",
    whiteSpace: "nowrap",
  };
  const viewerMeta = viewer?.email
    ? `${viewer.email} · ${viewer.workspaceRoleLabel}`
    : viewer
      ? [viewer.workspaceRoleLabel, viewer.workspaceName]
          .filter(Boolean)
          .join(" · ")
      : null;
  const viewerTitle = viewer
    ? [viewer.displayName, viewer.email, viewer.workspaceRoleLabel, viewer.workspaceName]
        .filter(Boolean)
        .join(" · ")
    : null;

  return (
    <header className="app-topbar">
      <div className="app-topbar__left">
        <NocPulseLogo
          className="app-topbar__brand-logo"
          width={101}
          height={24}
          aria-label="NocPulse"
        />
      </div>

      <nav className="app-topbar__center">
        {navItems.map((item) => (
          <button
            key={item}
            className={`nav-link${activeNav === item ? " nav-link--active" : ""}`}
            onClick={() => onNavChange?.(item)}
          >
            {item}
          </button>
        ))}
      </nav>

      <div className="app-topbar__right">
        {statusBadgeLabel ? (
          <span style={statusBadgeStyle}>{statusBadgeLabel}</span>
        ) : null}
        {guestBadgeLabel ? (
          <span style={guestBadgeStyle}>{guestBadgeLabel}</span>
        ) : null}
        {guestCtaHref ? (
          <a href={guestCtaHref} style={guestCtaStyle}>
            Get full access
          </a>
        ) : null}
        {showAddField ? (
          <button
            type="button"
            className="app-topbar__add-field-btn"
            onClick={onAddField}
            aria-label="Add field"
          >
            <Plus size={14} strokeWidth={2.5} />
            <span>Add Field</span>
          </button>
        ) : null}
        <button
          type="button"
          className="app-topbar__theme-btn"
          onClick={onThemeToggle}
          aria-label="Toggle theme"
        >
          {isDark ? <SunMedium size={16} strokeWidth={2} /> : <Moon size={16} strokeWidth={2} />}
        </button>
        {showAlertsBell ? (
          <button
            type="button"
            className="app-topbar__bell-btn"
            onClick={onAlertsBell}
            aria-label="Alerts"
          >
            <Bell size={18} strokeWidth={2} />
          </button>
        ) : null}
        {showAvatar ? (
          viewer ? (
            <div className="app-topbar__avatar-wrap" title={viewerTitle ?? undefined}>
              <div className="app-topbar__avatar app-topbar__avatar--initials">
                {viewer.initials}
              </div>
              <div className="app-topbar__avatar-dropdown">
                <span className="app-topbar__viewer-name">{viewer.displayName}</span>
                <span className="app-topbar__viewer-role">{viewerMeta ?? viewer.workspaceRoleLabel}</span>
                {viewer.email ? (
                  <span className="app-topbar__viewer-email">{viewer.email}</span>
                ) : null}
                {viewer.workspaceName ? (
                  <span className="app-topbar__viewer-workspace">{viewer.workspaceName}</span>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="app-topbar__avatar" />
          )
        ) : null}
      </div>
    </header>
  );
}
