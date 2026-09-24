import type { WeatherManifest } from "../manifest/WeatherManifest.js";

export function resolveAssetUrl(
  manifest: WeatherManifest,
  layerId: string,
  timeKey: string
): string {
  return manifest.delivery.assetTemplate
    .replaceAll("{datasetId}", encodeURIComponent(manifest.datasetId))
    .replaceAll("{runId}", encodeURIComponent(manifest.run.id))
    .replaceAll("{layerId}", encodeURIComponent(layerId))
    .replaceAll("{timeKey}", encodeURIComponent(timeKey));
}
