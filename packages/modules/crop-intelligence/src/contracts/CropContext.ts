export type GrowthStageKey =
  | "pre-seed"
  | "vegetative"
  | "flowering"
  | "ripening";

export type CropContextInput = {
  cropType?: string | null;
  growthStage?: string | null;
};

export type ResolvedCropContext = {
  cropKey: string;
  cropLabel: string;
  growthStage: GrowthStageKey;
  normalizedCropType: string | null;
  isGenericCrop: boolean;
  isDefaultStage: boolean;
  gddBaseC: number;
  stageProgression: readonly {
    stage: GrowthStageKey;
    minAccumulatedGdd: number;
  }[];
};
