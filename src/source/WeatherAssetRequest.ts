export interface WeatherAssetRequest {
  readonly url: string;
  readonly datasetId: string;
  readonly runId: string;
  readonly layerId: string;
  readonly timeKey: string;
}
