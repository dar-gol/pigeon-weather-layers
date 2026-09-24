import { describe, expect, it } from "vitest";
import { createPaletteTextureData } from "../src/palette/createPaletteTextureData.js";

describe("createPaletteTextureData", () => {
  it("clamps colors after the final stop", () => {
    const data = createPaletteTextureData({
      id: "clamped",
      valueRange: [0, 100],
      stops: [
        { value: 0, color: [255, 0, 0, 255] },
        { value: 50, color: [0, 0, 255, 255] }
      ]
    });

    expect([...data.slice(255 * 4, 256 * 4)]).toEqual([0, 0, 255, 255]);
  });

  it("clamps colors before the first stop", () => {
    const data = createPaletteTextureData({
      id: "clamped",
      valueRange: [-100, 0],
      stops: [
        { value: -50, color: [255, 0, 0, 255] },
        { value: 0, color: [0, 0, 255, 255] }
      ]
    });

    expect([...data.slice(0, 4)]).toEqual([255, 0, 0, 255]);
  });
});
