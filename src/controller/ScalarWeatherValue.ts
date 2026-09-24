export interface ScalarWeatherValue {
  readonly kind: "scalar";
  readonly layerId: string;
  readonly validTime: string;
  readonly unit: string;
  readonly value: number;
}
