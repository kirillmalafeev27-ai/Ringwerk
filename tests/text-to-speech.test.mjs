import assert from "node:assert/strict";
import test from "node:test";

function invokeWorker(worker, request, environment, requestContext) {
  return typeof worker === "function"
    ? worker(request, environment, requestContext)
    : worker.fetch(request, environment, requestContext);
}

async function loadWorker(tag) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("tts-test", `${tag}-${process.pid}-${Date.now()}`);
  return (await import(workerUrl.href)).default;
}

const context = { waitUntil() {}, passThroughOnException() {} };
const assets = { fetch: async () => new Response("Not found", { status: 404 }) };

function speechRequest(body, client) {
  return new Request("http://localhost/api/tts", {
    method: "POST",
    headers: { "content-type": "application/json", "x-real-ip": client },
    body: JSON.stringify(body),
  });
}

test("speech route reports itself unavailable instead of failing when no key is set", async () => {
  const worker = await loadWorker("unconfigured");
  const response = await invokeWorker(worker,
    speechRequest({ text: "Der Zug kommt um acht Uhr an." }, "tts-unconfigured"),
    { ASSETS: assets },
    context,
  );

  // 503 is the signal the client uses to read the sentence with the browser
  // voice, so the listening mode stays playable without a paid provider.
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "unavailable" });
});

test("speech route rejects empty and oversized sentences", async () => {
  const worker = await loadWorker("bounds");
  const environment = { ASSETS: assets, ELEVENLABS_API_KEY: "test-key" };

  const empty = await invokeWorker(worker, speechRequest({ text: "   " }, "tts-empty"), environment, context);
  assert.equal(empty.status, 400);

  const oversized = await invokeWorker(worker,
    speechRequest({ text: "Wort ".repeat(200) }, "tts-oversized"),
    environment,
    context,
  );
  assert.equal(oversized.status, 413);
});

test("speech route serves the provider audio and replays it from cache", async () => {
  const worker = await loadWorker("cache");
  const environment = { ASSETS: assets, ELEVENLABS_API_KEY: "test-key" };
  const originalFetch = globalThis.fetch;
  let upstreamCalls = 0;

  globalThis.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input.url;
    if (!url.includes("api.elevenlabs.io")) return originalFetch(input, init);
    upstreamCalls += 1;
    assert.equal(init.headers["xi-api-key"], "test-key");
    return new Response(new Uint8Array([1, 2, 3, 4]), {
      status: 200,
      headers: { "content-type": "audio/mpeg" },
    });
  };

  try {
    const sentence = { text: "Ich hole das Rezept in der Apotheke ab." };
    const first = await invokeWorker(worker, speechRequest(sentence, "tts-cache"), environment, context);
    assert.equal(first.status, 200);
    assert.equal(first.headers.get("content-type"), "audio/mpeg");
    assert.equal(first.headers.get("x-tts-cache"), "MISS");
    assert.equal((await first.arrayBuffer()).byteLength, 4);

    const second = await invokeWorker(worker, speechRequest(sentence, "tts-cache"), environment, context);
    assert.equal(second.status, 200);
    assert.equal(second.headers.get("x-tts-cache"), "HIT");
    assert.equal(upstreamCalls, 1, "a replayed sentence must not be paid for twice");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("speech route hides provider failures behind a generic error", async () => {
  const worker = await loadWorker("upstream-failure");
  const environment = { ASSETS: assets, ELEVENLABS_API_KEY: "test-key" };
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input.url;
    if (!url.includes("api.elevenlabs.io")) return originalFetch(input, init);
    return new Response("quota exceeded for account 12345", { status: 401 });
  };

  try {
    const response = await invokeWorker(worker,
      speechRequest({ text: "Wir müssen morgen früh zum Arzt gehen." }, "tts-upstream"),
      environment,
      context,
    );
    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), { error: "unavailable" });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
