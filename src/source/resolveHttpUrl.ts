export function resolveHttpUrl(
  value: string | URL,
  baseUrl?: string | URL
): URL {
  if (value instanceof URL) {
    return value;
  }

  const base =
    baseUrl ??
    (typeof globalThis.location === "undefined"
      ? undefined
      : globalThis.location.href);

  if (base === undefined) {
    return new URL(value);
  }

  return new URL(value, base);
}
