import { getRuntimeEnvironment } from "@/server/runtime-env";

const MAX_TEXT_CHARACTERS = 420;
const MAX_AUDIO_BYTES = 4_000_000;

// Listening drills repeat the same sentence whenever the player hits replay, so
// a small in-memory cache keeps the provider bill and the latency down. There is
// no disk on the Workers runtime, so the cache lives only as long as the isolate.
const audioCache = new Map<string, { audio: ArrayBuffer; contentType: string }>();

export class TextToSpeechError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "TextToSpeechError";
    this.statusCode = statusCode;
  }
}

function compactText(value: unknown, maximum: number) {
  if (typeof value !== "string") return "";
  const withoutControls = Array.from(value)
    .map((character) => {
      const code = character.charCodeAt(0);
      return code < 32 || code === 127 ? " " : character;
    })
    .join("");
  return withoutControls.replace(/\s+/gu, " ").trim().slice(0, maximum);
}

function boundedInteger(value: unknown, fallback: number, minimum: number, maximum: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(minimum, Math.min(maximum, Math.round(parsed))) : fallback;
}

function configuration() {
  const environment = getRuntimeEnvironment();
  return {
    key: compactText(
      environment.ELEVENLABS_API_KEY ?? environment.ELEVEN_API_KEY ?? environment.ELEVENLABS_KEY,
      4096,
    ),
    voiceId: compactText(environment.ELEVENLABS_VOICE_ID, 120) || "21m00Tcm4TlvDq8ikWAM",
    modelId: compactText(environment.ELEVENLABS_MODEL_ID ?? environment.ELEVENLABS_MODEL, 120)
      || "eleven_multilingual_v2",
    timeoutMs: boundedInteger(environment.TTS_TIMEOUT_MS, 30_000, 3_000, 60_000),
    cacheLimit: boundedInteger(environment.TTS_CACHE_LIMIT, 180, 8, 1_000),
  };
}

export function isTextToSpeechReady() {
  return Boolean(configuration().key && typeof fetch === "function");
}

function remember(key: string, entry: { audio: ArrayBuffer; contentType: string }, limit: number) {
  if (audioCache.has(key)) audioCache.delete(key);
  audioCache.set(key, entry);
  while (audioCache.size > limit) audioCache.delete(audioCache.keys().next().value!);
}

export async function synthesizeGerman(input: unknown) {
  const source = input && typeof input === "object" && !Array.isArray(input)
    ? input as Record<string, unknown>
    : {};
  const text = compactText(source.text, MAX_TEXT_CHARACTERS + 1);
  if (!text) throw new TextToSpeechError("text is required");
  if (text.length > MAX_TEXT_CHARACTERS) throw new TextToSpeechError("text is too long", 413);

  const config = configuration();
  if (!isTextToSpeechReady()) {
    // The client falls back to the browser voice, so this is an expected answer
    // rather than a failure worth retrying.
    throw new TextToSpeechError("Text-to-speech is not configured", 503);
  }

  const cacheKey = `${config.voiceId}:${config.modelId}:${text}`;
  const cached = audioCache.get(cacheKey);
  if (cached) {
    remember(cacheKey, cached, config.cacheLimit);
    return { ...cached, cache: "HIT" as const };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(config.voiceId)}`,
      {
        method: "POST",
        headers: {
          Accept: "audio/mpeg",
          "Content-Type": "application/json",
          "xi-api-key": config.key,
        },
        body: JSON.stringify({
          text,
          model_id: config.modelId,
          voice_settings: { stability: 0.45, similarity_boost: 0.75, use_speaker_boost: true },
        }),
        signal: controller.signal,
      },
    );
    if (!response.ok) throw new TextToSpeechError("Text-to-speech request failed", 502);

    const advertisedLength = Number(response.headers.get("content-length") ?? 0);
    if (Number.isFinite(advertisedLength) && advertisedLength > MAX_AUDIO_BYTES) {
      throw new TextToSpeechError("Text-to-speech response is too large", 502);
    }
    const audio = await response.arrayBuffer();
    if (!audio.byteLength || audio.byteLength > MAX_AUDIO_BYTES) {
      throw new TextToSpeechError("Text-to-speech returned unusable audio", 502);
    }

    const entry = { audio, contentType: "audio/mpeg" };
    remember(cacheKey, entry, config.cacheLimit);
    return { ...entry, cache: "MISS" as const };
  } catch (error) {
    if (error instanceof TextToSpeechError) throw error;
    throw new TextToSpeechError("Text-to-speech request failed", 502);
  } finally {
    clearTimeout(timeout);
  }
}
