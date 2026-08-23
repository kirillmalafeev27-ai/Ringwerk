export type GameQuestion = {
  id: string;
  prompt: string;
  options: [string, string, string, string];
  correct: 0 | 1 | 2 | 3;
  rule: string;
};

const FALLBACK_DATA: Array<Omit<GameQuestion, "id">> = [
  { prompt: "Ich gehe ___ Maschinenraum.", options: ["in den", "im", "in dem", "an der"], correct: 0, rule: "Wohin? → Akkusativ" },
  { prompt: "Der Kern liegt ___ Zentrum.", options: ["ins", "im", "in den", "am die"], correct: 1, rule: "Wo? → Dativ" },
  { prompt: "Wir hängen das Kabel ___ Wand.", options: ["an die", "an der", "an den", "auf dem"], correct: 0, rule: "Wohin? → Akkusativ" },
  { prompt: "Das Kabel hängt ___ Wand.", options: ["an die", "an der", "auf die", "in den"], correct: 1, rule: "Wo? → Dativ" },
  { prompt: "Sie läuft ___ Brücke.", options: ["über die", "über der", "über dem", "unter den"], correct: 0, rule: "Wohin? → Akkusativ" },
  { prompt: "Sie wartet ___ Brücke.", options: ["auf die", "auf der", "an den", "über das"], correct: 1, rule: "Wo? → Dativ" },
  { prompt: "Der Techniker stellt die Kiste ___ Terminal.", options: ["neben das", "neben dem", "am", "unter der"], correct: 0, rule: "Wohin? → Akkusativ" },
  { prompt: "Die Kiste steht ___ Terminal.", options: ["neben das", "neben dem", "ins", "auf den"], correct: 1, rule: "Wo? → Dativ" },
  { prompt: "Wir fahren ___ äußeren Ring.", options: ["auf den", "auf dem", "an der", "unter das"], correct: 0, rule: "Wohin? → Akkusativ" },
  { prompt: "Der Läufer ist ___ mittleren Ring.", options: ["auf dem", "auf den", "in den", "an die"], correct: 0, rule: "Wo? → Dativ" },
  { prompt: "Ich lege den Schlüssel ___ Konsole.", options: ["auf die", "auf der", "unter dem", "neben der"], correct: 0, rule: "Wohin? → Akkusativ" },
  { prompt: "Der Schlüssel liegt ___ Konsole.", options: ["auf die", "auf der", "an die", "unter den"], correct: 1, rule: "Wo? → Dativ" },
  { prompt: "Der Rotor dreht sich ___ Schutzgitter.", options: ["hinter dem", "hinter den", "in das", "über die"], correct: 0, rule: "Wo? → Dativ" },
  { prompt: "Wir schieben den Wagen ___ Schutzgitter.", options: ["hinter dem", "hinter das", "unter der", "auf dem"], correct: 1, rule: "Wohin? → Akkusativ" },
  { prompt: "Die Lampe hängt ___ Werkbank.", options: ["über die", "über der", "auf den", "zwischen das"], correct: 1, rule: "Wo? → Dativ" },
  { prompt: "Häng die Lampe ___ Werkbank!", options: ["über die", "über der", "unter dem", "neben der"], correct: 0, rule: "Wohin? → Akkusativ" },
];

export const FALLBACK_QUESTIONS: GameQuestion[] = FALLBACK_DATA.map((question) => ({
  ...question,
  id: `reserve-${hashText(question.prompt)}`,
}));

function cleanText(value: unknown, maximum: number) {
  if (typeof value !== "string") return "";
  const withoutControls = [...value]
    .map((character) => {
      const code = character.charCodeAt(0);
      return code < 32 || code === 127 || character === "<" || character === ">" ? " " : character;
    })
    .join("");
  return withoutControls.replace(/\s+/gu, " ").trim().slice(0, maximum);
}

export function questionFingerprint(question: Pick<GameQuestion, "prompt" | "options">) {
  return [question.prompt, ...[...question.options].sort((left, right) => left.localeCompare(right, "de"))]
    .map((value) => cleanText(value, 240).normalize("NFKC").toLocaleLowerCase("de-DE"))
    .join("|");
}

export function normalizeQuestion(candidate: unknown, sequence = 0): GameQuestion | null {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return null;
  const source = candidate as Record<string, unknown>;
  const prompt = cleanText(source.prompt ?? source.context ?? source.question, 220);
  const rule = cleanText(source.rule ?? source.explanation ?? source.rationale, 220);
  const rawOptions = source.options ?? source.answers ?? source.choices;
  if (prompt.length < 8 || rule.length < 4 || !Array.isArray(rawOptions) || rawOptions.length !== 4) return null;

  const options = rawOptions.map((option) => cleanText(option, 100));
  if (options.some((option) => !option)) return null;
  if (new Set(options.map((option) => option.normalize("NFKC").toLocaleLowerCase("de-DE"))).size !== 4) return null;

  const numericCorrect = Number(source.correct ?? source.correctIndex);
  if (!Number.isInteger(numericCorrect) || numericCorrect < 0 || numericCorrect > 3) return null;
  const declaredAnswer = cleanText(source.correctAnswer, 100);
  if (declaredAnswer && declaredAnswer !== options[numericCorrect]) return null;

  const tuple = options as GameQuestion["options"];
  const correct = numericCorrect as GameQuestion["correct"];
  const identity = questionFingerprint({ prompt, options: tuple });
  return {
    id: cleanText(source.id, 100) || `question-${hashText(identity)}-${sequence}`,
    prompt,
    options: tuple,
    correct,
    rule,
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

function hashText(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}
