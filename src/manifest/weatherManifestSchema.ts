import {
  MAX_WEATHER_GRID_DIMENSION,
  WEB_MERCATOR_MAX_LATITUDE
} from "./WeatherManifestLimits.js";
import { STRICT_UTC_TIMESTAMP_PATTERN } from "./isStrictUtcTimestamp.js";

const MAX_IDENTIFIER_LENGTH = 128;
const MAX_TEXT_LENGTH = 512;
const MAX_URL_LENGTH = 2_048;

export const weatherManifestSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://pigeonmap.com/schemas/weather-manifest-v1.schema.json",
  title: "WeatherManifest v1",
  type: "object",
  additionalProperties: false,
  required: [
    "schemaVersion",
    "datasetId",
    "sourcePolicyVersion",
    "run",
    "coverage",
    "grid",
    "delivery",
    "timeSelection",
    "frames",
    "layers",
    "attributions"
  ],
  properties: {
    schemaVersion: { const: 1 },
    datasetId: {
      type: "string",
      minLength: 1,
      maxLength: MAX_IDENTIFIER_LENGTH
    },
    sourcePolicyVersion: {
      type: "string",
      minLength: 1,
      maxLength: MAX_IDENTIFIER_LENGTH
    },
    run: {
      type: "object",
      additionalProperties: false,
      required: [
        "id",
        "model",
        "issuedAt",
        "generatedAt",
        "staleAfter",
        "availableUntil"
      ],
      properties: {
        id: {
          type: "string",
          minLength: 1,
          maxLength: MAX_IDENTIFIER_LENGTH
        },
        model: { type: "string", minLength: 1, maxLength: MAX_TEXT_LENGTH },
        issuedAt: { type: "string", pattern: STRICT_UTC_TIMESTAMP_PATTERN },
        generatedAt: { type: "string", pattern: STRICT_UTC_TIMESTAMP_PATTERN },
        staleAfter: { type: "string", pattern: STRICT_UTC_TIMESTAMP_PATTERN },
        availableUntil: { type: "string", pattern: STRICT_UTC_TIMESTAMP_PATTERN }
      }
    },
    coverage: {
      type: "object",
      additionalProperties: false,
      required: ["bounds", "crs"],
      properties: {
        bounds: {
          type: "array",
          minItems: 4,
          maxItems: 4,
          prefixItems: [
            { type: "number", minimum: -180, maximum: 180 },
            {
              type: "number",
              minimum: -WEB_MERCATOR_MAX_LATITUDE,
              maximum: WEB_MERCATOR_MAX_LATITUDE
            },
            { type: "number", minimum: -180, maximum: 180 },
            {
              type: "number",
              minimum: -WEB_MERCATOR_MAX_LATITUDE,
              maximum: WEB_MERCATOR_MAX_LATITUDE
            }
          ],
          items: false
        },
        crs: { const: "EPSG:4326" }
      }
    },
    grid: {
      type: "object",
      additionalProperties: false,
      required: [
        "width",
        "height",
        "longitudeStep",
        "latitudeStep",
        "xDirection",
        "yDirection"
      ],
      properties: {
        width: {
          type: "integer",
          minimum: 2,
          maximum: MAX_WEATHER_GRID_DIMENSION
        },
        height: {
          type: "integer",
          minimum: 2,
          maximum: MAX_WEATHER_GRID_DIMENSION
        },
        longitudeStep: { type: "number", exclusiveMinimum: 0 },
        latitudeStep: { type: "number", exclusiveMinimum: 0 },
        xDirection: { const: "west-to-east" },
        yDirection: { const: "south-to-north" }
      }
    },
    delivery: {
      type: "object",
      additionalProperties: false,
      required: ["layout", "assetTemplate"],
      properties: {
        layout: { const: "regular-grid-texture" },
        assetTemplate: {
          type: "string",
          minLength: 1,
          maxLength: MAX_URL_LENGTH,
          allOf: [
            { pattern: "\\{datasetId\\}" },
            { pattern: "\\{runId\\}" },
            { pattern: "\\{layerId\\}" },
            { pattern: "\\{timeKey\\}" }
          ],
          not: { pattern: "\\{(?:z|x|y)\\}" }
        }
      }
    },
    timeSelection: {
      type: "object",
      additionalProperties: false,
      required: ["defaultMode", "maxDistanceMinutes"],
      properties: {
        defaultMode: { const: "nearest" },
        maxDistanceMinutes: { type: "number", minimum: 0 }
      }
    },
    frames: {
      type: "array",
      minItems: 1,
      maxItems: 512,
      items: { $ref: "#/$defs/frame" }
    },
    layers: {
      type: "array",
      minItems: 1,
      maxItems: 64,
      items: {
        oneOf: [
          { $ref: "#/$defs/scalarLayer" },
          { $ref: "#/$defs/vectorLayer" }
        ]
      }
    },
    attributions: {
      type: "array",
      minItems: 1,
      maxItems: 16,
      items: { $ref: "#/$defs/attribution" }
    }
  },
  $defs: {
    frame: {
      type: "object",
      additionalProperties: false,
      required: ["timeKey", "leadHour", "validTime"],
      properties: {
        timeKey: {
          type: "string",
          minLength: 1,
          maxLength: MAX_IDENTIFIER_LENGTH
        },
        leadHour: { type: "number", minimum: 0 },
        validTime: { type: "string", pattern: STRICT_UTC_TIMESTAMP_PATTERN },
        intervalStart: {
          type: "string",
          pattern: STRICT_UTC_TIMESTAMP_PATTERN
        },
        intervalEnd: {
          type: "string",
          pattern: STRICT_UTC_TIMESTAMP_PATTERN
        }
      }
    },
    scalarLayer: {
      type: "object",
      additionalProperties: false,
      required: [
        "id",
        "kind",
        "sourceParameters",
        "unit",
        "aggregation",
        "temporalInterpolation",
        "encoding"
      ],
      properties: {
        id: {
          type: "string",
          minLength: 1,
          maxLength: MAX_IDENTIFIER_LENGTH
        },
        kind: { const: "scalar" },
        sourceParameters: {
          type: "array",
          minItems: 1,
          maxItems: 16,
          uniqueItems: true,
          items: {
            type: "string",
            minLength: 1,
            maxLength: MAX_IDENTIFIER_LENGTH
          }
        },
        unit: { type: "string", minLength: 1, maxLength: 32 },
        aggregation: { type: "string", minLength: 1, maxLength: 64 },
        temporalInterpolation: { const: "nearest" },
        encoding: {
          oneOf: [
            { $ref: "#/$defs/scalarLinearEncoding" },
            { $ref: "#/$defs/scalarSqrtEncoding" }
          ]
        }
      }
    },
    vectorLayer: {
      type: "object",
      additionalProperties: false,
      required: [
        "id",
        "kind",
        "sourceParameters",
        "unit",
        "aggregation",
        "temporalInterpolation",
        "encoding"
      ],
      properties: {
        id: {
          type: "string",
          minLength: 1,
          maxLength: MAX_IDENTIFIER_LENGTH
        },
        kind: { const: "vector" },
        sourceParameters: {
          type: "array",
          minItems: 2,
          maxItems: 2,
          uniqueItems: true,
          items: {
            type: "string",
            minLength: 1,
            maxLength: MAX_IDENTIFIER_LENGTH
          }
        },
        unit: { type: "string", minLength: 1, maxLength: 32 },
        aggregation: { type: "string", minLength: 1, maxLength: 64 },
        temporalInterpolation: { const: "nearest" },
        encoding: { $ref: "#/$defs/vectorEncoding" }
      }
    },
    scalarLinearEncoding: {
      type: "object",
      additionalProperties: false,
      required: [
        "type",
        "pngColorType",
        "valueRange",
        "encodedRange",
        "noDataCode"
      ],
      properties: {
        type: { const: "scalar-png-r8-linear-v1" },
        pngColorType: { const: 0 },
        valueRange: { $ref: "#/$defs/numberRange" },
        encodedRange: { const: [1, 255] },
        noDataCode: { const: 0 }
      }
    },
    scalarSqrtEncoding: {
      type: "object",
      additionalProperties: false,
      required: [
        "type",
        "pngColorType",
        "valueRange",
        "encodedRange",
        "noDataCode"
      ],
      properties: {
        type: { const: "scalar-png-r8-sqrt-v1" },
        pngColorType: { const: 0 },
        valueRange: { $ref: "#/$defs/numberRange" },
        encodedRange: { const: [1, 255] },
        noDataCode: { const: 0 }
      }
    },
    vectorEncoding: {
      type: "object",
      additionalProperties: false,
      required: [
        "type",
        "pngColorType",
        "uChannel",
        "vChannel",
        "componentRange",
        "encodedRange",
        "noDataCode"
      ],
      properties: {
        type: { const: "vector-png-rg8-linear-v1" },
        pngColorType: { const: 2 },
        uChannel: { const: "r" },
        vChannel: { const: "g" },
        componentRange: { $ref: "#/$defs/numberRange" },
        encodedRange: { const: [1, 255] },
        noDataCode: { const: 0 }
      }
    },
    numberRange: {
      type: "array",
      minItems: 2,
      maxItems: 2,
      items: { type: "number" }
    },
    attribution: {
      type: "object",
      additionalProperties: false,
      required: [
        "label",
        "sourceUrl",
        "termsUrl",
        "license",
        "modified",
        "modifications"
      ],
      properties: {
        label: { type: "string", minLength: 1, maxLength: MAX_TEXT_LENGTH },
        sourceUrl: {
          type: "string",
          maxLength: MAX_URL_LENGTH,
          format: "uri",
          pattern: "^https://"
        },
        termsUrl: {
          type: "string",
          maxLength: MAX_URL_LENGTH,
          format: "uri",
          pattern: "^https://"
        },
        license: {
          type: "string",
          minLength: 1,
          maxLength: MAX_IDENTIFIER_LENGTH
        },
        modified: { type: "boolean" },
        modifications: {
          type: "array",
          minItems: 1,
          maxItems: 32,
          uniqueItems: true,
          items: { type: "string", minLength: 1, maxLength: MAX_TEXT_LENGTH }
        }
      }
    }
  }
} as const;
