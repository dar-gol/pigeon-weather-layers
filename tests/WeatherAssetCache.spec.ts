import { describe, expect, it } from "vitest";
import { WeatherAssetCache } from "../src/controller/WeatherAssetCache.js";
import type { DecodedWeatherAsset } from "../src/rendering/DecodedWeatherAsset.js";

describe("WeatherAssetCache", () => {
  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, 1.5])(
    "rejects an unsafe byte budget: %s",
    (maxBytes) => {
      expect(() => new WeatherAssetCache(maxBytes)).toThrow(
        "maxBytes must be a positive safe integer"
      );
    }
  );

  it("evicts the least recently used asset without exceeding its budget", () => {
    const cache = new WeatherAssetCache(4);
    const first = createAsset(2, 1);
    const second = createAsset(2, 2);
    const third = createAsset(2, 3);

    cache.set("first", first);
    cache.set("second", second);
    expect(cache.get("first")).toBe(first);

    cache.set("third", third);

    expect(cache.get("second")).toBeUndefined();
    expect(cache.get("first")).toBe(first);
    expect(cache.get("third")).toBe(third);
  });

  it("does not retain an individual asset larger than the budget", () => {
    const cache = new WeatherAssetCache(2);

    cache.set("oversized", createAsset(3, 1));

    expect(cache.get("oversized")).toBeUndefined();
  });

  it("accounts for replacement and clear operations", () => {
    const cache = new WeatherAssetCache(4);
    const replacement = createAsset(3, 2);
    cache.set("same", createAsset(2, 1));
    cache.set("same", replacement);
    cache.set("other", createAsset(1, 3));

    expect(cache.get("same")).toBe(replacement);
    expect(cache.get("other")).toBeDefined();

    cache.clear();
    expect(cache.get("same")).toBeUndefined();
    expect(cache.get("other")).toBeUndefined();
  });
});

function createAsset(bytes: number, fill: number): DecodedWeatherAsset {
  return {
    width: bytes,
    height: 1,
    channels: 1,
    codes: new Uint8Array(bytes).fill(fill)
  };
}
