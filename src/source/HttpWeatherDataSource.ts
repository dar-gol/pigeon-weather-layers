import { WeatherLayersError } from "../error/WeatherLayersError.js";
import {
  MAX_WEATHER_MANIFEST_BYTES,
  MAX_WEATHER_PNG_BYTES
} from "../manifest/WeatherManifestLimits.js";
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
      response = await fetchRequest(this.#manifestUrl, {
        signal,
        redirect: "error"
      });
    } catch (cause) {
      this.#rethrowAbort(cause, signal);
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
      const bytes = await this.#readBoundedBody(
        response,
        MAX_WEATHER_MANIFEST_BYTES,
        "manifest",
        signal
      );
      return JSON.parse(new TextDecoder().decode(bytes));
    } catch (cause) {
      this.#rethrowAbort(cause, signal);
      if (cause instanceof WeatherLayersError) {
        throw cause;
      }
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
      response = await fetchRequest(url, { signal, redirect: "error" });
    } catch (cause) {
      this.#rethrowAbort(cause, signal);
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

    const bytes = await this.#readBoundedBody(
      response,
      MAX_WEATHER_PNG_BYTES,
      "asset",
      signal
    );
    return new Blob([bytes], { type: contentType ?? "image/png" });
  }

  #assertAllowedAssetOrigin(url: URL): void {
    if (!this.#allowedAssetOrigins.has(url.origin)) {
      throw new WeatherLayersError(
        "ASSET_ORIGIN_NOT_ALLOWED",
        "Weather asset origin is not allowed: " + url.origin
      );
    }
  }

  async #readBoundedBody(
    response: Response,
    maxBytes: number,
    bodyKind: "manifest" | "asset",
    signal: AbortSignal
  ): Promise<Uint8Array<ArrayBuffer>> {
    const contentLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > maxBytes) {
      throw this.#bodyTooLarge(bodyKind);
    }

    if (response.body === null) {
      return new Uint8Array();
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;
    const cancelOnAbort = (): void => {
      void reader.cancel(signal.reason).catch(() => undefined);
    };
    signal.addEventListener("abort", cancelOnAbort, { once: true });

    try {
      while (true) {
        this.#throwIfAborted(signal);
        const { done, value } = await reader.read();
        this.#throwIfAborted(signal);
        if (done) {
          break;
        }
        totalBytes += value.byteLength;
        if (totalBytes > maxBytes) {
          await reader.cancel();
          throw this.#bodyTooLarge(bodyKind);
        }
        chunks.push(value);
      }
    } finally {
      signal.removeEventListener("abort", cancelOnAbort);
      reader.releaseLock();
    }

    const bytes = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return bytes;
  }

  #bodyTooLarge(bodyKind: "manifest" | "asset"): WeatherLayersError {
    return bodyKind === "manifest"
      ? new WeatherLayersError(
          "MANIFEST_INVALID",
          "Weather manifest exceeds the response size limit"
        )
      : new WeatherLayersError(
          "ASSET_FETCH_FAILED",
          "Weather asset exceeds the response size limit"
        );
  }

  #throwIfAborted(signal: AbortSignal): void {
    if (signal.aborted) {
      throw (
        signal.reason ??
        new DOMException("Weather request was aborted", "AbortError")
      );
    }
  }

  #rethrowAbort(cause: unknown, signal: AbortSignal): void {
    if (signal.aborted) {
      this.#throwIfAborted(signal);
    }
    if (cause instanceof DOMException && cause.name === "AbortError") {
      throw cause;
    }
  }
}
