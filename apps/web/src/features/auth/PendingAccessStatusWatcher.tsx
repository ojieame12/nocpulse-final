"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const PENDING_ACCESS_POLL_MS = 3_000;

type PendingAccessStatusWatcherProps = {
  nextPath: string;
};

function buildSignInHref(nextPath: string) {
  return `/auth/sign-in?next=${encodeURIComponent(nextPath)}`;
}

export function PendingAccessStatusWatcher({
  nextPath,
}: PendingAccessStatusWatcherProps) {
  const router = useRouter();
  const [statusText, setStatusText] = useState(
    "Checking for workspace access every few seconds.",
  );
  const redirectingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function checkActor() {
      if (redirectingRef.current || cancelled) {
        return;
      }

      try {
        const response = await fetch("/api/auth/actor", {
          cache: "no-store",
        });

        if (cancelled || redirectingRef.current) {
          return;
        }

        if (response.ok) {
          redirectingRef.current = true;
          setStatusText("Access confirmed. Opening your workspace…");
          router.replace(nextPath);
          router.refresh();
          return;
        }

        if (response.status === 401) {
          redirectingRef.current = true;
          setStatusText("Your session expired. Returning to sign in…");
          router.replace(buildSignInHref(nextPath));
          router.refresh();
          return;
        }

        if (response.status === 403) {
          setStatusText(
            "Still waiting for this email to be provisioned for a workspace.",
          );
          return;
        }

        setStatusText("Waiting for workspace access. You can stay on this page while NocPulse checks again.");
      } catch {
        if (!cancelled && !redirectingRef.current) {
          setStatusText(
            "Waiting for workspace access. Network checks will retry automatically.",
          );
        }
      }
    }

    void checkActor();
    const intervalId = window.setInterval(() => {
      void checkActor();
    }, PENDING_ACCESS_POLL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [nextPath, router]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-sm)",
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
        Live Status
      </span>
      <p
        style={{
          margin: 0,
          fontFamily: "var(--font-body)",
          fontSize: "var(--text-sm)",
          lineHeight: "var(--leading-normal)",
          color: "var(--text-body)",
        }}
      >
        {statusText}
      </p>
    </div>
  );
}
