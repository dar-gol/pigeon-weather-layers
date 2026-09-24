import type { WeatherAttribution } from "../manifest/WeatherAttribution.js";
import type { WeatherMapControl } from "../map/WeatherMapControl.js";

export class WeatherAttributionControl implements WeatherMapControl {
  readonly #attributions: readonly WeatherAttribution[];
  #container: HTMLElement | null = null;

  constructor(attributions: readonly WeatherAttribution[]) {
    this.#attributions = attributions;
  }

  onAdd(_map: unknown): HTMLElement {
    const container = document.createElement("div");
    container.className =
      "maplibregl-ctrl maplibregl-ctrl-attrib pigeon-weather-attribution";

    for (const [index, attribution] of this.#attributions.entries()) {
      if (index > 0) {
        container.append(document.createTextNode(" | "));
      }
      const link = document.createElement("a");
      link.href = attribution.sourceUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = attribution.label;
      link.title = attribution.license;
      container.append(link);
    }

    this.#container = container;
    return container;
  }

  onRemove(): void {
    this.#container?.remove();
    this.#container = null;
  }
}
