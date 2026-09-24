import type { WeatherLayersErrorCode } from "./WeatherLayersErrorCode.js";

export class WeatherLayersError extends Error {
  readonly code: WeatherLayersErrorCode;
  readonly recoverable: boolean;
  override readonly cause?: unknown;

  constructor(
    code: WeatherLayersErrorCode,
    message: string,
    options: { cause?: unknown; recoverable?: boolean } = {}
  ) {
    super(message);
    this.name = "WeatherLayersError";
    this.code = code;
    this.recoverable = options.recoverable ?? false;
    this.cause = options.cause;
  }
}
