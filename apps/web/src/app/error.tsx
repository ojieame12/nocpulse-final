"use client";
import React, { useEffect } from "react";

export default function GlobalRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error("[app] Unhandled Route segment error thrown:", error);
  }, [error]);

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
        <span
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: "var(--text-xl)",
            fontWeight: 700,
            color: "var(--text-primary)",
            lineHeight: "var(--leading-snug)",
          }}
        >
          Something went wrong
        </span>
        <span
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "var(--text-sm)",
            color: "var(--text-secondary)",
            lineHeight: "var(--leading-normal)",
          }}
        >
          {error.message || "An unexpected error caused this section to crash."}
        </span>
        <button
          onClick={reset}
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
            marginTop: "var(--space-md)",
          }}
        >
          Retry
        </button>
      </div>
    </div>
  );
}
