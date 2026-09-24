import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  testMatch: "**/*.e2e.ts",
  fullyParallel: false,
  use: {
    baseURL: "http://127.0.0.1:4174/tests/browser/",
    browserName: "chromium",
    launchOptions: {
      args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"]
    }
  },
  webServer: {
    command: "npm run test:browser:serve",
    url: "http://127.0.0.1:4174/tests/browser/index.html",
    reuseExistingServer: process.env.CI !== "true"
  }
});
