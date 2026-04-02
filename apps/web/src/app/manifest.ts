import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "NocPulse",
    short_name: "NocPulse",
    description:
      "Field intelligence for growers. Satellite health scores, explainable alerts, and actionable crop monitoring.",
    start_url: "/preview",
    display: "standalone",
    background_color: "#0b110d",
    theme_color: "#0b110d",
    icons: [
      {
        src: "/nocpulse-logo.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/nDwUq.png",
        sizes: "192x192",
        type: "image/png",
      },
    ],
  };
}
