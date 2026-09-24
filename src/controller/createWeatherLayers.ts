import { DefaultWeatherLayersController } from "./DefaultWeatherLayersController.js";
import type { WeatherLayersController } from "./WeatherLayersController.js";
import type { WeatherLayersOptions } from "./WeatherLayersOptions.js";

export function createWeatherLayers(
  options: WeatherLayersOptions
): WeatherLayersController {
  return new DefaultWeatherLayersController(options);
}
