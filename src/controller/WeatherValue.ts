import type { ScalarWeatherValue } from "./ScalarWeatherValue.js";
import type { VectorWeatherValue } from "./VectorWeatherValue.js";

export type WeatherValue = ScalarWeatherValue | VectorWeatherValue;
