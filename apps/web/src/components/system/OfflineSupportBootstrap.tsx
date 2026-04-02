"use client";

import { useEffect } from "react";

export function OfflineSupportBootstrap() {
  useEffect(() => {
    if (
      typeof window === "undefined"
      || !("serviceWorker" in navigator)
      || (!window.isSecureContext
        && window.location.hostname !== "localhost"
        && window.location.hostname !== "127.0.0.1")
    ) {
      return;
    }

    void navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.warn("[offline] service worker registration failed", error);
    });
  }, []);

  return null;
}
