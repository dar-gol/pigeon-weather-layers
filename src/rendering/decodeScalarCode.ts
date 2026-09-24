import type { ScalarWeatherEncoding } from "../manifest/ScalarWeatherEncoding.js";

export function decodeScalarCode(
  code: number,
  encoding: ScalarWeatherEncoding
): number | null {
  if (code === encoding.noDataCode) {
    return null;
  }

  const normalized = (code - 1) / 254;
  const transformed =
    encoding.type === "scalar-png-r8-sqrt-v1"
      ? normalized * normalized
      : normalized;
  return (
    encoding.valueRange[0] +
    transformed * (encoding.valueRange[1] - encoding.valueRange[0])
  );
}
