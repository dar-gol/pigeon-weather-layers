import * as maplibregl from "maplibre-gl";
import mapLibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import "maplibre-gl/dist/maplibre-gl.css";
import { addWeatherLayers } from "../../src/index.js";
import { WeatherControl } from "../../src/control/index.js";
import "../../src/control/control.css";
import "./style.css";

export async function startExample(): Promise<void> {
  maplibregl.setWorkerUrl(mapLibreWorkerUrl);

  const map = new maplibregl.Map({
    container: "map",
    style: {
      version: 8,
      sources: {},
      layers: [
        {
          id: "background",
          type: "background",
          paint: { "background-color": "#dcecf4" }
        }
      ]
    },
    center: [10, 51],
    zoom: 3
  });

  const weather = await addWeatherLayers(map, {
    source: "/weather/manifest.json",
    initialLayer: "temperature",
    initialTime: "latest",
    opacity: 0.72,
    placement: "below-labels"
  });

  map.addControl(
    new WeatherControl({
      controller: weather,
      messages: {
        layer: "Layer",
        time: "Forecast time",
        opacity: "Opacity"
      }
    }),
    "top-right"
  );

  map.on("click", async (event) => {
    const value = await weather.getValueAt({
      longitude: event.lngLat.lng,
      latitude: event.lngLat.lat
    });
    if (value === null) {
      return;
    }
    const description =
      value.kind === "scalar"
        ? `${value.value.toFixed(1)} ${value.unit}`
        : `${value.speed.toFixed(1)} ${value.unit}, ${value.directionDegrees.toFixed(0)}°`;
    new maplibregl.Popup()
      .setLngLat(event.lngLat)
      .setText(description)
      .addTo(map);
  });
}
