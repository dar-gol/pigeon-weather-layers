import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { weatherManifestSchema } from "../dist/manifest/weatherManifestSchema.js";

await writeFile(
  resolve("dist/weather-manifest-v1.schema.json"),
  JSON.stringify(weatherManifestSchema, null, 2) + "\n",
  "utf8"
);
