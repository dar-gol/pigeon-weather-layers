import type { HttpWeatherDataSourceOptions } from "./HttpWeatherDataSourceOptions.js";
import { HttpWeatherDataSource } from "./HttpWeatherDataSource.js";
import type { WeatherDataSource } from "./WeatherDataSource.js";

export function createHttpWeatherDataSource(
  options: HttpWeatherDataSourceOptions
): WeatherDataSource {
  return new HttpWeatherDataSource(options);
}
