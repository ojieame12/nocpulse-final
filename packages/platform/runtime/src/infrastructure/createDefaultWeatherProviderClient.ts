import { createOpenMeteoWeatherProviderClient } from "@fieldpulse/module-weather";
import type { RuntimeEnv } from "../contracts/ServerRuntime";

export function createDefaultWeatherProviderClient(env: RuntimeEnv) {
  return createOpenMeteoWeatherProviderClient({
    apiKey: env.weather.openMeteo.apiKey,
  });
}
