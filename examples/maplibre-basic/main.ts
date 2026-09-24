import * as maplibregl from "maplibre-gl";
import mapLibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import "maplibre-gl/dist/maplibre-gl.css";
import { addWeatherLayers } from "../../src/index.js";
import { WeatherControl } from "../../src/control/index.js";
import "../../src/control/control.css";
import "./style.css";

const COVERAGE_BOUNDS: readonly [number, number, number, number] = [
  -20, 30, 40, 70
];

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
    initialLayer: "temperature-2m",
    initialTime: "latest",
    opacity: 0.72,
    placement: "below-labels"
  });

  map.addControl(
    new WeatherControl({
      controller: weather,
      messages: {
        layer: "Layer",
        time: "Synthetic frame",
        opacity: "Opacity"
      },
      formatTime: (frame) => `T+${frame.leadHour} h · synthetic`
    }),
    "top-right"
  );

  addReferenceGrid(map);
  document.querySelector("#demo-notice")?.removeAttribute("hidden");

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
        : value.directionDegrees === null
          ? `${value.speed.toFixed(1)} ${value.unit}, calm`
          : `${value.speed.toFixed(1)} ${value.unit}, ${value.directionDegrees.toFixed(0)}°`;
    new maplibregl.Popup()
      .setLngLat(event.lngLat)
      .setText(description)
      .addTo(map);
  });
}

function addReferenceGrid(map: maplibregl.Map): void {
  const [west, south, east, north] = COVERAGE_BOUNDS;
  const features: Array<{
    type: "Feature";
    properties: Record<string, never>;
    geometry: { type: "LineString"; coordinates: number[][] };
  }> = [];

  for (let longitude = west; longitude <= east; longitude += 10) {
    features.push({
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates: [
          [longitude, south],
          [longitude, north]
        ]
      }
    });
  }
  for (let latitude = south; latitude <= north; latitude += 10) {
    features.push({
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates: [
          [west, latitude],
          [east, latitude]
        ]
      }
    });
  }

  map.addSource("demo-coordinate-grid", {
    type: "geojson",
    data: { type: "FeatureCollection", features }
  });
  map.addLayer({
    id: "demo-coordinate-grid",
    type: "line",
    source: "demo-coordinate-grid",
    paint: {
      "line-color": "#17384f",
      "line-opacity": 0.42,
      "line-width": 1,
      "line-dasharray": [3, 3]
    }
  });
}
