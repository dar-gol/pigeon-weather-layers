import type { WeatherPalette } from "../controller/WeatherPalette.js";

const PALETTE_SIZE = 256;

export function createPaletteTextureData(
  palette: WeatherPalette
): Uint8Array {
  if (palette.stops.length < 2) {
    throw new RangeError("A weather palette requires at least two stops");
  }

  const stops = [...palette.stops].sort((left, right) => left.value - right.value);
  const data = new Uint8Array(PALETTE_SIZE * 4);
  const [minimum, maximum] = palette.valueRange;

  for (let index = 0; index < PALETTE_SIZE; index += 1) {
    const value = minimum + (index / (PALETTE_SIZE - 1)) * (maximum - minimum);
    const rightIndex = stops.findIndex((stop) => stop.value >= value);
    const last = stops[stops.length - 1];
    const right = rightIndex < 0 ? last : stops[rightIndex];
    const left =
      rightIndex < 0
        ? last
        : rightIndex === 0
          ? right
          : stops[rightIndex - 1];

    if (left === undefined || right === undefined) {
      throw new RangeError("Weather palette contains no usable stops");
    }

    const span = right.value - left.value;
    const ratio = span === 0 ? 0 : (value - left.value) / span;
    const offset = index * 4;

    for (let channel = 0; channel < 4; channel += 1) {
      const leftValue = left.color[channel] ?? 0;
      const rightValue = right.color[channel] ?? 0;
      data[offset + channel] = Math.round(
        leftValue + (rightValue - leftValue) * ratio
      );
    }
  }

  return data;
}
