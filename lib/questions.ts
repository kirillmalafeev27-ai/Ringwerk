import {
  AUDIO_DISPLAY_CONTEXT,
  EXERCISE_FORMATS,
  WORD_FIELD_TOPIC,
  exerciseFormatFor,
  isWordFieldTopic,
  wordFieldFor,
  wordFieldInstruction,
} from "./exercise-formats.ts";
import type { LearningSettings } from "./learning-settings.ts";

export {
  AUDIO_DISPLAY_CONTEXT,
  EXERCISE_FORMATS,
  WORD_FIELDS,
  WORD_FIELD_TOPIC,
  exerciseHint,
  exerciseFormatFor,
  isWordFieldTopic,
  usesEveryFragment,
  wordFieldBank,
  wordFieldFor,
  wordFieldInstruction,
  wordFieldSynonymOf,
  wordFieldsForLevel,
  wordOrderFragments,
  wordOrderInstruction,
} from "./exercise-formats.ts";
export type {
  ExerciseFormat,
  ExerciseFormatId,
  WordField,
  WordFieldSynonym,
} from "./exercise-formats.ts";

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
  /** Listening drills only: the German sentence that is spoken, never printed. */
  audioText?: string;
  /** Synonym drills only: the worn-out word the four synonyms stand in for. */
  wordFieldBase?: string;
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

// Listening reserves, ported from the See Escape audio pool. `translation` stays
// empty on purpose — printing it would hand over the answer — and `rule` carries
// the German sentence so the feedback line reveals what was said.
const AUDIO_FALLBACK_DATA: Array<Omit<GameQuestion, "id">> = [
  { level: "A1", lexicalTopic: "Einkaufen & Konsum", prompt: EXERCISE_FORMATS.audio.instruction, context: AUDIO_DISPLAY_CONTEXT, translation: "", audioText: "Ich kaufe heute Brot und Käse.", options: ["Сегодня я покупаю хлеб и сыр.", "Сегодня я продаю хлеб и сыр.", "Сегодня я покупаю булочки и сыр.", "Сегодня я покупаю хлеб и колбасу."], correct: 0, rule: "Ich kaufe heute Brot und Käse." },
  { level: "A1", lexicalTopic: "Verkehr & Mobilität", prompt: EXERCISE_FORMATS.audio.instruction, context: AUDIO_DISPLAY_CONTEXT, translation: "", audioText: "Der Zug kommt um acht Uhr an.", options: ["Поезд прибывает в восемь часов.", "Поезд отправляется в восемь часов.", "Поезд прибывает на восьмой путь.", "На поезд нужно пересесть в восемь часов."], correct: 0, rule: "Der Zug kommt um acht Uhr an." },
  { level: "A2", lexicalTopic: "Gesundheit & Wohlbefinden", prompt: EXERCISE_FORMATS.audio.instruction, context: AUDIO_DISPLAY_CONTEXT, translation: "", audioText: "Wir müssen morgen früh zum Arzt gehen.", options: ["Завтра рано мы должны пойти к врачу.", "Завтра рано мы хотим пойти к врачу.", "Завтра рано мы должны пойти в аптеку.", "Завтра рано нам разрешено пойти к врачу."], correct: 0, rule: "Wir müssen morgen früh zum Arzt gehen." },
  { level: "A2", lexicalTopic: "Wohnen & Nachbarschaft", prompt: EXERCISE_FORMATS.audio.instruction, context: AUDIO_DISPLAY_CONTEXT, translation: "", audioText: "Sie hat den Schlüssel auf dem Tisch gelassen.", options: ["Она оставила ключ на столе.", "Она положила ключ на стул.", "Она оставила ключ в столе.", "Она забыла замок на столе."], correct: 0, rule: "Sie hat den Schlüssel auf dem Tisch gelassen." },
  { level: "B1", lexicalTopic: "Wetter & Jahreszeiten", prompt: EXERCISE_FORMATS.audio.instruction, context: AUDIO_DISPLAY_CONTEXT, translation: "", audioText: "Obwohl es regnet, gehen die Kinder nach draußen.", options: ["Хотя идёт дождь, дети выходят на улицу.", "Пока идёт дождь, дети выходят на улицу.", "Потому что идёт дождь, дети выходят на улицу.", "Хотя идёт дождь, дети идут внутрь."], correct: 0, rule: "Obwohl es regnet, gehen die Kinder nach draußen." },
  { level: "B1", lexicalTopic: "Freundschaft & Partnerschaft", prompt: EXERCISE_FORMATS.audio.instruction, context: AUDIO_DISPLAY_CONTEXT, translation: "", audioText: "Ich freue mich darauf, dich wiederzusehen.", options: ["Я рад снова тебя увидеть.", "Я боюсь снова тебя увидеть.", "Я рад снова тебя проводить.", "Я рад снова с тобой познакомиться."], correct: 0, rule: "Ich freue mich darauf, dich wiederzusehen." },
  { level: "B2", lexicalTopic: "Arbeit & Beruf", prompt: EXERCISE_FORMATS.audio.instruction, context: AUDIO_DISPLAY_CONTEXT, translation: "", audioText: "Nachdem der Vertrag unterschrieben worden war, begann die Lieferung.", options: ["После того как договор был подписан, началась поставка.", "После того как договор подписали, поставка была отменена.", "После того как договор был отправлен, началась поставка.", "После того как заявка была подписана, началась поставка."], correct: 0, rule: "Nachdem der Vertrag unterschrieben worden war, begann die Lieferung." },
  { level: "B2", lexicalTopic: "Termine & Zeitmanagement", prompt: EXERCISE_FORMATS.audio.instruction, context: AUDIO_DISPLAY_CONTEXT, translation: "", audioText: "Je länger wir warten, desto schwieriger wird die Entscheidung.", options: ["Чем дольше мы ждём, тем труднее становится решение.", "Чем дольше мы ждём, тем труднее становится обсуждение.", "Чем дольше мы советуемся, тем труднее становится решение.", "Чем дольше мы ждём, тем надёжнее становится решение."], correct: 0, rule: "Je länger wir warten, desto schwieriger wird die Entscheidung." },
];

// Synonym reserves. `translation` keeps the neutral base word on purpose: name
// the nuance in Russian and the item answers itself.
const WORD_FIELD_FALLBACK_DATA: Array<Omit<GameQuestion, "id">> = [
  { level: "A1", lexicalTopic: "Familie & Beziehungen", grammarTopic: WORD_FIELD_TOPIC, wordFieldBase: "sagen", prompt: wordFieldInstruction("sagen"), context: "Das Baby schläft, deshalb ___ wir nur noch.", translation: "Малыш спит, поэтому мы теперь только говорим.", options: ["flüstern", "rufen", "murmeln", "behaupten"], correct: 0, rule: "flüstern — говорить очень тихо, почти на ухо; на это указывает «Das Baby schläft»." },
  { level: "A1", lexicalTopic: "Reisen & Tourismus", grammarTopic: WORD_FIELD_TOPIC, wordFieldBase: "gehen", prompt: wordFieldInstruction("gehen"), context: "Wir haben viel Zeit und ___ durch die Altstadt.", translation: "У нас много времени, и мы идём по старому городу.", options: ["schlendern", "rennen", "eilen", "stapfen"], correct: 0, rule: "schlendern — идти не спеша, прогуливаясь; «viel Zeit» исключает спешку." },
  { level: "A1", lexicalTopic: "Essen & Ernährung", grammarTopic: WORD_FIELD_TOPIC, wordFieldBase: "gut", prompt: wordFieldInstruction("gut"), context: "Der Kuchen war wirklich ___, alle wollten noch ein Stück.", translation: "Пирог был действительно хорошим, все хотели ещё кусок.", options: ["lecker", "solide", "brauchbar", "angenehm"], correct: 0, rule: "lecker — вкусный, и только о еде или напитках; речь о пироге." },
  { level: "A1", lexicalTopic: "Essen & Ernährung", grammarTopic: WORD_FIELD_TOPIC, wordFieldBase: "essen", prompt: wordFieldInstruction("essen"), context: "Die Soße sieht gut aus — darf ich sie kurz ___?", translation: "Соус выглядит хорошо — можно я его немного поем?", options: ["probieren", "schlingen", "naschen", "speisen"], correct: 0, rule: "probieren — взять маленький кусочек на пробу; на это указывает «kurz»." },
  { level: "A2", lexicalTopic: "Natur & Tiere", grammarTopic: WORD_FIELD_TOPIC, wordFieldBase: "sehen", prompt: wordFieldInstruction("sehen"), context: "Der Forscher ___ die Vögel jeden Morgen zwei Stunden lang.", translation: "Исследователь видит птиц каждое утро по два часа.", options: ["beobachtet", "bemerkt", "erblickt", "glotzt"], correct: 0, rule: "beobachten — долго и внимательно наблюдать; длительность задаёт «zwei Stunden lang»." },
  { level: "A2", lexicalTopic: "Essen & Ernährung", grammarTopic: WORD_FIELD_TOPIC, wordFieldBase: "machen", prompt: wordFieldInstruction("machen"), context: "Am Wochenende ___ mein Vater immer eine Suppe.", translation: "На выходных мой отец всегда делает суп.", options: ["kocht", "bastelt", "produziert", "verursacht"], correct: 0, rule: "kochen — готовить еду на плите; в предложении речь о супе." },
  { level: "B1", lexicalTopic: "Feste, Traditionen & Feiertage", grammarTopic: WORD_FIELD_TOPIC, wordFieldBase: "geben", prompt: wordFieldInstruction("geben"), context: "Feierlich, vor allen Gästen, ___ der Bürgermeister dem Gewinner den Pokal.", translation: "Торжественно, перед всеми гостями, мэр дал победителю кубок.", options: ["überreichte", "reichte", "schenkte", "spendete"], correct: 0, rule: "überreichen — вручить торжественно; на это указывает «Feierlich, vor allen Gästen»." },
  { level: "B2", lexicalTopic: "Termine & Zeitmanagement", grammarTopic: WORD_FIELD_TOPIC, wordFieldBase: "wichtig", prompt: wordFieldInstruction("wichtig"), context: "Der Termin ist ___ — die Unterlagen müssen noch heute im Amt sein.", translation: "Этот срок важный — документы должны быть в ведомстве ещё сегодня.", options: ["dringend", "wesentlich", "maßgeblich", "unverzichtbar"], correct: 0, rule: "dringend — срочный, не терпит отлагательства; срок задаёт «noch heute»." },
];

// A synonym drill announces itself through its own field, so a reserve item
// reaches the right shape even without the grammar topic beside it.
export function exerciseFormatOf(
  question: Pick<GameQuestion, "grammarTopic" | "audioText" | "wordFieldBase">,
  mode?: string,
) {
  return exerciseFormatFor(
    question.wordFieldBase ? WORD_FIELD_TOPIC : question.grammarTopic,
    question.audioText ? "audio" : mode,
  );
}

function toReserve(question: Omit<GameQuestion, "id">): GameQuestion {
  return {
    ...question,
    id: `reserve-${hashText([question.audioText ?? question.context, ...question.options].join("|"))}`,
  };
}

export const FALLBACK_QUESTIONS: GameQuestion[] = FALLBACK_DATA.map(toReserve);

export const AUDIO_FALLBACK_QUESTIONS: GameQuestion[] = AUDIO_FALLBACK_DATA.map(toReserve);

export const WORD_FIELD_FALLBACK_QUESTIONS: GameQuestion[] = WORD_FIELD_FALLBACK_DATA.map(toReserve);

function cleanText(value: unknown, maximum: number) {
  if (typeof value !== "string") return "";
  const withoutControls = [...value].map((character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127 || character === "<" || character === ">" ? " " : character;
  }).join("");
  return withoutControls.replace(/\s+/gu, " ").trim().slice(0, maximum);
}

export function questionFingerprint(question: Pick<GameQuestion, "context" | "options" | "audioText">) {
  // Every listening task shares one display line, so its identity is the spoken
  // sentence rather than what the player sees.
  return [question.audioText || question.context, ...[...question.options].sort((left, right) => left.localeCompare(right, "de"))]
    .map((value) => cleanText(value, 360).normalize("NFKC").toLocaleLowerCase("de-DE"))
    .join("|");
}

export function questionHistoryLabel(question: Pick<GameQuestion, "prompt" | "context" | "audioText">) {
  return (question.audioText || `${question.prompt} ${question.context}`).trim();
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
  const audioText = cleanText(source.audioText ?? source.audio ?? source.satz, 360) || undefined;
  // Resolving against the catalogue rather than trusting the label keeps the
  // word bank the player sees in step with the four options.
  const wordField = wordFieldFor(cleanText(source.wordFieldBase ?? source.wordField, 40));
  const identity = questionFingerprint({ context, options: tuple, audioText });
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
    audioText,
    wordFieldBase: wordField?.base,
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

export function fallbackQuestionsFor(
  settings: Pick<LearningSettings, "level" | "lexicalTopic" | "grammarTopic"> & { mode?: string },
) {
  const levelRank = { A1: 0, A2: 1, B1: 2, B2: 3 } as const;
  const pool = settings.mode === "audio"
    ? AUDIO_FALLBACK_QUESTIONS
    : isWordFieldTopic(settings.grammarTopic)
      ? WORD_FIELD_FALLBACK_QUESTIONS
      : FALLBACK_QUESTIONS;
  const eligible = pool.filter(
    (question) => levelRank[question.level ?? "A1"] <= levelRank[settings.level],
  );
  const score = (question: GameQuestion) =>
    (question.level === settings.level ? 8 : 0)
    + (question.grammarTopic === settings.grammarTopic ? 5 : 0)
    + (question.lexicalTopic === settings.lexicalTopic ? 3 : 0);
  const preferred = eligible.filter(
    (question) => (question.grammarTopic !== undefined && question.grammarTopic === settings.grammarTopic)
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
