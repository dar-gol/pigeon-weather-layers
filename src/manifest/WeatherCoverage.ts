export interface WeatherCoverage {
  readonly bounds: readonly [number, number, number, number];
  readonly crs: "EPSG:4326";
}
