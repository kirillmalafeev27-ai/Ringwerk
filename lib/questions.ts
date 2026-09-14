import { EXERCISE_FORMATS, exerciseFormatFor } from "@/lib/exercise-formats";
import type { LearningSettings } from "@/lib/learning-settings";

export {
  EXERCISE_FORMATS,
  exerciseFormatFor,
  usesEveryFragment,
  wordOrderFragments,
  wordOrderInstruction,
} from "@/lib/exercise-formats";
export type { ExerciseFormat, ExerciseFormatId } from "@/lib/exercise-formats";

export type GameQuestion = {
  id: string;
  prompt: string;
  context: string;
  translation: string;
  options: [string, string, string, string];
  correct: 0 | 1 | 2 | 3;
  rule: string;
  level?: string;
  lexicalTopic?: string;
  grammarTopic?: string;
};

const FALLBACK_DATA: Array<Omit<GameQuestion, "id">> = [
  { level: "A1", lexicalTopic: "Verkehr & Mobilität", grammarTopic: "Artikel", prompt: "Вставьте правильную немецкую форму.", context: "___ Zug kommt um acht Uhr.", translation: "Поезд прибывает в восемь часов.", options: ["Der", "Die", "Das", "Den"], correct: 0, rule: "Мужской род в Nominativ требует артикль der." },
  { level: "A1", lexicalTopic: "Essen & Ernährung", grammarTopic: "Präsens", prompt: "Вставьте правильную немецкую форму.", context: "Maria ___ jeden Morgen Kaffee.", translation: "Мария пьёт кофе каждое утро.", options: ["trinkt", "trinken", "trinke", "trinkst"], correct: 0, rule: "В Präsens для sie в единственном числе: trinkt." },
  { level: "A1", lexicalTopic: "Natur & Tiere", grammarTopic: "Akkusativ", prompt: "Вставьте правильную немецкую форму.", context: "Ich sehe ___ Hund im Park.", translation: "Я вижу собаку в парке.", options: ["den", "der", "dem", "das"], correct: 0, rule: "Мужской род в Akkusativ требует артикль den." },
  { level: "A1", lexicalTopic: "Reisen & Tourismus", grammarTopic: "Wortstellung im Hauptsatz", prompt: "Соберите из всех частей главное предложение.", context: "morgen / ich / fahre / nach Berlin", translation: "Завтра я еду в Берлин.", options: ["Morgen fahre ich nach Berlin.", "Morgen ich fahre nach Berlin.", "Ich nach Berlin fahre morgen.", "Fahre ich morgen nach Berlin."], correct: 0, rule: "В главном предложении спрягаемый глагол стоит на втором месте." },
  { level: "A1", lexicalTopic: "Termine & Zeitmanagement", grammarTopic: "Negation", prompt: "Вставьте правильную немецкую форму.", context: "Wir haben ___ Zeit.", translation: "У нас нет времени.", options: ["keine", "nicht", "kein", "keinen"], correct: 0, rule: "Zeit — женского рода; отрицательный артикль в Akkusativ: keine." },
  { level: "A1", lexicalTopic: "Schule & Lernen", grammarTopic: "Modalverben", prompt: "Вставьте правильную немецкую форму.", context: "Ich ___ heute lernen.", translation: "Сегодня мне нужно учиться.", options: ["muss", "musst", "müssen", "müsst"], correct: 0, rule: "Для ich модальный глагол müssen имеет форму muss." },
  { level: "A2", lexicalTopic: "Kunst & Kultur", grammarTopic: "Perfekt", prompt: "Вставьте правильную немецкую форму.", context: "Gestern ___ wir ins Museum gegangen.", translation: "Вчера мы ходили в музей.", options: ["sind", "haben", "sein", "hat"], correct: 0, rule: "Глагол gehen образует Perfekt с sein: wir sind gegangen." },
  { level: "A2", lexicalTopic: "Wohnen & Nachbarschaft", grammarTopic: "Dativ", prompt: "Вставьте правильную немецкую форму.", context: "Ich helfe ___ neuen Nachbarin.", translation: "Я помогаю новой соседке.", options: ["der", "die", "den", "dem"], correct: 0, rule: "Глагол helfen требует Dativ; женский род — der." },
  { level: "A2", lexicalTopic: "Alltag & Routinen", grammarTopic: "Modalverben", prompt: "Вставьте правильную немецкую форму.", context: "Am Abend ___ Lukas noch lernen.", translation: "Вечером Лукасу ещё нужно учиться.", options: ["muss", "musst", "müssen", "müsst"], correct: 0, rule: "Для Lukas (er) модальный глагол müssen имеет форму muss." },
  { level: "A2", lexicalTopic: "Wohnen & Nachbarschaft", grammarTopic: "Wechselpräpositionen", prompt: "Вставьте правильную немецкую форму.", context: "Das Buch liegt auf ___ Tisch.", translation: "Книга лежит на столе.", options: ["dem", "den", "der", "das"], correct: 0, rule: "Wo? → Dativ: auf dem Tisch." },
  { level: "A2", lexicalTopic: "Verkehr & Mobilität", grammarTopic: "Trennbare Verben", prompt: "Вставьте правильную немецкую форму.", context: "Der Zug ___ um neun Uhr ___.", translation: "Поезд прибывает в девять часов.", options: ["kommt ... an", "ankommt ...", "kommt ... auf", "kommt ... mit"], correct: 0, rule: "В главном предложении приставка an отделяется: kommt ... an." },
  { level: "A2", lexicalTopic: "Gesundheit & Wohlbefinden", grammarTopic: "weil-Sätze", prompt: "Завершите немецкое предложение.", context: "Ich bleibe zu Hause, weil ...", translation: "Я остаюсь дома, потому что болен.", options: ["ich krank bin.", "ich bin krank.", "bin ich krank.", "krank ich bin."], correct: 0, rule: "В придаточном с weil спрягаемый глагол стоит в конце." },
  { level: "A2", lexicalTopic: "Stadt & öffentlicher Raum", grammarTopic: "Adjektivdeklination", prompt: "Вставьте правильную немецкую форму.", context: "Das ist ein ___ Platz.", translation: "Это тихое место.", options: ["ruhiger", "ruhige", "ruhigen", "ruhiges"], correct: 0, rule: "После ein в Nominativ мужского рода: ruhiger." },
  { level: "A2", lexicalTopic: "Alltag & Routinen", grammarTopic: "Imperativ", prompt: "Вставьте правильную немецкую форму.", context: "___ bitte die Tür!", translation: "Пожалуйста, закрой дверь!", options: ["Schließ", "Schließt", "Schließen", "Geschlossen"], correct: 0, rule: "Для du употребляется Imperativ Schließ!" },
  { level: "A2", lexicalTopic: "Schule & Lernen", grammarTopic: "Wortstellung im Nebensatz", prompt: "Соберите из всех частей придаточное предложение.", context: "Ich hoffe, / dass / er / die Prüfung / besteht", translation: "Надеюсь, что он сдаст экзамен.", options: ["Ich hoffe, dass er die Prüfung besteht.", "Ich hoffe, dass er besteht die Prüfung.", "Ich hoffe, dass besteht er die Prüfung.", "Ich hoffe, er dass die Prüfung besteht."], correct: 0, rule: "После dass спрягаемый глагол уходит в самый конец придаточного: dass er die Prüfung besteht." },
  { level: "B1", lexicalTopic: "Kommunikation & Konflikte", grammarTopic: "Konjunktiv II", prompt: "Вставьте правильную немецкую форму.", context: "___ Sie mir bitte helfen?", translation: "Не могли бы Вы мне помочь?", options: ["Könnten", "Können", "Konnten", "Kann"], correct: 0, rule: "Вежливая просьба строится с Konjunktiv II: Könnten Sie ...?" },
  { level: "B1", lexicalTopic: "Schule & Lernen", grammarTopic: "Infinitiv mit zu", prompt: "Вставьте правильную немецкую форму.", context: "Anna versucht, den Text ___ verstehen.", translation: "Анна пытается понять текст.", options: ["zu", "zum", "um zu", "ohne"], correct: 0, rule: "После versuchen используется Infinitiv mit zu." },
  { level: "B1", lexicalTopic: "Wohnen & Nachbarschaft", grammarTopic: "Passiv", prompt: "Вставьте правильную немецкую форму.", context: "Die Tür ___ jeden Abend geschlossen.", translation: "Дверь закрывают каждый вечер.", options: ["wird", "ist", "hat", "werden"], correct: 0, rule: "Passiv Präsens: wird + Partizip II." },
  { level: "B1", lexicalTopic: "Familie & Beziehungen", grammarTopic: "Relativpronomen", prompt: "Вставьте правильную немецкую форму.", context: "Das ist der Mann, ___ ich gestern geholfen habe.", translation: "Это мужчина, которому я вчера помог.", options: ["dem", "den", "der", "dessen"], correct: 0, rule: "Helfen требует Dativ; Relativpronomen мужского рода — dem." },
  { level: "B1", lexicalTopic: "Familie & Beziehungen", grammarTopic: "Präteritum", prompt: "Вставьте правильную немецкую форму.", context: "Als Kind ___ sie oft am Meer.", translation: "В детстве она часто бывала у моря.", options: ["war", "ist", "sein", "wäre"], correct: 0, rule: "Präteritum глагола sein для sie: war." },
  { level: "B1", lexicalTopic: "Filme, Serien & Streaming", grammarTopic: "Doppelkonjunktionen", prompt: "Вставьте правильную конструкцию.", context: "___ der Film war spannend, ___ die Musik war gut.", translation: "Не только фильм был захватывающим, но и музыка была хорошей.", options: ["Nicht nur ... sondern auch", "Entweder ... aber", "Sowohl ... oder", "Je ... sondern"], correct: 0, rule: "Парная конструкция: nicht nur ... sondern auch." },
  { level: "B1", lexicalTopic: "Arbeit & Beruf", grammarTopic: "Wortstellung im Nebensatz", prompt: "Соберите из всех частей придаточное предложение.", context: "Er fragt, / ob / ich / morgen / arbeiten / muss", translation: "Он спрашивает, должен ли я завтра работать.", options: ["Er fragt, ob ich morgen arbeiten muss.", "Er fragt, ob ich muss morgen arbeiten.", "Er fragt, ob muss ich morgen arbeiten.", "Er fragt, ob ich morgen muss arbeiten."], correct: 0, rule: "В придаточном с ob модальный глагол закрывает предложение: ob ich morgen arbeiten muss." },
  { level: "B2", lexicalTopic: "Arbeit & Beruf", grammarTopic: "Genitiv", prompt: "Вставьте правильную немецкую форму.", context: "Während ___ Treffens blieb das Handy aus.", translation: "Во время встречи телефон оставался выключенным.", options: ["des", "dem", "den", "der"], correct: 0, rule: "Während обычно требует Genitiv; das Treffen → des Treffens." },
  { level: "B2", lexicalTopic: "Essen & Ernährung", grammarTopic: "Plusquamperfekt", prompt: "Вставьте правильную немецкую форму.", context: "Nachdem er gegessen ___, ging er los.", translation: "После того как он поел, он отправился в путь.", options: ["hatte", "hat", "war", "wurde"], correct: 0, rule: "Plusquamperfekt: hatte + Partizip II." },
  { level: "B2", lexicalTopic: "Studium & Universität", grammarTopic: "Indirekte Fragen", prompt: "Завершите немецкий вопрос.", context: "Kannst du mir sagen, ...", translation: "Можешь сказать мне, когда начинается курс?", options: ["wann der Kurs beginnt?", "wann beginnt der Kurs?", "wann der Kurs beginnt.", "wann beginnt Kurs der?"], correct: 0, rule: "В косвенном вопросе глагол уходит в конец: wann der Kurs beginnt." },
  { level: "B2", lexicalTopic: "Wetter & Jahreszeiten", grammarTopic: "obwohl-Sätze", prompt: "Вставьте правильный немецкий союз.", context: "___ es stark regnet, gehen wir spazieren.", translation: "Хотя идёт сильный дождь, мы идём гулять.", options: ["Obwohl", "Weil", "Damit", "Sobald"], correct: 0, rule: "Уступительное придаточное начинается с obwohl." },
  { level: "B2", lexicalTopic: "Termine & Zeitmanagement", grammarTopic: "Wortstellung im Hauptsatz", prompt: "Соберите из всех частей главное предложение.", context: "trotzdem / kommt / er / pünktlich", translation: "Тем не менее он приходит вовремя.", options: ["Trotzdem kommt er pünktlich.", "Trotzdem er kommt pünktlich.", "Er pünktlich kommt trotzdem.", "Kommt trotzdem er pünktlich."], correct: 0, rule: "После trotzdem спрягаемый глагол остаётся на втором месте." },
  { level: "B2", lexicalTopic: "Umwelt & Klimawandel", grammarTopic: "Wortstellung im Nebensatz", prompt: "Соберите из всех частей придаточное предложение.", context: "Wir wissen, / dass / die Stadt / viel / investiert / hat", translation: "Мы знаем, что город много инвестировал.", options: ["Wir wissen, dass die Stadt viel investiert hat.", "Wir wissen, dass die Stadt hat viel investiert.", "Wir wissen, dass hat die Stadt viel investiert.", "Wir wissen, dass die Stadt viel hat investiert."], correct: 0, rule: "В придаточном вспомогательный глагол идёт последним, после Partizip II: dass die Stadt viel investiert hat." },
];

export function exerciseFormatOf(question: Pick<GameQuestion, "grammarTopic">) {
  return exerciseFormatFor(question.grammarTopic);
}

export const FALLBACK_QUESTIONS: GameQuestion[] = FALLBACK_DATA.map((question) => ({
  ...question,
  id: `reserve-${hashText([question.context, ...question.options].join("|"))}`,
}));

function cleanText(value: unknown, maximum: number) {
  if (typeof value !== "string") return "";
  const withoutControls = [...value].map((character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127 || character === "<" || character === ">" ? " " : character;
  }).join("");
  return withoutControls.replace(/\s+/gu, " ").trim().slice(0, maximum);
}

export function questionFingerprint(question: Pick<GameQuestion, "context" | "options">) {
  return [question.context, ...[...question.options].sort((left, right) => left.localeCompare(right, "de"))]
    .map((value) => cleanText(value, 360).normalize("NFKC").toLocaleLowerCase("de-DE"))
    .join("|");
}

export function questionHistoryLabel(question: Pick<GameQuestion, "prompt" | "context">) {
  return `${question.prompt} ${question.context}`.trim();
}

export function normalizeQuestion(candidate: unknown, sequence = 0): GameQuestion | null {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return null;
  const source = candidate as Record<string, unknown>;
  const sourcePrompt = cleanText(source.prompt ?? source.question ?? source.instruction, 360);
  const sourceContext = cleanText(source.context ?? source.sentence ?? source.display, 360);
  const context = sourceContext || sourcePrompt;
  const prompt = sourceContext ? sourcePrompt : EXERCISE_FORMATS.gap.instruction;
  const translation = cleanText(source.translation ?? source.russianTranslation ?? source.ru, 360);
  const rule = cleanText(source.rule ?? source.explanation ?? source.rationale ?? source.grammarTopic, 360);
  const rawOptions = source.options ?? source.answers ?? source.choices;
  if (prompt.length < 4 || context.length < 2 || rule.length < 4 || !Array.isArray(rawOptions) || rawOptions.length !== 4) return null;

  const options = rawOptions.map((option) => cleanText(option, 180));
  if (options.some((option) => !option)) return null;
  if (new Set(options.map((option) => option.normalize("NFKC").toLocaleLowerCase("de-DE"))).size !== 4) return null;
  const numericCorrect = Number(source.correct ?? source.correctIndex);
  if (!Number.isInteger(numericCorrect) || numericCorrect < 0 || numericCorrect > 3) return null;
  const declaredAnswer = cleanText(source.correctAnswer ?? source.answer, 180);
  if (declaredAnswer && declaredAnswer !== options[numericCorrect]) return null;

  const tuple = options as GameQuestion["options"];
  const correct = numericCorrect as GameQuestion["correct"];
  const identity = questionFingerprint({ context, options: tuple });
  return {
    id: cleanText(source.id, 100) || `question-${hashText(identity)}-${sequence}`,
    prompt,
    context,
    translation,
    options: tuple,
    correct,
    rule,
    level: cleanText(source.level, 8) || undefined,
    lexicalTopic: cleanText(source.lexicalTopic ?? source.topic, 80) || undefined,
    grammarTopic: cleanText(source.grammarTopic, 80) || undefined,
  };
}

export function shuffleQuestion(question: GameQuestion, random = Math.random): GameQuestion {
  const entries = question.options.map((label, originalIndex) => ({ label, originalIndex }));
  for (let index = entries.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [entries[index], entries[swapIndex]] = [entries[swapIndex], entries[index]];
  }
  return {
    ...question,
    options: entries.map((entry) => entry.label) as GameQuestion["options"],
    correct: entries.findIndex((entry) => entry.originalIndex === question.correct) as GameQuestion["correct"],
  };
}

export function fallbackQuestionsFor(settings: Pick<LearningSettings, "level" | "lexicalTopic" | "grammarTopic">) {
  const levelRank = { A1: 0, A2: 1, B1: 2, B2: 3 } as const;
  const eligible = FALLBACK_QUESTIONS.filter(
    (question) => levelRank[question.level ?? "A1"] <= levelRank[settings.level],
  );
  const score = (question: GameQuestion) =>
    (question.level === settings.level ? 8 : 0)
    + (question.grammarTopic === settings.grammarTopic ? 5 : 0)
    + (question.lexicalTopic === settings.lexicalTopic ? 3 : 0);
  const preferred = eligible.filter(
    (question) => question.grammarTopic === settings.grammarTopic
      || question.lexicalTopic === settings.lexicalTopic,
  );
  const supplemental = eligible.filter((question) => !preferred.includes(question));
  return [
    ...preferred.sort((left, right) => score(right) - score(left)),
    ...supplemental.sort((left, right) => score(right) - score(left)),
  ];
}

function hashText(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}
