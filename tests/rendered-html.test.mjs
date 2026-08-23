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

test("source keeps the fast but readable game rules explicit", async () => {
  const [page, layout, packageJson, questionPool, questionRoute] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../app/use-question-pool.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/questions/generate/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(page, /const simulationDelta = delta/);
  assert.match(page, /world\.phaseTime -= simulationDelta/);
  assert.match(page, /IMPULSE_QUESTION_DECAY = 6\.6/);
  assert.match(page, /IMPULSE_ACTION_DECAY = 9/);
  assert.match(page, /ACTION_THRESHOLDS/);
  assert.match(page, /impulseRef\.current - requiredImpulse/);
  assert.match(page, /world\.spokeAngle = normalizeAngle/);
  assert.match(page, /ring\.angle = normalizeAngle/);
  assert.match(page, /type BonusId = "brake" \| "reverse" \| "overdrive" \| "shift" \| "blackout"/);
  assert.match(page, /nextCombo % 3 === 0/);
  assert.match(page, /current\.length < 2/);
  assert.doesNotMatch(page, /bonusDraft|chooseBonus/);
  assert.match(page, /Object\.values\(world\.terminals\)\.every\(Boolean\)/);
  assert.match(page, /\/game-assets\/player-core\.webp/);
  assert.match(layout, /RINGWERK — Deutsch unter Druck/);
  assert.match(packageJson, /"name": "ringwerk"/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  assert.match(questionPool, /useState<GameQuestion>\(FALLBACK_QUESTIONS\[0\]\)/);
  assert.doesNotMatch(questionPool, /useState\(\(\) => shuffleQuestion\(FALLBACK_QUESTIONS\[0\]\)\)/);
  assert.match(questionRoute, /GLOBAL_LIMIT = 30/);
  assert.match(questionRoute, /\.at\(-1\)/);
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
  assert.deepEqual(await response.json(), { ok: true });
});

test("question API stays playable without a server key", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("question-api-test", String(process.pid) + "-" + Date.now());
  const { default: worker } = await import(workerUrl.href);
  const environment = { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } };
  const context = { waitUntil() {}, passThroughOnException() {} };

  const statusResponse = await worker.fetch(new Request("http://localhost/api/questions/status"), environment, context);
  assert.equal(statusResponse.status, 200);
  assert.deepEqual(await statusResponse.json(), { ready: false });

  const generationResponse = await worker.fetch(
    new Request("http://localhost/api/questions/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ level: "A2", count: 8, exclude: [] }),
    }),
    environment,
    context,
  );
  assert.equal(generationResponse.status, 200);
  assert.deepEqual(await generationResponse.json(), { questions: [] });
});

test("question pool mirrors the non-blocking Odyssey lifecycle", async () => {
  const [pool, generator, questions] = await Promise.all([
    readFile(new URL("../app/use-question-pool.ts", import.meta.url), "utf8"),
    readFile(new URL("../server/question-generation.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/questions.ts", import.meta.url), "utf8"),
  ]);

  assert.match(pool, /BATCH_SIZE = 8/);
  assert.match(pool, /LOW_WATER_MARK = 3/);
  assert.match(pool, /RECENT_LIMIT = 80/);
  assert.match(pool, /exclude: recentRef\.current\.slice\(-RECENT_LIMIT\)/);
  assert.match(pool, /queueRef\.current\.shift\(\) \?\? nextReserve\(\)/);
  assert.match(pool, /releaseQuestion/);
  assert.match(generator, /pending = new Map/);
  assert.match(generator, /questions\.length === spec\.count/);
  assert.match(generator, /AITUNNEL_API_KEY/);
  assert.match(generator, /Authorization: `Bearer \$\{config\.key\}`/);
  assert.match(questions, /options: \[string, string, string, string\]/);
});

test("AITunnel batches are accepted only when all eight questions validate", async () => {
  const originalFetch = globalThis.fetch;
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("aitunnel-mock-test", String(process.pid) + "-" + Date.now());
  let worker;
  const environment = {
    ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
    AITUNNEL_API_KEY: "test-only-key",
    AITUNNEL_BASE_URL: "https://mock.aitunnel.invalid/v1",
    QUESTION_GENERATION_TIMEOUT_MS: "3000",
  };
  const context = { waitUntil() {}, passThroughOnException() {} };
  const makeBatch = (count) => Array.from({ length: count }, (_, index) => ({
    prompt: `Ich stelle Kiste ${index + 1} ___ Tisch.`,
    options: ["auf den", "auf dem", "an der", "unter die"],
    correct: 0,
    correctAnswer: "auf den",
    rule: "Wohin? → Akkusativ",
  }));
  let batchSize = 8;
  let upstreamCalls = 0;

  globalThis.fetch = async (url, init) => {
    upstreamCalls += 1;
    assert.equal(String(url), "https://mock.aitunnel.invalid/v1/chat/completions");
    assert.equal(new Headers(init?.headers).get("authorization"), "Bearer test-only-key");
    return Response.json({
      choices: [{ message: { content: JSON.stringify({ questions: makeBatch(batchSize) }) } }],
    });
  };

  try {
    ({ default: worker } = await import(workerUrl.href));
    const readyResponse = await worker.fetch(
      new Request("http://localhost/api/questions/status"),
      environment,
      context,
    );
    assert.deepEqual(await readyResponse.json(), { ready: true });
    const validResponse = await worker.fetch(
      new Request("http://localhost/api/questions/generate", {
        method: "POST",
        headers: { "content-type": "application/json", "x-real-ip": "test-valid" },
        body: JSON.stringify({ level: "A2", count: 8, exclude: [] }),
      }),
      environment,
      context,
    );
    assert.equal(validResponse.status, 200);
    const validPayload = await validResponse.json();
    assert.equal(validPayload.questions.length, 8, `upstream calls: ${upstreamCalls}`);
    assert.ok(validPayload.questions.every((question) => question.options.length === 4));

    batchSize = 7;
    const partialResponse = await worker.fetch(
      new Request("http://localhost/api/questions/generate", {
        method: "POST",
        headers: { "content-type": "application/json", "x-real-ip": "test-partial" },
        body: JSON.stringify({ level: "B1", count: 8, exclude: [] }),
      }),
      environment,
      context,
    );
    assert.equal(partialResponse.status, 200);
    assert.deepEqual(await partialResponse.json(), { questions: [] });
    assert.ok(upstreamCalls >= 3, "partial batches should trigger the compatible retry path");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("question API ignores spoofed prefixes when applying the client limit", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("rate-limit-test", String(process.pid) + "-" + Date.now());
  const { default: worker } = await import(workerUrl.href);
  const environment = { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } };
  const context = { waitUntil() {}, passThroughOnException() {} };

  for (let attempt = 0; attempt < 7; attempt += 1) {
    const response = await worker.fetch(
      new Request("http://localhost/api/questions/generate", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": `198.51.100.${attempt}, 203.0.113.77`,
        },
        body: JSON.stringify({ level: "A2", count: 8, exclude: [] }),
      }),
      environment,
      context,
    );
    assert.equal(response.status, attempt < 6 ? 200 : 429);
  }
});
