import type { WeatherColorStop } from "./WeatherColorStop.js";

export interface WeatherPalette {
  readonly id: string;
  readonly valueRange: readonly [number, number];
  readonly stops: readonly WeatherColorStop[];
}
