export type RasterArtifact = {
  key: string;
  width: number;
  height: number;
  bands: number;
};

export type RasterComputationMode = "native" | "enhanced" | "fallback";
