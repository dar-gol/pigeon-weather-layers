import type { VectorWeatherEncoding } from "./VectorWeatherEncoding.js";

export interface VectorWeatherLayer {
  readonly id: string;
  readonly kind: "vector";
  readonly sourceParameters: readonly string[];
  readonly unit: string;
  readonly aggregation: string;
  readonly temporalInterpolation: "nearest";
  readonly encoding: VectorWeatherEncoding;
}
