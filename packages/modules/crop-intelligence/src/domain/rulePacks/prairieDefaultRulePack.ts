import type { RulePack } from "../../contracts/RulePack";

export const prairieDefaultRulePack: RulePack = {
  id: "prairie-default",
  version: "v1",
  label: "Prairie default agronomic rules",
  moistureStress: {
    dedupeKey: "prairie-default",
    label: "Prairie default moisture stress",
    rootZoneMonitorPct: 28,
    rootZoneCriticalPct: 22,
    cellMonitorPct: 28,
    cellCriticalPct: 22,
    elevatedVpdKpa: 1.4,
    severeVpdKpa: 1.8,
    waterBalance24hMonitorMm: -2,
    waterBalance24hSevereMm: -4,
    minAffectedCellRatio: 0.25,
    severeAffectedCellRatio: 0.5,
  },
  weatherRisk: {
    frost: {
      dedupeKey: "prairie-default-frost",
      label: "Prairie default frost risk",
      damageTempC: -2,
      killTempC: -4,
    },
    atmosphericDemand: {
      dedupeKey: "prairie-default-atmospheric-demand",
      label: "Prairie default atmospheric demand",
      elevatedVpdKpa: 1.4,
      severeVpdKpa: 1.8,
      monitorWaterBalance24hMm: -2,
      severeWaterBalance24hMm: -4,
      severeWaterBalance72hMm: -6,
    },
  },
  diseaseRisk: {
    models: [
      {
        key: "canola-sclerotinia",
        label: "Canola sclerotinia risk",
        cropKeys: ["canola"],
        growthStages: ["flowering"],
        minLeafWetHours: 8,
        severeLeafWetHours: 12,
        minTempC: 15,
        maxTempC: 25,
        recommendedAction:
          "Scout flowering canola for petal stick and canopy humidity, and check whether fungicide timing is still defensible if the wet window persists.",
      },
      {
        key: "wheat-fhb",
        label: "Wheat fusarium head blight risk",
        cropKeys: ["wheat", "barley"],
        growthStages: ["flowering"],
        minLeafWetHours: 8,
        severeLeafWetHours: 12,
        minTempC: 15,
        maxTempC: 30,
        recommendedAction:
          "Check heading and flowering cereals for fusarium-conducive conditions, confirm crop stage, and review fungicide timing before the wet window closes.",
      },
      {
        key: "pulse-ascochyta",
        label: "Pulse ascochyta risk",
        cropKeys: ["peas", "lentils", "faba-bean"],
        growthStages: ["vegetative", "flowering"],
        minLeafWetHours: 8,
        severeLeafWetHours: 12,
        minTempC: 10,
        maxTempC: 24,
        recommendedAction:
          "Scout pulse canopies for lesion development, confirm recent wetness in denser areas, and prepare a protection decision if symptoms are already present.",
      },
      {
        key: "soybean-white-mould",
        label: "Soybean white mould risk",
        cropKeys: ["soybean"],
        growthStages: ["flowering"],
        minLeafWetHours: 8,
        severeLeafWetHours: 12,
        minTempC: 15,
        maxTempC: 28,
        recommendedAction:
          "Inspect flowering soybean for canopy closure and sustained humidity, then compare fungicide timing against the current flowering window.",
      },
      {
        key: "generic-wet-canopy",
        label: "Generic wet-canopy disease risk",
        cropKeys: ["generic"],
        growthStages: ["vegetative", "flowering"],
        minLeafWetHours: 10,
        severeLeafWetHours: 14,
        minTempC: 12,
        maxTempC: 26,
        recommendedAction:
          "Use the next scouting pass to confirm whether the sustained wet canopy is translating into visible disease pressure before conditions tighten further.",
      },
    ],
  },
  cropProfiles: [
    {
      key: "generic",
      label: "Generic prairie crop",
      aliases: ["default", "mixed"],
      gddBaseC: 5,
      defaultGrowthStage: "vegetative",
      stageProgression: [
        { stage: "pre-seed", minAccumulatedGdd: 0 },
        { stage: "vegetative", minAccumulatedGdd: 120 },
        { stage: "flowering", minAccumulatedGdd: 600 },
        { stage: "ripening", minAccumulatedGdd: 1000 },
      ],
      stages: {
        "pre-seed": {
          weatherRisk: {
            frost: {
              damageTempC: -1.5,
              killTempC: -3.5,
            },
          },
        },
        flowering: {
          moistureStress: {
            rootZoneMonitorPct: 30,
            rootZoneCriticalPct: 24,
          },
        },
      },
    },
    {
      key: "canola",
      label: "Canola",
      aliases: ["rapeseed"],
      gddBaseC: 5,
      defaultGrowthStage: "vegetative",
      stageProgression: [
        { stage: "pre-seed", minAccumulatedGdd: 0 },
        { stage: "vegetative", minAccumulatedGdd: 110 },
        { stage: "flowering", minAccumulatedGdd: 600 },
        { stage: "ripening", minAccumulatedGdd: 1000 },
      ],
      stages: {
        "pre-seed": {
          weatherRisk: {
            frost: {
              damageTempC: -1,
              killTempC: -3,
            },
          },
        },
        flowering: {
          moistureStress: {
            rootZoneMonitorPct: 30,
            rootZoneCriticalPct: 24,
            cellMonitorPct: 30,
            cellCriticalPct: 24,
          },
        },
      },
    },
    {
      key: "wheat",
      label: "Wheat",
      aliases: ["durum", "hrs", "cps", "spring wheat"],
      gddBaseC: 5,
      defaultGrowthStage: "vegetative",
      stageProgression: [
        { stage: "pre-seed", minAccumulatedGdd: 0 },
        { stage: "vegetative", minAccumulatedGdd: 150 },
        { stage: "flowering", minAccumulatedGdd: 700 },
        { stage: "ripening", minAccumulatedGdd: 1200 },
      ],
      stages: {
        flowering: {
          moistureStress: {
            rootZoneMonitorPct: 29,
            rootZoneCriticalPct: 23,
          },
          weatherRisk: {
            frost: {
              damageTempC: -2,
              killTempC: -4,
            },
          },
        },
      },
    },
    {
      key: "barley",
      label: "Barley",
      aliases: [],
      gddBaseC: 5,
      defaultGrowthStage: "vegetative",
      stageProgression: [
        { stage: "pre-seed", minAccumulatedGdd: 0 },
        { stage: "vegetative", minAccumulatedGdd: 140 },
        { stage: "flowering", minAccumulatedGdd: 650 },
        { stage: "ripening", minAccumulatedGdd: 1100 },
      ],
      stages: {
        flowering: {
          moistureStress: {
            rootZoneMonitorPct: 29,
            rootZoneCriticalPct: 23,
          },
        },
      },
    },
    {
      key: "rye",
      label: "Rye",
      aliases: [],
      gddBaseC: 5,
      defaultGrowthStage: "vegetative",
      stageProgression: [
        { stage: "pre-seed", minAccumulatedGdd: 0 },
        { stage: "vegetative", minAccumulatedGdd: 140 },
        { stage: "flowering", minAccumulatedGdd: 650 },
        { stage: "ripening", minAccumulatedGdd: 1100 },
      ],
    },
    {
      key: "oats",
      label: "Oats",
      aliases: [],
      gddBaseC: 5,
      defaultGrowthStage: "vegetative",
      stageProgression: [
        { stage: "pre-seed", minAccumulatedGdd: 0 },
        { stage: "vegetative", minAccumulatedGdd: 140 },
        { stage: "flowering", minAccumulatedGdd: 620 },
        { stage: "ripening", minAccumulatedGdd: 1050 },
      ],
    },
    {
      key: "flax",
      label: "Flax",
      aliases: ["linseed"],
      gddBaseC: 5,
      defaultGrowthStage: "vegetative",
      stageProgression: [
        { stage: "pre-seed", minAccumulatedGdd: 0 },
        { stage: "vegetative", minAccumulatedGdd: 130 },
        { stage: "flowering", minAccumulatedGdd: 560 },
        { stage: "ripening", minAccumulatedGdd: 950 },
      ],
      stages: {
        flowering: {
          moistureStress: {
            rootZoneMonitorPct: 27,
            rootZoneCriticalPct: 21,
          },
        },
      },
    },
    {
      key: "peas",
      label: "Peas",
      aliases: ["field peas", "pea"],
      gddBaseC: 5,
      defaultGrowthStage: "vegetative",
      stageProgression: [
        { stage: "pre-seed", minAccumulatedGdd: 0 },
        { stage: "vegetative", minAccumulatedGdd: 120 },
        { stage: "flowering", minAccumulatedGdd: 500 },
        { stage: "ripening", minAccumulatedGdd: 900 },
      ],
    },
    {
      key: "lentils",
      label: "Lentils",
      aliases: ["lentil"],
      gddBaseC: 5,
      defaultGrowthStage: "vegetative",
      stageProgression: [
        { stage: "pre-seed", minAccumulatedGdd: 0 },
        { stage: "vegetative", minAccumulatedGdd: 120 },
        { stage: "flowering", minAccumulatedGdd: 500 },
        { stage: "ripening", minAccumulatedGdd: 880 },
      ],
      stages: {
        flowering: {
          weatherRisk: {
            atmosphericDemand: {
              elevatedVpdKpa: 1.3,
              severeVpdKpa: 1.7,
            },
          },
        },
      },
    },
    {
      key: "faba-bean",
      label: "Faba Bean",
      aliases: ["faba bean", "fababean", "faba"],
      gddBaseC: 5,
      defaultGrowthStage: "vegetative",
      stageProgression: [
        { stage: "pre-seed", minAccumulatedGdd: 0 },
        { stage: "vegetative", minAccumulatedGdd: 140 },
        { stage: "flowering", minAccumulatedGdd: 520 },
        { stage: "ripening", minAccumulatedGdd: 920 },
      ],
    },
    {
      key: "soybean",
      label: "Soybean",
      aliases: ["soybeans", "soy"],
      gddBaseC: 10,
      defaultGrowthStage: "vegetative",
      stageProgression: [
        { stage: "pre-seed", minAccumulatedGdd: 0 },
        { stage: "vegetative", minAccumulatedGdd: 160 },
        { stage: "flowering", minAccumulatedGdd: 650 },
        { stage: "ripening", minAccumulatedGdd: 1100 },
      ],
      stages: {
        flowering: {
          moistureStress: {
            rootZoneMonitorPct: 31,
            rootZoneCriticalPct: 25,
          },
          weatherRisk: {
            frost: {
              damageTempC: -1,
              killTempC: -2.5,
            },
          },
        },
      },
    },
    {
      key: "corn",
      label: "Corn",
      aliases: ["maize"],
      gddBaseC: 10,
      defaultGrowthStage: "vegetative",
      stageProgression: [
        { stage: "pre-seed", minAccumulatedGdd: 0 },
        { stage: "vegetative", minAccumulatedGdd: 180 },
        { stage: "flowering", minAccumulatedGdd: 750 },
        { stage: "ripening", minAccumulatedGdd: 1400 },
      ],
      stages: {
        "pre-seed": {
          weatherRisk: {
            frost: {
              damageTempC: 0,
              killTempC: -1.5,
            },
          },
        },
        vegetative: {
          weatherRisk: {
            frost: {
              damageTempC: 0,
              killTempC: -1.5,
            },
          },
        },
        flowering: {
          moistureStress: {
            rootZoneMonitorPct: 32,
            rootZoneCriticalPct: 26,
          },
        },
      },
    },
  ],
};
