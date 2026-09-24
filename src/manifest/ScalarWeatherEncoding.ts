export interface ScalarWeatherEncoding {
  readonly type:
    | "scalar-png-r8-linear-v1"
    | "scalar-png-r8-sqrt-v1";
  readonly pngColorType: 0;
  readonly valueRange: readonly [number, number];
  readonly encodedRange: readonly [1, 255];
  readonly noDataCode: 0;
}
