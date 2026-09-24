export const STRICT_UTC_TIMESTAMP_PATTERN =
  "^[0-9]{4}-(0[1-9]|1[0-2])-([0-2][0-9]|3[01])T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](\\.[0-9]+)?Z$";

const strictUtcTimestamp = new RegExp(STRICT_UTC_TIMESTAMP_PATTERN);

export function isStrictUtcTimestamp(value: string): boolean {
  const match = strictUtcTimestamp.exec(value);
  if (match === null) {
    return false;
  }

  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    return false;
  }

  const date = new Date(timestamp);
  const [datePart, timePart] = value.split("T");
  const [year, month, day] = (datePart ?? "").split("-").map(Number);
  const [hour, minute, secondWithFraction] = (timePart ?? "")
    .replace(/Z$/, "")
    .split(":");
  const second = Number(secondWithFraction?.split(".")[0]);

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() + 1 === month &&
    date.getUTCDate() === day &&
    date.getUTCHours() === Number(hour) &&
    date.getUTCMinutes() === Number(minute) &&
    date.getUTCSeconds() === second
  );
}
