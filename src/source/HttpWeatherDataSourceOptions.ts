export interface HttpWeatherDataSourceOptions {
  readonly manifestUrl: string | URL;
  readonly baseUrl?: string | URL;
  readonly allowedAssetOrigins?: readonly string[];
  readonly fetch?: typeof globalThis.fetch;
}
