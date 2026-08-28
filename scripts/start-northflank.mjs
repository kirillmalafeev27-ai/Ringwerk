import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildStandalone } from "./build-node.mjs";

const standaloneServer = new URL("../dist/standalone/server.js", import.meta.url);

// Northflank starts the service from the repository, where the build step may
// have produced the Cloudflare bundle instead of the Node standalone runtime.
if (!existsSync(fileURLToPath(standaloneServer))) {
  const status = buildStandalone();
  if (status !== 0) process.exit(status);
}

process.env.NODE_ENV ??= "production";
process.env.HOST ??= "0.0.0.0";
process.env.PORT ??= "3000";

await import(standaloneServer.href);
