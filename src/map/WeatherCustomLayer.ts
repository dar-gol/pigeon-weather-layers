import type { WeatherRenderOptions } from "./WeatherRenderOptions.js";

export interface WeatherCustomLayer {
  readonly id: string;
  readonly type: "custom";
  readonly renderingMode: "2d";
  onAdd(map: unknown, gl: WebGL2RenderingContext): void;
  render(gl: WebGL2RenderingContext, options: WeatherRenderOptions): void;
  onRemove(map: unknown, gl: WebGL2RenderingContext): void;
}
