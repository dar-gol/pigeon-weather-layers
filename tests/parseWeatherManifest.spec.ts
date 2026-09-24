import { describe, expect, it } from "vitest";
import { WeatherLayersError } from "../src/error/WeatherLayersError.js";
import { parseWeatherManifest } from "../src/manifest/parseWeatherManifest.js";
import { createWeatherManifest } from "./fixtures/createWeatherManifest.js";

describe("parseWeatherManifest", () => {
  it("accepts a valid regular-grid manifest", () => {
    const manifest = createWeatherManifest();

    expect(parseWeatherManifest(manifest)).toBe(manifest);
  });

  it("rejects tile placeholders", () => {
    const valid = createWeatherManifest();
    const manifest = {
      ...valid,
      delivery: {
        ...valid.delivery,
        assetTemplate:
          "./{datasetId}/{runId}/{layerId}/{timeKey}/{z}/{x}/{y}.png"
      }
    };

    expect(() => parseWeatherManifest(manifest)).toThrowError(
      WeatherLayersError
    );
  });

  it("rejects a grid that does not match its coverage", () => {
    const valid = createWeatherManifest();
    const manifest = { ...valid, grid: { ...valid.grid, width: 4 } };

    expect(() => parseWeatherManifest(manifest)).toThrow(
      "grid.width does not match coverage"
    );
  });

  it("rejects duplicate layer ids", () => {
    const valid = createWeatherManifest();
    const first = valid.layers[0];
    const second = valid.layers[1];
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    if (first === undefined || second === undefined) return;
    const manifest = {
      ...valid,
      layers: [first, { ...second, id: first.id }]
    };

    expect(() => parseWeatherManifest(manifest)).toThrow(
      "layers must have unique id values"
    );
  });

  it("rejects invalid timestamps even when they end with Z", () => {
    const valid = createWeatherManifest();
    const manifest = {
      ...valid,
      run: { ...valid.run, issuedAt: "not-a-dateZ" }
    };

    expect(() => parseWeatherManifest(manifest)).toThrow(
      "run timestamps must be valid ISO dates"
    );
  });
});
