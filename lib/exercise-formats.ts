/**
 * The exercise formats the See Escape generator writes, shared verbatim so every
 * German drill in this project has the same shape and the same authoring rules.
 *
 * A format describes what stands in `context` and what the four options are;
 * `TOPIC_RULES` adds the per-topic rule sheet that keeps an item solvable only
 * through the grammar topic it claims to test.
 */

export type ExerciseFormatId = "gap" | "word-order" | "word-field" | "audio";

export type ExerciseFormat = {
  id: ExerciseFormatId;
  /** Human-readable name of the shape, for logs and docs. */
  label: string;
  /** German description of the shape, handed to the generator. */
  shape: string;
  /** Russian instruction; word-order topics override it with their own. */
  instruction: string;
  /** Russian placeholder for the free-recall input. */
  recallPlaceholder: string;
  /** Russian hint under the answer area, per practice mode. */
  hints: { recognition: string; recall: string };
};

const GAP_FORMAT: ExerciseFormat = {
  id: "gap",
  label: "Подстановка",
  shape:
    "Lueckenuebung. Die Aufgabe-Zeile enthaelt einen deutschen Satz mit genau einer Luecke ___.",
  instruction: "Вставьте правильную немецкую форму.",
  recallPlaceholder: "Напиши слово или фразу",
  hints: {
    recognition: "Выбери форму, которая закрывает пропуск.",
    recall: "Введи форму для пропуска без вариантов.",
  },
};

const WORD_ORDER_FORMAT: ExerciseFormat = {
  id: "word-order",
  label: "Порядок слов",
  shape:
    "Wortstellungsuebung. Die Aufgabe-Zeile enthaelt durcheinander gebrachte Woerter oder Satzteile, getrennt durch ' / '.",
  instruction: "Соберите из всех частей предложение.",
  recallPlaceholder: "Напиши предложение целиком",
  hints: {
    recognition: "Выбери вариант с правильным порядком слов.",
    recall: "Собери предложение и введи его целиком.",
  },
};

const WORD_FIELD_FORMAT: ExerciseFormat = {
  id: "word-field",
  label: "Синонимы",
  shape:
    "Wortfelduebung. Die Aufgabe-Zeile enthaelt einen deutschen Satz mit genau einer Luecke ___; die vier Optionen sind Synonyme desselben abgenutzten Grundworts und unterscheiden sich nur in der Nuance, die der Kontext verlangt.",
  instruction: "Выберите точный синоним вместо стёртого слова.",
  recallPlaceholder: "Напиши точный синоним",
  hints: {
    recognition: "Все четыре варианта — синонимы одного слова: подходит один.",
    recall: "Впиши синоним из поля слова в нужной форме.",
  },
};

// Listening drills never print the German sentence: it is only spoken, so the
// task line carries this fixed Russian display text instead.
export const AUDIO_DISPLAY_CONTEXT = "Немецкая фраза звучит вслух.";

const AUDIO_FORMAT: ExerciseFormat = {
  id: "audio",
  label: "Аудирование",
  shape:
    "Hoerverstehensaufgabe. audioText ist ein vollstaendiger deutscher Satz, der nur vorgelesen und nie angezeigt wird; die vier Optionen sind russische Uebersetzungen.",
  instruction: "Прослушай немецкую фразу и выбери точный перевод.",
  recallPlaceholder: "Напиши перевод",
  hints: {
    recognition: "Нажми ▶, чтобы прослушать ещё раз, затем выбери перевод.",
    recall: "Аудирование идёт только с вариантами ответа.",
  },
};

export const EXERCISE_FORMATS: Record<ExerciseFormatId, ExerciseFormat> = {
  gap: GAP_FORMAT,
  "word-order": WORD_ORDER_FORMAT,
  "word-field": WORD_FIELD_FORMAT,
  audio: AUDIO_FORMAT,
};

// Word-order drills show the parts of a sentence instead of a gap, so they need
// their own wording — and the parts have to add up to the answer.
const WORD_ORDER_INSTRUCTIONS: Record<string, string> = {
  "Wortstellung im Hauptsatz": "Соберите из всех частей главное предложение.",
  "Wortstellung im Nebensatz": "Соберите из всех частей придаточное предложение.",
};

export function wordOrderInstruction(grammarTopic: string | undefined) {
  return grammarTopic ? WORD_ORDER_INSTRUCTIONS[grammarTopic] : undefined;
}


/**
 * Wortfelder. A synonym drill replaces a worn-out everyday word with the one
 * precise synonym the sentence actually calls for. Every field carries exactly
 * five synonyms and an item shows four of them, so a package that spends a
 * field drills all five.
 */
export const WORD_FIELD_TOPIC = "Wortfelder & Synonyme";

export const WORD_FIELD_SYNONYM_COUNT = 5;

export type WordFieldSynonym = {
  /** Dictionary form, exactly as the catalogue spells it. */
  word: string;
  /** The Russian note naming the context that picks this synonym alone. */
  sense: string;
};

export type WordField = {
  /** The worn-out word the drill replaces. */
  base: string;
  /** Russian gloss of that worn-out word; the task line and the translation
   * both use it, so the translation never gives the nuance away. */
  gloss: string;
  /** Lowest level whose sentences may carry the field. */
  level: "A1" | "A2" | "B1" | "B2";
  /** Five, always: four become options and every one gets its turn. */
  synonyms: readonly [
    WordFieldSynonym,
    WordFieldSynonym,
    WordFieldSynonym,
    WordFieldSynonym,
    WordFieldSynonym,
  ];
};

// Separable verbs are deliberately absent: they split around the sentence and
// would need two gaps, and the format promises exactly one.
export const WORD_FIELDS: readonly WordField[] = [
  {
    base: "sagen",
    gloss: "говорить",
    level: "A1",
    synonyms: [
      { word: "flüstern", sense: "говорить очень тихо, почти на ухо" },
      { word: "rufen", sense: "громко звать или окликать издалека" },
      { word: "murmeln", sense: "бормотать себе под нос, невнятно" },
      { word: "behaupten", sense: "утверждать как факт, без доказательств" },
      { word: "erwähnen", sense: "упомянуть вскользь, между прочим" },
    ],
  },
  {
    base: "gehen",
    gloss: "идти",
    level: "A1",
    synonyms: [
      { word: "laufen", sense: "идти пешком, а не ехать" },
      { word: "rennen", sense: "бежать изо всех сил" },
      { word: "schlendern", sense: "брести не спеша, прогуливаясь" },
      { word: "eilen", sense: "спешить, потому что время поджимает" },
      { word: "stapfen", sense: "тяжело шагать по снегу, грязи или песку" },
    ],
  },
  {
    base: "essen",
    gloss: "есть",
    level: "A1",
    synonyms: [
      { word: "naschen", sense: "таскать сладкое понемногу" },
      { word: "schlingen", sense: "глотать торопливо, почти не жуя" },
      { word: "speisen", sense: "есть торжественно, в ресторане" },
      { word: "frühstücken", sense: "есть утром, завтракать" },
      { word: "probieren", sense: "попробовать маленький кусочек на вкус" },
    ],
  },
  {
    base: "gut",
    gloss: "хороший",
    level: "A1",
    synonyms: [
      { word: "hervorragend", sense: "заметно выше среднего, отличный" },
      { word: "solide", sense: "крепко и надёжно сделанный" },
      { word: "lecker", sense: "вкусный, о еде и напитках" },
      { word: "angenehm", sense: "приятный, об ощущении или обстановке" },
      { word: "brauchbar", sense: "годный, пригодный для дела" },
    ],
  },
  {
    base: "sehen",
    gloss: "видеть",
    level: "A2",
    synonyms: [
      { word: "beobachten", sense: "долго и внимательно наблюдать" },
      { word: "glotzen", sense: "пялиться, невежливо и не отрываясь" },
      { word: "erblicken", sense: "вдруг увидеть, заметить издалека" },
      { word: "betrachten", sense: "рассматривать подробно, вникая" },
      { word: "bemerken", sense: "заметить мимоходом, обратить внимание" },
    ],
  },
  {
    base: "machen",
    gloss: "делать",
    level: "A2",
    synonyms: [
      { word: "produzieren", sense: "производить на предприятии" },
      { word: "erledigen", sense: "выполнить дело и закрыть его" },
      { word: "basteln", sense: "мастерить руками, для себя" },
      { word: "verursachen", sense: "стать причиной чего-то неприятного" },
      { word: "kochen", sense: "готовить еду на плите" },
    ],
  },
  {
    base: "groß",
    gloss: "большой",
    level: "A2",
    synonyms: [
      { word: "riesig", sense: "огромный, несоразмерно больше обычного" },
      { word: "geräumig", sense: "просторный, о помещении" },
      { word: "umfangreich", sense: "объёмный, о тексте, работе, наборе" },
      { word: "erwachsen", sense: "взрослый, о человеке" },
      { word: "bedeutend", sense: "значительный, о роли и событии" },
    ],
  },
  {
    base: "schnell",
    gloss: "быстрый",
    level: "A2",
    synonyms: [
      { word: "rasant", sense: "стремительный, о темпе и скорости" },
      { word: "hastig", sense: "торопливый и суетливый" },
      { word: "zügig", sense: "без задержек, деловито" },
      { word: "blitzschnell", sense: "молниеносный, за доли секунды" },
      { word: "vorschnell", sense: "поспешный, принятый без раздумий" },
    ],
  },
  {
    base: "geben",
    gloss: "давать",
    level: "B1",
    synonyms: [
      { word: "reichen", sense: "подать прямо в руки" },
      { word: "schenken", sense: "подарить безвозмездно" },
      { word: "verleihen", sense: "дать на время, с возвратом" },
      { word: "überreichen", sense: "вручить торжественно" },
      { word: "spenden", sense: "пожертвовать на общее дело" },
    ],
  },
  {
    base: "helfen",
    gloss: "помогать",
    level: "B1",
    synonyms: [
      { word: "unterstützen", sense: "поддерживать, в том числе деньгами" },
      { word: "retten", sense: "спасти из опасности" },
      { word: "betreuen", sense: "вести и курировать длительно" },
      { word: "pflegen", sense: "ухаживать за больным" },
      { word: "fördern", sense: "способствовать развитию, продвигать" },
    ],
  },
  {
    base: "schön",
    gloss: "красивый",
    level: "B1",
    synonyms: [
      { word: "hübsch", sense: "милый, симпатичный" },
      { word: "prächtig", sense: "роскошный и пышный" },
      { word: "malerisch", sense: "живописный, о виде и местности" },
      { word: "elegant", sense: "изысканный, о движении и одежде" },
      { word: "reizend", sense: "очаровательный, о человеке и жесте" },
    ],
  },
  {
    base: "schlecht",
    gloss: "плохой",
    level: "B1",
    synonyms: [
      { word: "mies", sense: "паршивый, разговорно о настроении и погоде" },
      { word: "fehlerhaft", sense: "с ошибками, дефектный" },
      { word: "schädlich", sense: "вредный для здоровья или среды" },
      { word: "unangenehm", sense: "неприятный, о впечатлении" },
      { word: "mangelhaft", sense: "недостаточный, о качестве и оценке" },
    ],
  },
  {
    base: "denken",
    gloss: "думать",
    level: "B2",
    synonyms: [
      { word: "überlegen", sense: "взвешивать перед решением" },
      { word: "vermuten", sense: "предполагать без уверенности" },
      { word: "grübeln", sense: "мучительно размышлять, не находя выхода" },
      { word: "meinen", sense: "иметь мнение, считать" },
      { word: "schätzen", sense: "прикидывать, оценивать на глаз" },
    ],
  },
  {
    base: "bekommen",
    gloss: "получать",
    level: "B2",
    synonyms: [
      { word: "erhalten", sense: "получить официально" },
      { word: "kriegen", sense: "получить, разговорно" },
      { word: "erben", sense: "получить в наследство" },
      { word: "gewinnen", sense: "выиграть в состязании или лотерее" },
      { word: "beziehen", sense: "получать регулярно: зарплату, пособие" },
    ],
  },
  {
    base: "wichtig",
    gloss: "важный",
    level: "B2",
    synonyms: [
      { word: "entscheidend", sense: "решающий, от него зависит исход" },
      { word: "dringend", sense: "срочный, не терпит отлагательства" },
      { word: "wesentlich", sense: "существенный, по сути дела" },
      { word: "unverzichtbar", sense: "незаменимый, без него никак" },
      { word: "maßgeblich", sense: "определяющий, задающий норму" },
    ],
  },
];

function normalizeWordKey(value: string | undefined) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase("de-DE")
    .replace(/ß/gu, "ss")
    .replace(/[^\p{Letter}]+/gu, "");
}

const FIELDS_BY_BASE = new Map(
  WORD_FIELDS.map((field) => [normalizeWordKey(field.base), field]),
);

const SYNONYMS_BY_FIELD = new Map(
  WORD_FIELDS.map((field) => [
    field.base,
    new Map(
      field.synonyms.map((synonym) => [normalizeWordKey(synonym.word), synonym]),
    ),
  ]),
);

export function wordFieldFor(base: string | undefined) {
  const key = normalizeWordKey(base);
  return key ? FIELDS_BY_BASE.get(key) : undefined;
}

/** The five dictionary forms a player sees as the word bank. */
export function wordFieldBank(field: WordField) {
  return field.synonyms.map((synonym) => synonym.word);
}

export function wordFieldSynonymOf(field: WordField, word: string | undefined) {
  const key = normalizeWordKey(word);
  return key ? SYNONYMS_BY_FIELD.get(field.base)?.get(key) : undefined;
}

const LEVEL_RANK: Record<string, number> = { A1: 0, A2: 1, B1: 2, B2: 3 };

// The level caps how demanding the sentence around the gap may get. The
// synonyms themselves are the new material by definition, so an A1 shift still
// meets flüstern — it just meets it in an A1 sentence.
export function wordFieldsForLevel(level: string | undefined) {
  const ceiling = LEVEL_RANK[String(level ?? "").toUpperCase()] ?? 0;
  const fitting = WORD_FIELDS.filter(
    (field) => LEVEL_RANK[field.level] <= ceiling,
  );
  return fitting.length
    ? fitting
    : WORD_FIELDS.filter((field) => field.level === "A1");
}

/**
 * Picks the fields one package drills. Stepping by `count` walks the whole
 * catalogue before a field comes back, so consecutive packages never repeat.
 */
export function pickWordFields(level: string | undefined, seed = 0, count = 2) {
  const pool = wordFieldsForLevel(level);
  const wanted = Math.max(1, Math.min(Math.trunc(count), pool.length));
  const step = Math.trunc(seed) * wanted;
  const start = ((step % pool.length) + pool.length) % pool.length;
  return Array.from(
    { length: wanted },
    (_, index) => pool[(start + index) % pool.length],
  );
}

export function wordFieldInstruction(base: string) {
  return `Вместо стёртого «${base}» вставьте точный синоним.`;
}

export function isWordFieldTopic(grammarTopic: string | undefined) {
  return normalizeTopicKey(grammarTopic) === normalizeTopicKey(WORD_FIELD_TOPIC);
}

/**
 * The synonym drill's own rules. Its giveaway is not grammar but the
 * translation: name the nuance in Russian and the item answers itself.
 */
export function wordFieldQualityRules(fields: readonly WordField[]): string[] {
  const names = fields.map((field) => field.base).join(", ");
  return [
    "Jede Aufgabe hat genau vier Antwortmoeglichkeiten.",
    `Alle vier Optionen sind Synonyme DESSELBEN Grundworts (${names}) und stehen in genau derselben grammatischen Form, damit die Form nichts verraet.`,
    "Genau ein Synonym passt in den Satz; die drei anderen sind dort sachlich falsch oder stilistisch unmoeglich.",
    "Der Satz enthaelt ein eindeutiges Kontextsignal — Lautstaerke, Tempo, Ort, Absicht, Gefuehl oder Menge —, das genau ein Synonym erzwingt.",
    "Nie zwei Optionen, die im selben Satz beide funktionieren wuerden.",
    "Die Luecke ___ deckt nur das Synonym ab; alles andere steht fertig im Satz.",
    "Die russische Uebersetzung benutzt das neutrale Grundwort und nennt die Nuance NICHT: sonst loest der Lerner die Aufgabe aus der Uebersetzung statt aus dem Kontext.",
    "rule nennt die Nuance des richtigen Synonyms UND das Signal im Satz, das sie erzwingt.",
    "correctAnswer ist der exakte Text von options[correct].",
    "Keine abgeschnittenen Saetze, keine Erklaerungen ausserhalb von rule, kein Markdown.",
  ];
}

// Listening replaces the written task entirely, so the practice mode decides
// the shape before the grammar topic gets a say.
export function exerciseFormatFor(
  grammarTopic: string | undefined,
  mode?: string,
): ExerciseFormat {
  if (mode === "audio") return AUDIO_FORMAT;
  if (isWordFieldTopic(grammarTopic)) return WORD_FIELD_FORMAT;
  return wordOrderInstruction(grammarTopic) ? WORD_ORDER_FORMAT : GAP_FORMAT;
}

// Listening is answered from options like recognition is, so it reads the same
// hint slot.
export function exerciseHint(format: ExerciseFormat, mode: string) {
  return mode === "recall" ? format.hints.recall : format.hints.recognition;
}

export function wordOrderFragments(context: string) {
  return context.split("/").map((fragment) => fragment.trim()).filter(Boolean);
}

function sortedWords(value: string) {
  return value
    .replace(/[.,!?;:…"«»()]/gu, " ")
    .split(/[/\s]+/u)
    .map((word) => word.toLocaleLowerCase("de-DE"))
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right, "de"));
}

export function usesEveryFragment(context: string, answer: string) {
  const fragments = sortedWords(context);
  const words = sortedWords(answer);
  return fragments.length > 0
    && fragments.length === words.length
    && fragments.every((word, index) => word === words[index]);
}

/**
 * The generator's standing quality rules. Rules 9 and 10 of the See Escape
 * prompt cover its plain-text answer key; here the model answers in JSON, so
 * they are restated for that payload instead.
 */
export function qualityRules(grammarTopic: string): string[] {
  return [
    "Jede Aufgabe hat genau vier Antwortmoeglichkeiten.",
    "Genau eine Antwort ist grammatisch korrekt.",
    "Die falschen Antworten sind plausibel, aber eindeutig falsch.",
    `Alle vier Optionen gehoeren zur selben Kategorie und unterscheiden sich NUR in dem Merkmal, das "${grammarTopic}" prueft. Baue nie zwei Fehler in eine Option (etwa falsche Verbform UND falsches Pronomen): sonst kann der Lerner die Loesung ueber das zweite Merkmal erraten, ohne das Thema zu beherrschen.`,
    "Alles, was nicht geprueft wird, steht fertig im Satz und nicht in den Optionen. Die Luecke ___ deckt genau das gepruefte Element ab, nicht mehr.",
    "Die richtige Antwort muss absolut korrekt sein. Wenn du unsicher bist, formuliere die Aufgabe neu.",
    `Pruefe jede Aufgabe gegen Regel 4: Waere sie auch ohne Kenntnis von "${grammarTopic}" loesbar, schreibe sie neu.`,
    "Loese jede deiner Aufgaben selbst und setze correct und correctAnswer erst nach dieser Selbstpruefung.",
    "correctAnswer ist der exakte Text von options[correct].",
    "Keine abgeschnittenen Saetze, keine Erklaerungen ausserhalb von rule, kein Markdown.",
  ];
}

/**
 * The listening generator's own rules, kept in See Escape's English wording
 * because that is the language its audio prompt is written in.
 */
export const AUDIO_QUALITY_RULES: readonly string[] = [
  "Every German sentence is natural, complete, and 6 to 14 words long.",
  "The correct Russian option is an exact translation.",
  "Wrong options are realistic learner traps: similar word field, separable prefix, modal verb, preposition, case relation, movement direction, false friend, or verb valency.",
  "All four options are Russian, similarly short, plausible, and distinct.",
];

/**
 * Per-topic authoring rules. Without them the model writes items that are
 * solvable from a second, untested feature — the giveaway the See Escape rule
 * sheet exists to close.
 */
export const TOPIC_RULES: Record<string, string> = {
  "Infinitiv mit zu": "Verwende NUR Verben, die \"zu + Infinitiv\" verlangen: versuchen, beginnen, anfangen, aufhören, vorhaben, hoffen, vergessen, planen, sich freuen, Lust haben, Es ist wichtig/möglich/schwer... NIEMALS Modalverben (können, müssen, sollen, wollen, dürfen, mögen) — diese stehen mit Infinitiv OHNE \"zu\"! Richtig: \"Er versucht, den Bahnhof zu finden.\" | Falsch: \"Er kann den Bahnhof zu finden.\"",

  "Modalverben": "Modalverben: können, müssen, sollen, wollen, dürfen, mögen/möchten. Modalverb auf Position 2, Infinitiv am Satzende OHNE \"zu\"! Richtig: \"Er kann den Bahnhof finden.\" | Falsch: \"Er kann den Bahnhof zu finden.\"",

  "Perfekt": "sein + Partizip II bei: Bewegungsverben (gehen→ist gegangen, fahren→ist gefahren, kommen→ist gekommen, fliegen→ist geflogen, laufen→ist gelaufen), Zustandsänderung (einschlafen→ist eingeschlafen, aufwachen, sterben, werden, bleiben). haben + Partizip II bei ALLEN anderen Verben (machen→hat gemacht, essen→hat gegessen, lesen→hat gelesen). Partizip II: ge-...-t (regelmäßig: gemacht, gekauft), ge-...-en (unregelmäßig: gegangen, geschrieben). Verben auf -ieren: KEIN ge- (studiert, telefoniert). Trennbare: ge- zwischen Präfix und Stamm (ein·ge·kauft, auf·ge·standen). Untrennbare (be-, er-, ver-, ent-, zer-, emp-, miss-): KEIN ge- (besucht, verstanden, erzählt).",

  "Präteritum": "Regelmäßig: Stamm + -te/-test/-te/-ten/-tet/-ten (machte, sagtest). Unregelmäßig: Stammvokalwechsel OHNE -te (gehen→ging, sehen→sah, nehmen→nahm, schreiben→schrieb, lesen→las, sprechen→sprach). Mischverben: Vokalwechsel + -te (bringen→brachte, denken→dachte, kennen→kannte, wissen→wusste).",

  "Dativ": "Dativpräpositionen: mit, nach, bei, seit, von, zu, aus, gegenüber, ab. Dativverben: helfen, danken, gehören, gefallen, schmecken, passen, gratulieren, antworten, folgen. Formen: dem (m/n), der (f), den + -n (Pl). ein→einem (m/n), eine→einer (f).",

  "Akkusativ": "Akkusativpräpositionen: durch, für, gegen, ohne, um. Formen: den (m), die (f), das (n), die (Pl). ein→einen (m), eine (f), ein (n). Transitive Verben: sehen, kaufen, essen, trinken, lesen, schreiben, brauchen, haben, finden.",

  "Genitiv": "Genitivpräpositionen: wegen, trotz, während, innerhalb, außerhalb, statt/anstatt. Maskulin/Neutrum: des/eines + Nomen mit -(e)s (des Mannes, eines Kindes). Feminin: der/einer + Nomen OHNE Endung (der Frau, einer Studentin). Plural: der + Nomen OHNE Endung (der Kinder).",

  "Adjektivdeklination": "Nach bestimmtem Artikel (der/die/das): -e (Nom. Sg. alle Genera), -en (alle anderen Fälle). Nach unbestimmtem Artikel (ein/kein/mein): -er (Nom.m), -es (Nom./Akk.n), -e (Nom./Akk.f), -en (alle anderen). Ohne Artikel: starke Endungen — Signalendungen des bestimmten Artikels: -er (m.Nom), -e (f.Nom/Akk), -es (n.Nom/Akk), -en (Dat/Gen), -em (m/n.Dat). Richtig: \"ein alter Mann\" (m.Nom), \"mit dem alten Mann\" (m.Dat) | Falsch: \"ein alten Mann\", \"mit dem alter Mann\"",

  "Wechselpräpositionen": "an, auf, hinter, in, neben, über, unter, vor, zwischen. Wohin? (Bewegung/Richtung) → Akkusativ: \"Ich stelle das Buch auf den Tisch.\" (stellen, legen, setzen, hängen) Wo? (Position/Ort) → Dativ: \"Das Buch steht auf dem Tisch.\" (stehen, liegen, sitzen, hängen)",

  "Negation": "\"nicht\" verneint: Verben, Adjektive, Adverbien, Präpositionalphrasen. Position: vor dem verneinten Element. \"kein/keine/keinen/keinem/keiner\" ersetzt unbestimmten Artikel oder Nullartikel + Nomen. Richtig: \"Ich habe kein Auto.\" | Falsch: \"Ich habe nicht Auto.\" Richtig: \"Ich komme nicht aus Berlin.\" | Falsch: \"Ich komme kein aus Berlin.\"",

  "Wortstellung im Hauptsatz": "Finites Verb IMMER auf Position 2! Inversion bei Adverb/Objekt auf Pos.1: Verb Pos.2, Subjekt Pos.3. Richtig: \"Gestern ging ich ins Kino.\" | Falsch: \"Gestern ich ging ins Kino.\"",

  "Wortstellung im Nebensatz": "Nach Konjunktion (weil, dass, wenn, ob, als, nachdem, obwohl): finites Verb am SATZENDE. Richtig: \"Ich weiß, dass er morgen kommt.\" | Falsch: \"Ich weiß, dass er kommt morgen.\" Perfekt im Nebensatz: \"..., weil er nach Hause gegangen ist.\" (Hilfsverb am Ende!)",

  "dass-Sätze": "\"dass\" + Nebensatzwortstellung (Verb am Ende). Richtig: \"Ich glaube, dass er recht hat.\" | Falsch: \"Ich glaube, dass er hat recht.\"",

  "weil-Sätze": "\"weil\" + Nebensatzwortstellung (Verb am Ende). Richtig: \"Ich bleibe zu Hause, weil ich krank bin.\" | Falsch: \"Ich bleibe zu Hause, weil ich bin krank.\"",

  "wenn-Sätze": "\"wenn\" + Verb am Ende. Hauptsatz nach wenn-Satz: Verb auf Position 1. Richtig: \"Wenn es regnet, bleibe ich zu Hause.\" | Falsch: \"Wenn es regnet, ich bleibe zu Hause.\"",

  "Relativsätze": "Relativpronomen: Genus/Numerus vom BEZUGSWORT, aber Kasus von der FUNKTION im Nebensatz! Bestimme den Kasus: Was ist die Rolle des Relativpronomens im Nebensatz? Subjekt→Nom, direktes Objekt→Akk, indirektes Objekt→Dat. Nom: der/die/das/die. Akk: den/die/das/die. Dat: dem/der/dem/denen. Gen: dessen/deren. Richtig: \"Der Turm, den man sehen kann\" (Akk! weil: man sieht DEN Turm). Falsch: \"Der Turm, dem man sehen kann.\" Richtig: \"Der Mann, dem ich helfe\" (Dat! weil: ich helfe DEM Mann). Verb am Ende des Relativsatzes!",

  "Konjunktiv II": "Irreale Wünsche, höfliche Bitten, Ratschläge. würde + Infinitiv (Standard). Eigene Formen: wäre, hätte, könnte, müsste, sollte, dürfte, wüsste, käme, ginge, bräuchte. Richtig: \"Wenn ich reich wäre, würde ich reisen.\" | Falsch: \"Wenn ich reich würde sein...\"",

  "Passiv": "Vorgangspassiv: werden + Partizip II. \"Das Buch wird gelesen.\" Zustandspassiv: sein + Partizip II. \"Das Fenster ist geöffnet.\" Agens: von + Dativ. Präteritum: wurde + P.II. Perfekt: ist + P.II + worden.",

  "Präsens": "Konjugation: -e, -st, -t, -en, -t, -en. Stammvokalwechsel (2./3. Sg.): e→i (sprechen→spricht, helfen→hilft), e→ie (lesen→liest, sehen→sieht), a→ä (fahren→fährt, schlafen→schläft). Verben auf -ten/-den: Bindevokal -e- (du arbeitest, er arbeitet).",

  "Futur I": "werden + Infinitiv. werden: werde, wirst, wird, werden, werdet, werden. Richtig: \"Ich werde morgen kommen.\" | Falsch: \"Ich werde morgen zu kommen.\"",

  "Imperativ": "du: Stamm (+e optional): \"Komm!\", \"Mach!\". e→i/ie bleibt: \"Sprich!\", \"Lies!\", \"Nimm!\" (KEIN -st, KEIN Pronomen). a→ä fällt weg: \"Fahr!\" (nicht \"Fähr!\"). ihr: wie Präsens ohne \"ihr\": \"Kommt!\", \"Lest!\". Sie: Infinitiv + Sie: \"Kommen Sie!\", \"Lesen Sie!\"",

  "Artikel": "Bestimmt: der (m), die (f), das (n), die (Pl). Unbestimmt: ein (m/n), eine (f). Genus-Regeln: -ung/-heit/-keit/-schaft/-tion/-tät → die. -chen/-lein → das. -er/-ling → oft der.",

  "Reflexive Verben": "Reflexivpronomen Akkusativ: mich, dich, sich, uns, euch, sich. Dativ: mir, dir, sich, uns, euch, sich — Dativ nur, wenn zusätzlich ein Akkusativobjekt im Satz steht: \"Ich wasche mich.\" (Akk) aber \"Ich wasche mir die Hände.\" (Dat). AUFGABENBAU — verbindlich: Die Lücke ___ steht AUSSCHLIESSLICH für das Reflexivpronomen; das Verb steht bereits fertig konjugiert im Satz. Alle vier Optionen sind nackte Reflexivpronomen (mich, dich, sich, uns, euch, mir, dir) und unterscheiden sich NUR im Pronomen. Setze niemals die Verbform mit in die Optionen: sonst erschließt der Lerner die Lösung über die Konjugation und muss das Thema gar nicht kennen. Falsch, viel zu leicht: \"Wir ___ heute Abend im Park.\" mit den Optionen \"treffen uns / treffen sich / trifft euch / trefft uns\" — hier verrät schon \"wir\" die Verbform. Richtig: \"Wir treffen ___ heute Abend im Park.\" mit den Optionen \"uns / sich / euch / mich\". Richtig für den Dativ: \"Ich putze ___ nach dem Essen die Zähne.\" mit den Optionen \"mir / mich / sich / dir\". Die falschen Pronomen müssen aus derselben Reihe stammen (andere Person oder anderer Kasus), nicht aus einer anderen Wortart. Echte reflexive Verben verwenden: sich freuen, sich interessieren, sich treffen, sich waschen, sich anziehen, sich beeilen, sich erinnern, sich vorstellen, sich setzen, sich fühlen, sich ärgern, sich entschuldigen.",

  "Wortfelder & Synonyme": "Wortfeldarbeit statt Grammatik. Ersetze ein abgenutztes Alltagswort (sagen, gehen, sehen, machen, gut, schön ...) durch das eine Synonym, das der Satz verlangt. Alle vier Optionen kommen aus DEMSELBEN Wortfeld und stehen in derselben Form. Der Satz muss ein Signal tragen, das genau ein Synonym erzwingt: \"Das Baby schläft, deshalb ___ wir nur noch.\" → flüstern, weil \"Das Baby schläft\" die Lautstaerke vorgibt. Falsch waere \"Wir ___ im Garten.\" mit flüstern/rufen/murmeln/behaupten: dort passen mehrere. Die russische Uebersetzung nennt weiter das neutrale Grundwort, damit sie die Nuance nicht verraet.",

  "Nominativ": "Subjekt im Nominativ. Prädikativ nach sein/werden/bleiben ebenfalls Nominativ. Richtig: \"Der Mann ist ein guter Lehrer.\" | Falsch: \"Der Mann ist einen guten Lehrer.\"",
};

function normalizeTopicKey(value: string | undefined) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .replace(/ä/gu, "a").replace(/ö/gu, "o").replace(/ü/gu, "u").replace(/ß/gu, "ss")
    .replace(/ae/giu, "a").replace(/oe/giu, "o").replace(/ue/giu, "u")
    .replace(/saetze/giu, "satze")
    .replace(/[^a-z0-9]+/giu, "")
    .toLowerCase();
}

// Callers pass the topic exactly as it appears in GRAMMAR_TOPICS, but the rule
// sheet is shared with projects that spell umlauts out, so both reach the same
// entry.
const RULES_BY_NORMALIZED_TOPIC = new Map(
  Object.entries(TOPIC_RULES).map(([topic, rule]) => [normalizeTopicKey(topic), rule]),
);

export function topicRuleFor(grammarTopic: string | undefined) {
  const target = normalizeTopicKey(grammarTopic);
  return target ? RULES_BY_NORMALIZED_TOPIC.get(target) ?? "" : "";
}
