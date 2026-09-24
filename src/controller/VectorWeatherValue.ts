export interface VectorWeatherValue {
  readonly kind: "vector";
  readonly layerId: string;
  readonly validTime: string;
  readonly unit: string;
  readonly u: number;
  readonly v: number;
  readonly speed: number;
  readonly directionDegrees: number;
}
