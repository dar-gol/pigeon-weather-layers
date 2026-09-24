import type { WeatherLayersSnapshot } from "../controller/WeatherLayersSnapshot.js";
import type { WeatherMapControl } from "../map/WeatherMapControl.js";
import type { WeatherControlMessages } from "./WeatherControlMessages.js";
import type { WeatherControlOptions } from "./WeatherControlOptions.js";

const DEFAULT_MESSAGES: WeatherControlMessages = {
  layer: "Weather layer",
  time: "Forecast time",
  opacity: "Opacity",
  play: "Play forecast",
  pause: "Pause forecast",
  loading: "Loading weather data",
  error: "Weather data is unavailable"
};

export class WeatherControl implements WeatherMapControl {
  readonly #controller: WeatherControlOptions["controller"];
  readonly #messages: WeatherControlMessages;
  readonly #playIntervalMs: number;
  readonly #className: string | undefined;

  #container: HTMLElement | null = null;
  #layerSelect: HTMLSelectElement | null = null;
  #timeInput: HTMLInputElement | null = null;
  #timeOutput: HTMLOutputElement | null = null;
  #opacityInput: HTMLInputElement | null = null;
  #playButton: HTMLButtonElement | null = null;
  #status: HTMLElement | null = null;
  #unsubscribe: (() => void) | null = null;
  #playTimer: ReturnType<typeof setInterval> | null = null;
  #changingTime = false;
  #manifestIdentity: string | null = null;

  constructor(options: WeatherControlOptions) {
    this.#controller = options.controller;
    this.#messages = { ...DEFAULT_MESSAGES, ...options.messages };
    this.#playIntervalMs = options.playIntervalMs ?? 900;
    this.#className = options.className;

    if (this.#playIntervalMs < 100) {
      throw new RangeError("Weather control playIntervalMs must be at least 100");
    }
  }

  onAdd(_map: unknown): HTMLElement {
    if (this.#container !== null) {
      return this.#container;
    }

    const container = document.createElement("section");
    container.className = [
      "maplibregl-ctrl",
      "pigeon-weather-control",
      this.#className
    ]
      .filter((value): value is string => value !== undefined && value !== "")
      .join(" ");
    container.setAttribute("aria-label", "Weather controls");
    container.addEventListener("click", this.#stopPropagation);
    container.addEventListener("dblclick", this.#stopPropagation);
    container.addEventListener("mousedown", this.#stopPropagation);

    this.#layerSelect = document.createElement("select");
    this.#layerSelect.addEventListener("change", this.#handleLayerChange);
    container.append(
      this.#createField(this.#messages.layer, this.#layerSelect)
    );

    this.#timeInput = document.createElement("input");
    this.#timeInput.type = "range";
    this.#timeInput.min = "0";
    this.#timeInput.step = "1";
    this.#timeInput.addEventListener("input", this.#handleTimeInput);
    this.#timeInput.addEventListener("change", this.#handleTimeChange);
    this.#timeOutput = document.createElement("output");
    const timeField = this.#createField(this.#messages.time, this.#timeInput);
    timeField.append(this.#timeOutput);
    container.append(timeField);

    this.#opacityInput = document.createElement("input");
    this.#opacityInput.type = "range";
    this.#opacityInput.min = "0";
    this.#opacityInput.max = "1";
    this.#opacityInput.step = "0.05";
    this.#opacityInput.addEventListener("input", this.#handleOpacityInput);
    container.append(
      this.#createField(this.#messages.opacity, this.#opacityInput)
    );

    this.#playButton = document.createElement("button");
    this.#playButton.type = "button";
    this.#playButton.className = "pigeon-weather-control__play";
    this.#playButton.addEventListener("click", this.#handlePlayClick);
    container.append(this.#playButton);

    this.#status = document.createElement("p");
    this.#status.className = "pigeon-weather-control__status";
    this.#status.setAttribute("aria-live", "polite");
    container.append(this.#status);

    this.#container = container;
    this.#renderManifest();
    this.#unsubscribe = this.#controller.subscribe(this.#renderSnapshot);
    return container;
  }

  onRemove(): void {
    this.#stopPlayback();
    this.#unsubscribe?.();
    this.#unsubscribe = null;
    this.#layerSelect?.removeEventListener("change", this.#handleLayerChange);
    this.#timeInput?.removeEventListener("input", this.#handleTimeInput);
    this.#timeInput?.removeEventListener("change", this.#handleTimeChange);
    this.#opacityInput?.removeEventListener("input", this.#handleOpacityInput);
    this.#playButton?.removeEventListener("click", this.#handlePlayClick);
    this.#container?.remove();
    this.#container = null;
    this.#layerSelect = null;
    this.#timeInput = null;
    this.#timeOutput = null;
    this.#opacityInput = null;
    this.#playButton = null;
    this.#status = null;
    this.#manifestIdentity = null;
  }

  #createField(labelText: string, input: HTMLElement): HTMLLabelElement {
    const label = document.createElement("label");
    label.className = "pigeon-weather-control__field";
    const text = document.createElement("span");
    text.textContent = labelText;
    label.append(text, input);
    return label;
  }

  #renderManifest(): void {
    const manifest = this.#controller.getManifest();
    if (manifest === null || this.#layerSelect === null || this.#timeInput === null) {
      return;
    }

    const identity = [
      manifest.datasetId,
      manifest.run.id,
      manifest.layers.map((layer) => layer.id).join(","),
      manifest.frames.map((frame) => frame.timeKey).join(",")
    ].join("|");
    if (identity === this.#manifestIdentity) {
      return;
    }
    this.#manifestIdentity = identity;

    this.#layerSelect.replaceChildren();
    for (const layer of manifest.layers) {
      const option = document.createElement("option");
      option.value = layer.id;
      option.textContent = layer.id + " (" + layer.unit + ")";
      this.#layerSelect.append(option);
    }
    this.#timeInput.max = String(manifest.frames.length - 1);
  }

  readonly #renderSnapshot = (snapshot: WeatherLayersSnapshot): void => {
    this.#renderManifest();
    const manifest = this.#controller.getManifest();

    if (
      this.#layerSelect !== null &&
      snapshot.layerId !== null &&
      snapshot.status !== "loading"
    ) {
      this.#layerSelect.value = snapshot.layerId;
    }
    if (this.#opacityInput !== null) {
      this.#opacityInput.value = String(snapshot.opacity);
    }
    if (manifest !== null && this.#timeInput !== null) {
      const index = manifest.frames.findIndex(
        (frame) => frame.validTime === snapshot.resolvedTime
      );
      if (index >= 0 && !this.#changingTime && snapshot.status !== "loading") {
        this.#timeInput.value = String(index);
      }
      this.#renderTimeOutput(Number(this.#timeInput.value));
    }
    if (this.#status !== null) {
      this.#status.textContent =
        snapshot.status === "loading"
          ? this.#messages.loading
          : snapshot.status === "error"
            ? this.#messages.error
            : "";
    }
    if (this.#container !== null) {
      this.#container.setAttribute(
        "aria-busy",
        snapshot.status === "loading" ? "true" : "false"
      );
    }
    this.#renderPlayButton();
  };

  readonly #handleLayerChange = (): void => {
    const layerId = this.#layerSelect?.value;
    if (layerId !== undefined) {
      void this.#controller.setLayer(layerId).catch(() => undefined);
    }
  };

  readonly #handleTimeInput = (): void => {
    this.#changingTime = true;
    this.#renderTimeOutput(Number(this.#timeInput?.value ?? 0));
  };

  readonly #handleTimeChange = (): void => {
    this.#changingTime = false;
    const frame = this.#frameAt(Number(this.#timeInput?.value ?? 0));
    if (frame !== undefined) {
      void this.#controller.setTime(frame.validTime).catch(() => undefined);
    }
  };

  readonly #handleOpacityInput = (): void => {
    this.#controller.setOpacity(Number(this.#opacityInput?.value ?? 1));
  };

  readonly #handlePlayClick = (): void => {
    if (this.#playTimer === null) {
      this.#startPlayback();
    } else {
      this.#stopPlayback();
    }
  };

  #startPlayback(): void {
    this.#playTimer = setInterval(() => {
      if (this.#controller.getSnapshot().status === "loading") {
        return;
      }
      const manifest = this.#controller.getManifest();
      if (manifest === null || manifest.frames.length === 0) {
        this.#stopPlayback();
        return;
      }
      const current = Number(this.#timeInput?.value ?? 0);
      const next = (current + 1) % manifest.frames.length;
      const frame = manifest.frames[next];
      if (frame !== undefined) {
        void this.#controller.setTime(frame.validTime).catch(() => {
          this.#stopPlayback();
        });
      }
    }, this.#playIntervalMs);
    this.#renderPlayButton();
  }

  #stopPlayback(): void {
    if (this.#playTimer !== null) {
      clearInterval(this.#playTimer);
      this.#playTimer = null;
    }
    this.#renderPlayButton();
  }

  #renderPlayButton(): void {
    if (this.#playButton === null) {
      return;
    }
    const playing = this.#playTimer !== null;
    this.#playButton.textContent = playing ? "❚❚" : "▶";
    this.#playButton.setAttribute(
      "aria-label",
      playing ? this.#messages.pause : this.#messages.play
    );
    this.#playButton.title = playing
      ? this.#messages.pause
      : this.#messages.play;
  }

  #renderTimeOutput(index: number): void {
    if (this.#timeOutput === null) {
      return;
    }
    const frame = this.#frameAt(index);
    this.#timeOutput.textContent =
      frame === undefined
        ? ""
        : new Intl.DateTimeFormat(undefined, {
            dateStyle: "short",
            timeStyle: "short"
          }).format(new Date(frame.validTime));
  }

  #frameAt(index: number) {
    return this.#controller.getManifest()?.frames[index];
  }

  readonly #stopPropagation = (event: Event): void => {
    event.stopPropagation();
  };
}
