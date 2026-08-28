import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const vinextCli = fileURLToPath(new URL("../node_modules/vinext/dist/cli.js", import.meta.url));

// Inlining `DEPLOY_TARGET=node` in package.json would break Windows shells, so
// the Node standalone build gets its own entry point.
export function buildStandalone() {
  const build = spawnSync(process.execPath, [vinextCli, "build"], {
    cwd: projectRoot,
    env: { ...process.env, DEPLOY_TARGET: "node" },
    stdio: "inherit",
  });
  return build.status ?? 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(buildStandalone());
}
