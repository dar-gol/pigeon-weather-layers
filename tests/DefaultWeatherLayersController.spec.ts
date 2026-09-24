import { describe, expect, it, vi } from "vitest";
import { DefaultWeatherLayersController } from "../src/controller/DefaultWeatherLayersController.js";
import type { WeatherMap } from "../src/map/WeatherMap.js";
import type { WeatherCustomLayer } from "../src/map/WeatherCustomLayer.js";
import type { DecodedWeatherAsset } from "../src/rendering/DecodedWeatherAsset.js";
import type { WeatherAssetDecoder } from "../src/rendering/WeatherAssetDecoder.js";
import type { WeatherDataSource } from "../src/source/WeatherDataSource.js";
import { createWeatherManifest } from "./fixtures/createWeatherManifest.js";

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function createTestDecoder(): WeatherAssetDecoder {
  return {
    async decode(_blob, layer, grid) {
      const channels = layer.kind === "scalar" ? 1 : 2;
      return {
        width: grid.width,
        height: grid.height,
        channels,
        codes: new Uint8Array(grid.width * grid.height * channels).fill(128)
      };
    }
  };
}

function createTestMap(initialStyleLoaded = true) {
  let styleLoaded = initialStyleLoaded;
  let projection = "mercator";
  let mapLayer: WeatherCustomLayer | undefined;
  let addLayerCalls = 0;
  let lastBeforeLayerId: string | undefined;
  let styleLayers: readonly { readonly id: string; readonly type?: string }[] = [
    { id: "labels", type: "symbol" }
  ];
  const listeners = new Map<string, Set<() => void>>();
  const map: WeatherMap = {
    addLayer(layer, beforeId) {
      mapLayer = layer;
      addLayerCalls += 1;
      lastBeforeLayerId = beforeId;
    },
    getLayer(id) {
      return mapLayer?.id === id
        ? mapLayer
        : styleLayers.find((layer) => layer.id === id);
    },
    removeLayer() {
      mapLayer = undefined;
    },
    getStyle() {
      return { layers: styleLayers };
    },
    getProjection() {
      return { type: projection };
    },
    isStyleLoaded() {
      return styleLoaded;
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

  return {
    map,
    emit(type: "style.load" | "projectiontransition" | "remove") {
      for (const listener of [...(listeners.get(type) ?? [])]) {
        listener();
      }
    },
    getLayer: () => mapLayer,
    addLayerCalls: () => addLayerCalls,
    clearLayer() {
      mapLayer = undefined;
    },
    lastBeforeLayerId: () => lastBeforeLayerId,
    listenerCount: (type: string) => listeners.get(type)?.size ?? 0,
    setProjection(value: string) {
      projection = value;
    },
    setStyleLayers(
      layers: readonly { readonly id: string; readonly type?: string }[]
    ) {
      styleLayers = layers;
    }
  };
}

function createImmediateSource(): WeatherDataSource {
  return {
    async loadManifest() {
      return createWeatherManifest();
    },
    async loadAsset() {
      return new Blob([new Uint8Array([1])], { type: "image/png" });
    }
  };
}

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

  it("cancels style waiting and removes temporary listeners on destroy", async () => {
    const testMap = createTestMap(false);
    const loadManifest = vi.fn(async () => createWeatherManifest());
    const controller = new DefaultWeatherLayersController(
      {
        source: {
          loadManifest,
          async loadAsset() {
            return new Blob();
          }
        },
        attribution: "manual"
      },
      createTestDecoder()
    );

    const attaching = controller.attach(testMap.map);
    expect(testMap.listenerCount("style.load")).toBe(1);
    expect(testMap.listenerCount("remove")).toBe(2);

    controller.destroy();

    await expect(attaching).rejects.toMatchObject({ name: "AbortError" });
    expect(loadManifest).not.toHaveBeenCalled();
    expect(testMap.listenerCount("style.load")).toBe(0);
    expect(testMap.listenerCount("remove")).toBe(0);
  });

  it("destroys itself when the map is removed while waiting for the style", async () => {
    const testMap = createTestMap(false);
    const controller = new DefaultWeatherLayersController(
      { source: createImmediateSource(), attribution: "manual" },
      createTestDecoder()
    );

    const attaching = controller.attach(testMap.map);
    testMap.emit("remove");

    await expect(attaching).rejects.toMatchObject({ name: "AbortError" });
    expect(controller.getSnapshot().status).toBe("destroyed");
    expect(testMap.listenerCount("style.load")).toBe(0);
    expect(testMap.listenerCount("remove")).toBe(0);
  });

  it("cancels attach when the map is removed during manifest loading", async () => {
    const testMap = createTestMap();
    const delayedManifest = createDeferred<unknown>();
    const loadAsset = vi.fn(async () => new Blob());
    const controller = new DefaultWeatherLayersController(
      {
        source: {
          loadManifest: () => delayedManifest.promise,
          loadAsset
        },
        attribution: "manual"
      },
      createTestDecoder()
    );

    const attaching = controller.attach(testMap.map);
    testMap.emit("remove");
    delayedManifest.resolve(createWeatherManifest());

    await expect(attaching).rejects.toMatchObject({ name: "AbortError" });
    expect(controller.getSnapshot().status).toBe("destroyed");
    expect(loadAsset).not.toHaveBeenCalled();
  });

  it("keeps the last valid frame stale when the latest overlapping change fails", async () => {
    const manifest = createWeatherManifest();
    const heldRequest = createDeferred<Blob>();
    let initialAssetLoaded = false;
    const source: WeatherDataSource = {
      async loadManifest() {
        return manifest;
      },
      loadAsset(request, signal) {
        if (!initialAssetLoaded) {
          initialAssetLoaded = true;
          return Promise.resolve(new Blob());
        }
        if (request.layerId === "temperature") {
          signal.addEventListener(
            "abort",
            () => heldRequest.reject(signal.reason),
            { once: true }
          );
          return heldRequest.promise;
        }
        return Promise.reject(new Error("wind asset failed"));
      }
    };
    const testMap = createTestMap();
    const controller = new DefaultWeatherLayersController(
      {
        source,
        initialLayer: "temperature",
        initialTime: "2026-09-24T00:00:00Z",
        attribution: "manual",
        cache: { prefetchNextFrame: false }
      },
      createTestDecoder()
    );
    await controller.attach(testMap.map);

    const superseded = controller
      .setTime("2026-09-24T03:00:00Z")
      .catch((error: unknown) => error);
    const latest = controller
      .setLayer("wind")
      .catch((error: unknown) => error);

    await Promise.all([superseded, latest]);
    expect(controller.getSnapshot()).toMatchObject({
      status: "stale",
      layerId: "temperature",
      resolvedTime: "2026-09-24T00:00:00Z",
      error: { code: "ASSET_FETCH_FAILED" }
    });
  });

  it("cancels value queries even when the data source ignores abort", async () => {
    const manifest = createWeatherManifest();
    const delayedAsset = createDeferred<Blob>();
    const decode = vi.fn(createTestDecoder().decode);
    const source: WeatherDataSource = {
      async loadManifest() {
        return manifest;
      },
      loadAsset(request) {
        return request.layerId === "temperature"
          ? Promise.resolve(new Blob())
          : delayedAsset.promise;
      }
    };
    const testMap = createTestMap();
    const controller = new DefaultWeatherLayersController(
      {
        source,
        initialLayer: "temperature",
        initialTime: "2026-09-24T00:00:00Z",
        attribution: "manual",
        cache: { prefetchNextFrame: false }
      },
      { decode }
    );
    await controller.attach(testMap.map);

    const query = controller.getValueAt({
      longitude: 1,
      latitude: 1,
      layerId: "wind",
      time: "2026-09-24T03:00:00Z"
    });
    controller.destroy();
    delayedAsset.resolve(new Blob());

    await expect(query).rejects.toMatchObject({ name: "AbortError" });
    expect(decode).toHaveBeenCalledTimes(1);
  });

  it("does not let a superseded refresh replace controller state", async () => {
    const manifest = createWeatherManifest();
    const delayedManifest = createDeferred<unknown>();
    let manifestLoads = 0;
    const source: WeatherDataSource = {
      loadManifest() {
        manifestLoads += 1;
        return manifestLoads === 1
          ? Promise.resolve(manifest)
          : delayedManifest.promise;
      },
      async loadAsset() {
        return new Blob();
      }
    };
    const testMap = createTestMap();
    const controller = new DefaultWeatherLayersController(
      {
        source,
        initialLayer: "temperature",
        initialTime: "2026-09-24T00:00:00Z",
        attribution: "manual",
        cache: { prefetchNextFrame: false }
      },
      createTestDecoder()
    );
    await controller.attach(testMap.map);

    const refresh = controller.refresh();
    await controller.setTime("2026-09-24T03:00:00Z");
    delayedManifest.resolve({ invalid: "superseded response" });

    await expect(refresh).rejects.toMatchObject({ name: "AbortError" });
    expect(controller.getSnapshot()).toMatchObject({
      runId: manifest.run.id,
      resolvedTime: "2026-09-24T03:00:00Z"
    });
  });

  it("aborts the previous prefetch before activating the final frame", async () => {
    const manifest = createWeatherManifest();
    const prefetchedAsset = createDeferred<Blob>();
    let finalFrameRequests = 0;
    let prefetchSignal: AbortSignal | undefined;
    const source: WeatherDataSource = {
      async loadManifest() {
        return manifest;
      },
      loadAsset(request, signal) {
        if (request.timeKey === "f000") {
          return Promise.resolve(new Blob());
        }
        finalFrameRequests += 1;
        if (finalFrameRequests === 1) {
          prefetchSignal = signal;
          signal.addEventListener(
            "abort",
            () => prefetchedAsset.reject(signal.reason),
            { once: true }
          );
          return prefetchedAsset.promise;
        }
        return Promise.resolve(new Blob());
      }
    };
    const testMap = createTestMap();
    const controller = new DefaultWeatherLayersController(
      {
        source,
        initialLayer: "temperature",
        initialTime: "2026-09-24T00:00:00Z",
        attribution: "manual"
      },
      createTestDecoder()
    );
    await controller.attach(testMap.map);

    await controller.setTime("2026-09-24T03:00:00Z");

    expect(prefetchSignal?.aborted).toBe(true);
    expect(finalFrameRequests).toBe(2);
    expect(controller.getSnapshot().resolvedTime).toBe(
      "2026-09-24T03:00:00Z"
    );
  });

  it.each<readonly [string, DecodedWeatherAsset]>([
    [
      "dimensions",
      { width: 2, height: 3, channels: 1, codes: new Uint8Array(6) }
    ],
    [
      "channels",
      { width: 3, height: 3, channels: 2, codes: new Uint8Array(18) }
    ],
    [
      "code length",
      { width: 3, height: 3, channels: 1, codes: new Uint8Array(8) }
    ]
  ])("rejects decoded assets with invalid %s", async (_name, asset) => {
    const controller = new DefaultWeatherLayersController(
      {
        source: createImmediateSource(),
        initialLayer: "temperature",
        initialTime: "2026-09-24T00:00:00Z",
        attribution: "manual",
        cache: { prefetchNextFrame: false }
      },
      { async decode() { return asset; } }
    );

    await expect(controller.attach(createTestMap().map)).rejects.toMatchObject({
      code: "ASSET_DECODE_FAILED"
    });
  });

  it("removes the overlay on globe and restores it on Mercator", async () => {
    const testMap = createTestMap();
    const controller = new DefaultWeatherLayersController(
      {
        source: createImmediateSource(),
        initialLayer: "temperature",
        initialTime: "2026-09-24T00:00:00Z",
        attribution: "manual",
        cache: { prefetchNextFrame: false }
      },
      createTestDecoder()
    );
    await controller.attach(testMap.map);
    expect(testMap.getLayer()).toBeDefined();

    testMap.setProjection("globe");
    testMap.emit("projectiontransition");
    expect(testMap.getLayer()).toBeUndefined();
    expect(controller.getSnapshot()).toMatchObject({
      status: "stale",
      error: { code: "UNSUPPORTED_PROJECTION" }
    });

    testMap.setProjection("mercator");
    testMap.emit("projectiontransition");
    expect(testMap.getLayer()).toBeDefined();
    expect(controller.getSnapshot()).toMatchObject({
      status: "ready",
      error: null
    });
  });

  it("does not publish a completed frame after switching to globe", async () => {
    const manifest = createWeatherManifest();
    const delayedAsset = createDeferred<Blob>();
    let assetLoads = 0;
    const source: WeatherDataSource = {
      async loadManifest() {
        return manifest;
      },
      loadAsset() {
        assetLoads += 1;
        return assetLoads === 1 ? Promise.resolve(new Blob()) : delayedAsset.promise;
      }
    };
    const testMap = createTestMap();
    const controller = new DefaultWeatherLayersController(
      {
        source,
        initialLayer: "temperature",
        initialTime: "2026-09-24T00:00:00Z",
        attribution: "manual",
        cache: { prefetchNextFrame: false }
      },
      createTestDecoder()
    );
    await controller.attach(testMap.map);

    const changingTime = controller.setTime("2026-09-24T03:00:00Z");
    testMap.setProjection("globe");
    testMap.emit("projectiontransition");
    delayedAsset.resolve(new Blob());

    await expect(changingTime).rejects.toMatchObject({
      code: "UNSUPPORTED_PROJECTION"
    });
    expect(testMap.getLayer()).toBeUndefined();
    expect(controller.getSnapshot()).toMatchObject({
      status: "stale",
      resolvedTime: "2026-09-24T00:00:00Z",
      error: { code: "UNSUPPORTED_PROJECTION" }
    });
  });

  it("reloads an asset when a same-run refresh changes its contract", async () => {
    const firstManifest = createWeatherManifest();
    const firstLayer = firstManifest.layers[0];
    const secondLayer = firstManifest.layers[1];
    expect(firstLayer?.kind).toBe("scalar");
    expect(secondLayer).toBeDefined();
    if (firstLayer?.kind !== "scalar" || secondLayer === undefined) return;
    const refreshedManifest = {
      ...firstManifest,
      layers: [
        {
          ...firstLayer,
          encoding: { ...firstLayer.encoding, valueRange: [100, 200] as const }
        },
        secondLayer
      ]
    };
    let manifestLoads = 0;
    const loadAsset = vi.fn(async () => new Blob());
    const decode = vi.fn(createTestDecoder().decode);
    const controller = new DefaultWeatherLayersController(
      {
        source: {
          loadManifest() {
            manifestLoads += 1;
            return Promise.resolve(
              manifestLoads === 1 ? firstManifest : refreshedManifest
            );
          },
          loadAsset
        },
        initialLayer: "temperature",
        initialTime: "2026-09-24T00:00:00Z",
        attribution: "manual",
        cache: { prefetchNextFrame: false }
      },
      { decode }
    );
    await controller.attach(createTestMap().map);

    await controller.refresh();

    expect(loadAsset).toHaveBeenCalledTimes(2);
    expect(decode).toHaveBeenCalledTimes(2);
    expect(controller.getLegend().valueRange).toEqual([100, 200]);
  });

  it("reattaches once after a style reload and preserves public state", async () => {
    const testMap = createTestMap();
    const controller = new DefaultWeatherLayersController(
      {
        source: createImmediateSource(),
        initialLayer: "temperature",
        initialTime: "2026-09-24T00:00:00Z",
        opacity: 0.4,
        attribution: "manual",
        cache: { prefetchNextFrame: false }
      },
      createTestDecoder()
    );
    await controller.attach(testMap.map);
    const beforeReload = controller.getSnapshot();

    testMap.clearLayer();
    testMap.emit("style.load");
    testMap.emit("style.load");

    expect(testMap.addLayerCalls()).toBe(2);
    expect(testMap.lastBeforeLayerId()).toBe("labels");
    expect(controller.getSnapshot()).toEqual(beforeReload);
  });

  it("recovers after an explicit placement target returns", async () => {
    const testMap = createTestMap();
    testMap.setStyleLayers([
      { id: "weather-anchor", type: "fill" },
      { id: "labels", type: "symbol" }
    ]);
    const controller = new DefaultWeatherLayersController(
      {
        source: createImmediateSource(),
        initialLayer: "temperature",
        initialTime: "2026-09-24T00:00:00Z",
        placement: { beforeLayerId: "weather-anchor" },
        attribution: "manual",
        cache: { prefetchNextFrame: false }
      },
      createTestDecoder()
    );
    await controller.attach(testMap.map);

    testMap.clearLayer();
    testMap.setStyleLayers([{ id: "labels", type: "symbol" }]);
    testMap.emit("style.load");
    expect(controller.getSnapshot()).toMatchObject({
      status: "stale",
      error: { code: "LAYER_NOT_FOUND" }
    });

    testMap.setStyleLayers([
      { id: "weather-anchor", type: "fill" },
      { id: "labels", type: "symbol" }
    ]);
    testMap.emit("style.load");

    expect(testMap.addLayerCalls()).toBe(2);
    expect(testMap.lastBeforeLayerId()).toBe("weather-anchor");
    expect(controller.getSnapshot()).toMatchObject({
      status: "ready",
      error: null
    });
  });

  it("publishes the destroyed snapshot before unsubscribing listeners", async () => {
    const controller = new DefaultWeatherLayersController(
      {
        source: createImmediateSource(),
        initialLayer: "temperature",
        initialTime: "2026-09-24T00:00:00Z",
        attribution: "manual",
        cache: { prefetchNextFrame: false }
      },
      createTestDecoder()
    );
    await controller.attach(createTestMap().map);
    const statuses: string[] = [];
    controller.subscribe((snapshot) => statuses.push(snapshot.status));

    controller.destroy();
    controller.destroy();

    expect(statuses.filter((status) => status === "destroyed")).toHaveLength(1);
  });

  it("rejects non-finite and out-of-range palette values", async () => {
    const controller = new DefaultWeatherLayersController(
      {
        source: createImmediateSource(),
        initialLayer: "temperature",
        initialTime: "2026-09-24T00:00:00Z",
        attribution: "manual",
        cache: { prefetchNextFrame: false }
      },
      createTestDecoder()
    );
    await controller.attach(createTestMap().map);

    expect(() =>
      controller.setPalette("temperature", {
        id: "invalid-range",
        valueRange: [Number.NaN, 1],
        stops: [
          { value: 0, color: [0, 0, 0, 0] },
          { value: 1, color: [255, 255, 255, 255] }
        ]
      })
    ).toThrow(RangeError);
    expect(() =>
      controller.setPalette("temperature", {
        id: "invalid-stop",
        valueRange: [0, 1],
        stops: [
          { value: 0, color: [0, 0, 0, 0] },
          { value: Number.POSITIVE_INFINITY, color: [255, 255, 255, 255] }
        ]
      })
    ).toThrow(RangeError);
    expect(() =>
      controller.setPalette("temperature", {
        id: "invalid-color",
        valueRange: [0, 1],
        stops: [
          { value: 0, color: [0, 0, 0, 0] },
          { value: 1, color: [255, Number.NaN, 255, 256] }
        ]
      })
    ).toThrow(RangeError);
    expect(() =>
      controller.setPalette("temperature", {
        id: "unordered-stops",
        valueRange: [0, 1],
        stops: [
          { value: 1, color: [255, 255, 255, 255] },
          { value: 0, color: [0, 0, 0, 0] }
        ]
      })
    ).toThrow(RangeError);
  });
});
