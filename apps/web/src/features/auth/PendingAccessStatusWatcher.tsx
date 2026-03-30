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
  const activeRequestRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timeoutId: number | null = null;

    async function checkActor() {
      if (redirectingRef.current || cancelled) {
        return;
      }

      activeRequestRef.current?.abort();
      const controller = new AbortController();
      activeRequestRef.current = controller;

      try {
        const response = await fetch("/api/auth/actor", {
          cache: "no-store",
          signal: controller.signal,
        });

        if (
          cancelled ||
          redirectingRef.current ||
          activeRequestRef.current !== controller
        ) {
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
        if (
          !cancelled &&
          !redirectingRef.current &&
          !controller.signal.aborted
        ) {
          setStatusText(
            "Waiting for workspace access. Network checks will retry automatically.",
          );
        }
      } finally {
        if (activeRequestRef.current === controller) {
          activeRequestRef.current = null;
        }

        if (!cancelled && !redirectingRef.current) {
          timeoutId = window.setTimeout(() => {
            void checkActor();
          }, PENDING_ACCESS_POLL_MS);
        }
      }
    }

    void checkActor();

    return () => {
      cancelled = true;
      activeRequestRef.current?.abort();
      activeRequestRef.current = null;

      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
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
