import type { WeatherColorStop } from "./WeatherColorStop.js";

export interface WeatherLegend {
  readonly layerId: string;
  readonly unit: string;
  readonly valueRange: readonly [number, number];
  readonly stops: readonly WeatherColorStop[];
}
