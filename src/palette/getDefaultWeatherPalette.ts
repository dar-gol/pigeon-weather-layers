import type { WeatherLayer } from "../manifest/WeatherLayer.js";
import type { WeatherPalette } from "../controller/WeatherPalette.js";

const KELVIN_OFFSET = 273.15;
const CELSIUS_UNITS = new Set(["°C", "degC"]);
const CLOUD_COVER_UNITS = new Set(["%", "percent"]);

const TEMPERATURE_STOPS = [
  { value: -60, color: [58, 28, 113, 255] },
  { value: -20, color: [44, 123, 182, 255] },
  { value: 0, color: [171, 217, 233, 255] },
  { value: 15, color: [255, 255, 191, 255] },
  { value: 30, color: [253, 174, 97, 255] },
  { value: 60, color: [165, 0, 38, 255] }
] as const;

const PRECIPITATION_STOPS = [
  { value: 0, color: [255, 255, 255, 0] },
  { value: 0.2, color: [198, 219, 239, 160] },
  { value: 2, color: [49, 130, 189, 210] },
  { value: 10, color: [0, 109, 44, 225] },
  { value: 30, color: [255, 255, 0, 235] },
  { value: 60, color: [255, 0, 0, 245] },
  { value: 100, color: [128, 0, 128, 255] }
] as const;

const CLOUD_STOPS = [
  { value: 0, color: [255, 255, 255, 0] },
  { value: 25, color: [220, 226, 232, 100] },
  { value: 50, color: [174, 184, 194, 155] },
  { value: 75, color: [117, 129, 141, 205] },
  { value: 100, color: [58, 69, 79, 235] }
] as const;

const PRESSURE_STOPS = [
  { value: 870, color: [94, 79, 162, 220] },
  { value: 970, color: [50, 136, 189, 220] },
  { value: 1013, color: [255, 255, 191, 210] },
  { value: 1040, color: [244, 109, 67, 220] },
  { value: 1085, color: [158, 1, 66, 230] }
] as const;

const WIND_STOPS = [
  { value: 0, color: [255, 255, 255, 0] },
  { value: 5, color: [116, 196, 118, 170] },
  { value: 10, color: [35, 139, 69, 200] },
  { value: 20, color: [253, 174, 97, 225] },
  { value: 30, color: [215, 48, 39, 240] },
  { value: 40, color: [103, 0, 31, 255] }
] as const;

export function getDefaultWeatherPalette(
  layer: WeatherLayer
): WeatherPalette {
  if (
    layer.kind === "vector" &&
    layer.id === "wind-10m" &&
    layer.unit.trim() === "m/s"
  ) {
    return {
      id: "wind-speed",
      valueRange: [0, 40],
      stops: WIND_STOPS
    };
  }

  if (
    layer.kind === "scalar" &&
    layer.id === "temperature-2m" &&
    CELSIUS_UNITS.has(layer.unit.trim())
  ) {
    return {
      id: "temperature-celsius",
      valueRange: layer.encoding.valueRange,
      stops: TEMPERATURE_STOPS
    };
  }

  if (
    layer.kind === "scalar" &&
    layer.id === "temperature-2m" &&
    layer.unit.trim() === "K"
  ) {
    return {
      id: "temperature-kelvin",
      valueRange: layer.encoding.valueRange,
      stops: TEMPERATURE_STOPS.map((stop) => ({
        value: stop.value + KELVIN_OFFSET,
        color: stop.color
      }))
    };
  }

  if (
    layer.kind === "scalar" &&
    layer.id === "precipitation-rate" &&
    layer.unit.trim() === "mm/h"
  ) {
    return {
      id: "precipitation",
      valueRange: layer.encoding.valueRange,
      stops: PRECIPITATION_STOPS
    };
  }

  if (
    layer.kind === "scalar" &&
    layer.id === "cloud-cover" &&
    CLOUD_COVER_UNITS.has(layer.unit.trim())
  ) {
    return {
      id: "cloud-cover",
      valueRange: layer.encoding.valueRange,
      stops: CLOUD_STOPS
    };
  }

  if (
    layer.kind === "scalar" &&
    layer.id === "pressure-msl" &&
    layer.unit.trim() === "hPa"
  ) {
    return {
      id: "pressure",
      valueRange: layer.encoding.valueRange,
      stops: PRESSURE_STOPS
    };
  }

  const valueRange: readonly [number, number] =
    layer.kind === "scalar"
      ? layer.encoding.valueRange
      : [
          0,
          Math.SQRT2 *
            Math.max(
              Math.abs(layer.encoding.componentRange[0]),
              Math.abs(layer.encoding.componentRange[1])
            )
        ];

  return {
    id: "default",
    valueRange,
    stops: [
      {
        value: valueRange[0],
        color: [38, 130, 142, 180]
      },
      {
        value: valueRange[1],
        color: [253, 231, 37, 240]
      }
    ]
  };
}
