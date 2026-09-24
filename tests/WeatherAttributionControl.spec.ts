// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { WeatherAttributionControl } from "../src/attribution/WeatherAttributionControl.js";
import { createWeatherManifest } from "./fixtures/createWeatherManifest.js";

describe("WeatherAttributionControl", () => {
  it("renders every manifest attribution with its source and license", () => {
    const attributions = [
      ...createWeatherManifest().attributions,
      {
        label: "Second source",
        sourceUrl: "https://example.org/data",
        termsUrl: "https://example.org/terms",
        license: "CC-BY-4.0",
        modified: false,
        modifications: []
      }
    ];
    const control = new WeatherAttributionControl(attributions);

    const element = control.onAdd(undefined);
    const links = element.querySelectorAll("a");

    expect(links).toHaveLength(2);
    expect(links[0]?.textContent).toBe("Test data");
    expect(links[0]?.href).toBe("https://example.com/data");
    expect(links[0]?.title).toBe("Test license");
    expect(links[1]?.textContent).toBe("Second source");
    expect(element.textContent).toContain(" | ");

    document.body.append(element);
    control.onRemove();
    expect(element.isConnected).toBe(false);
  });
});
