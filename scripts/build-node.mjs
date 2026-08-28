import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const vinextCli = fileURLToPath(new URL("../node_modules/vinext/dist/cli.js", import.meta.url));
const standaloneManifest = fileURLToPath(new URL("../dist/standalone/package.json", import.meta.url));

// The standalone output is copied into the runtime image without the project
// manifest, so give it the start scripts a platform run command may invoke.
function addStandaloneStartScripts() {
  const manifest = JSON.parse(readFileSync(standaloneManifest, "utf8"));
  manifest.scripts = { start: "node server.js", "start:northflank": "node server.js" };
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
  if (status === 0) addStandaloneStartScripts();
  return status;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(buildStandalone());
}
