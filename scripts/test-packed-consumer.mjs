import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const workspace = await mkdtemp(join(tmpdir(), "pigeon-weather-consumer-"));

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed\n${result.stdout}${result.stderr}`
    );
  }
  return result.stdout;
}

try {
  const packOutput = run(
    "npm",
    ["pack", "--json", "--pack-destination", workspace],
    process.cwd()
  );
  const packed = JSON.parse(packOutput);
  const filename = packed[0]?.filename;
  if (typeof filename !== "string") {
    throw new Error("npm pack did not return an artifact filename");
  }

  await writeFile(
    join(workspace, "package.json"),
    JSON.stringify({ private: true, type: "module" })
  );
  run(
    "npm",
    [
      "install",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      join(workspace, filename)
    ],
    workspace
  );

  const consumerCheck = `
    import { readFile, stat } from "node:fs/promises";
    import { fileURLToPath } from "node:url";

    const api = await import("@pigeonmap/weather-layers");
    const control = await import("@pigeonmap/weather-layers/control");
    if (typeof api.addWeatherLayers !== "function") throw new Error("missing addWeatherLayers");
    if (typeof api.createWeatherLayers !== "function") throw new Error("missing createWeatherLayers");
    if (typeof api.parseWeatherManifest !== "function") throw new Error("missing parseWeatherManifest");
    if (typeof control.WeatherControl !== "function") throw new Error("missing WeatherControl");
    if ("DefaultWeatherLayersController" in api || "BrowserWeatherAssetDecoder" in api) {
      throw new Error("internal classes leaked from the package root");
    }

    const schemaPath = fileURLToPath(
      import.meta.resolve("@pigeonmap/weather-layers/weather-manifest-v1.schema.json")
    );
    const schema = JSON.parse(await readFile(schemaPath, "utf8"));
    if (schema.properties?.schemaVersion?.const !== 1) throw new Error("invalid packaged schema");

    const cssPath = fileURLToPath(
      import.meta.resolve("@pigeonmap/weather-layers/control.css")
    );
    if ((await stat(cssPath)).size === 0) throw new Error("empty packaged control CSS");
  `;
  run(process.execPath, ["--input-type=module", "--eval", consumerCheck], workspace);
  process.stdout.write("Packed package consumer contract passed\n");
} finally {
  await rm(workspace, { recursive: true, force: true });
}
