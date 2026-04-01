/**
 * Metric hint content system.
 *
 * Each hint has a static definition ("what this is") and a dynamic
 * interpreter ("what it means for you") that takes the current value
 * and optional crop context to produce a contextual read.
 */

export interface MetricHintDef {
  /** Short human label shown at the top of the hint. */
  label: string;
  /** One-sentence static definition. */
  definition: string;
  /**
   * Dynamic interpreter — returns a contextual sentence based on the
   * current value. If omitted, the hint only shows the definition.
   */
  interpret?: (value: string, context?: HintContext) => string;
}

export interface HintContext {
  cropType?: string;
  cropStage?: string;
  fieldName?: string;
  season?: string;
}

/* ── Parsing helpers ── */

function num(v: string): number | null {
  const n = parseFloat(v.replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function pct(v: string): number | null {
  const n = num(v);
  return n != null ? n : null;
}

/* ── Interpreters ── */

function ndviInterpret(v: string): string {
  const n = num(v);
  if (n == null) return "No reading available — check satellite pass schedule.";
  if (n >= 0.75) return "Canopy is dense and vigorous. No action needed.";
  if (n >= 0.55) return "Moderate canopy. Normal for early/late season or lighter stands.";
  if (n >= 0.35) return "Below expected range. Worth scouting for thin stand, weeds, or early stress.";
  return "Very low greenness. May indicate bare soil, crop failure, or cloud contamination.";
}

function ndreInterpret(v: string): string {
  const n = num(v);
  if (n == null) return "No reading available.";
  if (n >= 0.45) return "Strong chlorophyll activity. Crop is photosynthesizing well.";
  if (n >= 0.25) return "Moderate. Canopy present but chlorophyll density is middling.";
  return "Low chlorophyll signal. Possible nitrogen stress or thin canopy.";
}

function rootMoistureInterpret(v: string): string {
  const n = pct(v);
  if (n == null) return "No moisture data for this snapshot.";
  if (n >= 70) return "Root zone is well-supplied. No irrigation action needed.";
  if (n >= 45) return "Adequate for most crops, but monitor over the next few days.";
  if (n >= 25) return "Getting dry. Consider irrigation planning within 48–72 hours.";
  return "Root zone is critically dry. Immediate irrigation or rainfall needed.";
}

function surfaceMoistureInterpret(v: string): string {
  const n = pct(v);
  if (n == null) return "No data.";
  if (n >= 60) return "Surface is wet. Recent rain or irrigation detected.";
  if (n >= 30) return "Moderate surface moisture. Typical for a few days post-rain.";
  return "Surface is dry. Evaporation has outpaced replenishment.";
}

function temperatureInterpret(v: string): string {
  const n = num(v);
  if (n == null) return "No temperature data.";
  if (n >= 35) return "Heat stress territory. Watch for wilting and pollination issues.";
  if (n >= 25) return "Warm and favorable for most prairie crops.";
  if (n >= 10) return "Cool conditions. Growth may be slower but no frost risk.";
  if (n >= 0) return "Near freezing. Watch overnight lows for frost risk.";
  return "Below zero. Active frost risk — check crop stage tolerance.";
}

function windInterpret(v: string): string {
  const n = num(v);
  if (n == null) return "No wind data.";
  if (n >= 50) return "High winds. Spray drift risk is extreme — do not spray.";
  if (n >= 30) return "Moderate to strong. Limit field operations, check spray windows.";
  if (n >= 15) return "Light breeze. Acceptable for most field work.";
  return "Calm conditions. Good spray window.";
}

function precipInterpret(v: string): string {
  const n = pct(v);
  if (n == null) return "No precipitation forecast.";
  if (n >= 70) return "Rain very likely. Plan accordingly for field access.";
  if (n >= 40) return "Moderate chance. Keep an eye on the radar.";
  if (n >= 15) return "Slight chance. Probably dry but not guaranteed.";
  return "Dry conditions expected.";
}

function confidenceInterpret(v: string): string {
  const s = v.toLowerCase();
  if (s.includes("high") || s.includes("good")) return "Multiple data sources agree. This reading is trustworthy.";
  if (s.includes("med") || s.includes("moderate")) return "Based on limited passes. Directionally useful but verify with a scout.";
  return "Low confidence — sparse data. Treat as indicative only.";
}

function priceInterpret(v: string): string {
  const n = num(v);
  if (n == null) return "No market quote available.";
  return "Current reference price from market feed. Compare to your cost of production to assess margin.";
}

function yieldInterpret(v: string): string {
  const n = num(v);
  if (n == null) return "No yield estimate available.";
  return "Based on your entered or estimated yield. Adjust in the scenario overrides to model different outcomes.";
}

function revenueInterpret(v: string): string {
  const n = num(v);
  if (n == null) return "Cannot estimate — missing price or yield inputs.";
  return "Gross revenue estimate before costs. This is yield × price × area, adjusted for local basis.";
}

function stressAreaInterpret(v: string): string {
  const n = pct(v);
  if (n == null) return "No stress area detected.";
  if (n >= 30) return "Significant stress detected across the field. Scout the affected zones.";
  if (n >= 10) return "Moderate pockets of stress. Worth monitoring and targeted scouting.";
  return "Minimal stress. Field looks healthy overall.";
}

function spreadInterpret(v: string): string {
  const n = num(v);
  if (n == null) return "No variability data.";
  if (n >= 15) return "High variability across the field. Some zones are much drier or wetter than others.";
  if (n >= 7) return "Moderate variability. A few zones differ from the field average.";
  return "Uniform conditions. The field is behaving consistently.";
}

function waterBalanceInterpret(v: string): string {
  const n = num(v);
  if (n == null) return "No water balance data.";
  if (n != null && n > 5) return "Positive balance — recent rain exceeded evapotranspiration. Soil is recharging.";
  if (n != null && n > -5) return "Near-neutral balance. Input roughly matches crop water use.";
  return "Negative balance — crop is using more water than it's receiving. Monitor for stress.";
}

function frostMinInterpret(v: string): string {
  const n = num(v);
  if (n == null) return "No frost risk data.";
  if (n != null && n > 5) return "Well above freezing. No frost concern.";
  if (n != null && n > 0) return "Close to zero. Watch overnight minimums carefully.";
  return "Below freezing recorded. Check crop damage potential for current growth stage.";
}

/* ── Registry ── */

/**
 * Master map of metric keys to hint definitions.
 * Keys match reading iconKeys, crop param labels, and special identifiers.
 */
export const METRIC_HINTS: Record<string, MetricHintDef> = {
  // ── Vegetation ──
  ndvi: {
    label: "NDVI",
    definition: "Normalized Difference Vegetation Index — measures canopy greenness from satellite red and near-infrared reflectance. Range 0–1.",
    interpret: ndviInterpret,
  },
  ndre: {
    label: "NDRE",
    definition: "Normalized Difference Red Edge — detects chlorophyll activity deeper in the canopy than NDVI. More sensitive to mid-season nitrogen status.",
    interpret: ndreInterpret,
  },
  ndmi: {
    label: "NDMI",
    definition: "Normalized Difference Moisture Index — estimates leaf water content from shortwave infrared reflectance.",
    interpret: (v) => {
      const n = num(v);
      if (n == null) return "No data.";
      if (n >= 0.3) return "Leaves are well-hydrated. Canopy water stress is unlikely.";
      if (n >= 0.1) return "Moderate leaf moisture. Normal for warm conditions.";
      return "Low leaf water content. Canopy may be water-stressed.";
    },
  },

  // ── Moisture ──
  "root-moisture": {
    label: "Root Zone Moisture",
    definition: "Volumetric water content in the 20–60 cm soil profile where most crop roots draw water.",
    interpret: rootMoistureInterpret,
  },
  "soil-moisture": {
    label: "Surface Moisture",
    definition: "Volumetric water content in the top 10 cm of soil. Responds quickly to rain and evaporation.",
    interpret: surfaceMoistureInterpret,
  },
  "surface moisture": {
    label: "Surface Moisture",
    definition: "Volumetric water content in the top 10 cm of soil. Responds quickly to rain and evaporation.",
    interpret: surfaceMoistureInterpret,
  },
  "root moisture": {
    label: "Soil Moisture",
    definition: "Estimated water content in the root zone (20–60 cm). Derived from satellite and weather observations.",
    interpret: rootMoistureInterpret,
  },
  "radar-wetness": {
    label: "Radar Wetness",
    definition: "SAR-derived soil wetness estimate from radar backscatter. Works through clouds, day and night.",
    interpret: surfaceMoistureInterpret,
  },

  // ── Weather ──
  temperature: {
    label: "Temperature",
    definition: "Air temperature at 2 meters above ground from the nearest weather model grid point.",
    interpret: temperatureInterpret,
  },
  wind: {
    label: "Wind Speed",
    definition: "Wind speed at 10 meters above ground. Key factor for spray timing and evapotranspiration.",
    interpret: windInterpret,
  },
  precipitation: {
    label: "Precipitation",
    definition: "Accumulated rainfall or forecast probability from weather model data.",
    interpret: precipInterpret,
  },

  // ── Crop parameters ──
  "water balance": {
    label: "Water Balance",
    definition: "Net water input minus crop water use (evapotranspiration) over a rolling window.",
    interpret: waterBalanceInterpret,
  },
  "water balance 72h": {
    label: "Water Balance (72h)",
    definition: "Net water input minus crop water use over the last 72 hours.",
    interpret: waterBalanceInterpret,
  },
  "frost min": {
    label: "Frost Minimum",
    definition: "Lowest recorded or forecast temperature. Used to assess frost damage risk at the current growth stage.",
    interpret: frostMinInterpret,
  },

  // ── Derived metrics ──
  "stress-area": {
    label: "Stress Area",
    definition: "Percentage of the field showing vegetation stress relative to the field average, derived from satellite imagery.",
    interpret: stressAreaInterpret,
  },
  confidence: {
    label: "Confidence",
    definition: "How many independent data sources (satellite passes, sensors) contributed to this report. More sources = more reliable.",
    interpret: confidenceInterpret,
  },
  spread: {
    label: "Spread (σ)",
    definition: "Standard deviation of moisture readings across the field's grid cells. Measures spatial variability.",
    interpret: spreadInterpret,
  },
  trend: {
    label: "Trend (7d)",
    definition: "Direction and rate of change in root zone moisture over the last 7 days.",
    interpret: (v) => {
      const s = v.toLowerCase();
      if (s.includes("rising") || s.includes("+") || s.includes("up")) return "Moisture is recovering — recent rain or reduced crop demand.";
      if (s.includes("falling") || s.includes("-") || s.includes("down") || s.includes("▼")) return "Moisture is declining. The field is drying out.";
      return "Trend is flat or data is too sparse to determine direction.";
    },
  },

  // ── Market ──
  price: {
    label: "Market Price",
    definition: "Latest reference price for this crop from the configured market data feed.",
    interpret: priceInterpret,
  },
  yield: {
    label: "Expected Yield",
    definition: "Estimated or user-entered yield in bushels per acre (or tonnes per hectare). Used for gross revenue calculation.",
    interpret: yieldInterpret,
  },
  revenue: {
    label: "Gross Revenue",
    definition: "Estimated gross revenue before costs: yield × price × field area, adjusted for local basis differential.",
    interpret: revenueInterpret,
  },
  basis: {
    label: "Local Basis",
    definition: "The difference between the futures price and the local cash price offered by elevators. Varies by location and time.",
    interpret: () => "Basis narrows closer to delivery. A tighter basis means better local pricing.",
  },

  // ── Alerts ──
  moisture_stress: {
    label: "Moisture Stress Alert",
    definition: "Triggered when root zone moisture drops below the crop-specific stress threshold for the current growth stage.",
  },
  weather_risk: {
    label: "Weather Risk Alert",
    definition: "Triggered by extreme temperature, wind, or precipitation events that could impact crop health or field operations.",
  },
  hail_risk: {
    label: "Hail Risk Alert",
    definition: "Triggered by confirmed or forecast hail events from Environment Canada or weather radar analysis.",
  },
  disease_risk: {
    label: "Disease Risk Alert",
    definition: "Triggered when environmental conditions (temperature, humidity, leaf wetness) favor disease development for the current crop.",
  },
  crop_health: {
    label: "Crop Health Alert",
    definition: "Triggered when satellite vegetation indices show unexpected decline relative to the field's historical pattern.",
  },

  // ── Forecast ──
  forecast_temp: {
    label: "Forecast Temperature",
    definition: "Predicted high/low temperature from weather model data for this day.",
    interpret: temperatureInterpret,
  },
  forecast_precip: {
    label: "Precipitation Chance",
    definition: "Probability of measurable precipitation (≥0.2mm) for this forecast period.",
    interpret: precipInterpret,
  },

  // ── Summary donut ──
  cloud_cover: {
    label: "Cloud Cover",
    definition: "Percentage of the sky obscured by clouds. High cloud cover reduces satellite imagery quality and solar radiation.",
    interpret: (v) => {
      const n = pct(v);
      if (n == null) return "No data.";
      if (n >= 80) return "Overcast. Satellite passes are likely unusable. Next clear window may be days away.";
      if (n >= 50) return "Partly cloudy. Some satellite data may be partially obscured.";
      return "Clear skies. Good conditions for satellite imagery and solar radiation.";
    },
  },
  field_state: {
    label: "Field State",
    definition: "Overall assessment of the field's condition based on the latest available data from all sources.",
  },
};

/**
 * Resolve a metric hint by key. Tries exact match first, then
 * normalizes to lowercase with common aliases.
 */
export function resolveMetricHint(key: string): MetricHintDef | null {
  const direct = METRIC_HINTS[key];
  if (direct) return direct;

  const normalized = key.toLowerCase().trim();
  const byNormalized = METRIC_HINTS[normalized];
  if (byNormalized) return byNormalized;

  // Alias matching
  if (normalized.includes("ndvi")) return METRIC_HINTS.ndvi!;
  if (normalized.includes("ndre")) return METRIC_HINTS.ndre!;
  if (normalized.includes("ndmi")) return METRIC_HINTS.ndmi!;
  if (normalized.includes("root") && normalized.includes("moist")) return METRIC_HINTS["root-moisture"]!;
  if (normalized.includes("surface") && normalized.includes("moist")) return METRIC_HINTS["soil-moisture"]!;
  if (normalized.includes("soil") && normalized.includes("moist")) return METRIC_HINTS["soil-moisture"]!;
  if (normalized.includes("stress") && normalized.includes("area")) return METRIC_HINTS["stress-area"]!;
  if (normalized.includes("water") && normalized.includes("balance")) return METRIC_HINTS["water balance"]!;
  if (normalized.includes("frost")) return METRIC_HINTS["frost min"]!;
  if (normalized.includes("spread")) return METRIC_HINTS.spread!;
  if (normalized.includes("trend")) return METRIC_HINTS.trend!;
  if (normalized.includes("confid")) return METRIC_HINTS.confidence!;
  if (normalized.includes("precip") || normalized.includes("rain")) return METRIC_HINTS.precipitation!;
  if (normalized.includes("wind")) return METRIC_HINTS.wind!;
  if (normalized.includes("temp")) return METRIC_HINTS.temperature!;

  return null;
}
