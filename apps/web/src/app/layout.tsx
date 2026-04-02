import type { Metadata } from "next";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";
import "../styles/field-detail-panel.css";
import "../styles/landing.css";
import { OfflineSupportBootstrap } from "../components/system/OfflineSupportBootstrap";

export const metadata: Metadata = {
  title: "NocPulse — Agricultural Intelligence",
  description: "Field intelligence for growers. Satellite health scores, explainable alerts, and actionable crop monitoring.",
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="dark" style={{ colorScheme: "dark" }}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=Sintony:wght@400;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <OfflineSupportBootstrap />
        {children}
      </body>
    </html>
  );
}
