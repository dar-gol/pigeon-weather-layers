import type { WeatherManifest } from "../manifest/WeatherManifest.js";
import type { WeatherMap } from "../map/WeatherMap.js";
import type { ResolvedWeatherTime } from "./ResolvedWeatherTime.js";
import type { WeatherLayersListener } from "./WeatherLayersListener.js";
import type { WeatherLayersSnapshot } from "./WeatherLayersSnapshot.js";
import type { WeatherLegend } from "./WeatherLegend.js";
import type { WeatherPalette } from "./WeatherPalette.js";
import type { WeatherTimeInput } from "./WeatherTimeInput.js";
import type { WeatherTimeSelectionMode } from "./WeatherTimeSelectionMode.js";
import type { WeatherValue } from "./WeatherValue.js";
import type { WeatherValueQuery } from "./WeatherValueQuery.js";

export interface WeatherLayersController {
  attach(map: WeatherMap): Promise<void>;
  setLayer(layerId: string): Promise<void>;
  setTime(
    time: WeatherTimeInput,
    options?: { readonly mode?: WeatherTimeSelectionMode }
  ): Promise<ResolvedWeatherTime>;
  setOpacity(opacity: number): void;
  setVisible(visible: boolean): void;
  setPalette(layerId: string, palette: WeatherPalette): void;
  getLegend(layerId?: string): WeatherLegend;
  getValueAt(query: WeatherValueQuery): Promise<WeatherValue | null>;
  getManifest(): WeatherManifest | null;
  getSnapshot(): WeatherLayersSnapshot;
  subscribe(listener: WeatherLayersListener): () => void;
  refresh(): Promise<void>;
  destroy(): void;
}
