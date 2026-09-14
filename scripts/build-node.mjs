import { spawnSync } from "node:child_process";
import { copyFileSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const vinextCli = fileURLToPath(new URL("../node_modules/vinext/dist/cli.js", import.meta.url));
const standaloneManifest = fileURLToPath(new URL("../dist/standalone/package.json", import.meta.url));
const launcherSource = fileURLToPath(new URL("./northflank-serve.mjs", import.meta.url));
const launcherTarget = fileURLToPath(new URL("../dist/standalone/northflank-serve.mjs", import.meta.url));

// The standalone output is copied into the runtime image without the project
// manifest or scripts/, so it gets its own copy of the port-resolving launcher
// plus the start scripts a platform run command may invoke.
function addStandaloneLauncher() {
  copyFileSync(launcherSource, launcherTarget);
  const manifest = JSON.parse(readFileSync(standaloneManifest, "utf8"));
  manifest.scripts = {
    start: "node northflank-serve.mjs",
    "start:northflank": "node northflank-serve.mjs",
  };
  writeFileSync(standaloneManifest, `${JSON.stringify(manifest, null, 2)}\n`);
}

// Inlining `DEPLOY_TARGET=node` in package.json would break Windows shells, so
// the Node standalone build gets its own entry point.
export function buildStandalone() {
  const build = spawnSync(process.execPath, [vinextCli, "build"], {
    cwd: projectRoot,
    env: { ...process.env, DEPLOY_TARGET: "node" },
    stdio: "inherit",
  });
  const status = build.status ?? 1;
  if (status === 0) addStandaloneLauncher();
  return status;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(buildStandalone());
}
