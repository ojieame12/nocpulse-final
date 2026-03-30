"use client";
import React, { Component } from "react";
import type { ReactNode, ErrorInfo } from "react";

interface Props {
  children?: ReactNode;
  fallbackMessage?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary] Caught local rendering error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            width: "100%",
            padding: "var(--space-2xl)",
            background: "var(--surface-bg)",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "360px",
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
            <span
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "var(--text-lg)",
                fontWeight: 700,
                color: "var(--text-primary)",
              }}
            >
              Component Error
            </span>
            <span
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "var(--text-sm)",
                color: "var(--text-secondary)",
                lineHeight: "var(--leading-normal)",
              }}
            >
              {this.props.fallbackMessage || 
                this.state.error?.message || 
                "This section failed to load properly."}
            </span>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                if (this.props.onReset) this.props.onReset();
              }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "var(--space-sm)",
                padding: "8px 16px",
                border: "1px solid transparent",
                borderRadius: "var(--btn-radius)",
                background: "var(--btn-fill-primary)",
                color: "var(--btn-text-primary)",
                fontFamily: "var(--font-body)",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
                marginTop: "var(--space-sm)",
              }}
            >
              Try again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
