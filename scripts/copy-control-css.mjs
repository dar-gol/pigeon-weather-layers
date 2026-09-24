import { copyFile } from "node:fs/promises";
import { resolve } from "node:path";

await copyFile(
  resolve("src/control/control.css"),
  resolve("dist/control.css")
);
