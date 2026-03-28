"use client";

import type { ComponentPropsWithoutRef } from "react";
import { Bell } from "lucide-react";

const NAV_ITEMS = ["Crops", "Action", "Notes", "Zones", "Settings"] as const;

interface TopBarProps {
  activeNav?: string;
  onNavChange?: (nav: string) => void;
  onAlertsBell?: () => void;
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

export function TopBar({ activeNav, onNavChange, onAlertsBell }: TopBarProps) {
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
