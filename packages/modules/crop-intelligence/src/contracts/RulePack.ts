import type { GrowthStageKey } from "./CropContext";

export type MoistureStressRulePack = {
  dedupeKey: string;
  label: string;
  rootZoneMonitorPct: number;
  rootZoneCriticalPct: number;
  cellMonitorPct: number;
  cellCriticalPct: number;
  elevatedVpdKpa: number;
  severeVpdKpa: number;
  waterBalance24hMonitorMm: number;
  waterBalance24hSevereMm: number;
  minAffectedCellRatio: number;
  severeAffectedCellRatio: number;
};

export type FrostRiskRulePack = {
  dedupeKey: string;
  label: string;
  damageTempC: number;
  killTempC: number;
};

export type AtmosphericDemandRulePack = {
  dedupeKey: string;
  label: string;
  elevatedVpdKpa: number;
  severeVpdKpa: number;
  monitorWaterBalance24hMm: number;
  severeWaterBalance24hMm: number;
  severeWaterBalance72hMm: number;
};

export type WeatherRiskRulePack = {
  frost: FrostRiskRulePack;
  atmosphericDemand: AtmosphericDemandRulePack;
};

export type DiseaseRiskModel = {
  key: string;
  label: string;
  cropKeys: readonly string[];
  growthStages: readonly GrowthStageKey[];
  minLeafWetHours: number;
  severeLeafWetHours: number;
  minTempC: number;
  maxTempC: number;
  recommendedAction: string;
};

export type DiseaseRiskRulePack = {
  models: readonly DiseaseRiskModel[];
};

export type CropStageRuleOverrides = {
  moistureStress?: Partial<MoistureStressRulePack>;
  weatherRisk?: {
    frost?: Partial<FrostRiskRulePack>;
    atmosphericDemand?: Partial<AtmosphericDemandRulePack>;
  };
};

export type CropProfile = {
  key: string;
  label: string;
  aliases: readonly string[];
  gddBaseC: number;
  defaultGrowthStage: GrowthStageKey;
  stageProgression: readonly {
    stage: GrowthStageKey;
    minAccumulatedGdd: number;
  }[];
  stages?: Partial<Record<GrowthStageKey, CropStageRuleOverrides>>;
};

export type RulePack = {
  id: string;
  version: string;
  label: string;
  moistureStress: MoistureStressRulePack;
  weatherRisk: WeatherRiskRulePack;
  diseaseRisk: DiseaseRiskRulePack;
  cropProfiles: readonly CropProfile[];
};
