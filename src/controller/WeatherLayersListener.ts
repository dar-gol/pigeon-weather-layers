import type { WeatherLayersSnapshot } from "./WeatherLayersSnapshot.js";

export type WeatherLayersListener = (
  snapshot: WeatherLayersSnapshot
) => void;
