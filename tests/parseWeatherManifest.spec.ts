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

    expect(() => parseWeatherManifest(manifest)).toThrowError(
      WeatherLayersError
    );
  });

  it.each([
    "2026-02-31T00:00:00Z",
    "2026-09-24T00:00:00+00:00",
    "2026-09-24t00:00:00z"
  ])("rejects a non-strict UTC timestamp: %s", (issuedAt) => {
    const valid = createWeatherManifest();

    expect(() =>
      parseWeatherManifest({
        ...valid,
        run: { ...valid.run, issuedAt }
      })
    ).toThrowError(WeatherLayersError);
  });

  it.each([
    ["issued after generated", { issuedAt: "2026-09-24T00:20:00Z" }],
    ["generated at stale boundary", { generatedAt: "2099-09-24T12:00:00Z" }],
    ["stale at availability boundary", { staleAfter: "2099-09-25T00:00:00Z" }]
  ])("rejects run timestamps that are not ordered: %s", (_name, runUpdate) => {
    const valid = createWeatherManifest();

    expect(() =>
      parseWeatherManifest({
        ...valid,
        run: { ...valid.run, ...runUpdate }
      })
    ).toThrowError(WeatherLayersError);
  });

  it("requires validTime to equal issuedAt plus leadHour", () => {
    const valid = createWeatherManifest();
    const second = valid.frames[1];
    expect(second).toBeDefined();
    if (second === undefined) return;

    expect(() =>
      parseWeatherManifest({
        ...valid,
        frames: [
          valid.frames[0],
          { ...second, validTime: "2026-09-24T04:00:00Z" }
        ]
      })
    ).toThrow("frame validTime must equal run.issuedAt plus leadHour");
  });

  it("requires complete intervals ending at the frame valid time", () => {
    const valid = createWeatherManifest();
    const second = valid.frames[1];
    expect(second).toBeDefined();
    if (second === undefined) return;

    expect(() =>
      parseWeatherManifest({
        ...valid,
        frames: [
          valid.frames[0],
          {
            ...second,
            intervalStart: "2026-09-24T01:00:00Z",
            intervalEnd: "2026-09-24T02:00:00Z"
          }
        ]
      })
    ).toThrow(
      "frame intervals must be strict UTC dates from run issuance through validTime"
    );

    expect(() =>
      parseWeatherManifest({
        ...valid,
        frames: [
          valid.frames[0],
          { ...second, intervalStart: "2026-09-24T01:00:00Z" }
        ]
      })
    ).toThrow("frame intervals require both intervalStart and intervalEnd");
  });

  it.each([
    [-181, 0, 2, 2],
    [0, -85.05113, 2, 2],
    [0, 0, 181, 2],
    [0, 0, 2, 85.05113]
  ])("rejects coverage outside Web Mercator bounds: %j", (...bounds) => {
    const valid = createWeatherManifest();

    expect(() =>
      parseWeatherManifest({
        ...valid,
        coverage: { ...valid.coverage, bounds }
      })
    ).toThrowError(WeatherLayersError);
  });

  it("rejects grids above the pixel budget", () => {
    const valid = createWeatherManifest();

    expect(() =>
      parseWeatherManifest({
        ...valid,
        coverage: { ...valid.coverage, bounds: [0, 0, 20.48, 20.48] },
        grid: {
          ...valid.grid,
          width: 2049,
          height: 2049,
          longitudeStep: 0.01,
          latitudeStep: 0.01
        }
      })
    ).toThrow("grid exceeds the maximum weather pixel count");
  });

  it("rejects a grid dimension above the decoder limit", () => {
    const valid = createWeatherManifest();

    expect(() =>
      parseWeatherManifest({
        ...valid,
        coverage: { ...valid.coverage, bounds: [0, 0, 40.96, 2] },
        grid: {
          ...valid.grid,
          width: 4097,
          longitudeStep: 0.01
        }
      })
    ).toThrowError(WeatherLayersError);
  });

  it("bounds collection counts and identifier lengths", () => {
    const valid = createWeatherManifest();

    expect(() =>
      parseWeatherManifest({
        ...valid,
        datasetId: "x".repeat(129)
      })
    ).toThrowError(WeatherLayersError);
    expect(() =>
      parseWeatherManifest({
        ...valid,
        frames: Array.from({ length: 513 }, () => valid.frames[0])
      })
    ).toThrowError(WeatherLayersError);
  });
});
