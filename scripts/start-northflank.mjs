import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildStandalone } from "./build-node.mjs";

const standaloneServer = new URL("../dist/standalone/server.js", import.meta.url);
const vinextCli = fileURLToPath(new URL("../node_modules/vinext/dist/cli.js", import.meta.url));

// Northflank starts the service from the repository, where the build step may
// have produced the Cloudflare bundle instead of the Node standalone runtime.
if (!existsSync(fileURLToPath(standaloneServer))) {
  if (!existsSync(vinextCli)) {
    console.error("[ringwerk] dist/standalone is missing and vinext is not installed.");
    console.error("[ringwerk] Build the service with: npm run build:node");
    process.exit(1);
  }
  const status = buildStandalone();
  if (status !== 0) process.exit(status);
}

process.env.NODE_ENV ??= "production";
process.env.HOST ??= "0.0.0.0";
process.env.PORT ??= "3000";

await import(standaloneServer.href);
