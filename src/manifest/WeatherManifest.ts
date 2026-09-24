import type { WeatherAttribution } from "./WeatherAttribution.js";
import type { WeatherCoverage } from "./WeatherCoverage.js";
import type { WeatherDelivery } from "./WeatherDelivery.js";
import type { WeatherFrame } from "./WeatherFrame.js";
import type { WeatherGrid } from "./WeatherGrid.js";
import type { WeatherLayer } from "./WeatherLayer.js";
import type { WeatherRun } from "./WeatherRun.js";
import type { WeatherTimeSelection } from "./WeatherTimeSelection.js";

export interface WeatherManifest {
  readonly schemaVersion: 1;
  readonly datasetId: string;
  readonly sourcePolicyVersion: string;
  readonly run: WeatherRun;
  readonly coverage: WeatherCoverage;
  readonly grid: WeatherGrid;
  readonly delivery: WeatherDelivery;
  readonly timeSelection: WeatherTimeSelection;
  readonly frames: readonly WeatherFrame[];
  readonly layers: readonly WeatherLayer[];
  readonly attributions: readonly WeatherAttribution[];
}
