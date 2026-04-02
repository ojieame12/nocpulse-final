import type { Metadata } from "next";
import { headers } from "next/headers";
import { IBM_Plex_Mono, Sintony } from "next/font/google";
import localFont from "next/font/local";
import { PreviewAwareClerkProvider } from "@/components/auth/PreviewAwareClerkProvider";
import { PreviewAwareAppProviders } from "@/components/providers/PreviewAwareAppProviders";
import { env } from "@/lib/env";
import "./globals.css";

const mackinac = localFont({
  src: [
    { path: "../../public/fonts/P22Mackinac-Book.otf", weight: "400" },
    { path: "../../public/fonts/P22Mackinac-Medium.otf", weight: "500" },
    { path: "../../public/fonts/P22Mackinac-Bold.otf", weight: "700" },
  ],
  variable: "--font-mackinac",
  display: "swap",
});

const sintony = Sintony({
  variable: "--font-sintony",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "700"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "FieldPulse",
  description:
    "Map-first crop intelligence for field health review and explainable actions.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const requestHeaders = await headers();
  const forwardedProto = requestHeaders.get("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim();
  const forwardedHost = (
    requestHeaders.get("x-forwarded-host") ??
    requestHeaders.get("host")
  )
    ?.split(",")[0]
    ?.trim();
  const isLocalHost = Boolean(
    forwardedHost &&
      (forwardedHost.startsWith("localhost") || forwardedHost.startsWith("127.0.0.1")),
  );
  const appOrigin = !isLocalHost && forwardedProto && forwardedHost
    ? `${forwardedProto}://${forwardedHost}`
    : env.appUrl.replace(/\/$/, "");
  const clerkProxyUrl = appOrigin.startsWith("https://")
    ? `${appOrigin}/clerk-proxy`
    : undefined;
  const shell = (
    <>
      <PreviewAwareAppProviders>{children}</PreviewAwareAppProviders>
    </>
  );

  return (
    <html lang="en">
      <body
        className={`${mackinac.variable} ${sintony.variable} ${plexMono.variable} antialiased`}
      >
        <PreviewAwareClerkProvider
          proxyUrl={clerkProxyUrl}
          signInUrl="/sign-in"
          signUpUrl="/sign-up"
          appearance={{
            variables: {
              colorPrimary: "#004726",
              colorTextOnPrimaryBackground: "#FFFFFF",
              colorBackground: "#FFFFFF",
              colorText: "#2D2D2D",
              colorTextSecondary: "#8A8F98",
              colorInputBackground: "#FFFFFF",
              colorInputText: "#2D2D2D",
              borderRadius: "10px",
              fontFamily: "var(--font-sintony), sans-serif",
              fontSize: "14px",
            },
            elements: {
              card: { boxShadow: "0 8px 32px -8px rgba(0,0,0,0.10)", border: "1px solid #EBEBEB", borderRadius: "16px" },
              headerTitle: { fontFamily: "var(--font-mackinac), Georgia, serif", fontWeight: 300, color: "#2D2D2D", fontSize: "22px" },
              headerSubtitle: { color: "#8A8F98" },
              formButtonPrimary: { backgroundColor: "#004726", boxShadow: "0 4px 0 #002A15", borderRadius: "10px", fontWeight: 700 },
              formFieldInput: { borderColor: "#EBEBEB", borderRadius: "10px" },
              footerActionLink: { color: "#004726" },
              socialButtonsBlockButton: { borderColor: "#EBEBEB", borderRadius: "10px" },
            },
          }}
        >
          {shell}
        </PreviewAwareClerkProvider>
      </body>
    </html>
  );
}
