import { WeatherLayersError } from "../error/WeatherLayersError.js";
import type { WeatherTimeInput } from "./WeatherTimeInput.js";

export function normalizeWeatherTime(
  value: WeatherTimeInput
): string | "latest" {
  if (value === "latest") {
    return value;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw new WeatherLayersError(
      "TIME_NOT_AVAILABLE",
      "Weather time is not a valid timestamp"
    );
  }

  return date.toISOString();
}
