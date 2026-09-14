"use client";

// Listening drills speak the German sentence and never print it. ElevenLabs is
// used when the server has a key; otherwise the browser voice reads the same
// sentence, so the mode stays playable without a paid provider.

const CACHE_LIMIT = 60;
const clipCache = new Map<string, ArrayBuffer>();

let playbackToken = 0;
let activeAudio: HTMLAudioElement | null = null;
let activeUrl = "";

function releaseActive() {
  if (activeAudio) {
    activeAudio.pause();
    activeAudio.src = "";
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
    const audio = new Audio(url);
    activeAudio = audio;
    activeUrl = url;
    audio.addEventListener("ended", () => {
      if (activeAudio === audio) releaseActive();
    });
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
