import type { DecodedWeatherAsset } from "../rendering/DecodedWeatherAsset.js";

export class WeatherAssetCache {
  readonly #maxBytes: number;
  readonly #entries = new Map<
    string,
    { readonly asset: DecodedWeatherAsset; readonly bytes: number }
  >();
  #bytes = 0;

  constructor(maxBytes: number) {
    this.#maxBytes = maxBytes;
  }

  get(key: string): DecodedWeatherAsset | undefined {
    const entry = this.#entries.get(key);
    if (entry === undefined) {
      return undefined;
    }
    this.#entries.delete(key);
    this.#entries.set(key, entry);
    return entry.asset;
  }

  set(key: string, asset: DecodedWeatherAsset): void {
    const bytes = asset.codes.byteLength;
    const existing = this.#entries.get(key);
    if (existing !== undefined) {
      this.#bytes -= existing.bytes;
      this.#entries.delete(key);
    }

    if (bytes > this.#maxBytes) {
      return;
    }

    this.#entries.set(key, { asset, bytes });
    this.#bytes += bytes;
    this.#evict();
  }

  clear(): void {
    this.#entries.clear();
    this.#bytes = 0;
  }

  #evict(): void {
    while (this.#bytes > this.#maxBytes) {
      const oldestKey = this.#entries.keys().next().value;
      if (typeof oldestKey !== "string") {
        return;
      }
      const entry = this.#entries.get(oldestKey);
      this.#entries.delete(oldestKey);
      if (entry !== undefined) {
        this.#bytes -= entry.bytes;
      }
    }
  }
}
