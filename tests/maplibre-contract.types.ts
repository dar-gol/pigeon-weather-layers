import type { CustomLayerInterface, Map as MapLibreMap } from "maplibre-gl";
import type { WeatherCustomLayer } from "../src/map/WeatherCustomLayer.js";
import type { WeatherMap } from "../src/index.js";

declare const weatherLayer: WeatherCustomLayer;
declare const mapLibreMap: MapLibreMap;

const compatibleLayer: CustomLayerInterface = weatherLayer;
const compatibleMap: WeatherMap = mapLibreMap;

void compatibleLayer;
void compatibleMap;
