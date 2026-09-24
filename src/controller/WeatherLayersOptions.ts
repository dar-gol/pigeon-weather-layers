import type { WeatherDataSource } from "../source/WeatherDataSource.js";
import type { WeatherTimeInput } from "./WeatherTimeInput.js";

export interface WeatherLayersOptions {
  readonly source: string | URL | WeatherDataSource;
  readonly initialLayer?: string;
  readonly initialTime?: WeatherTimeInput;
  readonly opacity?: number;
  readonly visible?: boolean;
  readonly placement?:
    | "below-labels"
    | "top"
    | { readonly beforeLayerId: string };
  readonly idPrefix?: string;
  readonly attribution?: "auto" | "manual";
  readonly reducedMotion?: "system" | "always" | "never";
  readonly cache?: {
    readonly maxBytes?: number;
    readonly prefetchNextFrame?: boolean;
  };
}
