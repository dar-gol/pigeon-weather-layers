import { describe, expect, it, vi } from "vitest";
import { HttpWeatherDataSource } from "../src/source/HttpWeatherDataSource.js";
import { createWeatherManifest } from "./fixtures/createWeatherManifest.js";

describe("HttpWeatherDataSource", () => {
  it("loads JSON from the configured manifest origin", async () => {
    const manifest = createWeatherManifest();
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      new Response(JSON.stringify(manifest), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    );
    const source = new HttpWeatherDataSource({
      manifestUrl: "https://weather.example/manifest.json",
      fetch
    });

    await expect(
      source.loadManifest(new AbortController().signal)
    ).resolves.toEqual(manifest);
  });

  it("blocks an asset origin that was not explicitly allowed", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>();
    const source = new HttpWeatherDataSource({
      manifestUrl: "https://weather.example/manifest.json",
      fetch
    });

    await expect(
      source.loadAsset(
        {
          url: "https://untrusted.example/frame.png",
          datasetId: "dataset",
          runId: "run",
          layerId: "temperature",
          timeKey: "f000"
        },
        new AbortController().signal
      )
    ).rejects.toMatchObject({ code: "ASSET_ORIGIN_NOT_ALLOWED" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects non-PNG assets", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      new Response("not an image", {
        status: 200,
        headers: { "content-type": "text/plain" }
      })
    );
    const source = new HttpWeatherDataSource({
      manifestUrl: "https://weather.example/manifest.json",
      fetch
    });

    await expect(
      source.loadAsset(
        {
          url: "./frame.png",
          datasetId: "dataset",
          runId: "run",
          layerId: "temperature",
          timeKey: "f000"
        },
        new AbortController().signal
      )
    ).rejects.toMatchObject({ code: "ASSET_DECODE_FAILED" });
  });
});
