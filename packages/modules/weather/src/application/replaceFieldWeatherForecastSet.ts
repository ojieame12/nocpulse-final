import type { FieldWeatherForecast } from "../contracts/FieldWeatherForecast";
import type { ReplaceFieldWeatherForecastSetInput } from "../contracts/ReplaceFieldWeatherForecastSetInput";

type ReplaceFieldWeatherForecastSetRepository = {
  replaceForecastSet(
    input: ReplaceFieldWeatherForecastSetInput,
  ): Promise<readonly FieldWeatherForecast[]>;
};

export type ReplaceFieldWeatherForecastSetUseCaseInput = {
  repository: ReplaceFieldWeatherForecastSetRepository;
  forecastSet: ReplaceFieldWeatherForecastSetInput;
};

export async function replaceFieldWeatherForecastSet(
  input: ReplaceFieldWeatherForecastSetUseCaseInput,
): Promise<readonly FieldWeatherForecast[]> {
  return input.repository.replaceForecastSet(input.forecastSet);
}
