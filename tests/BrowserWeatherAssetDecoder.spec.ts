import { describe, expect, it } from "vitest";
import { BrowserWeatherAssetDecoder } from "../src/rendering/BrowserWeatherAssetDecoder.js";
import { createWeatherManifest } from "./fixtures/createWeatherManifest.js";

describe("BrowserWeatherAssetDecoder", () => {
  it("validates the PNG container before invoking the browser decoder", async () => {
    const manifest = createWeatherManifest();
    const layer = manifest.layers[0];
    if (layer === undefined) return;

    await expect(
      new BrowserWeatherAssetDecoder().decode(
        new Blob([new Uint8Array(33)], { type: "image/png" }),
        layer,
        manifest.grid,
        new AbortController().signal
      )
    ).rejects.toThrow("PNG signature");
  });
});
