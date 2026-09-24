import type { WeatherMap } from "../map/WeatherMap.js";
import type { WeatherLayersController } from "./WeatherLayersController.js";
import type { WeatherLayersOptions } from "./WeatherLayersOptions.js";
import { createWeatherLayers } from "./createWeatherLayers.js";

export async function addWeatherLayers(
  map: WeatherMap,
  options: WeatherLayersOptions
): Promise<WeatherLayersController> {
  const controller = createWeatherLayers(options);
  try {
    await controller.attach(map);
    return controller;
  } catch (error) {
    controller.destroy();
    throw error;
  }
}
