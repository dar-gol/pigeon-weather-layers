import type { WeatherPosition } from "./WeatherPosition.js";
import type { WeatherTimeInput } from "./WeatherTimeInput.js";

export interface WeatherValueQuery extends WeatherPosition {
  readonly layerId?: string;
  readonly time?: WeatherTimeInput;
}
