import type { WeatherManifest } from "./WeatherManifest.js";

const GRID_TOLERANCE = 1e-6;

export function getWeatherManifestSemanticErrors(
  manifest: WeatherManifest
): string[] {
  const errors: string[] = [];
  const [west, south, east, north] = manifest.coverage.bounds;

  if (west >= east || south >= north) {
    errors.push("coverage.bounds must use west,south,east,north order");
  }

  const runDates = [
    manifest.run.issuedAt,
    manifest.run.generatedAt,
    manifest.run.staleAfter,
    manifest.run.availableUntil
  ];
  if (runDates.some((value) => !Number.isFinite(Date.parse(value)))) {
    errors.push("run timestamps must be valid ISO dates");
  }
  if (
    Date.parse(manifest.run.staleAfter) >=
    Date.parse(manifest.run.availableUntil)
  ) {
    errors.push("run.staleAfter must be before run.availableUntil");
  }

  const expectedWidth = (east - west) / manifest.grid.longitudeStep + 1;
  const expectedHeight = (north - south) / manifest.grid.latitudeStep + 1;

  if (Math.abs(expectedWidth - manifest.grid.width) > GRID_TOLERANCE) {
    errors.push("grid.width does not match coverage and longitudeStep");
  }

  if (Math.abs(expectedHeight - manifest.grid.height) > GRID_TOLERANCE) {
    errors.push("grid.height does not match coverage and latitudeStep");
  }

  const frameKeys = new Set<string>();
  const frameTimes = new Set<string>();
  let previousTime = Number.NEGATIVE_INFINITY;

  for (const frame of manifest.frames) {
    const timestamp = Date.parse(frame.validTime);

    if (!Number.isFinite(timestamp)) {
      errors.push("frame validTime values must be valid ISO dates");
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
      (!Number.isFinite(Date.parse(frame.intervalStart)) ||
        !Number.isFinite(Date.parse(frame.intervalEnd)) ||
        Date.parse(frame.intervalStart) >= Date.parse(frame.intervalEnd))
    ) {
      errors.push("frame intervals must contain increasing ISO dates");
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
