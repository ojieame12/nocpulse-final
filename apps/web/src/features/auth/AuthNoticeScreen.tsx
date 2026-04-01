import Link from "next/link";
import type { ReactNode } from "react";

type AuthNoticeAction = {
  href: string;
  label: string;
  variant?: "primary" | "secondary";
};

type AuthNoticeScreenProps = {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
  detail?: ReactNode;
  actions?: readonly AuthNoticeAction[];
  footer?: ReactNode;
  showLogo?: boolean;
};

export function AuthNoticeScreen({
  eyebrow,
  title,
  description,
  children,
  detail,
  actions = [],
  footer,
  showLogo = true,
}: AuthNoticeScreenProps) {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--space-3xl) var(--space-lg)",
        background: "var(--surface-bg)",
      }}
    >
      <section
        style={{
          width: "min(100%, var(--panel-width))",
          background: "var(--surface-white)",
          border: "1px solid var(--border-light)",
          borderRadius: "var(--panel-radius)",
          boxShadow: "var(--panel-shadow)",
          overflow: "hidden",
        }}
      >
        <header
          style={{
            minHeight: "var(--panel-header-h)",
            padding: "var(--panel-header-padding)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid var(--border-light)",
            background: "var(--panel-header-bg)",
            fontFamily: "var(--font-body)",
            fontSize: "9px",
            fontWeight: 700,
            letterSpacing: "1px",
            textTransform: "uppercase",
            color: "var(--text-muted)",
          }}
        >
          {showLogo ? (
            <img src="/logo.svg" alt="NocPulse" style={{ height: 12, opacity: 0.4 }} />
          ) : null}
          <span>{eyebrow}</span>
        </header>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--panel-body-gap)",
            padding: "var(--panel-body-padding)",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-md)",
            }}
          >
            <h1
              style={{
                margin: 0,
                fontFamily: "var(--font-heading)",
                fontSize: "var(--text-2xl)",
                fontWeight: 400,
                lineHeight: "var(--leading-tight)",
                color: "var(--text-primary)",
              }}
            >
              {title}
            </h1>
            <p
              style={{
                margin: 0,
                fontFamily: "var(--font-body)",
                fontSize: "var(--text-sm)",
                lineHeight: "var(--leading-normal)",
                color: "var(--text-body)",
              }}
            >
              {description}
            </p>
          </div>

          {detail ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--section-gap)",
                padding: "var(--section-padding)",
                borderRadius: "var(--section-radius)",
                background: "var(--section-bg)",
                border: "var(--section-border)",
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "9px",
                  fontWeight: 700,
                  letterSpacing: "1px",
                  textTransform: "uppercase",
                  color: "var(--text-muted)",
                }}
              >
                Current State
              </span>
              <div
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "var(--text-sm)",
                  lineHeight: "var(--leading-normal)",
                  color: "var(--text-body)",
                }}
              >
                {detail}
              </div>
            </div>
          ) : null}

          {children}

          {actions.length > 0 ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-md)",
              }}
            >
              {actions.map((action) => {
                const isPrimary = action.variant !== "secondary";

                return (
                  <Link
                    key={`${action.href}:${action.label}`}
                    href={action.href}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: isPrimary
                        ? "var(--btn-padding-v) var(--btn-padding-h)"
                        : "10px var(--btn-padding-h)",
                      borderRadius: "var(--btn-radius)",
                      border: isPrimary
                        ? "1px solid transparent"
                        : "1px solid var(--border-light)",
                      background: isPrimary
                        ? "var(--btn-fill-primary)"
                        : "var(--surface-white)",
                      boxShadow: isPrimary ? "var(--shadow-btn)" : "none",
                      color: isPrimary
                        ? "var(--btn-text-primary)"
                        : "var(--text-body)",
                      fontFamily: "var(--font-body)",
                      fontSize: "var(--btn-font-size)",
                      fontWeight: 700,
                      lineHeight: "var(--leading-normal)",
                      textDecoration: "none",
                    }}
                  >
                    {action.label}
                  </Link>
                );
              })}
            </div>
          ) : null}

          {footer ? (
            <div
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "var(--text-xs)",
                lineHeight: "var(--leading-normal)",
                color: "var(--text-muted)",
              }}
            >
              {footer}
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
