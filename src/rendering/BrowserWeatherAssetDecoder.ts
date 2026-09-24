import { WeatherLayersError } from "../error/WeatherLayersError.js";
import type { WeatherGrid } from "../manifest/WeatherGrid.js";
import type { WeatherLayer } from "../manifest/WeatherLayer.js";
import type { DecodedWeatherAsset } from "./DecodedWeatherAsset.js";
import type { WeatherAssetDecoder } from "./WeatherAssetDecoder.js";

export class BrowserWeatherAssetDecoder implements WeatherAssetDecoder {
  async decode(
    blob: Blob,
    layer: WeatherLayer,
    grid: WeatherGrid,
    signal: AbortSignal
  ): Promise<DecodedWeatherAsset> {
    this.#throwIfAborted(signal);

    if (typeof createImageBitmap !== "function") {
      throw new WeatherLayersError(
        "ASSET_DECODE_FAILED",
        "createImageBitmap is not available"
      );
    }

    let bitmap: ImageBitmap;
    try {
      bitmap = await createImageBitmap(blob, {
        colorSpaceConversion: "none",
        premultiplyAlpha: "none"
      });
    } catch (cause) {
      throw new WeatherLayersError(
        "ASSET_DECODE_FAILED",
        "Unable to decode weather PNG",
        { cause }
      );
    }

    try {
      this.#throwIfAborted(signal);
      if (bitmap.width !== grid.width || bitmap.height !== grid.height) {
        throw new WeatherLayersError(
          "ASSET_DECODE_FAILED",
          "Weather PNG dimensions do not match the manifest grid"
        );
      }

      const context = this.#createContext(bitmap.width, bitmap.height);
      context.drawImage(bitmap, 0, 0);
      const rgba = context.getImageData(
        0,
        0,
        bitmap.width,
        bitmap.height
      ).data;
      const channels = layer.kind === "scalar" ? 1 : 2;
      const codes = new Uint8Array(bitmap.width * bitmap.height * channels);

      for (let pixel = 0; pixel < bitmap.width * bitmap.height; pixel += 1) {
        const sourceOffset = pixel * 4;
        const targetOffset = pixel * channels;
        codes[targetOffset] = rgba[sourceOffset] ?? 0;
        if (channels === 2) {
          codes[targetOffset + 1] = rgba[sourceOffset + 1] ?? 0;
        }
      }

      this.#throwIfAborted(signal);
      return {
        width: bitmap.width,
        height: bitmap.height,
        channels,
        codes
      };
    } finally {
      bitmap.close();
    }
  }

  #createContext(
    width: number,
    height: number
  ): OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D {
    if (typeof OffscreenCanvas !== "undefined") {
      const context = new OffscreenCanvas(width, height).getContext("2d", {
        willReadFrequently: true
      });
      if (context !== null) {
        return context;
      }
    }

    if (typeof document !== "undefined") {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d", {
        willReadFrequently: true
      });
      if (context !== null) {
        return context;
      }
    }

    throw new WeatherLayersError(
      "ASSET_DECODE_FAILED",
      "No 2D canvas is available for PNG decoding"
    );
  }

  #throwIfAborted(signal: AbortSignal): void {
    if (signal.aborted) {
      throw signal.reason;
    }
  }
}
