import type { WeatherAssetRequest } from "./WeatherAssetRequest.js";

export interface WeatherDataSource {
  loadManifest(signal: AbortSignal): Promise<unknown>;
  loadAsset(
    request: WeatherAssetRequest,
    signal: AbortSignal
  ): Promise<Blob>;
}
