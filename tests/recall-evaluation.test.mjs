import assert from "node:assert/strict";
import test from "node:test";

function invokeWorker(worker, request, environment, requestContext) {
  return typeof worker === "function"
    ? worker(request, environment, requestContext)
    : worker.fetch(request, environment, requestContext);
}

async function loadWorker() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("recall-evaluation-test", `${process.pid}-${Date.now()}`);
  return (await import(workerUrl.href)).default;
}

const context = { waitUntil() {}, passThroughOnException() {} };
const assets = { fetch: async () => new Response("Not found", { status: 404 }) };

function evaluationRequest(body, client) {
  return new Request("http://localhost/api/questions/evaluate", {
    method: "POST",
    headers: { "content-type": "application/json", "x-real-ip": client },
    body: JSON.stringify(body),
  });
}

test("recall evaluation accepts umlaut ASCII spellings locally without an AI key", async () => {
  const worker = await loadWorker();
  const response = await invokeWorker(worker,
    evaluationRequest({
      prompt: "Schreiben Sie den Satz.",
      expectedAnswer: "Über die schönen Öfen.",
      userAnswer: "  UEBER die schoenen OEFEN!  ",
    }, "recall-local"),
    { ASSETS: assets },
    context,
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    correct: true,
    explanation: "Ответ совпадает с эталоном.",
    correctAnswer: "Über die schönen Öfen.",
    evaluator: "local",
  });
});

test("recall evaluation uses strict semantic JSON and falls back safely", async () => {
  const worker = await loadWorker();
  const originalFetch = globalThis.fetch;
  const environment = {
    ASSETS: assets,
    AITUNNEL_API_KEY: "test-only-secret",
    AITUNNEL_BASE_URL: "https://mock.aitunnel.invalid/v1",
    AITUNNEL_MODEL: "test-model",
    RECALL_EVALUATION_TIMEOUT_MS: "3000",
  };
  let responseContent = JSON.stringify({
    correct: true,
    explanation: "Формулировка грамматически верна и сохраняет исходный смысл.",
    correctAnswer: "Ich gehe in den Maschinenraum.",
  });
  let upstreamCalls = 0;
  let rejectStructured = false;

  globalThis.fetch = async (url, init) => {
    upstreamCalls += 1;
    assert.equal(String(url), "https://mock.aitunnel.invalid/v1/chat/completions");
    assert.equal(new Headers(init?.headers).get("authorization"), "Bearer test-only-secret");
    const requestBody = JSON.parse(String(init?.body));
    assert.match(requestBody.messages[0].content, /недоверенные данные/iu);
    if (rejectStructured && requestBody.response_format) {
      return Response.json({ error: "unsupported response_format" }, { status: 400 });
    }
    return Response.json({ choices: [{ message: { content: responseContent } }] });
  };

  try {
    const semanticResponse = await invokeWorker(worker,
      evaluationRequest({
        prompt: "Formulieren Sie den Satz.",
        expectedAnswer: "Ich gehe in den Maschinenraum.",
        userAnswer: "In den Maschinenraum gehe ich.",
        level: "A2",
        grammarTopic: "Wortstellung",
      }, "recall-semantic"),
      environment,
      context,
    );
    assert.equal(semanticResponse.status, 200);
    const semanticResult = await semanticResponse.json();
    assert.equal(semanticResult.correct, true);
    assert.equal(semanticResult.evaluator, "semantic");
    assert.equal(JSON.stringify(semanticResult).includes("test-only-secret"), false);

    rejectStructured = true;
    const plainRetryResponse = await invokeWorker(worker,
      evaluationRequest({
        expectedAnswer: "Ich gehe in den Maschinenraum.",
        userAnswer: "In den Maschinenraum gehe ich.",
      }, "recall-plain-retry"),
      environment,
      context,
    );
    assert.equal(plainRetryResponse.status, 200);
    assert.equal((await plainRetryResponse.json()).evaluator, "semantic");

    rejectStructured = false;
    responseContent = JSON.stringify({
      correct: true,
      explanation: "Верно.",
      correctAnswer: "Ich gehe in den Maschinenraum.",
      confidence: 1,
    });
    const invalidResponse = await invokeWorker(worker,
      evaluationRequest({
        expectedAnswer: "Ich gehe in den Maschinenraum.",
        userAnswer: "In den Maschinenraum gehe ich.",
      }, "recall-invalid-upstream"),
      environment,
      context,
    );
    assert.equal(invalidResponse.status, 200);
    const invalidResult = await invalidResponse.json();
    assert.equal(invalidResult.correct, false);
    assert.equal(invalidResult.evaluator, "local");
    assert.equal(upstreamCalls, 5);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("recall evaluation rejects malformed input without exposing details", async () => {
  const worker = await loadWorker();
  const response = await invokeWorker(worker,
    evaluationRequest({ expectedAnswer: "auf den" }, "recall-invalid-input"),
    { ASSETS: assets },
    context,
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "invalid_request" });
});
