// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import { WeatherControl } from "../src/control/WeatherControl.js";
import type { WeatherLayersController } from "../src/controller/WeatherLayersController.js";
import type { WeatherLayersSnapshot } from "../src/controller/WeatherLayersSnapshot.js";
import { createWeatherManifest } from "./fixtures/createWeatherManifest.js";

describe("WeatherControl", () => {
  it("renders manifest choices and forwards user changes", () => {
    const manifest = createWeatherManifest();
    const snapshot: WeatherLayersSnapshot = {
      status: "ready",
      layerId: "temperature",
      requestedTime: "latest",
      resolvedTime: manifest.frames[0]?.validTime ?? null,
      runId: manifest.run.id,
      visible: true,
      opacity: 0.7,
      attributions: manifest.attributions,
      error: null
    };
    const setLayer = vi.fn<WeatherLayersController["setLayer"]>().mockResolvedValue();
    const setTime = vi.fn<WeatherLayersController["setTime"]>().mockResolvedValue({
      requestedTime: "2026-09-24T03:00:00.000Z",
      resolvedTime: "2026-09-24T03:00:00Z",
      timeKey: "f003"
    });
    const setOpacity = vi.fn<WeatherLayersController["setOpacity"]>();
    const controller: WeatherLayersController = {
      attach: vi.fn(),
      setLayer,
      setTime,
      setOpacity,
      setVisible: vi.fn(),
      setPalette: vi.fn(),
      getLegend: vi.fn(),
      getValueAt: vi.fn(),
      getManifest: () => manifest,
      getSnapshot: () => snapshot,
      subscribe(listener) {
        listener(snapshot);
        return () => undefined;
      },
      refresh: vi.fn(),
      destroy: vi.fn()
    };
    const control = new WeatherControl({ controller });
    const element = control.onAdd(undefined);
    const selects = element.querySelectorAll("select");
    const ranges = element.querySelectorAll<HTMLInputElement>('input[type="range"]');

    expect(selects[0]?.options).toHaveLength(2);
    if (selects[0] !== undefined) {
      selects[0].value = "wind";
      selects[0].dispatchEvent(new Event("change"));
    }
    if (ranges[0] !== undefined) {
      ranges[0].value = "1";
      ranges[0].dispatchEvent(new Event("change"));
    }
    if (ranges[1] !== undefined) {
      ranges[1].value = "0.4";
      ranges[1].dispatchEvent(new Event("input"));
    }

    expect(setLayer).toHaveBeenCalledWith("wind");
    expect(setTime).toHaveBeenCalledWith("2026-09-24T03:00:00Z");
    expect(setOpacity).toHaveBeenCalledWith(0.4);

    control.onRemove();
    expect(element.isConnected).toBe(false);
  });
});
