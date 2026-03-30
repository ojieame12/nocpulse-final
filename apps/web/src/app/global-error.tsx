"use client";
import React, { useEffect } from "react";

export default function RootGlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app] Catastrophic root layout crash:", error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div style={{ display: "flex", height: "100vh", width: "100vw", alignItems: "center", justifyContent: "center", background: "#f8faf8" }}>
          <div style={{ padding: "32px", background: "white", borderRadius: "16px", border: "1px solid #ebebeb", textAlign: "center", maxWidth: "420px" }}>
            <h2 style={{ fontFamily: "serif", fontSize: "22px", margin: "0 0 16px 0", color: "#111" }}>Fatal Application Error</h2>
            <p style={{ fontFamily: "sans-serif", fontSize: "14px", margin: "0 0 24px 0", color: "#6b7280" }}>
              The application encountered a fatal error and the main layout could not be recovered.
            </p>
            <button
              onClick={() => reset()}
              style={{ padding: "12px 28px", background: "#004726", color: "white", borderRadius: "10px", border: "none", cursor: "pointer", fontWeight: "bold" }}
            >
              Restart Application
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
