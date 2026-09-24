import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PNG } from "pngjs";

const width = 161;
const height = 101;
const datasetId = "synthetic-europe";
const runId = "demo-run";
const frameKeys = ["f000", "f003", "f006"];
const layerIds = ["temperature", "precipitation", "wind"];
const outputRoot = resolve(
  "examples/maplibre-basic/public/weather",
  datasetId,
  runId
);

function encodeLinear(value, minimum, maximum) {
  return Math.round(1 + (254 * (value - minimum)) / (maximum - minimum));
}

function encodeSqrt(value, minimum, maximum) {
  const normalized = Math.sqrt((value - minimum) / (maximum - minimum));
  return Math.round(1 + 254 * normalized);
}

function valueAt(x, y, frameIndex) {
  const longitude = -20 + x * 0.375;
  const latitude = 30 + y * 0.4;
  const phase = frameIndex * 0.75;
  const wave = Math.sin(longitude / 9 + phase) * Math.cos(latitude / 8);
  return {
    temperature: 280 + 14 * wave - (latitude - 50) * 0.22,
    precipitation: Math.max(0, 10 * (wave + 0.25)),
    u: 17 * Math.cos(latitude / 11 + phase),
    v: 13 * Math.sin(longitude / 12 - phase)
  };
}

function createPng(layerId, frameIndex) {
  const png = new PNG({ width, height });
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const value = valueAt(x, y, frameIndex);
      if (layerId === "temperature") {
        const code = encodeLinear(value.temperature, 250, 310);
        png.data[offset] = code;
        png.data[offset + 1] = code;
        png.data[offset + 2] = code;
      } else if (layerId === "precipitation") {
        const code = encodeSqrt(value.precipitation, 0, 20);
        png.data[offset] = code;
        png.data[offset + 1] = code;
        png.data[offset + 2] = code;
      } else {
        png.data[offset] = encodeLinear(value.u, -30, 30);
        png.data[offset + 1] = encodeLinear(value.v, -30, 30);
        png.data[offset + 2] = 0;
      }
      png.data[offset + 3] = 255;
    }
  }
  return PNG.sync.write(png, {
    colorType: layerId === "wind" ? 2 : 0
  });
}

for (const layerId of layerIds) {
  const layerDirectory = resolve(outputRoot, layerId);
  await mkdir(layerDirectory, { recursive: true });
  for (const [frameIndex, frameKey] of frameKeys.entries()) {
    await writeFile(
      resolve(layerDirectory, frameKey + ".png"),
      createPng(layerId, frameIndex)
    );
  }
}

const manifest = {
  schemaVersion: 1,
  datasetId,
  sourcePolicyVersion: "demo-1",
  run: {
    id: runId,
    model: "synthetic-demo",
    issuedAt: "2030-01-01T00:00:00Z",
    generatedAt: "2030-01-01T00:00:00Z",
    staleAfter: "2030-01-02T00:00:00Z",
    availableUntil: "2030-01-03T00:00:00Z"
  },
  coverage: {
    bounds: [-20, 30, 40, 70],
    crs: "EPSG:4326"
  },
  grid: {
    width,
    height,
    longitudeStep: 0.375,
    latitudeStep: 0.4,
    xDirection: "west-to-east",
    yDirection: "south-to-north"
  },
  delivery: {
    layout: "regular-grid-texture",
    assetTemplate:
      "/weather/{datasetId}/{runId}/{layerId}/{timeKey}.png"
  },
  timeSelection: {
    defaultMode: "nearest",
    maxDistanceMinutes: 180
  },
  frames: frameKeys.map((timeKey, index) => ({
    timeKey,
    leadHour: index * 3,
    validTime: `2030-01-01T${String(index * 3).padStart(2, "0")}:00:00Z`
  })),
  layers: [
    {
      id: "temperature",
      kind: "scalar",
      sourceParameters: ["synthetic-temperature"],
      unit: "K",
      aggregation: "instantaneous",
      temporalInterpolation: "nearest",
      encoding: {
        type: "scalar-png-r8-linear-v1",
        pngColorType: 0,
        valueRange: [250, 310],
        encodedRange: [1, 255],
        noDataCode: 0
      }
    },
    {
      id: "precipitation",
      kind: "scalar",
      sourceParameters: ["synthetic-precipitation"],
      unit: "mm",
      aggregation: "three-hour total",
      temporalInterpolation: "nearest",
      encoding: {
        type: "scalar-png-r8-sqrt-v1",
        pngColorType: 0,
        valueRange: [0, 20],
        encodedRange: [1, 255],
        noDataCode: 0
      }
    },
    {
      id: "wind",
      kind: "vector",
      sourceParameters: ["synthetic-u", "synthetic-v"],
      unit: "m/s",
      aggregation: "instantaneous",
      temporalInterpolation: "nearest",
      encoding: {
        type: "vector-png-rg8-linear-v1",
        pngColorType: 2,
        uChannel: "r",
        vChannel: "g",
        componentRange: [-30, 30],
        encodedRange: [1, 255],
        noDataCode: 0
      }
    }
  ],
  attributions: [
    {
      label: "Synthetic demo data",
      sourceUrl: "https://github.com/dar-gol/pigeon-weather-layers",
      termsUrl: "https://github.com/dar-gol/pigeon-weather-layers/blob/main/LICENSE",
      license: "Apache-2.0",
      modified: true,
      modifications: ["Programmatically generated for this example"]
    }
  ]
};

const manifestDirectory = resolve("examples/maplibre-basic/public/weather");
await mkdir(manifestDirectory, { recursive: true });
await writeFile(
  resolve(manifestDirectory, "manifest.json"),
  JSON.stringify(manifest, null, 2) + "\n",
  "utf8"
);
