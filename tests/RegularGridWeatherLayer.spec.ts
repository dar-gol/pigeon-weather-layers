import { describe, expect, it, vi } from "vitest";
import { RegularGridWeatherLayer } from "../src/rendering/RegularGridWeatherLayer.js";

describe("RegularGridWeatherLayer", () => {
  it("deletes both shaders when fragment compilation fails", () => {
    const vertexShader = { id: "vertex" };
    const fragmentShader = { id: "fragment" };
    const deleteShader = vi.fn();
    const gl = {
      texStorage2D() {},
      VERTEX_SHADER: 1,
      FRAGMENT_SHADER: 2,
      COMPILE_STATUS: 3,
      createShader: vi
        .fn()
        .mockReturnValueOnce(vertexShader)
        .mockReturnValueOnce(fragmentShader),
      shaderSource: vi.fn(),
      compileShader: vi.fn(),
      getShaderParameter: vi.fn((shader) => shader === vertexShader),
      getShaderInfoLog: vi.fn(() => "fragment failed"),
      deleteShader
    };
    const layer = new RegularGridWeatherLayer("weather", 1, true);

    expect(() => Reflect.apply(layer.onAdd, layer, [undefined, gl])).toThrow(
      "Unable to compile weather shader"
    );
    expect(deleteShader).toHaveBeenCalledWith(fragmentShader);
    expect(deleteShader).toHaveBeenCalledWith(vertexShader);
  });

  it("releases resources when allocation is incomplete", () => {
    const vertexShader = { id: "vertex" };
    const fragmentShader = { id: "fragment" };
    const program = { id: "program" };
    const buffer = { id: "buffer" };
    const vertexArray = { id: "vertex-array" };
    const dataTexture = { id: "data-texture" };
    const deleteProgram = vi.fn();
    const deleteBuffer = vi.fn();
    const deleteVertexArray = vi.fn();
    const deleteTexture = vi.fn();
    const gl = {
      texStorage2D() {},
      VERTEX_SHADER: 1,
      FRAGMENT_SHADER: 2,
      COMPILE_STATUS: 3,
      LINK_STATUS: 4,
      createShader: vi
        .fn()
        .mockReturnValueOnce(vertexShader)
        .mockReturnValueOnce(fragmentShader),
      shaderSource: vi.fn(),
      compileShader: vi.fn(),
      getShaderParameter: vi.fn(() => true),
      getShaderInfoLog: vi.fn(),
      deleteShader: vi.fn(),
      createProgram: vi.fn(() => program),
      attachShader: vi.fn(),
      linkProgram: vi.fn(),
      getProgramParameter: vi.fn(() => true),
      getProgramInfoLog: vi.fn(),
      deleteProgram,
      createBuffer: vi.fn(() => buffer),
      createVertexArray: vi.fn(() => vertexArray),
      createTexture: vi
        .fn()
        .mockReturnValueOnce(dataTexture)
        .mockReturnValueOnce(null),
      deleteBuffer,
      deleteVertexArray,
      deleteTexture
    };
    const layer = new RegularGridWeatherLayer("weather", 1, true);

    expect(() => Reflect.apply(layer.onAdd, layer, [undefined, gl])).toThrow(
      "Unable to allocate WebGL2 resources"
    );
    expect(deleteProgram).toHaveBeenCalledWith(program);
    expect(deleteBuffer).toHaveBeenCalledWith(buffer);
    expect(deleteVertexArray).toHaveBeenCalledWith(vertexArray);
    expect(deleteTexture).toHaveBeenCalledWith(dataTexture);
  });
});
