"use client";

import { AlertTriangle, RefreshCcw } from "lucide-react";
import type { ErrorInfo, ReactNode } from "react";
import { Component } from "react";

type AppShellErrorBoundaryProps = {
  children: ReactNode;
  resetKey?: string | null;
  title?: string;
  description?: string;
};

type AppShellErrorBoundaryState = {
  error: Error | null;
};

export class AppShellErrorBoundary extends Component<
  AppShellErrorBoundaryProps,
  AppShellErrorBoundaryState
> {
  state: AppShellErrorBoundaryState = {
    error: null,
  };

  static getDerivedStateFromError(error: Error) {
    return {
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[app-shell] boundary caught render failure", error, errorInfo);
  }

  componentDidUpdate(prevProps: AppShellErrorBoundaryProps) {
    if (
      this.state.error &&
      prevProps.resetKey !== this.props.resetKey
    ) {
      this.setState({
        error: null,
      });
    }
  }

  handleRetry = () => {
    this.setState({
      error: null,
    });
  };

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <div
        role="alert"
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "var(--space-2xl)",
          background: "rgba(248, 250, 248, 0.92)",
        }}
      >
        <div
          style={{
            width: "min(100%, 420px)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "var(--space-lg)",
            padding: "var(--empty-padding)",
            borderRadius: "var(--empty-radius)",
            border: "var(--empty-border)",
            background: "var(--surface-white)",
            boxShadow: "var(--shadow-card)",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "var(--radius-full)",
              background: "var(--status-warning-bg)",
              color: "var(--status-warning-fg)",
            }}
          >
            <AlertTriangle size={20} />
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-sm)",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "var(--text-lg)",
                fontWeight: 700,
                color: "var(--text-primary)",
                lineHeight: "var(--leading-snug)",
              }}
            >
              {this.props.title ?? "Shell recovered from a render error"}
            </span>
            <span
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "var(--text-sm)",
                color: "var(--text-secondary)",
                lineHeight: "var(--leading-normal)",
              }}
            >
              {this.props.description ??
                "A panel or map render path failed. Retry the shell without leaving the workspace."}
            </span>
          </div>
          <button
            type="button"
            onClick={this.handleRetry}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "var(--space-sm)",
              padding: "var(--btn-padding-v) var(--btn-padding-h)",
              border: "1px solid transparent",
              borderRadius: "var(--btn-radius)",
              background: "var(--btn-fill-primary)",
              boxShadow: "var(--shadow-btn)",
              color: "var(--btn-text-primary)",
              fontFamily: "var(--font-body)",
              fontSize: "var(--btn-font-size)",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            <RefreshCcw size={14} />
            Reload shell
          </button>
        </div>
      </div>
    );
  }
}
