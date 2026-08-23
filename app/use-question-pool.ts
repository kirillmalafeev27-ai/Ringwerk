"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  FALLBACK_QUESTIONS,
  normalizeQuestion,
  questionFingerprint,
  shuffleQuestion,
  type GameQuestion,
} from "@/lib/questions";

const BATCH_SIZE = 8;
const LOW_WATER_MARK = 3;
const RECENT_LIMIT = 80;

function shuffledIndexes(length: number) {
  const indexes = Array.from({ length }, (_, index) => index);
  for (let index = indexes.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [indexes[index], indexes[swap]] = [indexes[swap], indexes[index]];
  }
  return indexes;
}

export function useQuestionPool() {
  const queueRef = useRef<GameQuestion[]>([]);
  const recentRef = useRef<string[]>([]);
  const inFlightRef = useRef<Promise<void> | null>(null);
  const reserveOrderRef = useRef(shuffledIndexes(FALLBACK_QUESTIONS.length));
  const reserveCursorRef = useRef(1);
  const lastFingerprintRef = useRef(questionFingerprint(FALLBACK_QUESTIONS[0]));
  const mountedRef = useRef(true);
  // The first server-rendered question must be byte-for-byte deterministic so
  // React hydrates against the same option order. Later questions are shuffled
  // only after the client has mounted.
  const [question, setQuestion] = useState<GameQuestion>(FALLBACK_QUESTIONS[0]);
  const [questionNumber, setQuestionNumber] = useState(1);
  const [queuedCount, setQueuedCount] = useState(0);
  const [isRefilling, setIsRefilling] = useState(true);

  const refill = useCallback(() => {
    if (inFlightRef.current) return inFlightRef.current;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 46_000);
    const task = fetch("/api/questions/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        level: "A2",
        count: BATCH_SIZE,
        exclude: recentRef.current.slice(-RECENT_LIMIT),
      }),
      signal: controller.signal,
    })
      .then(async (response) => response.ok ? response.json() : { questions: [] })
      .then((payload: { questions?: unknown[] }) => {
        const known = new Set([
          lastFingerprintRef.current,
          ...queueRef.current.map(questionFingerprint),
        ]);
        const accepted: GameQuestion[] = [];
        for (const [index, candidate] of (Array.isArray(payload.questions) ? payload.questions : []).entries()) {
          const normalized = normalizeQuestion(candidate, index);
          if (!normalized) continue;
          const fingerprint = questionFingerprint(normalized);
          if (known.has(fingerprint)) continue;
          known.add(fingerprint);
          accepted.push(normalized);
        }
        if (!mountedRef.current || !accepted.length) return;
        queueRef.current.push(...accepted.sort(() => Math.random() - 0.5));
        setQueuedCount(queueRef.current.length);
      })
      .catch(() => {})
      .finally(() => {
        window.clearTimeout(timeout);
        inFlightRef.current = null;
        if (mountedRef.current) setIsRefilling(false);
      });
    inFlightRef.current = task;
    setIsRefilling(true);
    return task;
  }, []);

  const nextReserve = useCallback(() => {
    if (reserveCursorRef.current >= reserveOrderRef.current.length) {
      reserveOrderRef.current = shuffledIndexes(FALLBACK_QUESTIONS.length);
      reserveCursorRef.current = 0;
    }
    let question = FALLBACK_QUESTIONS[reserveOrderRef.current[reserveCursorRef.current++]];
    if (questionFingerprint(question) === lastFingerprintRef.current) {
      if (reserveCursorRef.current >= reserveOrderRef.current.length) reserveCursorRef.current = 0;
      question = FALLBACK_QUESTIONS[reserveOrderRef.current[reserveCursorRef.current++]];
    }
    return question;
  }, []);

  const takeNext = useCallback((restart = false) => {
    let next = queueRef.current.shift() ?? nextReserve();
    if (questionFingerprint(next) === lastFingerprintRef.current) {
      const replacement = queueRef.current.shift() ?? nextReserve();
      if (replacement) next = replacement;
    }
    const fingerprint = questionFingerprint(next);
    lastFingerprintRef.current = fingerprint;
    recentRef.current.push(next.prompt);
    if (recentRef.current.length > RECENT_LIMIT) recentRef.current.splice(0, recentRef.current.length - RECENT_LIMIT);
    setQuestion(shuffleQuestion(next));
    setQuestionNumber((number) => restart ? 1 : number + 1);
    setQueuedCount(queueRef.current.length);
    if (queueRef.current.length < LOW_WATER_MARK) void refill();
  }, [nextReserve, refill]);

  const releaseQuestion = useCallback((released: GameQuestion) => {
    const fingerprint = questionFingerprint(released);
    if (!queueRef.current.some((queued) => questionFingerprint(queued) === fingerprint)) {
      queueRef.current.push(released);
      setQueuedCount(queueRef.current.length);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void refill();
    return () => {
      mountedRef.current = false;
    };
  }, [refill]);

  const nextQuestion = useCallback(() => takeNext(false), [takeNext]);
  const restartQuestions = useCallback(() => takeNext(true), [takeNext]);

  return {
    question,
    questionNumber,
    queuedCount,
    isRefilling,
    nextQuestion,
    restartQuestions,
    releaseQuestion,
  };
}
