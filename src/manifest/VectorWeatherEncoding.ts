export interface VectorWeatherEncoding {
  readonly type: "vector-png-rg8-linear-v1";
  readonly pngColorType: 2;
  readonly uChannel: "r";
  readonly vChannel: "g";
  readonly componentRange: readonly [number, number];
  readonly encodedRange: readonly [1, 255];
  readonly noDataCode: 0;
}
