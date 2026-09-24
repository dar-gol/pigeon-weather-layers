import type { WeatherGrid } from "../manifest/WeatherGrid.js";
import type { WeatherLayer } from "../manifest/WeatherLayer.js";
import type { DecodedWeatherAsset } from "./DecodedWeatherAsset.js";

export interface WeatherAssetDecoder {
  decode(
    blob: Blob,
    layer: WeatherLayer,
    grid: WeatherGrid,
    signal: AbortSignal
  ): Promise<DecodedWeatherAsset>;
}
