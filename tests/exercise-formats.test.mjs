import assert from "node:assert/strict";
import test from "node:test";

import {
  GRAMMAR_TOPICS,
  GRAMMAR_TOPIC_GROUPS,
  LANGUAGE_LEVELS,
  QUESTION_MODES,
  learningPoolKey,
} from "../lib/learning-settings.ts";
import {
  AUDIO_QUALITY_RULES,
  EXERCISE_FORMATS,
  TOPIC_RULES,
  WORD_FIELDS,
  WORD_FIELD_SYNONYM_COUNT,
  WORD_FIELD_TOPIC,
  exerciseFormatFor,
  exerciseHint,
  isWordFieldTopic,
  pickWordFields,
  qualityRules,
  topicRuleFor,
  usesEveryFragment,
  wordFieldBank,
  wordFieldFor,
  wordFieldInstruction,
  wordFieldQualityRules,
  wordFieldSynonymOf,
  wordFieldsForLevel,
  wordOrderFragments,
} from "../lib/exercise-formats.ts";
import {
  WORD_FIELD_FALLBACK_QUESTIONS,
  exerciseFormatOf,
  fallbackQuestionsFor,
  normalizeQuestion,
} from "../lib/questions.ts";

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
  assert.deepEqual(
    GRAMMAR_TOPICS.filter((topic) => exerciseFormatFor(topic).id === "word-field"),
    [WORD_FIELD_TOPIC],
    "exactly one grammar topic may reach the synonym format",
  );
  assert.equal(exerciseFormatFor("Dativ"), EXERCISE_FORMATS.gap);
});

test("listening replaces the written shape whatever the grammar topic is", () => {
  for (const topic of ["Dativ", "Wortstellung im Hauptsatz"]) {
    assert.equal(exerciseFormatFor(topic, "audio"), EXERCISE_FORMATS.audio);
  }
  assert.equal(exerciseFormatFor("Dativ", "recall"), EXERCISE_FORMATS.gap);
  assert.ok(AUDIO_QUALITY_RULES.length >= 4);
});

test("listening keeps a pool of its own while the written modes share one", () => {
  const base = { level: "A2", lexicalTopic: "Alltag & Routinen", grammarTopic: "Präsens" };
  assert.equal(
    learningPoolKey({ ...base, mode: "recognition" }),
    learningPoolKey({ ...base, mode: "recall" }),
  );
  assert.notEqual(
    learningPoolKey({ ...base, mode: "audio" }),
    learningPoolKey({ ...base, mode: "recognition" }),
  );
  // The grammar topic must not split the listening queue, since listening
  // tasks are not written for one.
  assert.equal(
    learningPoolKey({ ...base, mode: "audio" }),
    learningPoolKey({ ...base, grammarTopic: "Passiv", mode: "audio" }),
  );
});

test("every practice mode has a hint in every format", () => {
  for (const format of Object.values(EXERCISE_FORMATS)) {
    for (const mode of QUESTION_MODES) {
      assert.ok(exerciseHint(format, mode.id), `${format.id} has no hint for ${mode.id}`);
    }
  }
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

// --- Wortfelder ------------------------------------------------------------

// Reserve items are written in the form the sentence needs, so a synonym is
// recognised by the stem it shares with its dictionary form.
function nearestSynonym(field, option) {
  const fold = (value) =>
    value.toLocaleLowerCase("de-DE").replace(/ß/gu, "ss").replace(/[^\p{Letter}]+/gu, "");
  const target = fold(option);
  let best = "";
  let bestLength = 0;
  for (const word of wordFieldBank(field)) {
    const candidate = fold(word);
    let shared = 0;
    while (
      shared < candidate.length
      && shared < target.length
      && candidate[shared] === target[shared]
    ) shared += 1;
    if (shared > bestLength) {
      best = word;
      bestLength = shared;
    }
  }
  return bestLength >= Math.min(4, target.length) ? best : "";
}

test("the synonym topic is reachable and every topic sits in one group", () => {
  assert.ok(GRAMMAR_TOPIC_GROUPS.some((group) => group.topics.includes(WORD_FIELD_TOPIC)));
  assert.deepEqual(
    GRAMMAR_TOPICS.filter(
      (topic) =>
        GRAMMAR_TOPIC_GROUPS.filter((group) => group.topics.includes(topic)).length !== 1,
    ),
    [],
  );
  assert.ok(isWordFieldTopic(WORD_FIELD_TOPIC));
  assert.ok(!isWordFieldTopic("Dativ"));
  assert.ok(topicRuleFor(WORD_FIELD_TOPIC).length > 80);
});

test("every word field carries five distinct, single-gap synonyms", () => {
  const all = [];
  for (const field of WORD_FIELDS) {
    assert.equal(field.synonyms.length, WORD_FIELD_SYNONYM_COUNT, field.base);
    assert.equal(
      new Set(field.synonyms.map((entry) => entry.word)).size,
      WORD_FIELD_SYNONYM_COUNT,
      `${field.base} repeats a synonym`,
    );
    for (const entry of field.synonyms) {
      assert.ok(entry.sense.length > 8, `${entry.word} has no sense note`);
      assert.ok(/[А-Яа-яЁё]/u.test(entry.sense), `${entry.word} explains nothing in Russian`);
      // A separable verb splits around the sentence and would need a second
      // gap, and this format promises exactly one.
      assert.ok(
        !/^(ab|an|auf|aus|ein|mit|nach|vor|zu|zurück|weg|her|hin|los)[a-zäöüß]{3,}en$/u.test(entry.word),
        `${entry.word} looks separable, so it cannot fill a single gap`,
      );
      all.push(entry.word);
    }
    assert.equal(wordFieldFor(field.base.toUpperCase()), field);
    assert.deepEqual(wordFieldBank(field), field.synonyms.map((entry) => entry.word));
    assert.equal(
      wordFieldSynonymOf(field, field.synonyms[2].word.toUpperCase())?.word,
      field.synonyms[2].word,
    );
    assert.equal(wordFieldSynonymOf(field, "Nichtsynonym"), undefined);
  }
  assert.equal(
    new Set(all).size,
    all.length,
    "a synonym may belong to one field only, or a wrong option is arguable",
  );
  assert.equal(new Set(WORD_FIELDS.map((field) => field.base)).size, WORD_FIELDS.length);
});

test("the rotation walks the whole catalogue before a field comes back", () => {
  for (const level of LANGUAGE_LEVELS) {
    const pool = wordFieldsForLevel(level);
    assert.ok(pool.length >= 3, `${level} has too few fields to rotate`);
    const picked = pickWordFields(level, 0, 2);
    assert.equal(picked.length, 2);
    assert.notEqual(picked[0].base, picked[1].base);
    // Ten synonyms behind a batch of eight is what lets every item drill a
    // synonym no other item in the package has used.
    assert.ok(picked.length * WORD_FIELD_SYNONYM_COUNT >= 8);
  }
  assert.deepEqual(
    wordFieldsForLevel("A1").map((field) => field.level),
    wordFieldsForLevel("A1").map(() => "A1"),
  );
  assert.ok(wordFieldsForLevel("B2").length > wordFieldsForLevel("A1").length);
  assert.equal(pickWordFields("B2", 3, 2)[0], wordFieldsForLevel("B2")[6]);

  const pool = wordFieldsForLevel("B2");
  const seen = new Set();
  for (let seed = 0; seed < Math.ceil(pool.length / 2); seed += 1) {
    for (const field of pickWordFields("B2", seed, 2)) seen.add(field.base);
  }
  assert.equal(seen.size, pool.length);
});

test("the synonym rules close the translation giveaway", () => {
  const rules = wordFieldQualityRules(pickWordFields("A2", 0, 2));
  assert.ok(rules.length >= 8);
  assert.ok(rules.some((rule) => /Uebersetzung/u.test(rule)));
  assert.equal(
    wordFieldInstruction("sagen"),
    "Вместо стёртого «sagen» вставьте точный синоним.",
  );
});

test("the reserve answers for the format when the server cannot", () => {
  assert.ok(WORD_FIELD_FALLBACK_QUESTIONS.length >= 6);
  for (const question of WORD_FIELD_FALLBACK_QUESTIONS) {
    const field = wordFieldFor(question.wordFieldBase);
    assert.ok(field, `${question.context} names no catalogued field`);
    assert.equal(question.context.split("___").length - 1, 1);
    assert.equal(question.prompt, wordFieldInstruction(field.base));
    assert.equal(exerciseFormatOf(question).id, "word-field");
    // A generated item declares its four synonyms outright (optionBases), so
    // the server checks them by name. A hand-written reserve has no such list,
    // and its options are inflected, so here they are traced back by stem.
    const matched = question.options.map((option) => nearestSynonym(field, option));
    assert.deepEqual(matched.filter((word) => !word), [], question.context);
    assert.equal(new Set(matched).size, 4, question.context);
    assert.ok(/[А-Яа-яЁё]/u.test(question.translation));
    assert.ok(
      !question.translation.includes(question.options[question.correct]),
      "the translation must not print the German answer",
    );
  }
  assert.ok(WORD_FIELD_FALLBACK_QUESTIONS.some((question) => question.level === "A1"));
});

test("the fallback pools never cross", () => {
  const base = { level: "B2", lexicalTopic: "Alltag & Routinen", mode: "recognition" };
  assert.ok(
    fallbackQuestionsFor({ ...base, grammarTopic: WORD_FIELD_TOPIC })[0].wordFieldBase,
    "the synonym topic has to fall back to synonym items",
  );
  assert.ok(
    fallbackQuestionsFor({ ...base, grammarTopic: "Dativ" })
      .every((question) => question.wordFieldBase === undefined),
    "a grammar topic must never be answered with synonym items",
  );
});

test("an unknown base word is dropped rather than shown as an unlookupable field", () => {
  const item = {
    prompt: wordFieldInstruction("sagen"),
    context: "Das Baby schläft, deshalb ___ wir nur noch.",
    translation: "Малыш спит, поэтому мы теперь только говорим.",
    options: ["flüstern", "rufen", "murmeln", "behaupten"],
    correct: 0,
    rule: "flüstern — очень тихо.",
  };
  assert.equal(normalizeQuestion({ ...item, wordFieldBase: "quatschen" }).wordFieldBase, undefined);
  assert.equal(normalizeQuestion({ ...item, wordField: "SAGEN" }).wordFieldBase, "sagen");
});
