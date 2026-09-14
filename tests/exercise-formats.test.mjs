import assert from "node:assert/strict";
import test from "node:test";

import { GRAMMAR_TOPICS } from "../lib/learning-settings.ts";
import {
  EXERCISE_FORMATS,
  TOPIC_RULES,
  exerciseFormatFor,
  qualityRules,
  topicRuleFor,
  usesEveryFragment,
  wordOrderFragments,
} from "../lib/exercise-formats.ts";

test("every topic rule names a grammar topic the setup screen offers", () => {
  const offered = new Set(GRAMMAR_TOPICS);
  const orphans = Object.keys(TOPIC_RULES).filter((topic) => !offered.has(topic));
  assert.deepEqual(orphans, []);
});

test("topic rules resolve through umlauts and their ASCII spellings", () => {
  const expected = TOPIC_RULES["Präteritum"];
  assert.ok(expected);
  assert.equal(topicRuleFor("Präteritum"), expected);
  assert.equal(topicRuleFor("Praeteritum"), expected);
  assert.equal(topicRuleFor("Nominalisierung"), "");
  assert.equal(topicRuleFor(undefined), "");
});

test("only the word-order topics leave the gap format", () => {
  const wordOrder = GRAMMAR_TOPICS.filter(
    (topic) => exerciseFormatFor(topic).id === "word-order",
  );
  assert.deepEqual(wordOrder, ["Wortstellung im Hauptsatz", "Wortstellung im Nebensatz"]);
  assert.equal(exerciseFormatFor("Dativ"), EXERCISE_FORMATS.gap);
});

test("word-order answers have to spend every listed fragment", () => {
  const context = "am Wochenende / wir / besuchen / unsere Großeltern";
  assert.deepEqual(wordOrderFragments(context), [
    "am Wochenende",
    "wir",
    "besuchen",
    "unsere Großeltern",
  ]);
  assert.ok(usesEveryFragment(context, "Am Wochenende besuchen wir unsere Großeltern."));
  assert.ok(!usesEveryFragment(context, "Am Wochenende besuchen wir."));
  assert.ok(!usesEveryFragment(context, "Am Wochenende besuchen wir heute unsere Großeltern."));
});

test("quality rules quote the topic the options must isolate", () => {
  const rules = qualityRules("Reflexive Verben");
  assert.equal(rules.length, 10);
  assert.ok(rules.some((rule) => rule.includes('"Reflexive Verben"')));
});
