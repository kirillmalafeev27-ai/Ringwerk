import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", String(process.pid) + "-" + Date.now());
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost" + path, {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the finished Ringwerk game shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html[^>]+lang="ru"/i);
  assert.match(html, /<title>RINGWERK — Deutsch unter Druck<\/title>/i);
  assert.match(html, /RINGWERK/);
  assert.match(html, /ЗАПУСТИТЬ МЕХАНИЗМ/);
  assert.match(html, /Ich gehe ___ Maschinenraum\./);
  assert.match(html, /ПИТАНИЕ/);
  assert.match(html, /РОТОР/);
  assert.match(html, /ЗАЩИТА/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|Wo oder Wohin/i);
});

test("source keeps the real-time game rules explicit", async () => {
  const [page, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /world\.phaseTime -= delta/);
  assert.match(page, /world\.spokeAngle = normalizeAngle/);
  assert.match(page, /ring\.angle = normalizeAngle/);
  assert.match(page, /type BonusId = "brake" \| "reverse" \| "overdrive" \| "shift" \| "blackout"/);
  assert.match(page, /inventory\.length >= 2/);
  assert.match(page, /Object\.values\(world\.terminals\)\.every\(Boolean\)/);
  assert.match(page, /\/game-assets\/player-core\.webp/);
  assert.match(layout, /RINGWERK — Deutsch unter Druck/);
  assert.match(packageJson, /"name": "ringwerk"/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
});

test("health endpoint reports readiness", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("health-test", String(process.pid) + "-" + Date.now());
  const { default: worker } = await import(workerUrl.href);
  const response = await worker.fetch(
    new Request("http://localhost/healthz"),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "ok" });
});
