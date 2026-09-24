import type { WeatherLayersError } from "../error/WeatherLayersError.js";
import type { WeatherAttribution } from "../manifest/WeatherAttribution.js";
import type { WeatherLayersStatus } from "./WeatherLayersStatus.js";

export interface WeatherLayersSnapshot {
  readonly status: WeatherLayersStatus;
  readonly layerId: string | null;
  readonly requestedTime: string | "latest";
  readonly resolvedTime: string | null;
  readonly runId: string | null;
  readonly visible: boolean;
  readonly opacity: number;
  readonly attributions: readonly WeatherAttribution[];
  readonly error: WeatherLayersError | null;
}
