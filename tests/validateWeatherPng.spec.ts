import { describe, expect, it } from "vitest";
import { MAX_WEATHER_PNG_BYTES } from "../src/manifest/WeatherManifestLimits.js";
import { validateWeatherPng } from "../src/rendering/validateWeatherPng.js";
import { createWeatherManifest } from "./fixtures/createWeatherManifest.js";

describe("validateWeatherPng", () => {
  it("accepts the declared scalar and vector PNG headers", async () => {
    const manifest = createWeatherManifest();
    const scalar = manifest.layers[0];
    const vector = manifest.layers[1];
    expect(scalar?.kind).toBe("scalar");
    expect(vector?.kind).toBe("vector");
    if (scalar === undefined || vector === undefined) return;

    await expect(
      validateWeatherPng(
        createPngHeader(3, 3, 0),
        scalar,
        manifest.grid,
        new AbortController().signal
      )
    ).resolves.toBeUndefined();
    await expect(
      validateWeatherPng(
        createPngHeader(3, 3, 2),
        vector,
        manifest.grid,
        new AbortController().signal
      )
    ).resolves.toBeUndefined();
  });

  it.each([
    ["signature", { signature: false }],
    ["IHDR length", { ihdrLength: 12 }],
    ["IHDR name", { ihdrName: "JHDR" }],
    ["dimensions", { width: 4 }],
    ["bit depth", { bitDepth: 16 }],
    ["compression", { compression: 1 }],
    ["filter", { filter: 1 }],
    ["interlace", { interlace: 1 }]
  ])("rejects an invalid %s", async (_name, overrides) => {
    const manifest = createWeatherManifest();
    const scalar = manifest.layers[0];
    if (scalar === undefined) return;

    await expect(
      validateWeatherPng(
        createPngHeader(3, 3, 0, overrides),
        scalar,
        manifest.grid,
        new AbortController().signal
      )
    ).rejects.toMatchObject({ code: "ASSET_DECODE_FAILED" });
  });

  it("rejects a color type that does not match the layer kind", async () => {
    const manifest = createWeatherManifest();
    const scalar = manifest.layers[0];
    const vector = manifest.layers[1];
    if (scalar === undefined || vector === undefined) return;

    await expect(
      validateWeatherPng(
        createPngHeader(3, 3, 2),
        scalar,
        manifest.grid,
        new AbortController().signal
      )
    ).rejects.toThrow("grayscale color type 0");
    await expect(
      validateWeatherPng(
        createPngHeader(3, 3, 0),
        vector,
        manifest.grid,
        new AbortController().signal
      )
    ).rejects.toThrow("RGB color type 2");
  });

  it("rejects truncated and oversized encoded assets", async () => {
    const manifest = createWeatherManifest();
    const scalar = manifest.layers[0];
    if (scalar === undefined) return;
    const signal = new AbortController().signal;

    await expect(
      validateWeatherPng(
        new Blob([new Uint8Array(8)]),
        scalar,
        manifest.grid,
        signal
      )
    ).rejects.toThrow("complete PNG header");
    await expect(
      validateWeatherPng(
        new Blob([new Uint8Array(MAX_WEATHER_PNG_BYTES + 1)]),
        scalar,
        manifest.grid,
        signal
      )
    ).rejects.toThrow("encoded asset size limit");
  });

  it("honors cancellation before reading the header", async () => {
    const manifest = createWeatherManifest();
    const scalar = manifest.layers[0];
    if (scalar === undefined) return;
    const operation = new AbortController();
    operation.abort(new DOMException("cancelled", "AbortError"));

    await expect(
      validateWeatherPng(
        createPngHeader(3, 3, 0),
        scalar,
        manifest.grid,
        operation.signal
      )
    ).rejects.toMatchObject({ name: "AbortError" });
  });
});

function createPngHeader(
  width: number,
  height: number,
  colorType: number,
  overrides: {
    signature?: boolean;
    ihdrLength?: number;
    ihdrName?: string;
    width?: number;
    height?: number;
    bitDepth?: number;
    compression?: number;
    filter?: number;
    interlace?: number;
  } = {}
): Blob {
  const bytes = new Uint8Array(33);
  if (overrides.signature !== false) {
    bytes.set([137, 80, 78, 71, 13, 10, 26, 10]);
  }
  const view = new DataView(bytes.buffer);
  view.setUint32(8, overrides.ihdrLength ?? 13, false);
  const name = overrides.ihdrName ?? "IHDR";
  for (let index = 0; index < name.length && index < 4; index += 1) {
    bytes[12 + index] = name.charCodeAt(index);
  }
  view.setUint32(16, overrides.width ?? width, false);
  view.setUint32(20, overrides.height ?? height, false);
  bytes[24] = overrides.bitDepth ?? 8;
  bytes[25] = colorType;
  bytes[26] = overrides.compression ?? 0;
  bytes[27] = overrides.filter ?? 0;
  bytes[28] = overrides.interlace ?? 0;
  return new Blob([bytes], { type: "image/png" });
}
