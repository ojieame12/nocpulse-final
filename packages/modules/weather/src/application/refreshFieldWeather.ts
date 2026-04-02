import type { FieldWeatherForecast } from "../contracts/FieldWeatherForecast";
import type { FieldWeatherDerivedSignalSet } from "../contracts/FieldWeatherDerivedSignalSet";
import type { FieldWeatherObservation } from "../contracts/FieldWeatherObservation";
import type {
  RefreshFieldWeatherInput,
  RefreshFieldWeatherResult,
} from "../contracts/RefreshFieldWeatherInput";
import type {
  ReplaceFieldWeatherForecastSetInput,
} from "../contracts/ReplaceFieldWeatherForecastSetInput";
import type {
  UpsertFieldWeatherObservationInput,
} from "../contracts/UpsertFieldWeatherObservationInput";
import type { WeatherProviderClient } from "../contracts/WeatherProviderClient";
import { deriveWeatherSignalSet } from "./deriveWeatherSignalSet";

type RefreshFieldWeatherObservationRepository = {
  listRecentByField(
    workspaceId: string,
    fieldId: string,
    limit?: number,
  ): Promise<readonly FieldWeatherObservation[]>;
  upsertObservation(
    input: UpsertFieldWeatherObservationInput,
  ): Promise<FieldWeatherObservation>;
};

type RefreshFieldWeatherForecastRepository = {
  replaceForecastSet(
    input: ReplaceFieldWeatherForecastSetInput,
  ): Promise<readonly FieldWeatherForecast[]>;
};

type RefreshFieldWeatherSignalRepository = {
  upsertSignalSet(
    input: ReturnType<typeof deriveWeatherSignalSet>,
  ): Promise<FieldWeatherDerivedSignalSet>;
};

export type RefreshFieldWeatherUseCaseInput = {
  provider: WeatherProviderClient;
  observationRepository: RefreshFieldWeatherObservationRepository;
  forecastRepository: RefreshFieldWeatherForecastRepository;
  signalRepository: RefreshFieldWeatherSignalRepository;
  weather: RefreshFieldWeatherInput;
};

export async function refreshFieldWeather(
  input: RefreshFieldWeatherUseCaseInput,
): Promise<RefreshFieldWeatherResult> {
  const fetched = await input.provider.fetchFieldWeather({
    latitude: input.weather.latitude,
    longitude: input.weather.longitude,
    requestedAt: input.weather.requestedAt,
    forecastHours: input.weather.forecastHours,
    frostDamageThresholdC: input.weather.frostDamageThresholdC,
  });

  const observation = await input.observationRepository.upsertObservation({
    workspaceId: input.weather.workspaceId,
    fieldId: input.weather.fieldId,
    observedAt: fetched.observation.observedAt,
    sourceKey: fetched.sourceKey,
    providerKey: fetched.providerKey,
    airTemperatureC: fetched.observation.airTemperatureC,
    precipitationMm: fetched.observation.precipitationMm,
    windSpeedKph: fetched.observation.windSpeedKph,
    relativeHumidityPct: fetched.observation.relativeHumidityPct ?? null,
    soilMoisturePct: fetched.observation.soilMoisturePct ?? null,
    soilTemperature6cmC: fetched.observation.soilTemperature6cmC ?? null,
    evapotranspirationMm: fetched.observation.evapotranspirationMm ?? null,
    provenance: fetched.observation.provenance,
  });
  const recentObservations = await input.observationRepository.listRecentByField(
    input.weather.workspaceId,
    input.weather.fieldId,
    168,
  );
  const forecasts = await input.forecastRepository.replaceForecastSet({
    workspaceId: input.weather.workspaceId,
    fieldId: input.weather.fieldId,
    forecastRunAt: fetched.forecastSet.forecastRunAt,
    sourceKey: fetched.sourceKey,
    providerKey: fetched.providerKey,
    entries: fetched.forecastSet.entries,
  });
  const derivedSignals = await input.signalRepository.upsertSignalSet(
    deriveWeatherSignalSet({
      workspaceId: input.weather.workspaceId,
      fieldId: input.weather.fieldId,
      observation,
      recentObservations,
      forecasts,
      gddBaseC: input.weather.gddBaseC,
      soilTempThresholdC: input.weather.soilTempThresholdC,
      frostProbabilityPct7d: fetched.ensemble?.frostProbabilityPct7d ?? null,
      frostProbabilityThresholdC:
        fetched.ensemble?.frostProbabilityThresholdC ?? null,
      frostProbabilityModelKey: fetched.ensemble?.modelKey ?? null,
      frostProbabilityMemberCount: fetched.ensemble?.memberCount ?? null,
    }),
  );

  return {
    workspaceId: input.weather.workspaceId,
    fieldId: input.weather.fieldId,
    providerKey: fetched.providerKey,
    sourceKey: fetched.sourceKey,
    observation,
    forecasts,
    derivedSignals,
  };
}
