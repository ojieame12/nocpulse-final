"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { isV2PreviewPath } from "@/lib/is-v2-preview-path";
import { AppProviders } from "@/providers/app-providers";

export function PreviewAwareAppProviders({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (isV2PreviewPath(pathname)) {
    return <>{children}</>;
  }

  return <AppProviders>{children}</AppProviders>;
}
