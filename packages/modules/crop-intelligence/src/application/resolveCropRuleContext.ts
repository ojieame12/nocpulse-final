import type { CropContextInput, GrowthStageKey, ResolvedCropContext } from "../contracts/CropContext";
import type {
  CropStageRuleOverrides,
  DiseaseRiskRulePack,
  CropProfile,
  RulePack,
  SeedingThresholdRulePack,
  WeatherRiskRulePack,
  MoistureStressRulePack,
} from "../contracts/RulePack";

export type ResolvedCropRuleContext = {
  crop: ResolvedCropContext;
  moistureStress: MoistureStressRulePack;
  weatherRisk: WeatherRiskRulePack;
  seedingThresholds: SeedingThresholdRulePack;
  diseaseRisk: DiseaseRiskRulePack;
};

const GROWTH_STAGE_ORDER: readonly GrowthStageKey[] = [
  "pre-seed",
  "vegetative",
  "flowering",
  "ripening",
];

function normalizeToken(value: string | null | undefined) {
  return value == null ? null : value.trim().toLowerCase().replace(/[_\s]+/g, "-");
}

function normalizeGrowthStage(value: string | null | undefined): GrowthStageKey | null {
  const normalized = normalizeToken(value);

  if (!normalized) {
    return null;
  }

  switch (normalized) {
    case "pre-seed":
    case "preseed":
    case "seed":
    case "emergence":
      return "pre-seed";
    case "vegetative":
    case "veg":
      return "vegetative";
    case "flowering":
    case "heading":
    case "reproductive":
      return "flowering";
    case "ripening":
    case "maturity":
    case "harvest":
      return "ripening";
    default:
      return null;
  }
}

function mergeMoistureStressRules(
  base: MoistureStressRulePack,
  override?: Partial<MoistureStressRulePack>,
): MoistureStressRulePack {
  return {
    ...base,
    ...override,
  };
}

function mergeWeatherRiskRules(
  base: WeatherRiskRulePack,
  override?: CropStageRuleOverrides["weatherRisk"],
): WeatherRiskRulePack {
  return {
    frost: {
      ...base.frost,
      ...(override?.frost ?? {}),
    },
    atmosphericDemand: {
      ...base.atmosphericDemand,
      ...(override?.atmosphericDemand ?? {}),
    },
  };
}

function mergeSeedingThresholdRules(
  base: SeedingThresholdRulePack,
  override?: Partial<SeedingThresholdRulePack>,
): SeedingThresholdRulePack {
  return {
    ...base,
    ...override,
  };
}

function resolveDiseaseRiskRules(
  base: DiseaseRiskRulePack,
  crop: {
    cropKey: string;
    growthStage: GrowthStageKey;
  },
): DiseaseRiskRulePack {
  const stageMatched = base.models.filter((model) =>
    model.growthStages.includes(crop.growthStage),
  );
  const cropMatched = stageMatched.filter((model) =>
    model.cropKeys.includes(crop.cropKey),
  );

  if (cropMatched.length > 0) {
    return {
      models: cropMatched,
    };
  }

  return {
    models: stageMatched.filter((model) => model.cropKeys.includes("generic")),
  };
}

function findGenericProfile(rulePack: RulePack): CropProfile {
  const generic = rulePack.cropProfiles.find((profile) => profile.key === "generic");

  if (!generic) {
    throw new Error("[crop-intelligence] rule pack is missing a generic crop profile");
  }

  return generic;
}

function findCropProfile(
  rulePack: RulePack,
  cropType: string | null,
): CropProfile {
  if (!cropType) {
    return findGenericProfile(rulePack);
  }

  const normalized = normalizeToken(cropType);

  if (!normalized) {
    return findGenericProfile(rulePack);
  }

  const matched = rulePack.cropProfiles.find((profile) => {
    if (profile.key === normalized) {
      return true;
    }

    return profile.aliases.some((alias) => normalizeToken(alias) === normalized);
  });

  return matched ?? findGenericProfile(rulePack);
}

export function resolveCropRuleContext(input: {
  rulePack: RulePack;
  cropContext?: CropContextInput | null;
}): ResolvedCropRuleContext {
  const profile = findCropProfile(input.rulePack, input.cropContext?.cropType ?? null);
  const requestedStage = normalizeGrowthStage(input.cropContext?.growthStage ?? null);
  const growthStage = requestedStage ?? profile.defaultGrowthStage;
  const stageOverrides = profile.stages?.[growthStage];

  return {
    crop: {
      cropKey: profile.key,
      cropLabel: profile.label,
      growthStage,
      normalizedCropType: normalizeToken(input.cropContext?.cropType ?? null),
      isGenericCrop: profile.key === "generic",
      isDefaultStage: requestedStage == null,
      gddBaseC: profile.gddBaseC,
      stageProgression: profile.stageProgression,
    },
    moistureStress: mergeMoistureStressRules(
      input.rulePack.moistureStress,
      stageOverrides?.moistureStress,
    ),
    weatherRisk: mergeWeatherRiskRules(
      input.rulePack.weatherRisk,
      stageOverrides?.weatherRisk,
    ),
    seedingThresholds: mergeSeedingThresholdRules(
      input.rulePack.seedingThresholds,
      profile.seedingThresholds,
    ),
    diseaseRisk: resolveDiseaseRiskRules(input.rulePack.diseaseRisk, {
      cropKey: profile.key,
      growthStage,
    }),
  };
}

export { GROWTH_STAGE_ORDER };
