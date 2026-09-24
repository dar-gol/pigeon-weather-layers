export interface ResolvedWeatherTime {
  readonly requestedTime: string | "latest";
  readonly resolvedTime: string;
  readonly timeKey: string;
}
