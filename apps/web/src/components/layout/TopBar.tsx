"use client";

import type { ComponentPropsWithoutRef } from "react";
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

export function TopBar({ activeNav, onNavChange, onAlertsBell, onAddField, theme, onThemeToggle }: TopBarProps) {
  const isDark = theme === "dark";

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
        {NAV_ITEMS.map((item) => (
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
        <button
          type="button"
          className="app-topbar__add-field-btn"
          onClick={onAddField}
          aria-label="Add field"
        >
          <Plus size={14} strokeWidth={2.5} />
          <span>Add Field</span>
        </button>
        <button
          type="button"
          className="app-topbar__theme-btn"
          onClick={onThemeToggle}
          aria-label="Toggle theme"
        >
          {isDark ? <SunMedium size={16} strokeWidth={2} /> : <Moon size={16} strokeWidth={2} />}
        </button>
        <button
          type="button"
          className="app-topbar__bell-btn"
          onClick={onAlertsBell}
          aria-label="Alerts"
        >
          <Bell size={18} strokeWidth={2} />
        </button>
        <div className="app-topbar__avatar" />
      </div>
    </header>
  );
}
