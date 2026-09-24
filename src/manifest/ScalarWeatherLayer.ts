import type { ScalarWeatherEncoding } from "./ScalarWeatherEncoding.js";

export interface ScalarWeatherLayer {
  readonly id: string;
  readonly kind: "scalar";
  readonly sourceParameters: readonly string[];
  readonly unit: string;
  readonly aggregation: string;
  readonly temporalInterpolation: "nearest";
  readonly encoding: ScalarWeatherEncoding;
}
