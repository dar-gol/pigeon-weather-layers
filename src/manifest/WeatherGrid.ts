export interface WeatherGrid {
  readonly width: number;
  readonly height: number;
  readonly longitudeStep: number;
  readonly latitudeStep: number;
  readonly xDirection: "west-to-east";
  readonly yDirection: "south-to-north";
}
