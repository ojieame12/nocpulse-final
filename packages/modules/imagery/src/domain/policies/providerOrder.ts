import type { ImageryProvider } from "../../contracts/ImageryProvider";

export const DEFAULT_IMAGERY_PROVIDER_ORDER: readonly ImageryProvider[] = [
  "sentinel-2",
  "planet",
  "sentinel-1",
] as const;
