import { describe, expect, it } from "vitest";
import type { ScalarWeatherLayer } from "../src/manifest/ScalarWeatherLayer.js";
import type { VectorWeatherLayer } from "../src/manifest/VectorWeatherLayer.js";
import { getDefaultWeatherPalette } from "../src/palette/getDefaultWeatherPalette.js";

function createScalarLayer(
  id: string,
  unit: string,
  valueRange: readonly [number, number]
): ScalarWeatherLayer {
  return {
    id,
    kind: "scalar",
    sourceParameters: ["test"],
    unit,
    aggregation: "instantaneous",
    temporalInterpolation: "nearest",
    encoding: {
      type: "scalar-png-r8-linear-v1",
      pngColorType: 0,
      valueRange,
      encodedRange: [1, 255],
      noDataCode: 0
    }
  };
}

function createVectorLayer(id: string, unit: string): VectorWeatherLayer {
  return {
    id,
    kind: "vector",
    sourceParameters: ["u", "v"],
    unit,
    aggregation: "instantaneous",
    temporalInterpolation: "nearest",
    encoding: {
      type: "vector-png-rg8-linear-v1",
      pngColorType: 2,
      uChannel: "r",
      vChannel: "g",
      componentRange: [-30, 30],
      encodedRange: [1, 255],
      noDataCode: 0
    }
  };
}

describe("getDefaultWeatherPalette", () => {
  it("uses Celsius stops for canonical Celsius temperature", () => {
    const palette = getDefaultWeatherPalette(
      createScalarLayer("temperature-2m", "°C", [-60, 60])
    );

    expect(palette.id).toBe("temperature-celsius");
    expect(palette.stops[0]?.value).toBe(-60);
    expect(palette.stops.at(-1)?.value).toBe(60);
    expect(
      getDefaultWeatherPalette(
        createScalarLayer("temperature-2m", "degC", [-60, 60])
      ).id
    ).toBe("temperature-celsius");
  });

  it("converts temperature stops to Kelvin", () => {
    const palette = getDefaultWeatherPalette(
      createScalarLayer("temperature-2m", "K", [213.15, 333.15])
    );

    expect(palette.id).toBe("temperature-kelvin");
    expect(palette.stops[0]?.value).toBeCloseTo(213.15);
    expect(palette.stops.at(-1)?.value).toBeCloseTo(333.15);
  });

  it.each([
    ["precipitation-rate", "mm/h", "precipitation"],
    ["cloud-cover", "%", "cloud-cover"],
    ["cloud-cover", "percent", "cloud-cover"],
    ["pressure-msl", "hPa", "pressure"]
  ])("uses %s palette only with canonical %s units", (id, unit, paletteId) => {
    expect(getDefaultWeatherPalette(createScalarLayer(id, unit, [0, 100])).id).toBe(
      paletteId
    );
  });

  it("uses the wind palette only for canonical 10 m wind in m/s", () => {
    expect(getDefaultWeatherPalette(createVectorLayer("wind-10m", "m/s")).id).toBe(
      "wind-speed"
    );
    expect(getDefaultWeatherPalette(createVectorLayer("wind", "m/s")).id).toBe(
      "default"
    );
    expect(getDefaultWeatherPalette(createVectorLayer("wind-10m", "km/h")).id).toBe(
      "default"
    );
  });

  it("falls back when a canonical id uses an incompatible unit", () => {
    expect(
      getDefaultWeatherPalette(
        createScalarLayer("temperature-2m", "m/s", [-60, 60])
      ).id
    ).toBe("default");
    expect(
      getDefaultWeatherPalette(
        createScalarLayer("pressure-msl", "Pa", [87_000, 108_500])
      ).id
    ).toBe("default");
  });
});
