import { describe, expect, it } from "vitest";
import { WeatherLayersError } from "../src/error/WeatherLayersError.js";
import { resolveWeatherFrame } from "../src/controller/resolveWeatherFrame.js";
import { createWeatherManifest } from "./fixtures/createWeatherManifest.js";

describe("resolveWeatherFrame", () => {
  it("chooses the nearest frame", () => {
    const result = resolveWeatherFrame(
      createWeatherManifest(),
      "2026-09-24T02:00:00Z"
    );

    expect(result.frame.timeKey).toBe("f003");
    expect(result.time.requestedTime).toBe("2026-09-24T02:00:00.000Z");
  });

  it("resolves latest relative to the supplied clock", () => {
    const result = resolveWeatherFrame(
      createWeatherManifest(),
      "latest",
      "nearest",
      new Date("2026-09-24T02:30:00Z")
    );

    expect(result.frame.timeKey).toBe("f003");
  });

  it("requires an exact frame in exact mode", () => {
    expect(() =>
      resolveWeatherFrame(
        createWeatherManifest(),
        "2026-09-24T02:00:00Z",
        "exact"
      )
    ).toThrowError(WeatherLayersError);
  });

  it("turns invalid dates into a typed error", () => {
    expect(() => resolveWeatherFrame(createWeatherManifest(), "not-a-date"))
      .toThrowError(
        expect.objectContaining({ code: "TIME_NOT_AVAILABLE" })
      );
  });
});
