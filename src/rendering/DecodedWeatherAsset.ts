export interface DecodedWeatherAsset {
  readonly width: number;
  readonly height: number;
  readonly channels: 1 | 2;
  readonly codes: Uint8Array;
}
