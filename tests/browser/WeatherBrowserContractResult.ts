export interface WeatherBrowserContractResult {
  readonly scalarCodes: readonly number[];
  readonly vectorCodes: readonly number[];
  readonly scalarCorners: {
    readonly southWest: readonly number[];
    readonly southEast: readonly number[];
    readonly northWest: readonly number[];
    readonly northEast: readonly number[];
  };
  readonly noDataAlpha: number;
  readonly vectorCorners: {
    readonly southWest: readonly number[];
    readonly southEast: readonly number[];
    readonly northWest: readonly number[];
    readonly northEast: readonly number[];
  };
  readonly vectorNoDataAlpha: number;
  readonly glStateRestored: boolean;
  readonly glError: number;
}

export interface MapLibreIntegrationResult {
  readonly attributionText: string | null;
  readonly layerAttached: boolean;
  readonly layerRemoved: boolean;
  readonly sampledValue: number | null;
  readonly status: string;
}
