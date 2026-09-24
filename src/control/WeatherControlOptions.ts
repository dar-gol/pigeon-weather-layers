import type { WeatherLayersController } from "../controller/WeatherLayersController.js";
import type { WeatherFrame } from "../manifest/WeatherFrame.js";
import type { WeatherControlMessages } from "./WeatherControlMessages.js";

export interface WeatherControlOptions {
  readonly controller: WeatherLayersController;
  readonly messages?: Partial<WeatherControlMessages>;
  readonly formatTime?: (frame: WeatherFrame) => string;
  readonly playIntervalMs?: number;
  readonly className?: string;
}
