import { WeatherAttributionControl } from "../attribution/WeatherAttributionControl.js";
import { WeatherLayersError } from "../error/WeatherLayersError.js";
import type { WeatherFrame } from "../manifest/WeatherFrame.js";
import type { WeatherLayer } from "../manifest/WeatherLayer.js";
import type { WeatherManifest } from "../manifest/WeatherManifest.js";
import { parseWeatherManifest } from "../manifest/parseWeatherManifest.js";
import type { WeatherMap } from "../map/WeatherMap.js";
import type { WeatherMapControl } from "../map/WeatherMapControl.js";
import { getDefaultWeatherPalette } from "../palette/getDefaultWeatherPalette.js";
import { BrowserWeatherAssetDecoder } from "../rendering/BrowserWeatherAssetDecoder.js";
import type { DecodedWeatherAsset } from "../rendering/DecodedWeatherAsset.js";
import { RegularGridWeatherLayer } from "../rendering/RegularGridWeatherLayer.js";
import type { WeatherAssetDecoder } from "../rendering/WeatherAssetDecoder.js";
import { resolveAssetUrl } from "../rendering/resolveAssetUrl.js";
import { createHttpWeatherDataSource } from "../source/createHttpWeatherDataSource.js";
import type { WeatherDataSource } from "../source/WeatherDataSource.js";
import { WeatherAssetCache } from "./WeatherAssetCache.js";
import type { WeatherLayersController } from "./WeatherLayersController.js";
import type { WeatherLayersListener } from "./WeatherLayersListener.js";
import type { WeatherLayersOptions } from "./WeatherLayersOptions.js";
import type { WeatherLayersSnapshot } from "./WeatherLayersSnapshot.js";
import type { WeatherLegend } from "./WeatherLegend.js";
import type { WeatherPalette } from "./WeatherPalette.js";
import type { ResolvedWeatherTime } from "./ResolvedWeatherTime.js";
import { resolveWeatherFrame } from "./resolveWeatherFrame.js";
import { sampleWeatherAsset } from "./sampleWeatherAsset.js";
import type { WeatherTimeInput } from "./WeatherTimeInput.js";
import type { WeatherTimeSelectionMode } from "./WeatherTimeSelectionMode.js";
import type { WeatherValue } from "./WeatherValue.js";
import type { WeatherValueQuery } from "./WeatherValueQuery.js";
import { normalizeWeatherTime } from "./normalizeWeatherTime.js";

const DEFAULT_CACHE_BYTES = 16 * 1024 * 1024;

export class DefaultWeatherLayersController
  implements WeatherLayersController
{
  readonly #options: WeatherLayersOptions;
  readonly #source: WeatherDataSource;
  readonly #decoder: WeatherAssetDecoder;
  readonly #cache: WeatherAssetCache;
  readonly #renderer: RegularGridWeatherLayer;
  readonly #listeners = new Set<WeatherLayersListener>();
  readonly #palettes = new Map<string, WeatherPalette>();
  readonly #queries = new Set<AbortController>();

  #snapshot: WeatherLayersSnapshot;
  #manifest: WeatherManifest | null = null;
  #map: WeatherMap | null = null;
  #currentLayer: WeatherLayer | null = null;
  #currentFrame: WeatherFrame | null = null;
  #currentAsset: DecodedWeatherAsset | null = null;
  #operation: AbortController | null = null;
  #prefetch: AbortController | null = null;
  #attributionControl: WeatherMapControl | null = null;
  #attachAttempted = false;

  readonly #handleMapConfigurationChange = (): void => {
    const map = this.#map;
    if (map === null || this.#snapshot.status === "destroyed") {
      return;
    }
    try {
      this.#assertMercator(map);
      if (map.getLayer(this.#renderer.id) === undefined) {
        map.addLayer(this.#renderer, this.#resolveBeforeLayerId(map));
      }
      if (
        this.#manifest !== null &&
        (this.#snapshot.error?.code === "UNSUPPORTED_PROJECTION" ||
          this.#snapshot.error?.code === "LAYER_NOT_FOUND")
      ) {
        this.#setSnapshot({
          status: this.#manifestStatus(this.#manifest),
          error: null
        });
      }
    } catch (cause) {
      if (map.getLayer(this.#renderer.id) !== undefined) {
        map.removeLayer(this.#renderer.id);
      }
      this.#publishError(
        this.#asWeatherError(cause),
        this.#currentAsset !== null
      );
    }
  };

  readonly #handleMapRemove = (): void => {
    const map = this.#map;
    if (map !== null) {
      this.#removeMapListeners(map);
    }
    this.#map = null;
    this.destroy();
  };

  constructor(
    options: WeatherLayersOptions,
    decoder: WeatherAssetDecoder = new BrowserWeatherAssetDecoder()
  ) {
    this.#options = options;
    this.#source =
      typeof options.source === "string" || options.source instanceof URL
        ? createHttpWeatherDataSource({ manifestUrl: options.source })
        : options.source;
    this.#decoder = decoder;
    this.#cache = new WeatherAssetCache(
      options.cache?.maxBytes ?? DEFAULT_CACHE_BYTES
    );
    const opacity = this.#normalizeOpacity(options.opacity ?? 0.72);
    const visible = options.visible ?? true;
    this.#renderer = new RegularGridWeatherLayer(
      (options.idPrefix ?? "pigeon-weather") + "-overlay",
      opacity,
      visible
    );
    this.#snapshot = {
      status: "idle",
      layerId: options.initialLayer ?? null,
      requestedTime: normalizeWeatherTime(options.initialTime ?? "latest"),
      resolvedTime: null,
      runId: null,
      visible,
      opacity,
      attributions: [],
      error: null
    };
  }

  async attach(map: WeatherMap): Promise<void> {
    this.#assertActive();
    if (this.#attachAttempted) {
      throw new WeatherLayersError(
        "CONTROLLER_ALREADY_ATTACHED",
        "Weather controller can only be attached once"
      );
    }
    this.#attachAttempted = true;
    const operation = this.#startOperation();
    this.#map = map;
    this.#renderer.setRepaint(() => map.triggerRepaint());
    map.on("remove", this.#handleMapRemove);
    this.#setSnapshot({ status: "loading", error: null });

    try {
      await this.#waitForStyle(map, operation.signal);
      this.#throwIfSuperseded(operation);
      this.#assertMercator(map);

      if (map.getLayer(this.#renderer.id) !== undefined) {
        throw new WeatherLayersError(
          "MAP_LAYER_ID_CONFLICT",
          "A map layer already uses id " + this.#renderer.id
        );
      }

      const manifest = parseWeatherManifest(
        await this.#source.loadManifest(operation.signal)
      );
      this.#throwIfSuperseded(operation);
      const layer = this.#resolveLayer(
        manifest,
        this.#options.initialLayer ?? manifest.layers[0]?.id ?? ""
      );
      const resolution = resolveWeatherFrame(
        manifest,
        this.#options.initialTime ?? "latest"
      );
      const asset = await this.#loadAsset(
        manifest,
        layer,
        resolution.frame,
        operation.signal
      );
      this.#throwIfSuperseded(operation);
      this.#assertMercator(map);

      this.#manifest = manifest;
      this.#currentLayer = layer;
      this.#currentFrame = resolution.frame;
      this.#currentAsset = asset;
      const palette = this.#paletteFor(layer);
      this.#renderer.setFrame({
        asset,
        layer,
        palette,
        bounds: manifest.coverage.bounds
      });
      map.addLayer(this.#renderer, this.#resolveBeforeLayerId(map));
      map.on("style.load", this.#handleMapConfigurationChange);
      map.on("projectiontransition", this.#handleMapConfigurationChange);
      this.#installAttribution(map, manifest);
      this.#setSnapshot({
        status: this.#manifestStatus(manifest),
        layerId: layer.id,
        requestedTime: resolution.time.requestedTime,
        resolvedTime: resolution.time.resolvedTime,
        runId: manifest.run.id,
        attributions: manifest.attributions,
        error: null
      });
      this.#prefetchNext(manifest, layer, resolution.frame);
    } catch (cause) {
      if (!operation.signal.aborted) {
        const error = this.#asWeatherError(cause);
        this.#publishError(error, false);
        throw error;
      }
      this.#throwIfSuperseded(operation);
      throw cause;
    } finally {
      if (this.#operation === operation) {
        this.#operation = null;
      }
    }
  }

  async setLayer(layerId: string): Promise<void> {
    const manifest = this.#requireManifest();
    const frame = this.#requireCurrentFrame();
    const layer = this.#resolveLayer(manifest, layerId);
    await this.#activate(manifest, layer, frame, {
      requestedTime: this.#snapshot.requestedTime,
      resolvedTime: frame.validTime,
      timeKey: frame.timeKey
    });
  }

  async setTime(
    time: WeatherTimeInput,
    options: { readonly mode?: WeatherTimeSelectionMode } = {}
  ): Promise<ResolvedWeatherTime> {
    const manifest = this.#requireManifest();
    const layer = this.#requireCurrentLayer();
    const resolution = resolveWeatherFrame(
      manifest,
      time,
      options.mode ?? manifest.timeSelection.defaultMode
    );
    await this.#activate(manifest, layer, resolution.frame, resolution.time);
    return resolution.time;
  }

  setOpacity(opacity: number): void {
    this.#assertActive();
    const normalized = this.#normalizeOpacity(opacity);
    this.#renderer.setOpacity(normalized);
    this.#setSnapshot({ opacity: normalized });
  }

  setVisible(visible: boolean): void {
    this.#assertActive();
    this.#renderer.setVisible(visible);
    this.#setSnapshot({ visible });
  }

  setPalette(layerId: string, palette: WeatherPalette): void {
    this.#assertActive();
    this.#assertPalette(palette);
    this.#palettes.set(layerId, palette);
    if (this.#currentLayer?.id === layerId) {
      this.#renderer.setPalette(palette);
    }
  }

  getLegend(layerId = this.#currentLayer?.id): WeatherLegend {
    const manifest = this.#requireManifest();
    if (layerId === undefined) {
      throw new WeatherLayersError(
        "LAYER_NOT_FOUND",
        "No weather layer is selected"
      );
    }
    const layer = this.#resolveLayer(manifest, layerId);
    const palette = this.#paletteFor(layer);
    return {
      layerId: layer.id,
      unit: layer.unit,
      valueRange: palette.valueRange,
      stops: palette.stops
    };
  }

  async getValueAt(query: WeatherValueQuery): Promise<WeatherValue | null> {
    const manifest = this.#requireManifest();
    const layer = this.#resolveLayer(
      manifest,
      query.layerId ?? this.#requireCurrentLayer().id
    );
    const resolution = resolveWeatherFrame(
      manifest,
      query.time ?? this.#requireCurrentFrame().validTime
    );
    const queryOperation = new AbortController();
    this.#queries.add(queryOperation);
    try {
      const asset =
        layer.id === this.#currentLayer?.id &&
        resolution.frame.timeKey === this.#currentFrame?.timeKey &&
        this.#currentAsset !== null
          ? this.#currentAsset
          : await this.#loadAsset(
              manifest,
              layer,
              resolution.frame,
              queryOperation.signal
            );
      this.#throwIfAborted(queryOperation.signal);
      return sampleWeatherAsset(
        asset,
        manifest,
        layer,
        resolution.frame,
        query
      );
    } finally {
      this.#queries.delete(queryOperation);
    }
  }

  getManifest(): WeatherManifest | null {
    return this.#manifest;
  }

  getSnapshot(): WeatherLayersSnapshot {
    return this.#snapshot;
  }

  subscribe(listener: WeatherLayersListener): () => void {
    this.#assertActive();
    this.#listeners.add(listener);
    listener(this.#snapshot);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  async refresh(): Promise<void> {
    this.#requireManifest();
    const layerId = this.#requireCurrentLayer().id;
    const operation = this.#startOperation();
    this.#setSnapshot({ status: "loading", error: null });

    try {
      const manifest = parseWeatherManifest(
        await this.#source.loadManifest(operation.signal)
      );
      this.#throwIfSuperseded(operation);
      const layer = this.#resolveLayer(manifest, layerId);
      const resolution = resolveWeatherFrame(
        manifest,
        this.#snapshot.requestedTime
      );

      const asset = await this.#loadAsset(
        manifest,
        layer,
        resolution.frame,
        operation.signal,
        true
      );
      this.#throwIfSuperseded(operation);
      this.#assertAttachedMapMercator();
      this.#manifest = manifest;
      this.#replaceAttribution(manifest);
      this.#currentLayer = layer;
      this.#currentFrame = resolution.frame;
      this.#currentAsset = asset;
      this.#renderer.setFrame({
        asset,
        layer,
        palette: this.#paletteFor(layer),
        bounds: manifest.coverage.bounds
      });
      this.#setSnapshot({
        status: this.#manifestStatus(manifest),
        resolvedTime: resolution.time.resolvedTime,
        runId: manifest.run.id,
        attributions: manifest.attributions,
        error: null
      });
      this.#prefetchNext(manifest, layer, resolution.frame);
    } catch (cause) {
      if (!operation.signal.aborted) {
        const error = this.#asWeatherError(cause);
        this.#publishError(error, true);
        throw error;
      }
      this.#throwIfSuperseded(operation);
      throw cause;
    } finally {
      if (this.#operation === operation) {
        this.#operation = null;
      }
    }
  }

  destroy(): void {
    if (this.#snapshot.status === "destroyed") {
      return;
    }
    this.#operation?.abort();
    this.#prefetch?.abort();
    for (const query of this.#queries) {
      query.abort();
    }
    this.#operation = null;
    this.#prefetch = null;
    this.#queries.clear();
    const map = this.#map;
    if (map !== null) {
      this.#removeMapListeners(map);
      if (map.getLayer(this.#renderer.id) !== undefined) {
        map.removeLayer(this.#renderer.id);
      }
      if (this.#attributionControl !== null) {
        map.removeControl(this.#attributionControl);
      }
    }
    this.#map = null;
    this.#renderer.setRepaint(null);
    this.#attributionControl = null;
    this.#cache.clear();
    this.#currentAsset = null;
    try {
      this.#setSnapshot({ status: "destroyed", error: null });
    } finally {
      this.#listeners.clear();
    }
  }

  async #activate(
    manifest: WeatherManifest,
    layer: WeatherLayer,
    frame: WeatherFrame,
    time: ResolvedWeatherTime
  ): Promise<void> {
    this.#assertActive();
    const operation = this.#startOperation();
    this.#setSnapshot({
      status: "loading",
      requestedTime: time.requestedTime,
      error: null
    });

    try {
      const asset = await this.#loadAsset(
        manifest,
        layer,
        frame,
        operation.signal
      );
      this.#throwIfSuperseded(operation);
      this.#assertAttachedMapMercator();
      this.#currentLayer = layer;
      this.#currentFrame = frame;
      this.#currentAsset = asset;
      this.#renderer.setFrame({
        asset,
        layer,
        palette: this.#paletteFor(layer),
        bounds: manifest.coverage.bounds
      });
      this.#setSnapshot({
        status: this.#manifestStatus(manifest),
        layerId: layer.id,
        requestedTime: time.requestedTime,
        resolvedTime: time.resolvedTime,
        runId: manifest.run.id,
        error: null
      });
      this.#prefetchNext(manifest, layer, frame);
    } catch (cause) {
      if (!operation.signal.aborted) {
        const error = this.#asWeatherError(cause);
        this.#publishError(error, this.#currentAsset !== null);
        throw error;
      }
      this.#throwIfSuperseded(operation);
      throw cause;
    } finally {
      if (this.#operation === operation) {
        this.#operation = null;
      }
    }
  }

  async #loadAsset(
    manifest: WeatherManifest,
    layer: WeatherLayer,
    frame: WeatherFrame,
    signal: AbortSignal,
    bypassCache = false
  ): Promise<DecodedWeatherAsset> {
    const url = resolveAssetUrl(manifest, layer.id, frame.timeKey);
    const key = JSON.stringify([
      manifest.datasetId,
      manifest.run.id,
      layer.id,
      frame.timeKey,
      url,
      manifest.grid.width,
      manifest.grid.height,
      layer.kind === "scalar" ? 1 : 2
    ]);
    const cached = this.#cache.get(key);
    if (!bypassCache && cached !== undefined) {
      this.#throwIfAborted(signal);
      return cached;
    }
    const blob = await this.#source.loadAsset(
      {
        url,
        datasetId: manifest.datasetId,
        runId: manifest.run.id,
        layerId: layer.id,
        timeKey: frame.timeKey
      },
      signal
    );
    this.#throwIfAborted(signal);
    const asset = await this.#decoder.decode(
      blob,
      layer,
      manifest.grid,
      signal
    );
    this.#throwIfAborted(signal);
    this.#assertDecodedAsset(asset, manifest, layer);
    this.#cache.set(key, asset);
    return asset;
  }

  #prefetchNext(
    manifest: WeatherManifest,
    layer: WeatherLayer,
    frame: WeatherFrame
  ): void {
    this.#prefetch?.abort();
    this.#prefetch = null;
    if (this.#options.cache?.prefetchNextFrame === false) {
      return;
    }
    const index = manifest.frames.findIndex(
      (candidate) => candidate.timeKey === frame.timeKey
    );
    const next = manifest.frames[index + 1];
    if (next === undefined) {
      return;
    }
    const prefetch = new AbortController();
    this.#prefetch = prefetch;
    void this.#loadAsset(manifest, layer, next, prefetch.signal)
      .catch(() => undefined)
      .finally(() => {
        if (this.#prefetch === prefetch) {
          this.#prefetch = null;
        }
      });
  }

  #installAttribution(map: WeatherMap, manifest: WeatherManifest): void {
    if ((this.#options.attribution ?? "auto") === "manual") {
      return;
    }
    const control = new WeatherAttributionControl(manifest.attributions);
    map.addControl(control, "bottom-right");
    this.#attributionControl = control;
  }

  #replaceAttribution(manifest: WeatherManifest): void {
    const map = this.#map;
    if (map === null || (this.#options.attribution ?? "auto") === "manual") {
      return;
    }
    if (this.#attributionControl !== null) {
      map.removeControl(this.#attributionControl);
      this.#attributionControl = null;
    }
    this.#installAttribution(map, manifest);
  }

  #resolveBeforeLayerId(map: WeatherMap): string | undefined {
    const placement = this.#options.placement ?? "below-labels";
    if (placement === "top") {
      return undefined;
    }
    if (placement === "below-labels") {
      return map.getStyle().layers?.find((layer) => layer.type === "symbol")?.id;
    }
    if (map.getLayer(placement.beforeLayerId) === undefined) {
      throw new WeatherLayersError(
        "LAYER_NOT_FOUND",
        "Placement layer does not exist: " + placement.beforeLayerId
      );
    }
    return placement.beforeLayerId;
  }

  #resolveLayer(
    manifest: WeatherManifest,
    layerId: string
  ): WeatherLayer {
    const layer = manifest.layers.find((candidate) => candidate.id === layerId);
    if (layer === undefined) {
      throw new WeatherLayersError(
        "LAYER_NOT_FOUND",
        "Weather layer does not exist: " + layerId
      );
    }
    return layer;
  }

  #paletteFor(layer: WeatherLayer): WeatherPalette {
    return this.#palettes.get(layer.id) ?? getDefaultWeatherPalette(layer);
  }

  #assertPalette(palette: WeatherPalette): void {
    const [minimum, maximum] = palette.valueRange;
    if (
      palette.stops.length < 2 ||
      !Number.isFinite(minimum) ||
      !Number.isFinite(maximum) ||
      minimum >= maximum
    ) {
      throw new RangeError(
        "Weather palette requires two stops and a finite increasing range"
      );
    }

    let previousValue = Number.NEGATIVE_INFINITY;
    for (const stop of palette.stops) {
      if (!Number.isFinite(stop.value) || stop.value < previousValue) {
        throw new RangeError(
          "Weather palette stop values must be finite and nondecreasing"
        );
      }
      if (
        stop.color.length !== 4 ||
        stop.color.some(
          (channel) =>
            !Number.isFinite(channel) || channel < 0 || channel > 255
        )
      ) {
        throw new RangeError(
          "Weather palette RGBA channels must be finite values between 0 and 255"
        );
      }
      previousValue = stop.value;
    }
  }

  #assertMercator(map: WeatherMap): void {
    const projection = map.getProjection();
    if (
      projection !== undefined &&
      projection.type !== undefined &&
      projection.type !== "mercator"
    ) {
      throw new WeatherLayersError(
        "UNSUPPORTED_PROJECTION",
        "Pigeon Weather Layers currently supports Mercator projection only"
      );
    }
  }

  #assertAttachedMapMercator(): void {
    const map = this.#map;
    if (map === null) {
      throw new WeatherLayersError(
        "CONTROLLER_DESTROYED",
        "Weather map is no longer attached"
      );
    }
    this.#assertMercator(map);
  }

  async #waitForStyle(
    map: WeatherMap,
    signal: AbortSignal
  ): Promise<void> {
    if (map.isStyleLoaded()) {
      return;
    }
    await new Promise<void>((resolve, reject) => {
      const cleanup = (): void => {
        map.off("style.load", handleStyleLoad);
        map.off("remove", handleMapRemove);
        signal.removeEventListener("abort", handleAbort);
      };
      const handleStyleLoad = (): void => {
        cleanup();
        resolve();
      };
      const handleMapRemove = (): void => {
        cleanup();
        this.#handleMapRemove();
        reject(
          signal.reason ??
            new DOMException("Weather map was removed", "AbortError")
        );
      };
      const handleAbort = (): void => {
        cleanup();
        reject(
          signal.reason ??
            new DOMException("Weather request was aborted", "AbortError")
        );
      };

      map.on("style.load", handleStyleLoad);
      map.on("remove", handleMapRemove);
      signal.addEventListener("abort", handleAbort, { once: true });
      if (signal.aborted) {
        handleAbort();
      }
    });
  }

  #startOperation(): AbortController {
    this.#operation?.abort();
    this.#prefetch?.abort();
    this.#prefetch = null;
    const operation = new AbortController();
    this.#operation = operation;
    return operation;
  }

  #throwIfSuperseded(operation: AbortController): void {
    if (operation.signal.aborted || this.#operation !== operation) {
      throw (
        operation.signal.reason ??
        new DOMException("Weather request was superseded", "AbortError")
      );
    }
  }

  #throwIfAborted(signal: AbortSignal): void {
    if (signal.aborted) {
      throw (
        signal.reason ??
        new DOMException("Weather request was aborted", "AbortError")
      );
    }
  }

  #assertDecodedAsset(
    asset: DecodedWeatherAsset,
    manifest: WeatherManifest,
    layer: WeatherLayer
  ): void {
    const expectedChannels = layer.kind === "scalar" ? 1 : 2;
    const expectedLength =
      manifest.grid.width * manifest.grid.height * expectedChannels;
    if (
      asset.width !== manifest.grid.width ||
      asset.height !== manifest.grid.height ||
      asset.channels !== expectedChannels ||
      !(asset.codes instanceof Uint8Array) ||
      asset.codes.byteLength !== expectedLength
    ) {
      throw new WeatherLayersError(
        "ASSET_DECODE_FAILED",
        "Decoded weather asset does not match the manifest grid and layer"
      );
    }
  }

  #removeMapListeners(map: WeatherMap): void {
    map.off("style.load", this.#handleMapConfigurationChange);
    map.off("projectiontransition", this.#handleMapConfigurationChange);
    map.off("remove", this.#handleMapRemove);
  }

  #publishError(error: WeatherLayersError, preserveFrame: boolean): void {
    this.#setSnapshot({
      status: preserveFrame ? "stale" : "error",
      error
    });
  }

  #setSnapshot(update: Partial<WeatherLayersSnapshot>): void {
    this.#snapshot = { ...this.#snapshot, ...update };
    for (const listener of this.#listeners) {
      listener(this.#snapshot);
    }
  }

  #manifestStatus(manifest: WeatherManifest): "ready" | "stale" {
    return Date.now() > Date.parse(manifest.run.staleAfter)
      ? "stale"
      : "ready";
  }

  #requireManifest(): WeatherManifest {
    this.#assertActive();
    if (this.#manifest === null) {
      throw new WeatherLayersError(
        "MANIFEST_INVALID",
        "Weather manifest is not loaded"
      );
    }
    return this.#manifest;
  }

  #requireCurrentLayer(): WeatherLayer {
    if (this.#currentLayer === null) {
      throw new WeatherLayersError(
        "LAYER_NOT_FOUND",
        "No weather layer is selected"
      );
    }
    return this.#currentLayer;
  }

  #requireCurrentFrame(): WeatherFrame {
    if (this.#currentFrame === null) {
      throw new WeatherLayersError(
        "TIME_NOT_AVAILABLE",
        "No weather frame is selected"
      );
    }
    return this.#currentFrame;
  }

  #assertActive(): void {
    if (this.#snapshot.status === "destroyed") {
      throw new WeatherLayersError(
        "CONTROLLER_DESTROYED",
        "Weather controller has been destroyed"
      );
    }
  }

  #normalizeOpacity(value: number): number {
    if (!Number.isFinite(value) || value < 0 || value > 1) {
      throw new RangeError("Weather opacity must be between 0 and 1");
    }
    return value;
  }

  #asWeatherError(cause: unknown): WeatherLayersError {
    return cause instanceof WeatherLayersError
      ? cause
      : new WeatherLayersError(
          "ASSET_FETCH_FAILED",
          "Unexpected weather layer failure",
          { cause, recoverable: true }
        );
  }
}
