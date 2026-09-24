export interface WeatherMapControl {
  onAdd(map: unknown): HTMLElement;
  onRemove(): void;
}
