"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { learningPoolKey, type LearningSettings } from "@/lib/learning-settings";
import {
  fallbackQuestionsFor,
  normalizeQuestion,
  questionFingerprint,
  questionHistoryLabel,
  shuffleQuestion,
  type GameQuestion,
} from "@/lib/questions";

const BATCH_SIZE = 8;
const LOW_WATER_MARK = 3;
const RECENT_LIMIT = 80;
const SERVER_EXCLUDE_LIMIT = 60;
const RETRY_DELAY_MS = 12_000;

function shuffled(values: number[]) {
  const copy = [...values];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

function reserveIndexes(
  questions: GameQuestion[],
  settings: Pick<LearningSettings, "lexicalTopic" | "grammarTopic">,
) {
  const preferred: number[] = [];
  const supplemental: number[] = [];
  questions.forEach((question, index) => {
    if (question.grammarTopic === settings.grammarTopic || question.lexicalTopic === settings.lexicalTopic) {
      preferred.push(index);
    } else {
      supplemental.push(index);
    }
  });
  return [...shuffled(preferred), ...shuffled(supplemental)];
}

export function useQuestionPool(settings: LearningSettings, enabled = true) {
  const poolKey = learningPoolKey(settings);
  const initialReserve = fallbackQuestionsFor(settings);
  const queuesByKeyRef = useRef(new Map<string, GameQuestion[]>([[poolKey, []]]));
  const recentByKeyRef = useRef(new Map<string, string[]>([[poolKey, []]]));
  const recentFingerprintsByKeyRef = useRef(new Map<string, string[]>([[poolKey, []]]));
  const reservesByKeyRef = useRef(new Map<string, GameQuestion[]>([[poolKey, initialReserve]]));
  const reserveOrdersByKeyRef = useRef(new Map<string, number[]>([
    [poolKey, reserveIndexes(initialReserve, settings)],
  ]));
  const reserveCursorsByKeyRef = useRef(new Map<string, number>([[poolKey, 0]]));
  const lastFingerprintsByKeyRef = useRef(new Map<string, string>([[poolKey, ""]]));
  const queueRef = useRef<GameQuestion[]>([]);
  const recentRef = useRef<string[]>([]);
  const recentFingerprintsRef = useRef<string[]>([]);
  const inFlightRef = useRef<Promise<void> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const retryTimerRef = useRef<number | null>(null);
  const refillRef = useRef<() => Promise<void> | void>(() => {});
  const enabledRef = useRef(enabled);
  const requestEpochRef = useRef(0);
  const activeKeyRef = useRef(poolKey);
  const activeSettingsRef = useRef({
    lexicalTopic: settings.lexicalTopic,
    grammarTopic: settings.grammarTopic,
  });
  const reserveRef = useRef(initialReserve);
  const reserveOrderRef = useRef(reserveIndexes(initialReserve, settings));
  const reserveCursorRef = useRef(0);
  const lastFingerprintRef = useRef("");
  const mountedRef = useRef(false);
  // The first rendered question is deterministic. Random answer order starts
  // only after hydration, preventing answer/index hydration mismatches.
  const [question, setQuestion] = useState<GameQuestion>(initialReserve[0]);
  const [questionNumber, setQuestionNumber] = useState(1);
  const [queuedCount, setQueuedCount] = useState(0);
  const [isRefilling, setIsRefilling] = useState(false);

  const refill = useCallback(() => {
    if (!enabledRef.current) return Promise.resolve();
    if (queueRef.current.length >= LOW_WATER_MARK) return Promise.resolve();
    if (inFlightRef.current) return inFlightRef.current;
    const requestKey = poolKey;
    const requestEpoch = requestEpochRef.current;
    const controller = new AbortController();
    abortRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 46_000);
    const task = fetch("/api/questions/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        level: settings.level,
        lexicalTopic: settings.lexicalTopic,
        grammarTopic: settings.grammarTopic,
        count: BATCH_SIZE,
        exclude: recentRef.current.slice(-SERVER_EXCLUDE_LIMIT),
      }),
      signal: controller.signal,
    })
      .then(async (response) => response.ok ? response.json() : { questions: [] })
      .then((payload: { questions?: unknown[] }) => {
        if (
          !mountedRef.current
          || requestEpoch !== requestEpochRef.current
          || requestKey !== activeKeyRef.current
        ) return;
        const known = new Set([
          lastFingerprintRef.current,
          ...recentFingerprintsRef.current,
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
        if (!accepted.length) return;
        queueRef.current.push(...accepted.sort(() => Math.random() - 0.5));
        setQueuedCount(queueRef.current.length);
      })
      .catch(() => {})
      .finally(() => {
        window.clearTimeout(timeout);
        if (abortRef.current === controller) abortRef.current = null;
        if (requestEpoch === requestEpochRef.current) inFlightRef.current = null;
        if (!mountedRef.current || requestEpoch !== requestEpochRef.current || requestKey !== activeKeyRef.current) return;
        setIsRefilling(false);
        if (enabledRef.current && queueRef.current.length < LOW_WATER_MARK && !retryTimerRef.current) {
          retryTimerRef.current = window.setTimeout(() => {
            retryTimerRef.current = null;
            void refillRef.current();
          }, RETRY_DELAY_MS);
        }
      });
    inFlightRef.current = task;
    setIsRefilling(true);
    return task;
  }, [poolKey, settings.grammarTopic, settings.level, settings.lexicalTopic]);

  const nextReserve = useCallback(() => {
    if (reserveCursorRef.current >= reserveOrderRef.current.length) {
      reserveOrderRef.current = reserveIndexes(reserveRef.current, activeSettingsRef.current);
      reserveCursorRef.current = 0;
    }
    let next = reserveRef.current[reserveOrderRef.current[reserveCursorRef.current++]];
    if (questionFingerprint(next) === lastFingerprintRef.current) {
      if (reserveCursorRef.current >= reserveOrderRef.current.length) reserveCursorRef.current = 0;
      next = reserveRef.current[reserveOrderRef.current[reserveCursorRef.current++]];
    }
    return next;
  }, []);

  const takeNext = useCallback((restart = false) => {
    if (restart) lastFingerprintRef.current = "";
    let next = queueRef.current.shift();
    if (next && questionFingerprint(next) === lastFingerprintRef.current) {
      // A failed question belongs at the tail, but must not immediately repeat.
      queueRef.current.push(next);
      const alternateIndex = queueRef.current.findIndex(
        (candidate) => questionFingerprint(candidate) !== lastFingerprintRef.current,
      );
      next = alternateIndex >= 0
        ? queueRef.current.splice(alternateIndex, 1)[0]
        : nextReserve();
    }
    next ??= nextReserve();
    const fingerprint = questionFingerprint(next);
    lastFingerprintRef.current = fingerprint;
    recentRef.current.push(questionHistoryLabel(next));
    recentFingerprintsRef.current.push(fingerprint);
    if (recentRef.current.length > RECENT_LIMIT) {
      recentRef.current.splice(0, recentRef.current.length - RECENT_LIMIT);
    }
    if (recentFingerprintsRef.current.length > RECENT_LIMIT) {
      recentFingerprintsRef.current.splice(0, recentFingerprintsRef.current.length - RECENT_LIMIT);
    }
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
    refillRef.current = refill;
  }, [refill]);

  useEffect(() => {
    mountedRef.current = true;
    const reserveCursorsByKey = reserveCursorsByKeyRef.current;
    const lastFingerprintsByKey = lastFingerprintsByKeyRef.current;
    const previousKey = activeKeyRef.current;
    reserveCursorsByKey.set(previousKey, reserveCursorRef.current);
    lastFingerprintsByKey.set(previousKey, lastFingerprintRef.current);

    abortRef.current?.abort();
    abortRef.current = null;
    activeKeyRef.current = poolKey;
    activeSettingsRef.current = {
      lexicalTopic: settings.lexicalTopic,
      grammarTopic: settings.grammarTopic,
    };
    requestEpochRef.current += 1;
    inFlightRef.current = null;
    if (retryTimerRef.current) window.clearTimeout(retryTimerRef.current);
    retryTimerRef.current = null;
    if (!queuesByKeyRef.current.has(poolKey)) queuesByKeyRef.current.set(poolKey, []);
    if (!recentByKeyRef.current.has(poolKey)) recentByKeyRef.current.set(poolKey, []);
    if (!recentFingerprintsByKeyRef.current.has(poolKey)) recentFingerprintsByKeyRef.current.set(poolKey, []);
    if (!reservesByKeyRef.current.has(poolKey)) {
      const reserve = fallbackQuestionsFor({
        level: settings.level,
        lexicalTopic: settings.lexicalTopic,
        grammarTopic: settings.grammarTopic,
      });
      reservesByKeyRef.current.set(poolKey, reserve);
      reserveOrdersByKeyRef.current.set(poolKey, reserveIndexes(reserve, activeSettingsRef.current));
      reserveCursorsByKey.set(poolKey, 0);
      lastFingerprintsByKey.set(poolKey, "");
    }
    queueRef.current = queuesByKeyRef.current.get(poolKey)!;
    recentRef.current = recentByKeyRef.current.get(poolKey)!;
    recentFingerprintsRef.current = recentFingerprintsByKeyRef.current.get(poolKey)!;
    reserveRef.current = reservesByKeyRef.current.get(poolKey)!;
    reserveOrderRef.current = reserveOrdersByKeyRef.current.get(poolKey)!;
    reserveCursorRef.current = reserveCursorsByKey.get(poolKey) ?? 0;
    const first = reserveRef.current[0];
    lastFingerprintRef.current = lastFingerprintsByKey.get(poolKey) ?? "";
    setQuestion(first);
    setQuestionNumber(1);
    setQueuedCount(queueRef.current.length);
    const needsRefill = enabledRef.current && queueRef.current.length < LOW_WATER_MARK;
    setIsRefilling(needsRefill);
    if (needsRefill) void refill();
    return () => {
      reserveCursorsByKey.set(poolKey, reserveCursorRef.current);
      lastFingerprintsByKey.set(poolKey, lastFingerprintRef.current);
      abortRef.current?.abort();
      abortRef.current = null;
      requestEpochRef.current += 1;
      inFlightRef.current = null;
      if (retryTimerRef.current) window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    };
  }, [poolKey, refill, settings.grammarTopic, settings.level, settings.lexicalTopic]);

  useEffect(() => {
    enabledRef.current = enabled;
    if (!enabled) {
      if (retryTimerRef.current) window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
      return;
    }
    if (queueRef.current.length < LOW_WATER_MARK) void refill();
  }, [enabled, refill]);

  useEffect(() => () => {
    mountedRef.current = false;
    abortRef.current?.abort();
  }, []);

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
