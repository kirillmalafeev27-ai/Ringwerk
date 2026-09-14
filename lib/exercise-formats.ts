/**
 * The exercise formats the See Escape generator writes, shared verbatim so every
 * German drill in this project has the same shape and the same authoring rules.
 *
 * A format describes what stands in `context` and what the four options are;
 * `TOPIC_RULES` adds the per-topic rule sheet that keeps an item solvable only
 * through the grammar topic it claims to test.
 */

export type ExerciseFormatId = "gap" | "word-order";

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

export const EXERCISE_FORMATS: Record<ExerciseFormatId, ExerciseFormat> = {
  gap: GAP_FORMAT,
  "word-order": WORD_ORDER_FORMAT,
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

export function exerciseFormatFor(grammarTopic: string | undefined): ExerciseFormat {
  return wordOrderInstruction(grammarTopic) ? WORD_ORDER_FORMAT : GAP_FORMAT;
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
