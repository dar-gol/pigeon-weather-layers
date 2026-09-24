export interface WeatherFrame {
  readonly timeKey: string;
  readonly leadHour: number;
  readonly validTime: string;
  readonly intervalStart?: string;
  readonly intervalEnd?: string;
}
