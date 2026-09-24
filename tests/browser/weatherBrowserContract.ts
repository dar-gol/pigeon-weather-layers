import type { WeatherPalette } from "../../src/controller/WeatherPalette.js";
import {
  addWeatherLayers,
  type WeatherDataSource,
  type WeatherManifest
} from "../../src/index.js";
import type { WeatherGrid } from "../../src/manifest/WeatherGrid.js";
import type { ScalarWeatherLayer } from "../../src/manifest/ScalarWeatherLayer.js";
import type { VectorWeatherLayer } from "../../src/manifest/VectorWeatherLayer.js";
import { BrowserWeatherAssetDecoder } from "../../src/rendering/BrowserWeatherAssetDecoder.js";
import { RegularGridWeatherLayer } from "../../src/rendering/RegularGridWeatherLayer.js";
import { Map as MapLibreMap } from "maplibre-gl";
import type {
  MapLibreIntegrationResult,
  WeatherBrowserContractResult
} from "./WeatherBrowserContractResult.js";

const SCALAR_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAAAAABX3VL4AAAADklEQVR4AWNktGeprwcAApYBRKmPPMIAAAAASUVORK5CYII=";
const VECTOR_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4AWNkZGKwt2dgqa9nqK9lAAAM9gKB/4yPrgAAAABJRU5ErkJggg==";
const WEB_MERCATOR_LIMIT = 85.0511287798066;

const grid: WeatherGrid = {
  width: 2,
  height: 2,
  longitudeStep: 360,
  latitudeStep: WEB_MERCATOR_LIMIT * 2,
  xDirection: "west-to-east",
  yDirection: "south-to-north"
};

const scalarLayer: ScalarWeatherLayer = {
  id: "browser-scalar",
  kind: "scalar",
  sourceParameters: ["fixture"],
  unit: "fixture",
  aggregation: "instantaneous",
  temporalInterpolation: "nearest",
  encoding: {
    type: "scalar-png-r8-linear-v1",
    pngColorType: 0,
    valueRange: [0, 254],
    encodedRange: [1, 255],
    noDataCode: 0
  }
};

const vectorLayer: VectorWeatherLayer = {
  id: "browser-vector",
  kind: "vector",
  sourceParameters: ["u", "v"],
  unit: "m/s",
  aggregation: "instantaneous",
  temporalInterpolation: "nearest",
  encoding: {
    type: "vector-png-rg8-linear-v1",
    pngColorType: 2,
    uChannel: "r",
    vChannel: "g",
    componentRange: [-10, 10],
    encodedRange: [1, 255],
    noDataCode: 0
  }
};

const palette: WeatherPalette = {
  id: "browser-contract",
  valueRange: [0, 254],
  stops: [
    { value: 0, color: [255, 0, 0, 255] },
    { value: 63, color: [0, 255, 0, 255] },
    { value: 127, color: [0, 0, 255, 255] },
    { value: 254, color: [255, 255, 255, 255] }
  ]
};

const worldMatrix = new Float32Array([
  2, 0, 0, 0,
  0, -2, 0, 0,
  0, 0, 1, 0,
  -1, 1, 0, 1
]);

const integrationManifest: WeatherManifest = {
  schemaVersion: 1,
  datasetId: "browser-contract",
  sourcePolicyVersion: "test-v1",
  run: {
    id: "20260924T0000Z",
    model: "browser fixture",
    issuedAt: "2026-09-24T00:00:00Z",
    generatedAt: "2026-09-24T00:05:00Z",
    staleAfter: "2026-09-24T23:00:00Z",
    availableUntil: "2026-09-25T00:00:00Z"
  },
  coverage: {
    bounds: [-180, -WEB_MERCATOR_LIMIT, 180, WEB_MERCATOR_LIMIT],
    crs: "EPSG:4326"
  },
  grid,
  delivery: {
    layout: "regular-grid-texture",
    assetTemplate:
      "/unused/{datasetId}/{runId}/{layerId}/{timeKey}.png"
  },
  timeSelection: {
    defaultMode: "nearest",
    maxDistanceMinutes: 60
  },
  frames: [
    {
      timeKey: "t000",
      leadHour: 0,
      validTime: "2026-09-24T00:00:00Z"
    }
  ],
  layers: [scalarLayer],
  attributions: [
    {
      label: "Browser fixture",
      sourceUrl: "https://example.com/weather",
      termsUrl: "https://example.com/terms",
      license: "CC0-1.0",
      modified: true,
      modifications: ["Encoded as a test PNG"]
    }
  ]
};

function pngBlob(base64: string): Blob {
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (character) =>
    character.charCodeAt(0)
  );
  return new Blob([bytes], { type: "image/png" });
}

function readPixel(
  gl: WebGL2RenderingContext,
  x: number,
  y: number
): readonly number[] {
  const pixel = new Uint8Array(4);
  gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
  return [...pixel];
}

function requireWebGl2(): WebGL2RenderingContext {
  const canvas = document.querySelector<HTMLCanvasElement>(
    "#weather-contract"
  );
  const gl = canvas?.getContext("webgl2", {
    alpha: true,
    premultipliedAlpha: false,
    preserveDrawingBuffer: true
  });
  if (gl === null || gl === undefined) {
    throw new Error("WebGL2 is unavailable in the browser contract test");
  }
  return gl;
}

function seedHostGlState(gl: WebGL2RenderingContext): () => boolean {
  const buffer = gl.createBuffer();
  const pixelUnpackBuffer = gl.createBuffer();
  const texture0 = gl.createTexture();
  const texture1 = gl.createTexture();
  const vertexArray = gl.createVertexArray();
  if (
    buffer === null ||
    pixelUnpackBuffer === null ||
    texture0 === null ||
    texture1 === null ||
    vertexArray === null
  ) {
    throw new Error("Unable to allocate host-state sentinels");
  }

  gl.bindVertexArray(vertexArray);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bindBuffer(gl.PIXEL_UNPACK_BUFFER, pixelUnpackBuffer);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texture0);
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, texture1);
  gl.activeTexture(gl.TEXTURE3);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 8);
  gl.pixelStorei(
    gl.UNPACK_COLORSPACE_CONVERSION_WEBGL,
    gl.BROWSER_DEFAULT_WEBGL
  );
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
  gl.pixelStorei(gl.UNPACK_IMAGE_HEIGHT, 9);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 1);
  gl.pixelStorei(gl.UNPACK_ROW_LENGTH, 7);
  gl.pixelStorei(gl.UNPACK_SKIP_IMAGES, 4);
  gl.pixelStorei(gl.UNPACK_SKIP_PIXELS, 2);
  gl.pixelStorei(gl.UNPACK_SKIP_ROWS, 3);
  gl.disable(gl.BLEND);

  return () => {
    const activeTexture = gl.getParameter(gl.ACTIVE_TEXTURE) as number;
    const arrayBuffer = gl.getParameter(
      gl.ARRAY_BUFFER_BINDING
    ) as WebGLBuffer | null;
    const activePixelUnpackBuffer = gl.getParameter(
      gl.PIXEL_UNPACK_BUFFER_BINDING
    ) as WebGLBuffer | null;
    const activeVertexArray = gl.getParameter(
      gl.VERTEX_ARRAY_BINDING
    ) as WebGLVertexArrayObject | null;
    const unpackAlignment = gl.getParameter(gl.UNPACK_ALIGNMENT) as number;
    const unpackColorSpaceConversion = gl.getParameter(
      gl.UNPACK_COLORSPACE_CONVERSION_WEBGL
    ) as number;
    const unpackFlipY = gl.getParameter(gl.UNPACK_FLIP_Y_WEBGL) as boolean;
    const unpackImageHeight = gl.getParameter(gl.UNPACK_IMAGE_HEIGHT) as number;
    const unpackPremultiplyAlpha = gl.getParameter(
      gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL
    ) as boolean;
    const unpackRowLength = gl.getParameter(gl.UNPACK_ROW_LENGTH) as number;
    const unpackSkipImages = gl.getParameter(gl.UNPACK_SKIP_IMAGES) as number;
    const unpackSkipPixels = gl.getParameter(gl.UNPACK_SKIP_PIXELS) as number;
    const unpackSkipRows = gl.getParameter(gl.UNPACK_SKIP_ROWS) as number;
    const blendEnabled = gl.isEnabled(gl.BLEND);
    gl.activeTexture(gl.TEXTURE0);
    const activeTexture0 = gl.getParameter(
      gl.TEXTURE_BINDING_2D
    ) as WebGLTexture | null;
    gl.activeTexture(gl.TEXTURE1);
    const activeTexture1 = gl.getParameter(
      gl.TEXTURE_BINDING_2D
    ) as WebGLTexture | null;
    gl.activeTexture(activeTexture);
    return (
      activeTexture === gl.TEXTURE3 &&
      arrayBuffer === buffer &&
      activePixelUnpackBuffer === pixelUnpackBuffer &&
      activeVertexArray === vertexArray &&
      unpackAlignment === 8 &&
      unpackColorSpaceConversion === gl.BROWSER_DEFAULT_WEBGL &&
      unpackFlipY &&
      unpackImageHeight === 9 &&
      unpackPremultiplyAlpha &&
      unpackRowLength === 7 &&
      unpackSkipImages === 4 &&
      unpackSkipPixels === 2 &&
      unpackSkipRows === 3 &&
      !blendEnabled &&
      activeTexture0 === texture0 &&
      activeTexture1 === texture1
    );
  };
}

async function runWeatherBrowserContract(): Promise<WeatherBrowserContractResult> {
  const decoder = new BrowserWeatherAssetDecoder();
  const signal = new AbortController().signal;
  const scalar = await decoder.decode(
    pngBlob(SCALAR_PNG),
    scalarLayer,
    grid,
    signal
  );
  const vector = await decoder.decode(
    pngBlob(VECTOR_PNG),
    vectorLayer,
    grid,
    signal
  );

  const gl = requireWebGl2();
  const hostGlStateIsRestored = seedHostGlState(gl);
  gl.viewport(0, 0, 64, 64);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  const scalarRenderer = new RegularGridWeatherLayer(
    "browser-scalar-layer",
    1,
    true
  );
  scalarRenderer.setFrame({
    asset: scalar,
    layer: scalarLayer,
    palette,
    bounds: [-180, -WEB_MERCATOR_LIMIT, 180, WEB_MERCATOR_LIMIT]
  });
  scalarRenderer.onAdd(undefined, gl);
  scalarRenderer.render(gl, { modelViewProjectionMatrix: worldMatrix });
  const scalarCorners = {
    southWest: readPixel(gl, 2, 2),
    southEast: readPixel(gl, 61, 2),
    northWest: readPixel(gl, 2, 61),
    northEast: readPixel(gl, 61, 61)
  };

  scalarRenderer.setFrame({
    asset: { width: 2, height: 2, channels: 1, codes: new Uint8Array(4) },
    layer: scalarLayer,
    palette,
    bounds: [-180, -WEB_MERCATOR_LIMIT, 180, WEB_MERCATOR_LIMIT]
  });
  gl.clear(gl.COLOR_BUFFER_BIT);
  scalarRenderer.render(gl, { modelViewProjectionMatrix: worldMatrix });
  const noDataAlpha = readPixel(gl, 32, 32)[3] ?? -1;
  scalarRenderer.onRemove(undefined, gl);

  const vectorRenderer = new RegularGridWeatherLayer(
    "browser-vector-layer",
    1,
    true
  );
  vectorRenderer.setFrame({
    asset: vector,
    layer: vectorLayer,
    palette: {
      id: "vector-contract",
      valueRange: [0, 15],
      stops: [
        { value: 0, color: [0, 0, 0, 255] },
        { value: 15, color: [255, 255, 255, 255] }
      ]
    },
    bounds: [-180, -WEB_MERCATOR_LIMIT, 180, WEB_MERCATOR_LIMIT]
  });
  vectorRenderer.onAdd(undefined, gl);
  gl.clear(gl.COLOR_BUFFER_BIT);
  vectorRenderer.render(gl, {
    defaultProjectionData: { mainMatrix: new Float64Array(worldMatrix) }
  });
  const vectorCorners = {
    southWest: readPixel(gl, 2, 2),
    southEast: readPixel(gl, 61, 2),
    northWest: readPixel(gl, 2, 61),
    northEast: readPixel(gl, 61, 61)
  };

  vectorRenderer.setFrame({
    asset: {
      width: 2,
      height: 2,
      channels: 2,
      codes: new Uint8Array([0, 128, 0, 128, 0, 128, 0, 128])
    },
    layer: vectorLayer,
    palette: {
      id: "vector-contract",
      valueRange: [0, 15],
      stops: [
        { value: 0, color: [0, 0, 0, 255] },
        { value: 15, color: [255, 255, 255, 255] }
      ]
    },
    bounds: [-180, -WEB_MERCATOR_LIMIT, 180, WEB_MERCATOR_LIMIT]
  });
  gl.clear(gl.COLOR_BUFFER_BIT);
  vectorRenderer.render(gl, {
    defaultProjectionData: { mainMatrix: new Float64Array(worldMatrix) }
  });
  const vectorNoDataAlpha = readPixel(gl, 32, 32)[3] ?? -1;
  vectorRenderer.onRemove(undefined, gl);
  const glStateRestored = hostGlStateIsRestored();

  return {
    scalarCodes: [...scalar.codes],
    vectorCodes: [...vector.codes],
    scalarCorners,
    noDataAlpha,
    vectorCorners,
    vectorNoDataAlpha,
    glStateRestored,
    glError: gl.getError()
  };
}

async function runMapLibreIntegrationContract(): Promise<MapLibreIntegrationResult> {
  const source: WeatherDataSource = {
    loadManifest: async () => integrationManifest,
    loadAsset: async () => pngBlob(SCALAR_PNG)
  };
  const map = new MapLibreMap({
    container: "maplibre-contract",
    style: { version: 8, sources: {}, layers: [] },
    center: [0, 0],
    zoom: 0,
    attributionControl: false
  });

  try {
    await new Promise<void>((resolve) => map.once("load", () => resolve()));
    const controller = await addWeatherLayers(map, {
      source,
      initialLayer: scalarLayer.id,
      opacity: 1
    });
    const sampled = await controller.getValueAt({
      longitude: 0,
      latitude: 0
    });
    const result: MapLibreIntegrationResult = {
      attributionText:
        document.querySelector(".pigeon-weather-attribution")?.textContent ??
        null,
      layerAttached: map.getLayer("pigeon-weather-overlay") !== undefined,
      layerRemoved: false,
      sampledValue:
        sampled?.kind === "scalar" ? sampled.value : null,
      status: controller.getSnapshot().status
    };

    controller.destroy();
    return {
      ...result,
      layerRemoved: map.getLayer("pigeon-weather-overlay") === undefined
    };
  } finally {
    map.remove();
  }
}

Object.assign(window, {
  runMapLibreIntegrationContract,
  runWeatherBrowserContract
});

declare global {
  interface Window {
    runMapLibreIntegrationContract(): Promise<MapLibreIntegrationResult>;
    runWeatherBrowserContract(): Promise<WeatherBrowserContractResult>;
  }
}
