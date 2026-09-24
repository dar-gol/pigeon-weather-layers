import { WeatherLayersError } from "../error/WeatherLayersError.js";
import type { WeatherGrid } from "../manifest/WeatherGrid.js";
import type { WeatherLayer } from "../manifest/WeatherLayer.js";
import {
  MAX_WEATHER_GRID_PIXELS,
  MAX_WEATHER_PNG_BYTES
} from "../manifest/WeatherManifestLimits.js";

const PNG_HEADER_BYTES = 33;
const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10] as const;

export async function validateWeatherPng(
  blob: Blob,
  layer: WeatherLayer,
  grid: WeatherGrid,
  signal: AbortSignal
): Promise<void> {
  throwIfAborted(signal);

  if (blob.size < PNG_HEADER_BYTES || blob.size > MAX_WEATHER_PNG_BYTES) {
    throw invalidPng(
      blob.size > MAX_WEATHER_PNG_BYTES
        ? "Weather PNG exceeds the encoded asset size limit"
        : "Weather asset does not contain a complete PNG header"
    );
  }

  const bytes = new Uint8Array(
    await blob.slice(0, PNG_HEADER_BYTES).arrayBuffer()
  );
  throwIfAborted(signal);

  if (!PNG_SIGNATURE.every((byte, index) => bytes[index] === byte)) {
    throw invalidPng("Weather asset does not have a PNG signature");
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (
    view.getUint32(8, false) !== 13 ||
    bytes[12] !== 73 ||
    bytes[13] !== 72 ||
    bytes[14] !== 68 ||
    bytes[15] !== 82
  ) {
    throw invalidPng("Weather PNG must start with a standard IHDR chunk");
  }

  const width = view.getUint32(16, false);
  const height = view.getUint32(20, false);
  if (
    width !== grid.width ||
    height !== grid.height ||
    width * height > MAX_WEATHER_GRID_PIXELS
  ) {
    throw invalidPng("Weather PNG dimensions do not match the manifest grid");
  }

  if (bytes[24] !== 8) {
    throw invalidPng("Weather PNG must use an 8-bit sample depth");
  }

  const expectedColorType = layer.kind === "scalar" ? 0 : 2;
  if (bytes[25] !== expectedColorType) {
    throw invalidPng(
      layer.kind === "scalar"
        ? "Scalar weather PNG must use grayscale color type 0"
        : "Vector weather PNG must use RGB color type 2"
    );
  }

  if (bytes[26] !== 0 || bytes[27] !== 0 || bytes[28] !== 0) {
    throw invalidPng(
      "Weather PNG must use standard compression and filtering without interlace"
    );
  }
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) {
    throw signal.reason;
  }
}

function invalidPng(message: string): WeatherLayersError {
  return new WeatherLayersError("ASSET_DECODE_FAILED", message);
}
