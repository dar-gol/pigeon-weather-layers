import { describe, expect, it } from "vitest";
import { sampleWeatherAsset } from "../src/controller/sampleWeatherAsset.js";
import type { DecodedWeatherAsset } from "../src/rendering/DecodedWeatherAsset.js";
import { createWeatherManifest } from "./fixtures/createWeatherManifest.js";

describe("sampleWeatherAsset", () => {
  it("bilinearly interpolates scalar values", () => {
    const manifest = createWeatherManifest();
    const layer = manifest.layers[0];
    const frame = manifest.frames[0];
    const asset: DecodedWeatherAsset = {
      width: 3,
      height: 3,
      channels: 1,
      codes: new Uint8Array([1, 11, 21, 31, 41, 51, 61, 71, 81])
    };

    expect(layer).toBeDefined();
    expect(frame).toBeDefined();
    if (layer === undefined || frame === undefined) return;

    const value = sampleWeatherAsset(asset, manifest, layer, frame, {
      longitude: 0.5,
      latitude: 0.5
    });

    expect(value?.kind).toBe("scalar");
    if (value?.kind === "scalar") {
      expect(value.value).toBeCloseTo(20);
    }
  });

  it("maps the first asset row to south and the last row to north", () => {
    const manifest = createWeatherManifest();
    const layer = manifest.layers[0];
    const frame = manifest.frames[0];
    const asset: DecodedWeatherAsset = {
      width: 3,
      height: 3,
      channels: 1,
      codes: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9])
    };

    expect(layer).toBeDefined();
    expect(frame).toBeDefined();
    if (layer === undefined || frame === undefined) return;

    const southWest = sampleWeatherAsset(asset, manifest, layer, frame, {
      longitude: 0,
      latitude: 0
    });
    const northEast = sampleWeatherAsset(asset, manifest, layer, frame, {
      longitude: 2,
      latitude: 2
    });

    expect(southWest?.kind).toBe("scalar");
    expect(northEast?.kind).toBe("scalar");
    if (southWest?.kind === "scalar" && northEast?.kind === "scalar") {
      expect(southWest.value).toBe(0);
      expect(northEast.value).toBe(8);
    }
  });

  it("returns wind speed and meteorological direction", () => {
    const manifest = createWeatherManifest();
    const layer = manifest.layers[1];
    const frame = manifest.frames[0];
    const codes = new Uint8Array(3 * 3 * 2);
    for (let offset = 0; offset < codes.length; offset += 2) {
      codes[offset] = 138;
      codes[offset + 1] = 128;
    }

    expect(layer).toBeDefined();
    expect(frame).toBeDefined();
    if (layer === undefined || frame === undefined) return;

    const value = sampleWeatherAsset(
      { width: 3, height: 3, channels: 2, codes },
      manifest,
      layer,
      frame,
      { longitude: 1, latitude: 1 }
    );

    expect(value?.kind).toBe("vector");
    if (value?.kind === "vector") {
      expect(value.speed).toBeCloseTo(10);
      expect(value.directionDegrees).toBeCloseTo(270);
    }
  });

  it("does not invent a direction for calm wind", () => {
    const manifest = createWeatherManifest();
    const layer = manifest.layers[1];
    const frame = manifest.frames[0];
    const codes = new Uint8Array(3 * 3 * 2).fill(128);

    expect(layer).toBeDefined();
    expect(frame).toBeDefined();
    if (layer === undefined || frame === undefined) return;

    const value = sampleWeatherAsset(
      { width: 3, height: 3, channels: 2, codes },
      manifest,
      layer,
      frame,
      { longitude: 1, latitude: 1 }
    );

    expect(value?.kind).toBe("vector");
    if (value?.kind === "vector") {
      expect(value.speed).toBe(0);
      expect(value.directionDegrees).toBeNull();
    }
  });

  it("returns null outside coverage", () => {
    const manifest = createWeatherManifest();
    const layer = manifest.layers[0];
    const frame = manifest.frames[0];
    if (layer === undefined || frame === undefined) return;

    expect(
      sampleWeatherAsset(
        {
          width: 3,
          height: 3,
          channels: 1,
          codes: new Uint8Array(9)
        },
        manifest,
        layer,
        frame,
        { longitude: 3, latitude: 1 }
      )
    ).toBeNull();
  });
});
