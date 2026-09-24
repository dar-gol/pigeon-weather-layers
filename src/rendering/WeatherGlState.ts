export interface WeatherGlState {
  readonly activeTexture: number;
  readonly arrayBuffer: WebGLBuffer | null;
  readonly blendEnabled: boolean;
  readonly blendDestinationAlpha: number;
  readonly blendDestinationRgb: number;
  readonly blendSourceAlpha: number;
  readonly blendSourceRgb: number;
  readonly program: WebGLProgram | null;
  readonly texture0: WebGLTexture | null;
  readonly texture1: WebGLTexture | null;
  readonly vertexArray: WebGLVertexArrayObject | null;
}
