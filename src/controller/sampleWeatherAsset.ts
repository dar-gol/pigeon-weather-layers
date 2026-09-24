import type { WeatherFrame } from "../manifest/WeatherFrame.js";
import type { WeatherLayer } from "../manifest/WeatherLayer.js";
import type { WeatherManifest } from "../manifest/WeatherManifest.js";
import type { DecodedWeatherAsset } from "../rendering/DecodedWeatherAsset.js";
import { decodeScalarCode } from "../rendering/decodeScalarCode.js";
import { decodeVectorCode } from "../rendering/decodeVectorCode.js";
import type { ScalarWeatherValue } from "./ScalarWeatherValue.js";
import type { VectorWeatherValue } from "./VectorWeatherValue.js";
import type { WeatherPosition } from "./WeatherPosition.js";
import type { WeatherValue } from "./WeatherValue.js";

export function sampleWeatherAsset(
  asset: DecodedWeatherAsset,
  manifest: WeatherManifest,
  layer: WeatherLayer,
  frame: WeatherFrame,
  position: WeatherPosition
): WeatherValue | null {
  const [west, south, east, north] = manifest.coverage.bounds;
  if (
    position.longitude < west ||
    position.longitude > east ||
    position.latitude < south ||
    position.latitude > north
  ) {
    return null;
  }

  const gridX =
    ((position.longitude - west) / (east - west)) * (asset.width - 1);
  const gridY =
    ((position.latitude - south) / (north - south)) * (asset.height - 1);
  const x0 = Math.floor(gridX);
  const y0 = Math.floor(gridY);
  const x1 = Math.min(x0 + 1, asset.width - 1);
  const y1 = Math.min(y0 + 1, asset.height - 1);
  const xFraction = gridX - x0;
  const yFraction = gridY - y0;
  const samples = [
    { x: x0, y: y0, weight: (1 - xFraction) * (1 - yFraction) },
    { x: x1, y: y0, weight: xFraction * (1 - yFraction) },
    { x: x0, y: y1, weight: (1 - xFraction) * yFraction },
    { x: x1, y: y1, weight: xFraction * yFraction }
  ];

  if (layer.kind === "scalar") {
    let weightedValue = 0;
    let validWeight = 0;

    for (const sample of samples) {
      const offset = sample.y * asset.width + sample.x;
      const value = decodeScalarCode(
        asset.codes[offset] ?? 0,
        layer.encoding
      );
      if (value !== null) {
        weightedValue += value * sample.weight;
        validWeight += sample.weight;
      }
    }

    if (validWeight === 0) {
      return null;
    }

    const result: ScalarWeatherValue = {
      kind: "scalar",
      layerId: layer.id,
      validTime: frame.validTime,
      unit: layer.unit,
      value: weightedValue / validWeight
    };
    return result;
  }

  let weightedU = 0;
  let weightedV = 0;
  let validWeight = 0;

  for (const sample of samples) {
    const offset = (sample.y * asset.width + sample.x) * 2;
    const u = decodeVectorCode(asset.codes[offset] ?? 0, layer.encoding);
    const v = decodeVectorCode(
      asset.codes[offset + 1] ?? 0,
      layer.encoding
    );
    if (u !== null && v !== null) {
      weightedU += u * sample.weight;
      weightedV += v * sample.weight;
      validWeight += sample.weight;
    }
  }

  if (validWeight === 0) {
    return null;
  }

  const u = weightedU / validWeight;
  const v = weightedV / validWeight;
  const speed = Math.hypot(u, v);
  const directionDegrees =
    speed === 0
      ? null
      : ((Math.atan2(-u, -v) * 180) / Math.PI + 360) % 360;
  const result: VectorWeatherValue = {
    kind: "vector",
    layerId: layer.id,
    validTime: frame.validTime,
    unit: layer.unit,
    u,
    v,
    speed,
    directionDegrees
  };
  return result;
}
