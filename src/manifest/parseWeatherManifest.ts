import { Ajv2020 } from "ajv/dist/2020.js";
import { WeatherLayersError } from "../error/WeatherLayersError.js";
import type { WeatherManifest } from "./WeatherManifest.js";
import { getWeatherManifestSemanticErrors } from "./getWeatherManifestSemanticErrors.js";
import { weatherManifestSchema } from "./weatherManifestSchema.js";

const ajv = new Ajv2020({
  allErrors: true,
  strict: true,
  validateFormats: false
});
const validateSchema = ajv.compile<WeatherManifest>(weatherManifestSchema);

export function parseWeatherManifest(value: unknown): WeatherManifest {
  if (!validateSchema(value)) {
    const detail = ajv.errorsText(validateSchema.errors, {
      separator: "; "
    });
    throw new WeatherLayersError(
      "MANIFEST_INVALID",
      "Weather manifest failed schema validation: " + detail
    );
  }

  const semanticErrors = getWeatherManifestSemanticErrors(value);
  if (semanticErrors.length > 0) {
    throw new WeatherLayersError(
      "MANIFEST_INVALID",
      "Weather manifest failed semantic validation: " +
        semanticErrors.join("; ")
    );
  }

  return value;
}
