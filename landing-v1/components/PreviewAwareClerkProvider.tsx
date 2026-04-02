"use client";

import type { ComponentProps, ReactNode } from "react";
import { ClerkProvider } from "@clerk/nextjs";
import { usePathname } from "next/navigation";
import { isV2PreviewPath } from "@/lib/is-v2-preview-path";

type PreviewAwareClerkProviderProps = {
  children: ReactNode;
  proxyUrl: string | undefined;
  signInUrl: string;
  signUpUrl: string;
  appearance: NonNullable<ComponentProps<typeof ClerkProvider>["appearance"]>;
};

export function PreviewAwareClerkProvider({
  children,
  proxyUrl,
  signInUrl,
  signUpUrl,
  appearance,
}: PreviewAwareClerkProviderProps) {
  const pathname = usePathname();

  if (isV2PreviewPath(pathname)) {
    return <>{children}</>;
  }

  return (
    <ClerkProvider
      proxyUrl={proxyUrl}
      signInUrl={signInUrl}
      signUpUrl={signUpUrl}
      appearance={appearance}
    >
      {children}
    </ClerkProvider>
  );
}
