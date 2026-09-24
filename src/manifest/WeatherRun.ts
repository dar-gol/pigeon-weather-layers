export interface WeatherRun {
  readonly id: string;
  readonly model: string;
  readonly issuedAt: string;
  readonly generatedAt: string;
  readonly staleAfter: string;
  readonly availableUntil: string;
}
