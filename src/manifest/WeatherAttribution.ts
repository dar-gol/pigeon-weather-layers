export interface WeatherAttribution {
  readonly label: string;
  readonly sourceUrl: string;
  readonly termsUrl: string;
  readonly license: string;
  readonly modified: boolean;
  readonly modifications: readonly string[];
}
