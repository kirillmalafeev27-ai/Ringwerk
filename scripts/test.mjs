import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const vinextCli = fileURLToPath(new URL("../node_modules/vinext/dist/cli.js", import.meta.url));
const testFiles = [
  "tests/rendered-html.test.mjs",
  "tests/game-assets.test.mjs",
  "tests/recall-evaluation.test.mjs",
];
const workerEnvironment = { ...process.env };
delete workerEnvironment.DEPLOY_TARGET;

const build = spawnSync(process.execPath, [vinextCli, "build"], {
  cwd: projectRoot,
  env: workerEnvironment,
  stdio: "inherit",
});
if (build.status !== 0) process.exit(build.status ?? 1);

const tests = spawnSync(process.execPath, ["--test", ...testFiles], {
  cwd: projectRoot,
  env: workerEnvironment,
  stdio: "inherit",
});
process.exit(tests.status ?? 1);
