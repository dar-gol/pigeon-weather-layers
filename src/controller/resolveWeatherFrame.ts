import { WeatherLayersError } from "../error/WeatherLayersError.js";
import type { WeatherManifest } from "../manifest/WeatherManifest.js";
import type { WeatherFrameResolution } from "./WeatherFrameResolution.js";
import type { WeatherTimeInput } from "./WeatherTimeInput.js";
import type { WeatherTimeSelectionMode } from "./WeatherTimeSelectionMode.js";
import { normalizeWeatherTime } from "./normalizeWeatherTime.js";

export function resolveWeatherFrame(
  manifest: WeatherManifest,
  input: WeatherTimeInput,
  mode: WeatherTimeSelectionMode = manifest.timeSelection.defaultMode,
  now: Date = new Date()
): WeatherFrameResolution {
  const requestedTime = normalizeWeatherTime(input);
  const targetTime =
    input === "latest" ? now.getTime() : Date.parse(requestedTime);

  if (!Number.isFinite(targetTime)) {
    throw new WeatherLayersError(
      "TIME_NOT_AVAILABLE",
      "Weather time is not a valid timestamp"
    );
  }

  if (mode === "exact" && requestedTime !== "latest") {
    const exact = manifest.frames.find(
      (frame) => Date.parse(frame.validTime) === targetTime
    );
    if (exact === undefined) {
      throw new WeatherLayersError(
        "TIME_NOT_AVAILABLE",
        "Requested weather time is not available"
      );
    }
    return {
      frame: exact,
      time: {
        requestedTime,
        resolvedTime: exact.validTime,
        timeKey: exact.timeKey
      }
    };
  }

  let nearest = manifest.frames[0];
  if (nearest === undefined) {
    throw new WeatherLayersError(
      "TIME_NOT_AVAILABLE",
      "Weather manifest contains no frames"
    );
  }
  let nearestDistance = Math.abs(Date.parse(nearest.validTime) - targetTime);

  for (const frame of manifest.frames.slice(1)) {
    const distance = Math.abs(Date.parse(frame.validTime) - targetTime);
    if (distance < nearestDistance) {
      nearest = frame;
      nearestDistance = distance;
    }
  }

  const maximumDistance =
    manifest.timeSelection.maxDistanceMinutes * 60 * 1000;
  if (input !== "latest" && nearestDistance > maximumDistance) {
    throw new WeatherLayersError(
      "TIME_NOT_AVAILABLE",
      "No weather frame is close enough to the requested time"
    );
  }

  return {
    frame: nearest,
    time: {
      requestedTime,
      resolvedTime: nearest.validTime,
      timeKey: nearest.timeKey
    }
  };
}
