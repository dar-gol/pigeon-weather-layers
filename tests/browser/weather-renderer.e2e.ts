import { expect, test } from "@playwright/test";

test("decodes real PNGs and renders scalar and vector textures in WebGL2", async ({
  page
}) => {
  await page.goto("index.html");

  const result = await page.evaluate(() => window.runWeatherBrowserContract());

  expect(result.scalarCodes).toEqual([1, 64, 128, 255]);
  expect(result.vectorCodes).toEqual([1, 2, 64, 65, 128, 129, 255, 254]);
  expect(result.scalarCorners.southWest[0]).toBeGreaterThan(
    result.scalarCorners.southWest[1] ?? 0
  );
  expect(result.scalarCorners.southEast[1]).toBeGreaterThan(
    result.scalarCorners.southEast[0] ?? 0
  );
  expect(result.scalarCorners.northWest[2]).toBeGreaterThan(
    result.scalarCorners.northWest[0] ?? 0
  );
  expect(Math.min(...result.scalarCorners.northEast.slice(0, 3))).toBeGreaterThan(
    200
  );
  expect(result.noDataAlpha).toBe(0);
  expect(result.vectorCorners.southWest[0]).toBeGreaterThan(
    result.vectorCorners.southEast[0] ?? 255
  );
  expect(result.vectorCorners.southEast[0]).toBeGreaterThan(
    result.vectorCorners.northWest[0] ?? 255
  );
  expect(result.vectorCorners.northEast[0]).toBeGreaterThan(
    result.vectorCorners.southEast[0] ?? 255
  );
  expect(result.vectorCorners.northEast[3]).toBeGreaterThan(0);
  expect(result.vectorNoDataAlpha).toBe(0);
  expect(result.glStateRestored).toBe(true);
  expect(result.glError).toBe(0);
});

test("attaches through the public API to a real MapLibre map", async ({ page }) => {
  await page.goto("index.html");

  const result = await page.evaluate(() =>
    window.runMapLibreIntegrationContract()
  );

  expect(result.layerAttached).toBe(true);
  expect(result.layerRemoved).toBe(true);
  expect(result.attributionText).toBe("Browser fixture");
  expect(result.sampledValue).not.toBeNull();
  expect(["ready", "stale"]).toContain(result.status);
});
