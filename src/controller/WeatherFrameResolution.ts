import type { WeatherFrame } from "../manifest/WeatherFrame.js";
import type { ResolvedWeatherTime } from "./ResolvedWeatherTime.js";

export interface WeatherFrameResolution {
  readonly frame: WeatherFrame;
  readonly time: ResolvedWeatherTime;
}
