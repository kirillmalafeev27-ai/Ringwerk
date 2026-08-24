export const LANGUAGE_LEVELS = ["A1", "A2", "B1", "B2"] as const;

export const QUESTION_MODES = [
  { id: "recognition", label: "Узнавание" },
  { id: "recall", label: "Воспроизведение" },
] as const;

export const LEXICAL_TOPICS = [
  "Alltag & Routinen",
  "Familie & Beziehungen",
  "Wohnen & Nachbarschaft",
  "Essen & Ernährung",
  "Einkaufen & Konsum",
  "Kleidung & Mode",
  "Gesundheit & Wohlbefinden",
  "Körper & Bewegung",
  "Sport & Fitness",
  "Freizeit & Hobbys",
  "Schule & Lernen",
  "Studium & Universität",
  "Arbeit & Beruf",
  "Bewerbung & Karriere",
  "Büro & Remote Work",
  "Reisen & Tourismus",
  "Hotel & Unterkunft",
  "Verkehr & Mobilität",
  "Stadt & öffentlicher Raum",
  "Landleben",
  "Natur & Tiere",
  "Wetter & Jahreszeiten",
  "Umwelt & Klimawandel",
  "Energie & Nachhaltigkeit",
  "Müll & Kreislaufwirtschaft",
  "Technik & Innovation",
  "Internet & digitale Dienste",
  "Smartphones & Apps",
  "Soziale Medien & Influencer",
  "Datenschutz & Cybersicherheit",
  "Nachrichten & Medienkompetenz",
  "Filme, Serien & Streaming",
  "Musik & Podcasts",
  "Bücher & Literatur",
  "Kunst & Kultur",
  "Deutschland & DACH-Länder",
  "Feste, Traditionen & Feiertage",
  "Gesellschaft & Zusammenleben",
  "Migration & Integration",
  "Vielfalt & Inklusion",
  "Politik & Demokratie",
  "Wirtschaft & Finanzen",
  "Wissenschaft & Forschung",
  "Kommunikation & Konflikte",
  "Gefühle & mentale Gesundheit",
  "Freundschaft & Partnerschaft",
  "Termine & Zeitmanagement",
  "Notfälle & Sicherheit",
  "Zukunft & Lebensplanung",
] as const;

export const GRAMMAR_TOPICS = [
  "Präsens",
  "Perfekt",
  "Präteritum",
  "Futur I",
  "Imperativ",
  "Modalverben",
  "Trennbare Verben",
  "Untrennbare Verben",
  "Reflexive Verben",
  "Verben mit Präpositionen",
  "Lassen",
  "Werden",
  "Sein vs. haben",
  "Nominativ",
  "Akkusativ",
  "Dativ",
  "Genitiv",
  "Artikel",
  "Possessivartikel",
  "Pronomen",
  "Personalpronomen",
  "Relativpronomen",
  "Fragewörter",
  "Negation",
  "Adjektivdeklination",
  "Komparativ",
  "Superlativ",
  "Zahlen und Datum",
  "Temporale Präpositionen",
  "Lokale Präpositionen",
  "Wechselpräpositionen",
  "Präpositionen mit Dativ",
  "Präpositionen mit Akkusativ",
  "Satzklammer",
  "Wortstellung im Hauptsatz",
  "Wortstellung im Nebensatz",
  "weil-Sätze",
  "dass-Sätze",
  "wenn-Sätze",
  "obwohl-Sätze",
  "damit-Sätze",
  "Relativsätze",
  "Indirekte Fragen",
  "Infinitiv mit zu",
  "Konjunktiv II",
  "Passiv",
  "Plusquamperfekt",
  "Doppelkonjunktionen",
  "als vs. wenn",
  "Partizip I und II",
  "Genitivpräpositionen",
] as const;

export type LanguageLevel = (typeof LANGUAGE_LEVELS)[number];
export type QuestionMode = (typeof QUESTION_MODES)[number]["id"];
export type LexicalTopic = (typeof LEXICAL_TOPICS)[number];
export type GrammarTopic = (typeof GRAMMAR_TOPICS)[number];

export type LearningSettings = {
  level: LanguageLevel;
  mode: QuestionMode;
  lexicalTopic: LexicalTopic;
  grammarTopic: GrammarTopic;
};

export type TopicGroup<T extends string> = { label: string; topics: readonly T[] };

export const LEXICAL_TOPIC_GROUPS: readonly TopicGroup<LexicalTopic>[] = [
  { label: "Повседневная жизнь", topics: LEXICAL_TOPICS.slice(0, 10) },
  { label: "Учёба и работа", topics: LEXICAL_TOPICS.slice(10, 15) },
  { label: "Путешествия и окружающий мир", topics: LEXICAL_TOPICS.slice(15, 22) },
  { label: "Экология и технологии", topics: LEXICAL_TOPICS.slice(22, 30) },
  { label: "Культура и общество", topics: LEXICAL_TOPICS.slice(30, 43) },
  { label: "Общение и жизненные ситуации", topics: LEXICAL_TOPICS.slice(43) },
];

export const GRAMMAR_TOPIC_GROUPS: readonly TopicGroup<GrammarTopic>[] = [
  { label: "Времена и наклонение", topics: GRAMMAR_TOPICS.slice(0, 6) },
  { label: "Глаголы", topics: GRAMMAR_TOPICS.slice(6, 13) },
  { label: "Падежи, артикли и местоимения", topics: GRAMMAR_TOPICS.slice(13, 23) },
  { label: "Формы слов", topics: GRAMMAR_TOPICS.slice(23, 28) },
  { label: "Предлоги", topics: [...GRAMMAR_TOPICS.slice(28, 33), GRAMMAR_TOPICS.at(-1)!] },
  { label: "Построение предложения", topics: GRAMMAR_TOPICS.slice(33, 44) },
  { label: "Продвинутая грамматика", topics: GRAMMAR_TOPICS.slice(44, -1) },
];

export const DEFAULT_LEARNING_SETTINGS: LearningSettings = {
  level: "A2",
  mode: "recognition",
  lexicalTopic: "Alltag & Routinen",
  grammarTopic: "Präsens",
};

export const LEARNING_SETTINGS_STORAGE_KEY = "ringwerk.learning.v1";

function normalizeText(value: unknown, maximum = 80) {
  return String(value ?? "").normalize("NFKC").trim().slice(0, maximum);
}

export function normalizeLearningSettings(candidate: unknown): LearningSettings {
  const source = candidate && typeof candidate === "object" && !Array.isArray(candidate)
    ? candidate as Record<string, unknown>
    : {};
  const requestedLevel = normalizeText(source.level, 8).toUpperCase();
  const requestedMode = normalizeText(source.mode, 24).toLowerCase();
  const requestedLexical = normalizeText(source.lexicalTopic);
  const requestedGrammar = normalizeText(source.grammarTopic);
  return {
    level: (LANGUAGE_LEVELS as readonly string[]).includes(requestedLevel)
      ? requestedLevel as LanguageLevel
      : DEFAULT_LEARNING_SETTINGS.level,
    mode: QUESTION_MODES.some((entry) => entry.id === requestedMode)
      ? requestedMode as QuestionMode
      : DEFAULT_LEARNING_SETTINGS.mode,
    lexicalTopic: LEXICAL_TOPICS.find((topic) => topic.normalize("NFKC") === requestedLexical)
      ?? DEFAULT_LEARNING_SETTINGS.lexicalTopic,
    grammarTopic: GRAMMAR_TOPICS.find((topic) => topic.normalize("NFKC") === requestedGrammar)
      ?? DEFAULT_LEARNING_SETTINGS.grammarTopic,
  };
}

export function learningPoolKey(settings: Pick<LearningSettings, "level" | "lexicalTopic" | "grammarTopic">) {
  // Both practice modes deliberately consume the same generated pool.
  return [settings.level, settings.lexicalTopic, settings.grammarTopic].join("|");
}
