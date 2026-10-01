"use client";

// Listening drills speak the German sentence and never print it. ElevenLabs is
// used when the server has a key; otherwise the browser voice reads the same
// sentence, so the mode stays playable without a paid provider.

const CACHE_LIMIT = 60;
const clipCache = new Map<string, ArrayBuffer>();

let playbackToken = 0;
let activeAudio: HTMLAudioElement | null = null;
let activeUrl = "";

// iOS only starts audio from inside a user gesture, and the first thing a
// listening drill does is await the mp3 — by the time it arrives the gesture is
// over and play() is refused, which is why the mode was silent on an iPhone.
// One element, unlocked once while a finger is still down, is allowed to speak
// for the rest of the session, so playback reuses it instead of building a
// fresh Audio() that was never granted anything.
const SILENT_CLIP =
  "data:audio/mpeg;base64,/+MYxAAAAANIAUAAAASEEB/jwOFM/0MM/90b/+RhST//w4NFwOjf///PZu////9lns5GFDv//l9GlUIEEIAAAgIg8Ir/JGq3/+MYxDsLIj5QMYcoAP0dv9HIjUcH//yYSg+CIbkGP//8w0bLVjUP///3Z0x5QCAv/yLjwtGKTEFNRTMuOTeqqqqqqqqqqqqq/+MYxEkNmdJkUYc4AKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq";

let unlockedPlayer: HTMLAudioElement | null = null;
let speechUnlocked = false;

/**
 * Must be called from inside a real user gesture — a tap or a key press — and
 * costs nothing after the first time.
 */
export function unlockQuestionAudio() {
  if (typeof window === "undefined") return;
  if (!unlockedPlayer) {
    const player = new Audio();
    player.preload = "auto";
    player.muted = true;
    player.src = SILENT_CLIP;
    void player.play().catch(() => {
      // A refusal only means the gesture was not one iOS accepts; the element
      // stays muted and silent, so the next tap simply tries again.
    });
    unlockedPlayer = player;
  }
  if (!speechUnlocked && "speechSynthesis" in window) {
    // The browser voice is the fallback when the provider is unavailable, and
    // its first utterance is gesture-bound too, so it is primed in silence.
    const primer = new SpeechSynthesisUtterance(" ");
    primer.volume = 0;
    window.speechSynthesis.speak(primer);
    speechUnlocked = true;
  }
}

function releaseActive() {
  if (activeAudio) {
    activeAudio.pause();
    // The unlocked element keeps its permission across sources, so it is
    // emptied rather than thrown away.
    activeAudio.removeAttribute("src");
    activeAudio.load();
    activeAudio = null;
  }
  if (activeUrl) {
    URL.revokeObjectURL(activeUrl);
    activeUrl = "";
  }
}

export function stopQuestionAudio() {
  playbackToken += 1;
  releaseActive();
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

function speakWithBrowser(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "de-DE";
  utterance.rate = 0.88;
  const german = window.speechSynthesis.getVoices?.()
    .find((voice) => /^de[-_]/iu.test(voice.lang ?? ""));
  if (german) utterance.voice = german;
  window.speechSynthesis.speak(utterance);
}

function remember(text: string, clip: ArrayBuffer) {
  if (clipCache.has(text)) clipCache.delete(text);
  clipCache.set(text, clip);
  while (clipCache.size > CACHE_LIMIT) clipCache.delete(clipCache.keys().next().value!);
}

export async function playQuestionAudio(text: string) {
  const sentence = text.trim();
  if (!sentence) return;

  stopQuestionAudio();
  const token = playbackToken;

  let clip = clipCache.get(sentence);
  if (!clip) {
    try {
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: sentence }),
      });
      if (!response.ok) throw new Error(`tts_${response.status}`);
      clip = await response.arrayBuffer();
      if (!clip.byteLength) throw new Error("tts_empty");
      remember(sentence, clip);
    } catch {
      if (token === playbackToken) speakWithBrowser(sentence);
      return;
    }
  }
  if (token !== playbackToken) return;

  try {
    const url = URL.createObjectURL(new Blob([clip.slice(0)], { type: "audio/mpeg" }));
    const audio = unlockedPlayer ?? new Audio();
    audio.muted = false;
    audio.src = url;
    activeAudio = audio;
    activeUrl = url;
    audio.addEventListener("ended", () => {
      if (activeAudio === audio) releaseActive();
    }, { once: true });
    await audio.play();
  } catch {
    // Autoplay refusals and decode errors both leave the browser voice, which
    // needs no object URL, as the way to still hear the sentence.
    if (token === playbackToken) {
      releaseActive();
      speakWithBrowser(sentence);
    }
  }
}
