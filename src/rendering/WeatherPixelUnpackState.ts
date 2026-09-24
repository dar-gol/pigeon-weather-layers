export interface WeatherPixelUnpackState {
  readonly buffer: WebGLBuffer | null;
  readonly alignment: number;
  readonly colorSpaceConversion: number;
  readonly flipY: boolean;
  readonly imageHeight: number;
  readonly premultiplyAlpha: boolean;
  readonly rowLength: number;
  readonly skipImages: number;
  readonly skipPixels: number;
  readonly skipRows: number;
}
