import { fileURLToPath } from "node:url";
import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
for (const name of readdirSync(new URL("../server/src/", import.meta.url))) {
  if (!name.endsWith(".js")) continue;
  const path = new URL(`../server/src/${name}`, import.meta.url);
  const result = spawnSync(process.execPath, ["--check", fileURLToPath(path)], { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log("Server syntax checks passed");
