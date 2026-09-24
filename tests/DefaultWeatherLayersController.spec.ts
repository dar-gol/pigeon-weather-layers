import { describe, expect, it } from "vitest";
import { DefaultWeatherLayersController } from "../src/controller/DefaultWeatherLayersController.js";
import type { WeatherMap } from "../src/map/WeatherMap.js";
import type { WeatherCustomLayer } from "../src/map/WeatherCustomLayer.js";
import type { WeatherAssetDecoder } from "../src/rendering/WeatherAssetDecoder.js";
import type { WeatherDataSource } from "../src/source/WeatherDataSource.js";
import { createWeatherManifest } from "./fixtures/createWeatherManifest.js";

describe("DefaultWeatherLayersController", () => {
  it("attaches, switches layer and time, and cleans up", async () => {
    const manifest = createWeatherManifest();
    const source: WeatherDataSource = {
      async loadManifest() {
        return manifest;
      },
      async loadAsset() {
        return new Blob([new Uint8Array([1])], { type: "image/png" });
      }
    };
    const decoder: WeatherAssetDecoder = {
      async decode(_blob, layer, grid) {
        return {
          width: grid.width,
          height: grid.height,
          channels: layer.kind === "scalar" ? 1 : 2,
          codes: new Uint8Array(
            grid.width * grid.height * (layer.kind === "scalar" ? 1 : 2)
          ).fill(128)
        };
      }
    };
    let mapLayer: WeatherCustomLayer | undefined;
    const listeners = new Map<string, Set<() => void>>();
    const map: WeatherMap = {
      addLayer(layer) {
        mapLayer = layer;
      },
      getLayer(id) {
        return mapLayer?.id === id ? mapLayer : undefined;
      },
      removeLayer() {
        mapLayer = undefined;
      },
      getStyle() {
        return { layers: [{ id: "labels", type: "symbol" }] };
      },
      getProjection() {
        return { type: "mercator" };
      },
      isStyleLoaded() {
        return true;
      },
      once(_type, listener) {
        listener();
      },
      on(type, listener) {
        const group = listeners.get(type) ?? new Set();
        group.add(listener);
        listeners.set(type, group);
      },
      off(type, listener) {
        listeners.get(type)?.delete(listener);
      },
      triggerRepaint() {},
      addControl() {},
      removeControl() {}
    };
    const controller = new DefaultWeatherLayersController(
      {
        source,
        initialLayer: "temperature",
        initialTime: "2026-09-24T00:00:00Z",
        attribution: "manual",
        cache: { prefetchNextFrame: false }
      },
      decoder
    );

    await controller.attach(map);
    expect(controller.getSnapshot()).toMatchObject({
      status: "ready",
      layerId: "temperature",
      resolvedTime: "2026-09-24T00:00:00Z"
    });
    expect(mapLayer?.id).toBe("pigeon-weather-overlay");

    await controller.setLayer("wind");
    await controller.setTime("2026-09-24T03:00:00Z", { mode: "exact" });
    expect(controller.getSnapshot()).toMatchObject({
      layerId: "wind",
      resolvedTime: "2026-09-24T03:00:00Z"
    });

    controller.destroy();
    expect(controller.getSnapshot().status).toBe("destroyed");
    expect(mapLayer).toBeUndefined();
  });
});
