import type { WeatherCustomLayer } from "./WeatherCustomLayer.js";
import type { WeatherMapControl } from "./WeatherMapControl.js";

export interface WeatherMap {
  addLayer(layer: WeatherCustomLayer, beforeId?: string): unknown;
  getLayer(id: string): unknown;
  removeLayer(id: string): unknown;
  getStyle(): {
    readonly layers?: readonly {
      readonly id: string;
      readonly type?: string;
    }[];
  };
  getProjection(): { readonly type?: unknown } | undefined;
  isStyleLoaded(): boolean | void;
  on(
    type: "style.load" | "projectiontransition" | "remove",
    listener: () => void
  ): unknown;
  off(
    type: "style.load" | "projectiontransition" | "remove",
    listener: () => void
  ): unknown;
  triggerRepaint(): void;
  addControl(
    control: WeatherMapControl,
    position?: "top-left" | "top-right" | "bottom-left" | "bottom-right"
  ): unknown;
  removeControl(control: WeatherMapControl): unknown;
}
