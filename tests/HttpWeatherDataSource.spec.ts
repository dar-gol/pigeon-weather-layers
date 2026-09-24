import { describe, expect, it, vi } from "vitest";
import {
  MAX_WEATHER_MANIFEST_BYTES,
  MAX_WEATHER_PNG_BYTES
} from "../src/manifest/WeatherManifestLimits.js";
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
    expect(fetch).toHaveBeenCalledWith(
      new URL("https://weather.example/manifest.json"),
      expect.objectContaining({ redirect: "error" })
    );
  });

  it("preserves AbortError when a fetch is cancelled", async () => {
    const reason = new DOMException("cancelled by caller", "AbortError");
    const fetch = vi.fn<typeof globalThis.fetch>().mockRejectedValue(reason);
    const source = new HttpWeatherDataSource({
      manifestUrl: "https://weather.example/manifest.json",
      fetch
    });

    await expect(
      source.loadManifest(new AbortController().signal)
    ).rejects.toBe(reason);
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
    ).rejects.toBe(reason);
  });

  it("preserves the signal reason when streaming is cancelled", async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("{"));
      }
    });
    const source = new HttpWeatherDataSource({
      manifestUrl: "https://weather.example/manifest.json",
      fetch: vi.fn<typeof globalThis.fetch>().mockResolvedValue(
        new Response(body, {
          status: 200,
          headers: { "content-type": "application/json" }
        })
      )
    });
    const operation = new AbortController();
    const reason = new DOMException("cancelled while reading", "AbortError");
    const promise = source.loadManifest(operation.signal);

    await Promise.resolve();
    operation.abort(reason);

    await expect(promise).rejects.toBe(reason);
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

  it("loads assets from an explicitly allowed CDN origin", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      new Response(new Uint8Array([137, 80, 78, 71]), {
        status: 200,
        headers: { "content-type": "image/png" }
      })
    );
    const source = new HttpWeatherDataSource({
      manifestUrl: "https://weather.example/manifest.json",
      allowedAssetOrigins: ["https://cdn.example"],
      fetch
    });

    await expect(
      source.loadAsset(
        {
          url: "https://cdn.example/frame.png",
          datasetId: "dataset",
          runId: "run",
          layerId: "temperature",
          timeKey: "f000"
        },
        new AbortController().signal
      )
    ).resolves.toMatchObject({ size: 4, type: "image/png" });
  });

  it("rejects a manifest response whose final URL changes origin", async () => {
    const response = new Response(JSON.stringify(createWeatherManifest()), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
    Object.defineProperty(response, "url", {
      value: "https://redirected.example/manifest.json"
    });
    const source = new HttpWeatherDataSource({
      manifestUrl: "https://weather.example/manifest.json",
      fetch: vi.fn<typeof globalThis.fetch>().mockResolvedValue(response)
    });

    await expect(
      source.loadManifest(new AbortController().signal)
    ).rejects.toMatchObject({ code: "ASSET_ORIGIN_NOT_ALLOWED" });
  });

  it("rejects an asset response whose final URL leaves the allow-list", async () => {
    const response = new Response(new Uint8Array([137, 80, 78, 71]), {
      status: 200,
      headers: { "content-type": "image/png" }
    });
    Object.defineProperty(response, "url", {
      value: "https://redirected.example/frame.png"
    });
    const source = new HttpWeatherDataSource({
      manifestUrl: "https://weather.example/manifest.json",
      fetch: vi.fn<typeof globalThis.fetch>().mockResolvedValue(response)
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
    ).rejects.toMatchObject({ code: "ASSET_ORIGIN_NOT_ALLOWED" });
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

  it("stops buffering manifest and asset responses at their byte limits", async () => {
    const manifestFetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      new Response(new Uint8Array(MAX_WEATHER_MANIFEST_BYTES + 1), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    );
    const manifestSource = new HttpWeatherDataSource({
      manifestUrl: "https://weather.example/manifest.json",
      fetch: manifestFetch
    });

    await expect(
      manifestSource.loadManifest(new AbortController().signal)
    ).rejects.toMatchObject({
      code: "MANIFEST_INVALID",
      message: "Weather manifest exceeds the response size limit"
    });

    const assetFetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      new Response(new Uint8Array([137, 80, 78, 71]), {
        status: 200,
        headers: {
          "content-type": "image/png",
          "content-length": String(MAX_WEATHER_PNG_BYTES + 1)
        }
      })
    );
    const assetSource = new HttpWeatherDataSource({
      manifestUrl: "https://weather.example/manifest.json",
      fetch: assetFetch
    });

    await expect(
      assetSource.loadAsset(
        {
          url: "./frame.png",
          datasetId: "dataset",
          runId: "run",
          layerId: "temperature",
          timeKey: "f000"
        },
        new AbortController().signal
      )
    ).rejects.toMatchObject({
      code: "ASSET_FETCH_FAILED",
      message: "Weather asset exceeds the response size limit"
    });
    expect(assetFetch).toHaveBeenCalledWith(
      new URL("https://weather.example/frame.png"),
      expect.objectContaining({ redirect: "error" })
    );
  });
});
