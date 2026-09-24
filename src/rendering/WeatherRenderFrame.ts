import type { WeatherPalette } from "../controller/WeatherPalette.js";
import type { WeatherLayer } from "../manifest/WeatherLayer.js";
import type { DecodedWeatherAsset } from "./DecodedWeatherAsset.js";

export interface WeatherRenderFrame {
  readonly asset: DecodedWeatherAsset;
  readonly layer: WeatherLayer;
  readonly palette: WeatherPalette;
  readonly bounds: readonly [number, number, number, number];
}
