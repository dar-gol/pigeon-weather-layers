import type { WeatherPalette } from "../controller/WeatherPalette.js";
import { WeatherLayersError } from "../error/WeatherLayersError.js";
import type { WeatherCustomLayer } from "../map/WeatherCustomLayer.js";
import type { WeatherRenderOptions } from "../map/WeatherRenderOptions.js";
import { createPaletteTextureData } from "../palette/createPaletteTextureData.js";
import type { WeatherRenderFrame } from "./WeatherRenderFrame.js";
import type { WeatherGlState } from "./WeatherGlState.js";
import type { WeatherPixelUnpackState } from "./WeatherPixelUnpackState.js";

const VERTEX_SHADER = [
  "#version 300 es",
  "uniform mat4 u_matrix;",
  "in vec2 a_position;",
  "out vec2 v_mercator;",
  "void main() {",
  "  v_mercator = a_position;",
  "  gl_Position = u_matrix * vec4(a_position, 0.0, 1.0);",
  "}"
].join("\n");

const FRAGMENT_SHADER = [
  "#version 300 es",
  "precision highp float;",
  "precision highp int;",
  "uniform sampler2D u_data;",
  "uniform sampler2D u_palette;",
  "uniform ivec2 u_grid_size;",
  "uniform vec4 u_bounds;",
  "uniform vec2 u_value_range;",
  "uniform vec2 u_component_range;",
  "uniform vec2 u_palette_range;",
  "uniform int u_kind;",
  "uniform bool u_sqrt;",
  "uniform float u_opacity;",
  "in vec2 v_mercator;",
  "out vec4 frag_color;",
  "const float PI = 3.141592653589793;",
  "float decode_code(float channel, vec2 range, bool sqrt_value) {",
  "  float code = floor(channel * 255.0 + 0.5);",
  "  float normalized = (code - 1.0) / 254.0;",
  "  if (sqrt_value) normalized *= normalized;",
  "  return mix(range.x, range.y, normalized);",
  "}",
  "vec2 scalar_sample(ivec2 position) {",
  "  float channel = texelFetch(u_data, position, 0).r;",
  "  float code = floor(channel * 255.0 + 0.5);",
  "  if (code < 0.5) return vec2(0.0, 0.0);",
  "  return vec2(decode_code(channel, u_value_range, u_sqrt), 1.0);",
  "}",
  "vec3 vector_sample(ivec2 position) {",
  "  vec2 channels = texelFetch(u_data, position, 0).rg;",
  "  vec2 codes = floor(channels * 255.0 + 0.5);",
  "  if (codes.r < 0.5 || codes.g < 0.5) return vec3(0.0);",
  "  return vec3(",
  "    decode_code(channels.r, u_component_range, false),",
  "    decode_code(channels.g, u_component_range, false),",
  "    1.0",
  "  );",
  "}",
  "void main() {",
  "  float longitude = v_mercator.x * 360.0 - 180.0;",
  "  float latitude = degrees(2.0 * atan(exp((0.5 - v_mercator.y) * 2.0 * PI)) - PI / 2.0);",
  "  vec2 uv = vec2(",
  "    (longitude - u_bounds.x) / (u_bounds.z - u_bounds.x),",
  "    (latitude - u_bounds.y) / (u_bounds.w - u_bounds.y)",
  "  );",
  "  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) discard;",
  "  vec2 grid = uv * vec2(u_grid_size - ivec2(1));",
  "  ivec2 low = ivec2(floor(grid));",
  "  ivec2 high = min(low + ivec2(1), u_grid_size - ivec2(1));",
  "  vec2 fraction = fract(grid);",
  "  vec4 weights = vec4(",
  "    (1.0 - fraction.x) * (1.0 - fraction.y),",
  "    fraction.x * (1.0 - fraction.y),",
  "    (1.0 - fraction.x) * fraction.y,",
  "    fraction.x * fraction.y",
  "  );",
  "  float value = 0.0;",
  "  float valid_weight = 0.0;",
  "  if (u_kind == 0) {",
  "    vec2 s0 = scalar_sample(ivec2(low.x, low.y));",
  "    vec2 s1 = scalar_sample(ivec2(high.x, low.y));",
  "    vec2 s2 = scalar_sample(ivec2(low.x, high.y));",
  "    vec2 s3 = scalar_sample(ivec2(high.x, high.y));",
  "    value = dot(vec4(s0.x, s1.x, s2.x, s3.x), weights * vec4(s0.y, s1.y, s2.y, s3.y));",
  "    valid_weight = dot(weights, vec4(s0.y, s1.y, s2.y, s3.y));",
  "  } else {",
  "    vec3 s0 = vector_sample(ivec2(low.x, low.y));",
  "    vec3 s1 = vector_sample(ivec2(high.x, low.y));",
  "    vec3 s2 = vector_sample(ivec2(low.x, high.y));",
  "    vec3 s3 = vector_sample(ivec2(high.x, high.y));",
  "    vec4 validity = vec4(s0.z, s1.z, s2.z, s3.z);",
  "    vec4 valid_weights = weights * validity;",
  "    valid_weight = dot(weights, validity);",
  "    vec2 vector_value = vec2(",
  "      dot(vec4(s0.x, s1.x, s2.x, s3.x), valid_weights),",
  "      dot(vec4(s0.y, s1.y, s2.y, s3.y), valid_weights)",
  "    );",
  "    if (valid_weight > 0.0) vector_value /= valid_weight;",
  "    value = length(vector_value);",
  "  }",
  "  if (valid_weight <= 0.0) discard;",
  "  if (u_kind == 0) value /= valid_weight;",
  "  float palette_x = clamp((value - u_palette_range.x) / (u_palette_range.y - u_palette_range.x), 0.0, 1.0);",
  "  vec4 color = texture(u_palette, vec2(palette_x, 0.5));",
  "  float alpha = color.a * u_opacity;",
  "  frag_color = vec4(color.rgb * alpha, alpha);",
  "}"
].join("\n");

export class RegularGridWeatherLayer implements WeatherCustomLayer {
  readonly type = "custom" as const;
  readonly renderingMode = "2d" as const;
  readonly id: string;

  #repaint: (() => void) | null = null;
  #gl: WebGL2RenderingContext | null = null;
  #program: WebGLProgram | null = null;
  #buffer: WebGLBuffer | null = null;
  #vertexArray: WebGLVertexArrayObject | null = null;
  #dataTexture: WebGLTexture | null = null;
  #paletteTexture: WebGLTexture | null = null;
  #frame: WeatherRenderFrame | null = null;
  #opacity: number;
  #visible: boolean;

  constructor(id: string, opacity: number, visible: boolean) {
    this.id = id;
    this.#opacity = opacity;
    this.#visible = visible;
  }

  setRepaint(repaint: (() => void) | null): void {
    this.#repaint = repaint;
  }

  setFrame(frame: WeatherRenderFrame): void {
    this.#frame = frame;
    const gl = this.#gl;
    if (gl !== null && this.#program !== null) {
      this.#withPreservedState(gl, () => {
        this.#uploadFrame(gl, frame);
      }, true);
    }
    this.#repaint?.();
  }

  setOpacity(opacity: number): void {
    this.#opacity = opacity;
    this.#repaint?.();
  }

  setVisible(visible: boolean): void {
    this.#visible = visible;
    this.#repaint?.();
  }

  setPalette(palette: WeatherPalette): void {
    if (this.#frame === null) {
      return;
    }
    this.#frame = { ...this.#frame, palette };
    const gl = this.#gl;
    if (gl !== null) {
      this.#withPreservedState(gl, () => {
        this.#uploadPalette(gl, palette);
      }, true);
    }
    this.#repaint?.();
  }

  onAdd(_map: unknown, gl: WebGL2RenderingContext): void {
    if (typeof gl.texStorage2D !== "function") {
      throw new WeatherLayersError(
        "WEBGL2_UNSUPPORTED",
        "Pigeon Weather Layers requires WebGL2"
      );
    }

    this.#gl = gl;
    try {
      this.#program = this.#createProgram(gl);
      this.#buffer = gl.createBuffer();
      this.#vertexArray = gl.createVertexArray();
      this.#dataTexture = gl.createTexture();
      this.#paletteTexture = gl.createTexture();

      if (
        this.#buffer === null ||
        this.#vertexArray === null ||
        this.#dataTexture === null ||
        this.#paletteTexture === null
      ) {
        throw new WeatherLayersError(
          "WEBGL2_UNSUPPORTED",
          "Unable to allocate WebGL2 resources"
        );
      }

      const frame = this.#frame;
      if (frame !== null) {
        this.#withPreservedState(gl, () => {
          this.#uploadFrame(gl, frame);
        }, true);
      }
    } catch (error) {
      this.#release(gl);
      this.#gl = null;
      throw error;
    }
  }

  render(gl: WebGL2RenderingContext, options: WeatherRenderOptions): void {
    const program = this.#program;
    const buffer = this.#buffer;
    const vertexArray = this.#vertexArray;
    const dataTexture = this.#dataTexture;
    const paletteTexture = this.#paletteTexture;
    const frame = this.#frame;
    if (
      !this.#visible ||
      frame === null ||
      program === null ||
      buffer === null ||
      vertexArray === null ||
      dataTexture === null ||
      paletteTexture === null
    ) {
      return;
    }

    const matrix = this.#normalizeMatrix(
      options.defaultProjectionData?.mainMatrix ??
        options.modelViewProjectionMatrix
    );
    if (matrix === null) {
      return;
    }

    this.#withPreservedState(gl, () => {
      gl.useProgram(program);
      gl.bindVertexArray(vertexArray);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);

      const position = gl.getAttribLocation(program, "a_position");
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

      this.#uniformMatrix(gl, "u_matrix", matrix);
      this.#uniform2i(gl, "u_grid_size", frame.asset.width, frame.asset.height);
      this.#uniform4f(gl, "u_bounds", ...frame.bounds);
      this.#uniform1f(gl, "u_opacity", this.#opacity);
      this.#uniform1i(gl, "u_kind", frame.layer.kind === "scalar" ? 0 : 1);
      this.#uniform1i(
        gl,
        "u_sqrt",
        frame.layer.kind === "scalar" &&
          frame.layer.encoding.type === "scalar-png-r8-sqrt-v1"
          ? 1
          : 0
      );

      if (frame.layer.kind === "scalar") {
        this.#uniform2f(gl, "u_value_range", ...frame.layer.encoding.valueRange);
        this.#uniform2f(gl, "u_component_range", -1, 1);
      } else {
        this.#uniform2f(gl, "u_value_range", 0, 1);
        this.#uniform2f(
          gl,
          "u_component_range",
          ...frame.layer.encoding.componentRange
        );
      }
      this.#uniform2f(gl, "u_palette_range", ...frame.palette.valueRange);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, dataTexture);
      this.#uniform1i(gl, "u_data", 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, paletteTexture);
      this.#uniform1i(gl, "u_palette", 1);

      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    });
  }

  onRemove(_map: unknown, gl: WebGL2RenderingContext): void {
    this.#release(gl);
    this.#gl = null;
  }

  #uploadFrame(
    gl: WebGL2RenderingContext,
    frame: WeatherRenderFrame
  ): void {
    if (
      this.#buffer === null ||
      this.#dataTexture === null ||
      this.#paletteTexture === null
    ) {
      return;
    }

    const [west, south, east, north] = frame.bounds;
    const vertices = new Float32Array([
      this.#mercatorX(west),
      this.#mercatorY(south),
      this.#mercatorX(east),
      this.#mercatorY(south),
      this.#mercatorX(west),
      this.#mercatorY(north),
      this.#mercatorX(east),
      this.#mercatorY(north)
    ]);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.#buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    this.#prepareTextureUpload(gl);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.#dataTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    if (frame.asset.channels === 1) {
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.R8,
        frame.asset.width,
        frame.asset.height,
        0,
        gl.RED,
        gl.UNSIGNED_BYTE,
        frame.asset.codes
      );
    } else {
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RG8,
        frame.asset.width,
        frame.asset.height,
        0,
        gl.RG,
        gl.UNSIGNED_BYTE,
        frame.asset.codes
      );
    }

    this.#uploadPalette(gl, frame.palette);
  }

  #uploadPalette(
    gl: WebGL2RenderingContext,
    palette: WeatherPalette
  ): void {
    if (this.#paletteTexture === null) {
      return;
    }
    this.#prepareTextureUpload(gl);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.#paletteTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      256,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      createPaletteTextureData(palette)
    );
  }

  #createProgram(gl: WebGL2RenderingContext): WebGLProgram {
    const vertex = this.#compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    let fragment: WebGLShader | null = null;
    let program: WebGLProgram | null = null;

    try {
      fragment = this.#compileShader(
        gl,
        gl.FRAGMENT_SHADER,
        FRAGMENT_SHADER
      );
      program = gl.createProgram();
      if (program === null) {
        throw new WeatherLayersError(
          "WEBGL2_UNSUPPORTED",
          "Unable to create WebGL program"
        );
      }
      gl.attachShader(program, vertex);
      gl.attachShader(program, fragment);
      gl.linkProgram(program);

      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        const message = gl.getProgramInfoLog(program) ?? "unknown link error";
        throw new WeatherLayersError(
          "WEBGL2_UNSUPPORTED",
          "Unable to link weather shader: " + message
        );
      }
      return program;
    } catch (error) {
      if (program !== null) {
        gl.deleteProgram(program);
      }
      throw error;
    } finally {
      gl.deleteShader(vertex);
      if (fragment !== null) {
        gl.deleteShader(fragment);
      }
    }
  }

  #compileShader(
    gl: WebGL2RenderingContext,
    type: number,
    source: string
  ): WebGLShader {
    const shader = gl.createShader(type);
    if (shader === null) {
      throw new WeatherLayersError(
        "WEBGL2_UNSUPPORTED",
        "Unable to create weather shader"
      );
    }
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const message = gl.getShaderInfoLog(shader) ?? "unknown compile error";
      gl.deleteShader(shader);
      throw new WeatherLayersError(
        "WEBGL2_UNSUPPORTED",
        "Unable to compile weather shader: " + message
      );
    }
    return shader;
  }

  #release(gl: WebGL2RenderingContext): void {
    if (this.#program !== null) gl.deleteProgram(this.#program);
    if (this.#buffer !== null) gl.deleteBuffer(this.#buffer);
    if (this.#vertexArray !== null) gl.deleteVertexArray(this.#vertexArray);
    if (this.#dataTexture !== null) gl.deleteTexture(this.#dataTexture);
    if (this.#paletteTexture !== null) gl.deleteTexture(this.#paletteTexture);
    this.#program = null;
    this.#buffer = null;
    this.#vertexArray = null;
    this.#dataTexture = null;
    this.#paletteTexture = null;
  }

  #withPreservedState(
    gl: WebGL2RenderingContext,
    operation: () => void,
    preservePixelUnpackState = false
  ): void {
    const state = this.#captureState(gl);
    const pixelUnpackState = preservePixelUnpackState
      ? this.#capturePixelUnpackState(gl)
      : null;
    try {
      operation();
    } finally {
      this.#restoreState(gl, state);
      if (pixelUnpackState !== null) {
        this.#restorePixelUnpackState(gl, pixelUnpackState);
      }
    }
  }

  #captureState(gl: WebGL2RenderingContext): WeatherGlState {
    const activeTexture = gl.getParameter(gl.ACTIVE_TEXTURE) as number;
    gl.activeTexture(gl.TEXTURE0);
    const texture0 = gl.getParameter(gl.TEXTURE_BINDING_2D) as WebGLTexture | null;
    gl.activeTexture(gl.TEXTURE1);
    const texture1 = gl.getParameter(gl.TEXTURE_BINDING_2D) as WebGLTexture | null;
    gl.activeTexture(activeTexture);

    return {
      activeTexture,
      arrayBuffer: gl.getParameter(gl.ARRAY_BUFFER_BINDING) as WebGLBuffer | null,
      blendEnabled: gl.isEnabled(gl.BLEND),
      blendDestinationAlpha: gl.getParameter(gl.BLEND_DST_ALPHA) as number,
      blendDestinationRgb: gl.getParameter(gl.BLEND_DST_RGB) as number,
      blendSourceAlpha: gl.getParameter(gl.BLEND_SRC_ALPHA) as number,
      blendSourceRgb: gl.getParameter(gl.BLEND_SRC_RGB) as number,
      program: gl.getParameter(gl.CURRENT_PROGRAM) as WebGLProgram | null,
      texture0,
      texture1,
      vertexArray: gl.getParameter(
        gl.VERTEX_ARRAY_BINDING
      ) as WebGLVertexArrayObject | null
    };
  }

  #restoreState(gl: WebGL2RenderingContext, state: WeatherGlState): void {
    gl.useProgram(state.program);
    gl.bindVertexArray(state.vertexArray);
    gl.bindBuffer(gl.ARRAY_BUFFER, state.arrayBuffer);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, state.texture0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, state.texture1);
    gl.activeTexture(state.activeTexture);
    gl.blendFuncSeparate(
      state.blendSourceRgb,
      state.blendDestinationRgb,
      state.blendSourceAlpha,
      state.blendDestinationAlpha
    );
    if (state.blendEnabled) {
      gl.enable(gl.BLEND);
    } else {
      gl.disable(gl.BLEND);
    }
  }

  #capturePixelUnpackState(
    gl: WebGL2RenderingContext
  ): WeatherPixelUnpackState {
    return {
      alignment: gl.getParameter(gl.UNPACK_ALIGNMENT) as number,
      buffer: gl.getParameter(
        gl.PIXEL_UNPACK_BUFFER_BINDING
      ) as WebGLBuffer | null,
      colorSpaceConversion: gl.getParameter(
        gl.UNPACK_COLORSPACE_CONVERSION_WEBGL
      ) as number,
      flipY: gl.getParameter(gl.UNPACK_FLIP_Y_WEBGL) as boolean,
      imageHeight: gl.getParameter(gl.UNPACK_IMAGE_HEIGHT) as number,
      premultiplyAlpha: gl.getParameter(
        gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL
      ) as boolean,
      rowLength: gl.getParameter(gl.UNPACK_ROW_LENGTH) as number,
      skipImages: gl.getParameter(gl.UNPACK_SKIP_IMAGES) as number,
      skipPixels: gl.getParameter(gl.UNPACK_SKIP_PIXELS) as number,
      skipRows: gl.getParameter(gl.UNPACK_SKIP_ROWS) as number
    };
  }

  #restorePixelUnpackState(
    gl: WebGL2RenderingContext,
    state: WeatherPixelUnpackState
  ): void {
    gl.bindBuffer(gl.PIXEL_UNPACK_BUFFER, state.buffer);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, state.alignment);
    gl.pixelStorei(
      gl.UNPACK_COLORSPACE_CONVERSION_WEBGL,
      state.colorSpaceConversion
    );
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, state.flipY ? 1 : 0);
    gl.pixelStorei(gl.UNPACK_IMAGE_HEIGHT, state.imageHeight);
    gl.pixelStorei(
      gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,
      state.premultiplyAlpha ? 1 : 0
    );
    gl.pixelStorei(gl.UNPACK_ROW_LENGTH, state.rowLength);
    gl.pixelStorei(gl.UNPACK_SKIP_IMAGES, state.skipImages);
    gl.pixelStorei(gl.UNPACK_SKIP_PIXELS, state.skipPixels);
    gl.pixelStorei(gl.UNPACK_SKIP_ROWS, state.skipRows);
  }

  #prepareTextureUpload(gl: WebGL2RenderingContext): void {
    gl.bindBuffer(gl.PIXEL_UNPACK_BUFFER, null);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
    gl.pixelStorei(gl.UNPACK_IMAGE_HEIGHT, 0);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 0);
    gl.pixelStorei(gl.UNPACK_ROW_LENGTH, 0);
    gl.pixelStorei(gl.UNPACK_SKIP_IMAGES, 0);
    gl.pixelStorei(gl.UNPACK_SKIP_PIXELS, 0);
    gl.pixelStorei(gl.UNPACK_SKIP_ROWS, 0);
  }

  #mercatorX(longitude: number): number {
    return (longitude + 180) / 360;
  }

  #mercatorY(latitude: number): number {
    const clamped = Math.max(-85.051129, Math.min(85.051129, latitude));
    const radians = (clamped * Math.PI) / 180;
    return (
      (180 - (180 / Math.PI) * Math.log(Math.tan(Math.PI / 4 + radians / 2))) /
      360
    );
  }

  #uniformMatrix(
    gl: WebGL2RenderingContext,
    name: string,
    value: Float32Array
  ): void {
    gl.uniformMatrix4fv(this.#uniform(gl, name), false, value);
  }

  #normalizeMatrix(value: unknown): Float32Array | null {
    if (value instanceof Float32Array && value.length === 16) {
      return value;
    }
    if (value instanceof Float64Array && value.length === 16) {
      return new Float32Array(value);
    }
    if (
      Array.isArray(value) &&
      value.length === 16 &&
      value.every((entry) => typeof entry === "number")
    ) {
      return new Float32Array(value);
    }
    return null;
  }

  #uniform1i(gl: WebGL2RenderingContext, name: string, value: number): void {
    gl.uniform1i(this.#uniform(gl, name), value);
  }

  #uniform1f(gl: WebGL2RenderingContext, name: string, value: number): void {
    gl.uniform1f(this.#uniform(gl, name), value);
  }

  #uniform2i(
    gl: WebGL2RenderingContext,
    name: string,
    first: number,
    second: number
  ): void {
    gl.uniform2i(this.#uniform(gl, name), first, second);
  }

  #uniform2f(
    gl: WebGL2RenderingContext,
    name: string,
    first: number,
    second: number
  ): void {
    gl.uniform2f(this.#uniform(gl, name), first, second);
  }

  #uniform4f(
    gl: WebGL2RenderingContext,
    name: string,
    first: number,
    second: number,
    third: number,
    fourth: number
  ): void {
    gl.uniform4f(this.#uniform(gl, name), first, second, third, fourth);
  }

  #uniform(
    gl: WebGL2RenderingContext,
    name: string
  ): WebGLUniformLocation {
    if (this.#program === null) {
      throw new WeatherLayersError(
        "WEBGL2_UNSUPPORTED",
        "Weather shader is not initialized"
      );
    }
    const location = gl.getUniformLocation(this.#program, name);
    if (location === null) {
      throw new WeatherLayersError(
        "WEBGL2_UNSUPPORTED",
        "Weather shader uniform is missing: " + name
      );
    }
    return location;
  }
}
