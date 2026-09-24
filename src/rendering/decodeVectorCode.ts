import type { VectorWeatherEncoding } from "../manifest/VectorWeatherEncoding.js";

export function decodeVectorCode(
  code: number,
  encoding: VectorWeatherEncoding
): number | null {
  if (code === encoding.noDataCode) {
    return null;
  }

  return (
    encoding.componentRange[0] +
    ((code - 1) / 254) *
      (encoding.componentRange[1] - encoding.componentRange[0])
  );
}
