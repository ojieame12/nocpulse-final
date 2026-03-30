"use client";

import { useState } from "react";
import { Sprout, ShieldAlert, WifiOff, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { TopBar } from "../../components/layout/TopBar";
import { ThemeContext, type AppTheme } from "../../components/layout/WorkspaceShell";

/* ── Empty-state card (renders inside the map area) ───────────── */

function EmptyCard({
  icon: Icon,
  pill,
  title,
  description,
  linkHref,
  linkLabel,
}: {
  icon: LucideIcon;
  pill: string;
  title: string;
  description: React.ReactNode;
  linkHref?: string;
  linkLabel?: string;
}) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--space-2xl)",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "var(--space-lg)",
          maxWidth: 400,
          padding: "var(--space-3xl) var(--space-2xl)",
          borderRadius: "var(--panel-radius)",
          background: "var(--surface-white)",
          boxShadow: "var(--panel-shadow)",
          textAlign: "center",
          border: "1px solid var(--border-light)",
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: "var(--color-slate-50)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon size={26} strokeWidth={1.5} style={{ color: "var(--text-muted)" }} />
        </div>

        <span
          style={{
            fontFamily: "var(--font-body)",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "1.2px",
            textTransform: "uppercase",
            color: "var(--text-muted)",
          }}
        >
          {pill}
        </span>

        <h1
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: "var(--text-xl)",
            fontWeight: 400,
            color: "var(--text-primary)",
            margin: 0,
            lineHeight: "var(--leading-tight)",
          }}
        >
          {title}
        </h1>

        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "var(--text-sm)",
            color: "var(--text-secondary)",
            lineHeight: "var(--leading-normal)",
            margin: 0,
            maxWidth: 320,
          }}
        >
          {description}
        </p>

        {linkHref && linkLabel && (
          <Link
            href={linkHref}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "var(--btn-padding-v) var(--btn-padding-h)",
              borderRadius: "var(--btn-radius)",
              background: "var(--btn-fill-primary)",
              color: "var(--btn-text-primary)",
              fontFamily: "var(--font-body)",
              fontSize: 13,
              fontWeight: 700,
              textDecoration: "none",
              border: "1px solid transparent",
              marginTop: "var(--space-sm)",
            }}
          >
            {linkLabel}
          </Link>
        )}
      </div>
    </div>
  );
}

/* ── Shell wrapper (TopBar + empty map-area) ──────────────────── */

export function PreviewEmptyShell({
  status,
}: {
  status: "no-runtime" | "unauthenticated" | "no-fields";
}) {
  const [theme, setTheme] = useState<AppTheme>("dark");

  const cards: Record<typeof status, { icon: LucideIcon; pill: string; title: string; description: React.ReactNode; linkHref?: string; linkLabel?: string }> = {
    "no-runtime": {
      icon: WifiOff,
      pill: "Runtime unavailable",
      title: "Supabase runtime not configured",
      description: (
        <>
          Set{" "}
          <code style={{ fontFamily: "var(--font-mono)", fontSize: 11, background: "var(--color-slate-50)", padding: "2px 6px", borderRadius: 4 }}>SUPABASE_URL</code>{" "}
          and{" "}
          <code style={{ fontFamily: "var(--font-mono)", fontSize: 11, background: "var(--color-slate-50)", padding: "2px 6px", borderRadius: 4 }}>SUPABASE_SERVICE_ROLE_KEY</code>{" "}
          in your environment to enable live data.
        </>
      ),
    },
    unauthenticated: {
      icon: ShieldAlert,
      pill: "Authentication required",
      title: "Sign in to view the preview",
      description: "You need to be signed in to access the workspace preview.",
      linkHref: "/auth/sign-in?next=/preview",
      linkLabel: "Continue to sign in",
    },
    "no-fields": {
      icon: Sprout,
      pill: "No fields",
      title: "No fields in your workspace",
      description: (
        <>
          Run{" "}
          <code style={{ fontFamily: "var(--font-mono)", fontSize: 11, background: "var(--color-slate-50)", padding: "2px 6px", borderRadius: 4 }}>pnpm bootstrap:dev-data</code>{" "}
          to seed Hope Creek Farms, or import fields from the home page.
        </>
      ),
      linkHref: "/",
      linkLabel: "Return home",
    },
  };

  const card = cards[status];

  return (
    <ThemeContext.Provider value={theme}>
      <div className="app-shell" data-theme={theme}>
        <TopBar
          activeNav="Map"
          theme={theme}
          onThemeToggle={() => setTheme(theme === "dark" ? "light" : "dark")}
          showAddField={false}
          showAlertsBell={false}
        />
        <div className="app-body">
          <div className="map-area">
            <div
              className="map-area__canvas"
              style={{
                background:
                  theme === "dark"
                    ? "linear-gradient(135deg, #1a2e1a 0%, #2d4a2d 40%, #1f3a1f 100%)"
                    : "linear-gradient(135deg, #e8ede8 0%, #d5ddd5 40%, #e0e8e0 100%)",
              }}
            />
            <EmptyCard {...card} />
          </div>
        </div>
      </div>
    </ThemeContext.Provider>
  );
}
