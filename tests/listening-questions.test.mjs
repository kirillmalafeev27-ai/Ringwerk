import assert from "node:assert/strict";
import test from "node:test";

function invokeWorker(worker, request, environment, requestContext) {
  return typeof worker === "function"
    ? worker(request, environment, requestContext)
    : worker.fetch(request, environment, requestContext);
}

const context = { waitUntil() {}, passThroughOnException() {} };
const environment = {
  ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
  AITUNNEL_API_KEY: "test-only-key",
  AITUNNEL_BASE_URL: "https://mock.aitunnel.invalid/v1",
  QUESTION_GENERATION_TIMEOUT_MS: "3000",
};

// The built worker shares one module instance across imports, so its generation
// cache outlives a test. Each case therefore asks for its own lexical topic.
function listeningRequest(body, client) {
  return new Request("http://localhost/api/questions/generate", {
    method: "POST",
    headers: { "content-type": "application/json", "x-real-ip": client },
    body: JSON.stringify({
      level: "A2",
      mode: "audio",
      grammarTopic: "Präsens",
      count: 4,
      exclude: [],
      ...body,
    }),
  });
}

async function withMockedUpstream(tag, batches, run) {
  const originalFetch = globalThis.fetch;
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("listening-test", `${tag}-${process.pid}-${Date.now()}`);
  const prompts = [];

  globalThis.fetch = async (url, init) => {
    assert.equal(String(url), "https://mock.aitunnel.invalid/v1/chat/completions");
    prompts.push(JSON.parse(String(init?.body)));
    return Response.json({
      choices: [{ message: { content: JSON.stringify({ questions: batches() }) } }],
    });
  };
  try {
    const { default: worker } = await import(workerUrl.href);
    return await run(worker, prompts);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

const validClip = (index) => ({
  audioText: `Ich hole das Rezept ${index + 1} in der Apotheke ab.`,
  options: [
    `Я забираю рецепт ${index + 1} в аптеке.`,
    `Я отдаю рецепт ${index + 1} в аптеке.`,
    `Я забираю чек ${index + 1} в аптеке.`,
    `Я забираю рецепт ${index + 1} у врача.`,
  ],
  correct: 0,
  correctAnswer: `Я забираю рецепт ${index + 1} в аптеке.`,
  rule: `Ich hole das Rezept ${index + 1} in der Apotheke ab.`,
});

test("listening batches keep the German spoken and the options Russian", async () => {
  await withMockedUpstream("valid", () => Array.from({ length: 4 }, (_, index) => validClip(index)),
    async (worker, prompts) => {
      const response = await invokeWorker(worker,
        listeningRequest({ lexicalTopic: "Alltag & Routinen" }, "listening-valid"),
        environment,
        context,
      );
      assert.equal(response.status, 200);
      const { questions } = await response.json();
      assert.equal(questions.length, 4);

      for (const question of questions) {
        assert.match(question.audioText, /[A-Za-zÄÖÜäöüß]/u);
        assert.doesNotMatch(question.audioText, /[А-Яа-яЁё]/u);
        assert.ok(question.options.every((option) => /[А-Яа-яЁё]/u.test(option)));
        // Printing the translation would hand over the answer before the
        // sentence is even played.
        assert.equal(question.translation, "");
        assert.doesNotMatch(question.context, /[A-Za-zÄÖÜäöüß]/u);
        assert.equal(question.grammarTopic, undefined);
        assert.equal(question.rule, question.audioText);
      }

      const sent = JSON.parse(prompts[0].messages.at(-1).content);
      assert.equal(sent.exerciseFormat, "audio");
      assert.ok(sent.qualityRules.length >= 4);
      assert.equal(sent.grammarTopic, undefined, "a listening task is not written for a grammar topic");
    });
});

test("listening batches drop clips that print the German or answer in German", async () => {
  await withMockedUpstream("invalid", () => [
    // The sentence the player must hear, spelled in Russian.
    { ...validClip(0), audioText: "Я забираю рецепт в аптеке." },
    // German options would be answerable without listening at all.
    {
      ...validClip(1),
      options: ["Ich hole ab.", "Ich gebe ab.", "Ich hole nicht ab.", "Ich hole es ab."],
      correctAnswer: "Ich hole ab.",
    },
    // Too short to be a listening comprehension task.
    { ...validClip(2), audioText: "Guten Tag.", rule: "Guten Tag." },
    validClip(3),
  ], async (worker) => {
    const response = await invokeWorker(worker,
      listeningRequest({ lexicalTopic: "Gesundheit & Wohlbefinden" }, "listening-invalid"),
      environment,
      context,
    );
    assert.equal(response.status, 200);
    // Only one clip of the four is usable, so the incomplete batch is refused
    // and the client falls back to its reserves.
    assert.deepEqual(await response.json(), { questions: [] });
  });
});

test("generation rejects a practice mode the game does not offer", async () => {
  await withMockedUpstream("bad-mode", () => [], async (worker) => {
    const response = await invokeWorker(worker,
      listeningRequest({ lexicalTopic: "Sport & Fitness", mode: "dictation" }, "listening-bad-mode"),
      environment,
      context,
    );
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { questions: [] });
  });
});
