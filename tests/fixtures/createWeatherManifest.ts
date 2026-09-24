import type { WeatherManifest } from "../../src/manifest/WeatherManifest.js";

export function createWeatherManifest(): WeatherManifest {
  return {
    schemaVersion: 1,
    datasetId: "test-dataset",
    sourcePolicyVersion: "test-1",
    run: {
      id: "20260924T00Z",
      model: "test-model",
      issuedAt: "2026-09-24T00:00:00Z",
      generatedAt: "2026-09-24T00:10:00Z",
      staleAfter: "2099-09-24T12:00:00Z",
      availableUntil: "2099-09-25T00:00:00Z"
    },
    coverage: {
      bounds: [0, 0, 2, 2],
      crs: "EPSG:4326"
    },
    grid: {
      width: 3,
      height: 3,
      longitudeStep: 1,
      latitudeStep: 1,
      xDirection: "west-to-east",
      yDirection: "south-to-north"
    },
    delivery: {
      layout: "regular-grid-texture",
      assetTemplate:
        "./{datasetId}/{runId}/{layerId}/{timeKey}.png"
    },
    timeSelection: {
      defaultMode: "nearest",
      maxDistanceMinutes: 240
    },
    frames: [
      {
        timeKey: "f000",
        leadHour: 0,
        validTime: "2026-09-24T00:00:00Z"
      },
      {
        timeKey: "f003",
        leadHour: 3,
        validTime: "2026-09-24T03:00:00Z"
      }
    ],
    layers: [
      {
        id: "temperature",
        kind: "scalar",
        sourceParameters: ["TMP"],
        unit: "K",
        aggregation: "instantaneous",
        temporalInterpolation: "nearest",
        encoding: {
          type: "scalar-png-r8-linear-v1",
          pngColorType: 0,
          valueRange: [0, 254],
          encodedRange: [1, 255],
          noDataCode: 0
        }
      },
      {
        id: "wind",
        kind: "vector",
        sourceParameters: ["UGRD", "VGRD"],
        unit: "m/s",
        aggregation: "instantaneous",
        temporalInterpolation: "nearest",
        encoding: {
          type: "vector-png-rg8-linear-v1",
          pngColorType: 2,
          uChannel: "r",
          vChannel: "g",
          componentRange: [-127, 127],
          encodedRange: [1, 255],
          noDataCode: 0
        }
      }
    ],
    attributions: [
      {
        label: "Test data",
        sourceUrl: "https://example.com/data",
        termsUrl: "https://example.com/terms",
        license: "Test license",
        modified: true,
        modifications: ["Test fixture"]
      }
    ]
  };
}
