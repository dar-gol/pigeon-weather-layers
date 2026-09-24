# @pigeonmap/weather-layers

Framework-independent WebGL2 weather overlays for MapLibre GL JS and
MapLibre-compatible maps, including MapTiler SDK. The library renders a small
regular-grid texture directly on the GPU; it does not download or generate a
large pyramid of map tiles.

The package is Apache-2.0 software. It does not require a paid weather API and
does not bundle production weather data. The included example uses 44 KB of
synthetic forecast assets so development and CI remain fully free.

> The `@pigeonmap` npm scope is planned but not configured yet. Until the first
> npm release, install this repository directly or use a local workspace.

## What works

- scalar overlays such as temperature and precipitation;
- vector datasets such as wind, rendered as a wind-speed overlay;
- nearest-frame time selection, playback and next-frame prefetch;
- custom palettes, opacity and visibility;
- value queries at longitude/latitude, including wind direction;
- automatic source attribution;
- optional accessible map control;
- strict manifest validation and explicit asset-origin allow-listing;
- style reload recovery and deterministic cleanup.

Animated wind particles are intentionally not part of `0.1.0`; the vector
contract is designed so that renderer can be added without changing the data
format.

## Install

```bash
npm install @pigeonmap/weather-layers maplibre-gl
```

`maplibre-gl` is an optional peer: an application using MapTiler SDK can pass
its compatible map instance without installing a second map runtime.

## Quick start with MapLibre

```ts
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { addWeatherLayers } from "@pigeonmap/weather-layers";

const map = new maplibregl.Map({
  container: "map",
  style: "https://demotiles.maplibre.org/style.json",
  center: [10, 51],
  zoom: 4
});

const weather = await addWeatherLayers(map, {
  source: "https://weather.example.com/manifest.json",
  initialLayer: "temperature",
  initialTime: "latest",
  opacity: 0.72,
  placement: "below-labels"
});

await weather.setTime("2026-09-24T12:00:00Z");
await weather.setLayer("wind");
```

`addWeatherLayers()` waits for the map style, loads and validates the
manifest, decodes the selected PNG and attaches the custom layer. Use
`createWeatherLayers(options)` when construction and `attach(map)` need to be
separate.

## MapTiler SDK

The same controller API works with a MapTiler map because the integration uses
the shared MapLibre custom-layer contract:

```ts
import { Map } from "@maptiler/sdk";
import { addWeatherLayers } from "@pigeonmap/weather-layers";

const map = new Map({
  container: "map",
  style: "streets-v2",
  apiKey: import.meta.env.VITE_MAPTILER_KEY
});

const weather = await addWeatherLayers(map, {
  source: "/weather/manifest.json"
});
```

MapTiler may require its own key for the base map. The weather library does
not require or send that key.

## Optional control

The control is a separate entry point so applications that provide their own
UI do not ship its code or CSS.

```ts
import { WeatherControl } from "@pigeonmap/weather-layers/control";
import "@pigeonmap/weather-layers/control.css";

map.addControl(
  new WeatherControl({
    controller: weather,
    messages: {
      layer: "Warstwa",
      time: "Czas prognozy",
      opacity: "Przezroczystość",
      play: "Odtwórz prognozę",
      pause: "Zatrzymaj prognozę"
    },
    formatTime: (frame) =>
      new Intl.DateTimeFormat("pl-PL", {
        dateStyle: "short",
        timeStyle: "short",
        timeZone: "Europe/Warsaw"
      }).format(new Date(frame.validTime))
  }),
  "top-right"
);
```

The control includes layer selection, forecast time, opacity and playback.
All visible labels can be translated by the host application. By default the
time includes the browser's local time-zone abbreviation; `formatTime` can
provide application-specific formatting or label non-forecast demo frames.

## Application UI

The controller is deliberately independent from React, Vue and other UI
frameworks. Subscribe to one immutable snapshot and render controls using the
application's own components:

```ts
const unsubscribe = weather.subscribe((snapshot) => {
  console.log(snapshot.status, snapshot.layerId, snapshot.resolvedTime);
});

weather.setOpacity(0.5);
weather.setVisible(false);

const value = await weather.getValueAt({
  longitude: 19.94,
  latitude: 50.06,
  layerId: "temperature"
});

unsubscribe();
weather.destroy();
```

Changing layer or time is latest-request-wins. A superseded fetch is aborted,
and a failed change keeps the last valid frame visible with status `stale`.

## Data contract

The source exposes one versioned JSON manifest and one lossless PNG per layer
and forecast frame. The manifest declares:

- WGS84 bounds and a regular south-to-north/west-to-east grid;
- forecast run, valid times and staleness;
- scalar or vector encodings and physical units;
- an asset URL template;
- source attribution and modification notices.

The published schema is available as:

```ts
import { weatherManifestSchema } from "@pigeonmap/weather-layers";
```

and from the package path
`@pigeonmap/weather-layers/weather-manifest-v1.schema.json`.

Minimal delivery fragment:

```json
{
  "delivery": {
    "layout": "regular-grid-texture",
    "assetTemplate": "/weather/{datasetId}/{runId}/{layerId}/{timeKey}.png"
  }
}
```

The texture size is `width × height × channel count`, not a world tile
pyramid. For example, the repository's three layers and three frames occupy
about 44 KB after PNG compression. Production size depends on coverage,
resolution, number of layers and forecast horizon.

## Custom or offline sources

Pass a `WeatherDataSource` instead of a URL to load assets from IndexedDB,
Capacitor, signed storage or another transport:

```ts
import type { WeatherDataSource } from "@pigeonmap/weather-layers";

const source: WeatherDataSource = {
  loadManifest: (signal) => fetch("/manifest.json", { signal }).then((r) => r.json()),
  loadAsset: (request, signal) => fetch(request.url, { signal }).then((r) => r.blob())
};

const weather = await addWeatherLayers(map, { source });
```

The built-in HTTP source permits the manifest origin by default. A separate
CDN must be explicitly allowed through `createHttpWeatherDataSource()`.

## Free-data policy

The reference production direction uses freely redistributable DWD ICON-EU
data. Code licensing and weather-data licensing remain separate; applications
must keep attribution from the manifest visible. See [DATA_SOURCES.md](DATA_SOURCES.md)
for the source policy and required notice.

The library never silently falls back to a paid provider. A data pipeline is a
separate deployment concern and is not bundled into browser applications.

## Browser support and limits

- WebGL2 and `createImageBitmap` are required.
- Mercator projection is supported in `0.1.0`.
- Data must be a regular EPSG:4326 grid described by manifest version 1.
- Temporal interpolation is nearest-frame; spatial sampling is bilinear.
- Cross-origin assets require normal browser CORS headers.

## Local development

```bash
npm install
npm run check
npm run example:build
npm run example:open
```

The last command generates synthetic data, starts a local HTTP server and
opens the example. Do not open `examples/maplibre-basic/index.html` directly:
`file://` pages cannot load the TypeScript modules, weather assets or MapLibre
worker.

To start the server without opening a browser, run:

```bash
npm run example:dev
```

## License

Copyright 2026 Dariusz Golomski.

Library code and documentation are licensed under Apache-2.0. Weather datasets
retain their own licenses and attribution requirements. External contributions
currently do not require a CLA; see [CONTRIBUTING.md](CONTRIBUTING.md).
