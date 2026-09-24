import type { WeatherManifest } from "./WeatherManifest.js";
import {
  MAX_WEATHER_GRID_PIXELS,
  WEB_MERCATOR_MAX_LATITUDE
} from "./WeatherManifestLimits.js";
import { isStrictUtcTimestamp } from "./isStrictUtcTimestamp.js";

const GRID_TOLERANCE = 1e-6;

export function getWeatherManifestSemanticErrors(
  manifest: WeatherManifest
): string[] {
  const errors: string[] = [];
  const [west, south, east, north] = manifest.coverage.bounds;

  if (west >= east || south >= north) {
    errors.push("coverage.bounds must use west,south,east,north order");
  }
  if (
    west < -180 ||
    east > 180 ||
    south < -WEB_MERCATOR_MAX_LATITUDE ||
    north > WEB_MERCATOR_MAX_LATITUDE
  ) {
    errors.push(
      "coverage.bounds must stay within Web Mercator longitude and latitude limits"
    );
  }

  const runDates = [
    manifest.run.issuedAt,
    manifest.run.generatedAt,
    manifest.run.staleAfter,
    manifest.run.availableUntil
  ];
  if (runDates.some((value) => !isStrictUtcTimestamp(value))) {
    errors.push("run timestamps must be strict RFC3339 UTC dates");
  }
  if (runDates.every(isStrictUtcTimestamp)) {
    const issuedAt = Date.parse(manifest.run.issuedAt);
    const generatedAt = Date.parse(manifest.run.generatedAt);
    const staleAfter = Date.parse(manifest.run.staleAfter);
    const availableUntil = Date.parse(manifest.run.availableUntil);
    if (issuedAt > generatedAt) {
      errors.push("run.issuedAt must not be after run.generatedAt");
    }
    if (generatedAt >= staleAfter) {
      errors.push("run.generatedAt must be before run.staleAfter");
    }
    if (staleAfter >= availableUntil) {
      errors.push("run.staleAfter must be before run.availableUntil");
    }
  }

  const expectedWidth = (east - west) / manifest.grid.longitudeStep + 1;
  const expectedHeight = (north - south) / manifest.grid.latitudeStep + 1;

  if (Math.abs(expectedWidth - manifest.grid.width) > GRID_TOLERANCE) {
    errors.push("grid.width does not match coverage and longitudeStep");
  }

  if (Math.abs(expectedHeight - manifest.grid.height) > GRID_TOLERANCE) {
    errors.push("grid.height does not match coverage and latitudeStep");
  }
  if (manifest.grid.width * manifest.grid.height > MAX_WEATHER_GRID_PIXELS) {
    errors.push("grid exceeds the maximum weather pixel count");
  }

  const frameKeys = new Set<string>();
  const frameTimes = new Set<string>();
  let previousTime = Number.NEGATIVE_INFINITY;

  for (const frame of manifest.frames) {
    const timestamp = Date.parse(frame.validTime);

    if (!isStrictUtcTimestamp(frame.validTime)) {
      errors.push("frame validTime values must be strict RFC3339 UTC dates");
    } else if (
      isStrictUtcTimestamp(manifest.run.issuedAt) &&
      timestamp !==
        Date.parse(manifest.run.issuedAt) + frame.leadHour * 60 * 60 * 1000
    ) {
      errors.push("frame validTime must equal run.issuedAt plus leadHour");
    }

    if (frameKeys.has(frame.timeKey)) {
      errors.push("frames must have unique timeKey values");
    }
    if (frameTimes.has(frame.validTime)) {
      errors.push("frames must have unique validTime values");
    }
    if (timestamp <= previousTime) {
      errors.push("frames must be ordered by increasing validTime");
    }
    if (
      (frame.intervalStart === undefined) !==
      (frame.intervalEnd === undefined)
    ) {
      errors.push("frame intervals require both intervalStart and intervalEnd");
    }
    if (
      frame.intervalStart !== undefined &&
      frame.intervalEnd !== undefined &&
      (!isStrictUtcTimestamp(frame.intervalStart) ||
        !isStrictUtcTimestamp(frame.intervalEnd) ||
        Date.parse(frame.intervalStart) >= Date.parse(frame.intervalEnd) ||
        Date.parse(frame.intervalEnd) !== timestamp ||
        (isStrictUtcTimestamp(manifest.run.issuedAt) &&
          Date.parse(frame.intervalStart) < Date.parse(manifest.run.issuedAt)))
    ) {
      errors.push(
        "frame intervals must be strict UTC dates from run issuance through validTime"
      );
    }

    frameKeys.add(frame.timeKey);
    frameTimes.add(frame.validTime);
    previousTime = timestamp;
  }

  const layerIds = new Set<string>();
  for (const layer of manifest.layers) {
    if (layerIds.has(layer.id)) {
      errors.push("layers must have unique id values");
    }
    const range =
      layer.kind === "scalar"
        ? layer.encoding.valueRange
        : layer.encoding.componentRange;
    if (range[0] >= range[1]) {
      errors.push("encoding ranges must be increasing");
    }
    layerIds.add(layer.id);
  }

  for (const attribution of manifest.attributions) {
    if (
      !isHttpsUrl(attribution.sourceUrl) ||
      !isHttpsUrl(attribution.termsUrl)
    ) {
      errors.push("attribution URLs must be valid HTTPS URLs");
    }
  }

  return errors;
}

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}
