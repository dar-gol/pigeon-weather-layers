import { WeatherLayersError } from "../error/WeatherLayersError.js";
import type { HttpWeatherDataSourceOptions } from "./HttpWeatherDataSourceOptions.js";
import type { WeatherAssetRequest } from "./WeatherAssetRequest.js";
import type { WeatherDataSource } from "./WeatherDataSource.js";
import { resolveHttpUrl } from "./resolveHttpUrl.js";

export class HttpWeatherDataSource implements WeatherDataSource {
  readonly #manifestUrl: URL;
  readonly #allowedAssetOrigins: ReadonlySet<string>;
  readonly #fetch: typeof globalThis.fetch;

  constructor(options: HttpWeatherDataSourceOptions) {
    this.#manifestUrl = resolveHttpUrl(options.manifestUrl, options.baseUrl);
    const allowedOrigins =
      options.allowedAssetOrigins ?? [this.#manifestUrl.origin];
    this.#allowedAssetOrigins = new Set(
      allowedOrigins.map((origin) => new URL(origin).origin)
    );
    this.#fetch = options.fetch ?? globalThis.fetch;

    if (this.#fetch === undefined) {
      throw new WeatherLayersError(
        "MANIFEST_FETCH_FAILED",
        "No fetch implementation is available"
      );
    }
  }

  async loadManifest(signal: AbortSignal): Promise<unknown> {
    let response: Response;
    try {
      const fetchRequest = this.#fetch;
      response = await fetchRequest(this.#manifestUrl, { signal });
    } catch (cause) {
      throw new WeatherLayersError(
        "MANIFEST_FETCH_FAILED",
        "Unable to fetch the weather manifest",
        { cause, recoverable: true }
      );
    }

    if (!response.ok) {
      throw new WeatherLayersError(
        "MANIFEST_FETCH_FAILED",
        "Weather manifest request failed with HTTP " + response.status,
        { recoverable: response.status >= 500 }
      );
    }

    const finalUrl = new URL(response.url || this.#manifestUrl.href);
    if (finalUrl.origin !== this.#manifestUrl.origin) {
      throw new WeatherLayersError(
        "ASSET_ORIGIN_NOT_ALLOWED",
        "Weather manifest redirect changed origin"
      );
    }

    try {
      return await response.json();
    } catch (cause) {
      throw new WeatherLayersError(
        "MANIFEST_INVALID",
        "Weather manifest is not valid JSON",
        { cause }
      );
    }
  }

  async loadAsset(
    request: WeatherAssetRequest,
    signal: AbortSignal
  ): Promise<Blob> {
    const url = new URL(request.url, this.#manifestUrl);
    this.#assertAllowedAssetOrigin(url);

    let response: Response;
    try {
      const fetchRequest = this.#fetch;
      response = await fetchRequest(url, { signal });
    } catch (cause) {
      throw new WeatherLayersError(
        "ASSET_FETCH_FAILED",
        "Unable to fetch weather asset",
        { cause, recoverable: true }
      );
    }

    const finalUrl = new URL(response.url || url.href);
    this.#assertAllowedAssetOrigin(finalUrl);

    if (!response.ok) {
      throw new WeatherLayersError(
        "ASSET_FETCH_FAILED",
        "Weather asset request failed with HTTP " + response.status,
        { recoverable: response.status >= 500 }
      );
    }

    const contentType = response.headers.get("content-type");
    if (contentType !== null && !contentType.startsWith("image/png")) {
      throw new WeatherLayersError(
        "ASSET_DECODE_FAILED",
        "Weather asset must use image/png"
      );
    }

    return response.blob();
  }

  #assertAllowedAssetOrigin(url: URL): void {
    if (!this.#allowedAssetOrigins.has(url.origin)) {
      throw new WeatherLayersError(
        "ASSET_ORIGIN_NOT_ALLOWED",
        "Weather asset origin is not allowed: " + url.origin
      );
    }
  }
}
