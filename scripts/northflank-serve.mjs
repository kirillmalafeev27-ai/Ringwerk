import { existsSync } from "node:fs";
import { connect, createServer } from "node:net";
import { fileURLToPath } from "node:url";

// Northflank does not inject $PORT. The port entry in the dashboard decides
// which port its proxy dials, and a container listening anywhere else answers
// "upstream connect error ... Connection refused". With neither PORT nor PORTS
// set we therefore bind both numbers this project uses, so either entry reaches
// the app without a dashboard edit.
const DEFAULT_PORTS = "8080,3000";

export function resolvePorts(environment = process.env) {
  const configured = environment.PORTS || environment.PORT || DEFAULT_PORTS;
  const ports = [];
  for (const entry of String(configured).split(",")) {
    const port = Number(entry.trim());
    if (
      Number.isInteger(port) &&
      port > 0 &&
      port < 65_536 &&
      !ports.includes(port)
    ) {
      ports.push(port);
    }
  }
  return ports.length ? ports : [8080];
}

// The standalone runtime owns the first port; every extra one is a plain TCP
// pipe into it, so streaming and websockets keep working. Extras are
// best-effort: a port already in use warns instead of taking the service down.
function forwardPort(port, target, host) {
  const relay = createServer((socket) => {
    const upstream = connect(target, "127.0.0.1");
    const drop = () => {
      socket.destroy();
      upstream.destroy();
    };
    socket.on('error', drop);
    upstream.on('error', drop);
    socket.pipe(upstream);
    upstream.pipe(socket);
  });
  relay.on('error', (error) => {
    console.warn(
      `[northflank] extra port ${port} unavailable: ${error.message}`,
    );
  });
  relay.listen(port, host);
  relay.unref();
  return relay;
}

export async function serveStandalone(serverUrl) {
  const requestedPort = process.env.PORT ?? "";
  const requestedPorts = process.env.PORTS ?? "";
  const [primary, ...extras] = resolvePorts();
  const host = process.env.HOST ?? "0.0.0.0";

  process.env.NODE_ENV ??= "production";
  process.env.HOST = host;
  // The standalone runtime reads PORT, so the first entry is the contract: if
  // it cannot be bound the process exits and Northflank sees a failed start.
  process.env.PORT = String(primary);

  console.log(
    `[northflank] PORT=${requestedPort} PORTS=${requestedPorts} -> binding ${[primary, ...extras].join(", ")} on ${host}`,
  );

  await import(serverUrl.href ?? String(serverUrl));
  for (const port of extras) forwardPort(port, primary, host);
}

// The launcher is copied next to the standalone server in the runtime image and
// also runs from scripts/ in a repository build, so it finds either layout.
export function standaloneServerUrl() {
  const sibling = new URL("./server.js", import.meta.url);
  return existsSync(fileURLToPath(sibling))
    ? sibling
    : new URL("../dist/standalone/server.js", import.meta.url);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await serveStandalone(standaloneServerUrl());
}
