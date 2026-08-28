"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_LEARNING_SETTINGS,
  GRAMMAR_TOPIC_GROUPS,
  LANGUAGE_LEVELS,
  LEARNING_SETTINGS_STORAGE_KEY,
  LEXICAL_TOPIC_GROUPS,
  normalizeLearningSettings,
  type GrammarTopic,
  type LanguageLevel,
  type LearningSettings,
  type LexicalTopic,
  type QuestionMode,
} from "@/lib/learning-settings";
import { useQuestionPool } from "./use-question-pool";

const TAU = Math.PI * 2;
const STEP_ANGLE = TAU / 6;
const RING_NAMES = ["ВНЕШНИЙ", "СРЕДНИЙ", "ВНУТРЕННИЙ"] as const;
const RING_LOCATIVE = ["внешнем", "среднем", "внутреннем"] as const;
const RING_COLORS = ["#35e0c1", "#47b8ff", "#f5d94e"] as const;
const TERMINAL_TIME_BONUS = 60;
const TERMINAL_REACH = 0.24;
// A step jumps a whole sector at once, so a crossing may never land inside
// TERMINAL_REACH. Allow a sweep slightly wider than one step.
const TERMINAL_SWEEP_LIMIT = STEP_ANGLE * 1.5;
const IMPULSE_QUESTION_DECAY = 3.3;
const IMPULSE_ACTION_DECAY = 4.5;
const ACTION_THRESHOLDS = {
  "step-left": 10,
  "step-right": 10,
  outer: 25,
  inner: 25,
  spoke: 55,
  jump: 80,
} as const;

type Phase = "setup" | "briefing" | "playing" | "won" | "lost";
type TerminalId = "A" | "B" | "C";
type PlayerMode = "ring" | "spoke";
type BonusId = "brake" | "reverse" | "overdrive" | "shift" | "blackout";
type ActionId = keyof typeof ACTION_THRESHOLDS;

type BonusDefinition = {
  id: BonusId;
  name: string;
  mark: string;
  effect: string;
  cost: string;
  impulseCost: number;
  color: string;
};

type StoredBonus = { id: BonusId; level: 1 | 2 };

type Particle = {
  angle: number;
  ring: number;
  radial: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  angularSpeed: number;
  radialSpeed: number;
};

type RingState = {
  angle: number;
  baseSpeed: number;
  permanentScale: number;
  permanentDirection: number;
  temporaryMultiplier: number;
  temporaryUntil: number;
  reversedUntil: number;
  frozenUntil: number;
};

type WorldState = {
  rings: RingState[];
  player: {
    ringIndex: number;
    localAngle: number;
    mode: PlayerMode;
    spokeIndex: number;
    health: number;
    invulnerableUntil: number;
  };
  terminals: Record<TerminalId, boolean>;
  terminalOffsets: Record<TerminalId, number | null>;
  elapsed: number;
  phaseTime: number;
  spokeAngle: number;
  spokeSpeed: number;
  spokeCount: number;
  spokeCharge: number;
  hazardsDisabledUntil: number;
  sawDisabled: boolean;
  particles: Particle[];
  shake: number;
  flash: number;
  score: number;
  correct: number;
  wrong: number;
};

type HudSnapshot = {
  time: number;
  health: number;
  ringIndex: number;
  mode: PlayerMode;
  charge: number;
  terminals: Record<TerminalId, boolean>;
  speeds: number[];
  threat: { label: string; seconds: number } | null;
  nearSpoke: boolean;
  score: number;
  correct: number;
  wrong: number;
};

type AssetSet = {
  floor?: HTMLImageElement;
  player?: HTMLImageElement;
  terminal?: HTMLImageElement;
  hazard?: HTMLImageElement;
};

type RecallEvaluation = {
  correct: boolean;
  explanation: string;
  correctAnswer: string;
  evaluator: "local" | "semantic";
};

function normalizeRecallText(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("de-DE")
    .replace(/ä/gu, "ae")
    .replace(/ö/gu, "oe")
    .replace(/ü/gu, "ue")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

const BONUSES: Record<BonusId, BonusDefinition> = {
  brake: { id: "brake", name: "ТОРМОЗ", mark: "Ⅱ", effect: "Твоё кольцо ×0.45", cost: "соседнее ×1.45", impulseCost: 20, color: "#35e0c1" },
  reverse: { id: "reverse", name: "РЕВЕРС", mark: "↺", effect: "Разворот на 6 сек", cost: "маршрут тоже меняется", impulseCost: 30, color: "#a98cff" },
  overdrive: { id: "overdrive", name: "ФОРСАЖ", mark: "»", effect: "Твоё кольцо ×1.75", cost: "опасности ближе", impulseCost: 20, color: "#f5d94e" },
  shift: { id: "shift", name: "СДВИГ", mark: "+", effect: "Рывок кольца на 40°", cost: "вся геометрия сдвинется", impulseCost: 25, color: "#ff9d4a" },
  blackout: { id: "blackout", name: "ГЛУШИЛКА", mark: "×", effect: "Ловушки выкл. 6 сек", cost: "все кольца ×1.28", impulseCost: 35, color: "#ff6b6b" },
};

const TERMINALS: Array<{
  id: TerminalId;
  ring: number;
  localAngle: number;
  color: string;
  name: string;
  effect: string;
  cost: string;
}> = [
  { id: "A", ring: 0, localAngle: -2.18, color: "#35e0c1", name: "ПИТАНИЕ", effect: "+12 секунд", cost: "кольца быстрее" },
  { id: "B", ring: 1, localAngle: 0.72, color: "#47b8ff", name: "РОТОР", effect: "спицы медленнее", cost: "одна спица отключится" },
  { id: "C", ring: 2, localAngle: 2.58, color: "#f5d94e", name: "ЗАЩИТА", effect: "пила отключится", cost: "кольца развернутся" },
];

const HAZARDS = [
  { id: "saw", label: "ПИЛА", angle: -Math.PI / 2, rings: [0, 1], width: 0.1, color: "#ff5f45" },
  { id: "arc", label: "ДУГА", angle: 2.52, rings: [1, 2], width: 0.095, color: "#ffb347" },
  { id: "press", label: "ПРЕСС", angle: 0.13, rings: [0, 1, 2], width: 0.075, color: "#ff3d70" },
] as const;

function normalizeAngle(value: number) {
  let angle = value % TAU;
  if (angle > Math.PI) angle -= TAU;
  if (angle < -Math.PI) angle += TAU;
  return angle;
}

function angleDistance(a: number, b: number) {
  return Math.abs(normalizeAngle(a - b));
}

function directedDistance(from: number, to: number, direction: number) {
  const clockwise = ((to - from) % TAU + TAU) % TAU;
  return direction >= 0 ? clockwise : (TAU - clockwise) % TAU;
}

function createWorld(): WorldState {
  return {
    rings: [
      { angle: 0.4, baseSpeed: 0.064, permanentScale: 1, permanentDirection: 1, temporaryMultiplier: 1, temporaryUntil: 0, reversedUntil: 0, frozenUntil: 0 },
      { angle: -0.8, baseSpeed: -0.084, permanentScale: 1, permanentDirection: 1, temporaryMultiplier: 1, temporaryUntil: 0, reversedUntil: 0, frozenUntil: 0 },
      { angle: 1.2, baseSpeed: 0.112, permanentScale: 1, permanentDirection: 1, temporaryMultiplier: 1, temporaryUntil: 0, reversedUntil: 0, frozenUntil: 0 },
    ],
    player: { ringIndex: 1, localAngle: 2.8, mode: "ring", spokeIndex: 0, health: 5, invulnerableUntil: 18 },
    terminals: { A: false, B: false, C: false },
    terminalOffsets: { A: null, B: null, C: null },
    elapsed: 0,
    phaseTime: 180,
    spokeAngle: 1.02,
    spokeSpeed: 0.24,
    spokeCount: 3,
    spokeCharge: 0,
    hazardsDisabledUntil: 0,
    sawDisabled: false,
    particles: [],
    shake: 0,
    flash: 0,
    score: 0,
    correct: 0,
    wrong: 0,
  };
}

function getRingSpeed(world: WorldState, index: number) {
  const ring = world.rings[index];
  if (world.elapsed < ring.frozenUntil) return 0;
  const temporary = world.elapsed < ring.temporaryUntil ? ring.temporaryMultiplier : 1;
  const reversed = world.elapsed < ring.reversedUntil ? -1 : 1;
  return ring.baseSpeed * ring.permanentScale * ring.permanentDirection * temporary * reversed;
}

function getSpokeAngle(world: WorldState, index: number) {
  return normalizeAngle(world.spokeAngle + (TAU / world.spokeCount) * index);
}

function getPlayerWorldAngle(world: WorldState) {
  if (world.player.mode === "spoke") {
    return getSpokeAngle(world, Math.min(world.player.spokeIndex, world.spokeCount - 1));
  }
  return normalizeAngle(world.rings[world.player.ringIndex].angle + world.player.localAngle);
}

function nearestSpoke(world: WorldState) {
  const playerAngle = getPlayerWorldAngle(world);
  let best = { index: 0, distance: Infinity };
  for (let index = 0; index < world.spokeCount; index += 1) {
    const distance = angleDistance(playerAngle, getSpokeAngle(world, index));
    if (distance < best.distance) best = { index, distance };
  }
  return best;
}

function isHazardActive(world: WorldState, hazardId: string) {
  if (world.elapsed < world.hazardsDisabledUntil) return false;
  if (hazardId === "saw" && world.sawDisabled) return false;
  if (hazardId === "press") return Math.sin(world.elapsed * 2.15) > -0.15;
  return true;
}

function getThreat(world: WorldState) {
  const ringIndex = world.player.ringIndex;
  const playerAngle = getPlayerWorldAngle(world);
  const speed = world.player.mode === "spoke" ? world.spokeSpeed : getRingSpeed(world, ringIndex);
  if (Math.abs(speed) < 0.01) return null;
  let best: { label: string; seconds: number } | null = null;
  for (const hazard of HAZARDS) {
    if (!hazard.rings.includes(ringIndex as never) || !isHazardActive(world, hazard.id)) continue;
    const seconds = directedDistance(playerAngle, hazard.angle, speed) / Math.abs(speed);
    if (seconds < 24 && (!best || seconds < best.seconds)) best = { label: hazard.label, seconds };
  }
  return best;
}

function snapshotWorld(world: WorldState): HudSnapshot {
  return {
    time: world.phaseTime,
    health: world.player.health,
    ringIndex: world.player.ringIndex,
    mode: world.player.mode,
    charge: world.spokeCharge,
    terminals: { ...world.terminals },
    speeds: world.rings.map((_, index) => Math.round((getRingSpeed(world, index) * 180) / Math.PI)),
    threat: getThreat(world),
    nearSpoke: world.player.mode === "spoke" || nearestSpoke(world).distance < 0.24,
    score: world.score,
    correct: world.correct,
    wrong: world.wrong,
  };
}

function polar(cx: number, cy: number, radius: number, angle: number) {
  return { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius };
}

function drawSprite(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement | undefined,
  x: number,
  y: number,
  size: number,
  rotation = 0,
  alpha = 1,
) {
  if (!image?.complete || image.naturalWidth === 0) return false;
  context.save();
  context.translate(x, y);
  context.rotate(rotation);
  context.globalAlpha = alpha;
  const ratio = image.naturalWidth / image.naturalHeight;
  const width = ratio >= 1 ? size : size * ratio;
  const height = ratio >= 1 ? size / ratio : size;
  context.drawImage(image, -width / 2, -height / 2, width, height);
  context.restore();
  return true;
}

function drawArena(canvas: HTMLCanvasElement, world: WorldState, assets: AssetSet) {
  const rect = canvas.getBoundingClientRect();
  const density = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.round(rect.width * density));
  const height = Math.max(1, Math.round(rect.height * density));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const context = canvas.getContext("2d");
  if (!context) return;
  context.setTransform(density, 0, 0, density, 0, 0);
  const viewWidth = rect.width;
  const viewHeight = rect.height;
  context.clearRect(0, 0, viewWidth, viewHeight);

  if (assets.floor?.complete) {
    const imageRatio = assets.floor.naturalWidth / assets.floor.naturalHeight;
    const viewRatio = viewWidth / viewHeight;
    const sourceWidth = imageRatio > viewRatio ? assets.floor.naturalHeight * viewRatio : assets.floor.naturalWidth;
    const sourceHeight = imageRatio > viewRatio ? assets.floor.naturalHeight : assets.floor.naturalWidth / viewRatio;
    context.globalAlpha = 0.72;
    context.drawImage(
      assets.floor,
      (assets.floor.naturalWidth - sourceWidth) / 2,
      (assets.floor.naturalHeight - sourceHeight) / 2,
      sourceWidth,
      sourceHeight,
      0,
      0,
      viewWidth,
      viewHeight,
    );
    context.globalAlpha = 1;
  } else {
    const gradient = context.createRadialGradient(viewWidth * 0.5, viewHeight * 0.48, 10, viewWidth * 0.5, viewHeight * 0.48, Math.max(viewWidth, viewHeight) * 0.7);
    gradient.addColorStop(0, "#15332f");
    gradient.addColorStop(0.55, "#091715");
    gradient.addColorStop(1, "#030908");
    context.fillStyle = gradient;
    context.fillRect(0, 0, viewWidth, viewHeight);
  }
  context.fillStyle = "rgba(1, 8, 7, 0.32)";
  context.fillRect(0, 0, viewWidth, viewHeight);

  const cx = viewWidth * 0.5 + (world.shake > 0 ? (Math.random() - 0.5) * world.shake : 0);
  const cy = viewHeight * 0.5 + (world.shake > 0 ? (Math.random() - 0.5) * world.shake : 0);
  const maxRadius = Math.min(viewWidth, viewHeight) * 0.425;
  const radii = [maxRadius * 0.84, maxRadius * 0.59, maxRadius * 0.34];
  const laneWidth = Math.max(25, maxRadius * 0.14);

  context.save();
  context.translate(cx, cy);
  context.strokeStyle = "rgba(127, 255, 231, 0.035)";
  context.lineWidth = 1;
  for (let radius = 30; radius < maxRadius * 1.15; radius += 32) {
    context.beginPath();
    context.arc(0, 0, radius, 0, TAU);
    context.stroke();
  }
  for (let index = 0; index < 16; index += 1) {
    const angle = (TAU / 16) * index;
    context.beginPath();
    context.moveTo(Math.cos(angle) * 20, Math.sin(angle) * 20);
    context.lineTo(Math.cos(angle) * maxRadius * 1.18, Math.sin(angle) * maxRadius * 1.18);
    context.stroke();
  }
  context.restore();

  for (let ringIndex = 0; ringIndex < 3; ringIndex += 1) {
    const radius = radii[ringIndex];
    const color = RING_COLORS[ringIndex];
    const ring = world.rings[ringIndex];
    context.save();
    context.shadowColor = color;
    context.shadowBlur = 13;
    context.strokeStyle = "rgba(2, 11, 10, 0.96)";
    context.lineWidth = laneWidth + 9;
    context.beginPath();
    context.arc(cx, cy, radius, 0, TAU);
    context.stroke();
    context.shadowBlur = 0;
    context.strokeStyle = color + "42";
    context.lineWidth = laneWidth;
    context.beginPath();
    context.arc(cx, cy, radius, 0, TAU);
    context.stroke();
    context.strokeStyle = color + "b8";
    context.lineWidth = 2;
    context.beginPath();
    context.arc(cx, cy, radius - laneWidth / 2, 0, TAU);
    context.stroke();
    context.beginPath();
    context.arc(cx, cy, radius + laneWidth / 2, 0, TAU);
    context.stroke();
    for (let tick = 0; tick < 24; tick += 1) {
      const angle = ring.angle + (TAU / 24) * tick;
      const outer = polar(cx, cy, radius + laneWidth * 0.28, angle);
      const inner = polar(cx, cy, radius - laneWidth * 0.28, angle);
      context.strokeStyle = tick % 4 === 0 ? color + "a8" : "rgba(235, 255, 247, 0.13)";
      context.lineWidth = tick % 4 === 0 ? 3 : 1;
      context.beginPath();
      context.moveTo(inner.x, inner.y);
      context.lineTo(outer.x, outer.y);
      context.stroke();
    }
    const speed = getRingSpeed(world, ringIndex);
    for (let marker = 0; marker < 3; marker += 1) {
      const angle = ring.angle + marker * (TAU / 3);
      const point = polar(cx, cy, radius, angle);
      context.save();
      context.translate(point.x, point.y);
      context.rotate(angle + (speed >= 0 ? Math.PI / 2 : -Math.PI / 2));
      context.fillStyle = color;
      context.beginPath();
      context.moveTo(8, 0);
      context.lineTo(-5, -5);
      context.lineTo(-5, 5);
      context.closePath();
      context.fill();
      context.restore();
    }
    context.restore();
  }

  context.save();
  context.globalCompositeOperation = "screen";
  for (let spokeIndex = 0; spokeIndex < world.spokeCount; spokeIndex += 1) {
    const angle = getSpokeAngle(world, spokeIndex);
    const start = polar(cx, cy, maxRadius * 0.16, angle);
    const end = polar(cx, cy, radii[0] + laneWidth * 0.55, angle);
    const gradient = context.createLinearGradient(start.x, start.y, end.x, end.y);
    gradient.addColorStop(0, "rgba(53, 224, 193, 0.08)");
    gradient.addColorStop(0.55, "rgba(114, 255, 231, 0.72)");
    gradient.addColorStop(1, "rgba(71, 184, 255, 0.12)");
    context.strokeStyle = gradient;
    context.lineWidth = 5;
    context.shadowColor = "#35e0c1";
    context.shadowBlur = 10;
    context.beginPath();
    context.moveTo(start.x, start.y);
    context.lineTo(end.x, end.y);
    context.stroke();
    context.shadowBlur = 0;
    for (const radius of radii) {
      const node = polar(cx, cy, radius, angle);
      context.fillStyle = "#eafff8";
      context.beginPath();
      context.arc(node.x, node.y, 4, 0, TAU);
      context.fill();
    }
  }
  context.restore();

  for (const hazard of HAZARDS) {
    const active = isHazardActive(world, hazard.id);
    const innerRadius = Math.min(...hazard.rings.map((index) => radii[index])) - laneWidth * 0.65;
    const outerRadius = Math.max(...hazard.rings.map((index) => radii[index])) + laneWidth * 0.65;
    context.save();
    context.globalAlpha = active ? 0.82 : 0.22;
    context.strokeStyle = hazard.color;
    context.lineWidth = 3;
    context.shadowColor = hazard.color;
    context.shadowBlur = active ? 17 : 0;
    const start = polar(cx, cy, innerRadius, hazard.angle);
    const end = polar(cx, cy, outerRadius, hazard.angle);
    context.beginPath();
    context.moveTo(start.x, start.y);
    context.lineTo(end.x, end.y);
    context.stroke();
    for (const ringIndex of hazard.rings) {
      const point = polar(cx, cy, radii[ringIndex], hazard.angle);
      context.fillStyle = active ? hazard.color : "#6d7774";
      context.beginPath();
      context.arc(point.x, point.y, active ? 7 : 4, 0, TAU);
      context.fill();
    }
    const iconPoint = polar(cx, cy, outerRadius + 22, hazard.angle);
    if (hazard.id === "saw") {
      if (!drawSprite(context, assets.hazard, iconPoint.x, iconPoint.y, 64, world.elapsed * 1.4, active ? 0.95 : 0.3)) {
        context.fillStyle = hazard.color;
        context.beginPath();
        context.arc(iconPoint.x, iconPoint.y, 18, 0, TAU);
        context.fill();
      }
    } else {
      context.fillStyle = "rgba(3, 10, 9, 0.92)";
      context.strokeStyle = hazard.color;
      context.lineWidth = 1;
      context.beginPath();
      context.arc(iconPoint.x, iconPoint.y, 18, 0, TAU);
      context.fill();
      context.stroke();
      context.fillStyle = active ? "#fff8e7" : "#75827f";
      context.font = "800 9px Inter, sans-serif";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(hazard.label, iconPoint.x, iconPoint.y);
    }
    context.restore();
  }

  for (const terminal of TERMINALS) {
    const angle = normalizeAngle(world.rings[terminal.ring].angle + terminal.localAngle);
    const point = polar(cx, cy, radii[terminal.ring], angle);
    const active = world.terminals[terminal.id];
    context.save();
    context.shadowColor = terminal.color;
    context.shadowBlur = active ? 7 : 22;
    context.globalAlpha = active ? 0.42 : 1;
    if (!drawSprite(context, assets.terminal, point.x, point.y, laneWidth * 1.85, angle + Math.PI / 2)) {
      context.fillStyle = "#0c1d1b";
      context.strokeStyle = terminal.color;
      context.lineWidth = 3;
      context.beginPath();
      context.arc(point.x, point.y, laneWidth * 0.42, 0, TAU);
      context.fill();
      context.stroke();
    }
    context.shadowBlur = 0;
    context.globalAlpha = 1;
    context.fillStyle = active ? "#06100f" : terminal.color;
    context.strokeStyle = active ? terminal.color : "#06100f";
    context.lineWidth = 2;
    context.beginPath();
    context.arc(point.x, point.y, laneWidth * 0.25, 0, TAU);
    context.fill();
    context.stroke();
    context.fillStyle = active ? terminal.color : "#06100f";
    context.font = "950 " + Math.max(12, laneWidth * 0.34) + "px Inter, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(active ? "✓" : terminal.id, point.x, point.y + 0.5);
    context.restore();
  }

  const terminalCount = Object.values(world.terminals).filter(Boolean).length;
  context.save();
  context.translate(cx, cy);
  const portalPulse = 1 + Math.sin(world.elapsed * 4) * 0.08;
  context.fillStyle = terminalCount === 3 ? "rgba(245, 217, 78, 0.18)" : "rgba(2, 10, 9, 0.82)";
  context.strokeStyle = terminalCount === 3 ? "#f5d94e" : "rgba(126, 181, 170, 0.18)";
  context.lineWidth = 3;
  context.shadowColor = "#f5d94e";
  context.shadowBlur = terminalCount === 3 ? 28 : 0;
  context.beginPath();
  context.arc(0, 0, maxRadius * 0.13 * portalPulse, 0, TAU);
  context.fill();
  context.stroke();
  context.shadowBlur = 0;
  context.fillStyle = terminalCount === 3 ? "#fff4a8" : "#506663";
  context.font = "900 9px Inter, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(terminalCount === 3 ? "ВЫХОД" : terminalCount + "/3", 0, 0);
  context.restore();

  const playerAngle = getPlayerWorldAngle(world);
  const playerPoint = polar(cx, cy, radii[world.player.ringIndex], playerAngle);
  const playerSpeed = world.player.mode === "spoke" ? world.spokeSpeed : getRingSpeed(world, world.player.ringIndex);
  const blink = world.elapsed < world.player.invulnerableUntil && Math.floor(world.elapsed * 12) % 2 === 0;
  if (!blink) {
    context.save();
    context.shadowColor = "#ff6b45";
    context.shadowBlur = 20;
    if (!drawSprite(context, assets.player, playerPoint.x, playerPoint.y, laneWidth * 1.55, playerAngle + (playerSpeed >= 0 ? 0.8 : -2.35))) {
      context.translate(playerPoint.x, playerPoint.y);
      context.rotate(playerAngle + (playerSpeed >= 0 ? Math.PI / 2 : -Math.PI / 2));
      context.fillStyle = "#ff6b45";
      context.beginPath();
      context.moveTo(12, 0);
      context.lineTo(-9, -8);
      context.lineTo(-5, 0);
      context.lineTo(-9, 8);
      context.closePath();
      context.fill();
    }
    context.restore();
  }
  if (world.player.mode === "spoke") {
    context.save();
    context.strokeStyle = "#fff8d4";
    context.lineWidth = 2;
    context.setLineDash([4, 5]);
    context.beginPath();
    context.arc(playerPoint.x, playerPoint.y, laneWidth * 0.6, 0, TAU);
    context.stroke();
    context.restore();
  }
  for (const particle of world.particles) {
    const point = polar(cx, cy, radii[Math.max(0, Math.min(2, particle.ring))] + particle.radial, particle.angle);
    context.globalAlpha = Math.max(0, particle.life / particle.maxLife);
    context.fillStyle = particle.color;
    context.beginPath();
    context.arc(point.x, point.y, particle.size, 0, TAU);
    context.fill();
  }
  context.globalAlpha = 1;
  if (world.flash > 0) {
    context.fillStyle = "rgba(255, 91, 62, " + Math.min(0.28, world.flash * 0.18) + ")";
    context.fillRect(0, 0, viewWidth, viewHeight);
  }
}

function spawnBurst(
  world: WorldState,
  color: string,
  count = 14,
  ring = world.player.ringIndex,
  angle = getPlayerWorldAngle(world),
) {
  for (let index = 0; index < count; index += 1) {
    world.particles.push({
      angle: angle + (Math.random() - 0.5) * 0.18,
      ring,
      radial: (Math.random() - 0.5) * 12,
      life: 0.65 + Math.random() * 0.55,
      maxLife: 1.2,
      size: 1.4 + Math.random() * 2.8,
      color,
      angularSpeed: (Math.random() - 0.5) * 0.42,
      radialSpeed: (Math.random() - 0.5) * 28,
    });
  }
}

export default function Home() {
  const [phase, setPhase] = useState<Phase>("setup");
  const [draftSettings, setDraftSettings] = useState<LearningSettings>(DEFAULT_LEARNING_SETTINGS);
  const [sessionSettings, setSessionSettings] = useState<LearningSettings>(DEFAULT_LEARNING_SETTINGS);
  const [settingsReady, setSettingsReady] = useState(false);
  const {
    question,
    questionNumber,
    queuedCount,
    isRefilling,
    nextQuestion,
    restartQuestions,
    releaseQuestion,
  } = useQuestionPool(sessionSettings, settingsReady && phase !== "setup");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const recallInputRef = useRef<HTMLInputElement>(null);
  const worldRef = useRef<WorldState>(createWorld());
  const phaseRef = useRef<Phase>("setup");
  const soundRef = useRef(true);
  const assetsRef = useRef<AssetSet>({});
  const audioRef = useRef<AudioContext | null>(null);
  const inventoryRef = useRef<StoredBonus[]>([]);
  const comboRef = useRef(0);
  const resolutionRef = useRef({ action: false, bonus: false });
  const feedbackRef = useRef<"correct" | "wrong" | null>(null);
  const impulseRef = useRef(100);
  const impulseExpiredRef = useRef(false);
  const evaluatingRef = useRef(false);
  const recallRequestRef = useRef(0);
  const onImpulseExpiredRef = useRef<() => void>(() => {});
  const callbacksRef = useRef<{
    onTerminal: (id: TerminalId) => void;
    onHit: (label: string) => void;
    onLose: (reason: string) => void;
  }>({
    onTerminal: () => {},
    onHit: () => {},
    onLose: () => {},
  });
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [hud, setHud] = useState<HudSnapshot>(() => snapshotWorld(createWorld()));
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const [impulse, setImpulse] = useState(100);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [resolution, setResolution] = useState({ action: false, bonus: false });
  const [inventory, setInventory] = useState<StoredBonus[]>([]);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [banner, setBanner] = useState("");
  const [lossReason, setLossReason] = useState("");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [recallAnswer, setRecallAnswer] = useState("");
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [feedbackDetail, setFeedbackDetail] = useState("");

  const terminalCount = Object.values(hud.terminals).filter(Boolean).length;
  const exitUnlocked = terminalCount === 3;

  const setGamePhase = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [phase]);

  useEffect(() => {
    let cancelled = false;
    let restored = DEFAULT_LEARNING_SETTINGS;
    try {
      const raw = window.localStorage.getItem(LEARNING_SETTINGS_STORAGE_KEY);
      if (raw) restored = normalizeLearningSettings(JSON.parse(raw));
    } catch {
      // Private browsing and malformed old settings must not block the menu.
    }
    queueMicrotask(() => {
      if (cancelled) return;
      setDraftSettings(restored);
      setSessionSettings(restored);
      setSettingsReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const updateDraftSettings = useCallback((patch: Partial<LearningSettings>) => {
    setDraftSettings((current) => normalizeLearningSettings({ ...current, ...patch }));
  }, []);

  const confirmLearningSettings = useCallback(() => {
    const confirmed = normalizeLearningSettings(draftSettings);
    setDraftSettings(confirmed);
    setSessionSettings(confirmed);
    try {
      window.localStorage.setItem(LEARNING_SETTINGS_STORAGE_KEY, JSON.stringify(confirmed));
    } catch {
      // The current session remains fully playable without browser storage.
    }
    setGamePhase("briefing");
  }, [draftSettings, setGamePhase]);

  const returnToSetup = useCallback(() => {
    recallRequestRef.current += 1;
    evaluatingRef.current = false;
    setIsEvaluating(false);
    setDraftSettings(sessionSettings);
    setGamePhase("setup");
  }, [sessionSettings, setGamePhase]);

  const playTone = useCallback(
    (kind: "correct" | "wrong" | "move" | "bonus" | "terminal" | "hit" | "win") => {
      if (!soundRef.current || typeof window === "undefined") return;
      const AudioContextClass =
        window.AudioContext ??
        (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;
      if (!audioRef.current) audioRef.current = new AudioContextClass();
      const audio = audioRef.current;
      if (audio.state === "suspended") void audio.resume();
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      const settings = {
        correct: [620, 0.11, "triangle"],
        wrong: [145, 0.16, "sawtooth"],
        move: [280, 0.06, "square"],
        bonus: [440, 0.12, "triangle"],
        terminal: [760, 0.32, "sine"],
        hit: [85, 0.22, "sawtooth"],
        win: [920, 0.5, "triangle"],
      } as const;
      const [frequency, duration, type] = settings[kind];
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, audio.currentTime);
      if (kind === "terminal" || kind === "win") {
        oscillator.frequency.exponentialRampToValueAtTime(frequency * 1.6, audio.currentTime + duration);
      }
      gain.gain.setValueAtTime(0.0001, audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.09, audio.currentTime + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + duration);
      oscillator.connect(gain);
      gain.connect(audio.destination);
      oscillator.start();
      oscillator.stop(audio.currentTime + duration + 0.02);
    },
    [],
  );

  const showBanner = useCallback((message: string) => {
    setBanner(message);
    if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    bannerTimerRef.current = setTimeout(() => setBanner(""), 2300);
  }, []);

  const loseGame = useCallback(
    (reason: string) => {
      if (phaseRef.current !== "playing") return;
      setLossReason(reason);
      resolutionRef.current = { action: false, bonus: false };
      setResolution({ action: false, bonus: false });
      setGamePhase("lost");
      playTone("hit");
    },
    [playTone, setGamePhase],
  );

  const activateTerminal = useCallback(
    (id: TerminalId) => {
      const world = worldRef.current;
      const count = Object.values(world.terminals).filter(Boolean).length;
      world.phaseTime += TERMINAL_TIME_BONUS;
      if (count === 1) world.phaseTime = Math.max(world.phaseTime, 108);
      if (count === 2) world.phaseTime = Math.max(world.phaseTime, 76);
      if (count === 3) world.phaseTime = Math.max(world.phaseTime, 56);
      world.player.health = Math.min(5, world.player.health + 1);

      if (id === "A") {
        world.phaseTime += 12;
        world.rings.forEach((ring) => { ring.permanentScale *= 1.14; });
      }
      if (id === "B") {
        if (world.player.mode === "spoke" && world.player.spokeIndex === 2) {
          const worldAngle = getPlayerWorldAngle(world);
          world.player.mode = "ring";
          world.player.localAngle = normalizeAngle(worldAngle - world.rings[world.player.ringIndex].angle);
        }
        world.spokeCount = 2;
        world.spokeSpeed *= 0.72;
        world.rings[1].permanentScale *= 0.78;
        world.rings[0].permanentScale *= 1.16;
      }
      if (id === "C") {
        world.sawDisabled = true;
        world.rings.forEach((ring) => { ring.permanentDirection *= -1; });
      }

      world.score += 1000 + Math.round(world.phaseTime * 8);
      const terminal = TERMINALS.find((item) => item.id === id)!;
      spawnBurst(
        world,
        terminal.color,
        28,
        terminal.ring,
        normalizeAngle(world.rings[terminal.ring].angle + terminal.localAngle),
      );
      playTone("terminal");
      showBanner(
        count === 3
          ? "КОНТУР СОБРАН · ВЫХОД ОТКРЫТ"
          : "УЗЕЛ " + id + ": +" + TERMINAL_TIME_BONUS + "с · " + terminal.effect + " · " + terminal.cost,
      );
    },
    [playTone, showBanner],
  );

  const onHit = useCallback(
    (label: string) => {
      playTone("hit");
      showBanner("УДАР: " + label + " · ЦЕЛОСТНОСТЬ −1");
    },
    [playTone, showBanner],
  );

  useEffect(() => {
    callbacksRef.current = { onTerminal: activateTerminal, onHit, onLose: loseGame };
  }, [activateTerminal, loseGame, onHit]);

  useEffect(() => {
    const load = (key: keyof AssetSet, source: string) => {
      const image = new Image();
      image.decoding = "async";
      image.src = source;
      image.onload = () => { assetsRef.current[key] = image; };
    };
    load("floor", "/game-assets/arena-floor.webp");
    load("player", "/game-assets/player-core.webp");
    load("terminal", "/game-assets/terminal-core.webp");
    load("hazard", "/game-assets/hazard-core.webp");
  }, []);

  useEffect(() => {
    let animationFrame = 0;
    let lastFrame = performance.now();
    let lastHudUpdate = 0;

    const frame = (now: number) => {
      const world = worldRef.current;
      const delta = Math.min(0.05, Math.max(0, (now - lastFrame) / 1000));
      lastFrame = now;

      // A submitted free answer may need a semantic network check. That
      // latency must never consume arena time or health.
      if (phaseRef.current === "playing" && !evaluatingRef.current) {
        const simulationDelta = delta;
        world.elapsed += simulationDelta;
        world.phaseTime -= simulationDelta;
        world.rings.forEach((ring, index) => {
          ring.angle = normalizeAngle(ring.angle + getRingSpeed(world, index) * simulationDelta);
        });
        world.spokeAngle = normalizeAngle(world.spokeAngle + world.spokeSpeed * simulationDelta);
        if (world.player.mode === "spoke") {
          world.spokeCharge = Math.min(100, world.spokeCharge + simulationDelta * 8.5);
        }

        world.particles.forEach((particle) => {
          particle.life -= delta;
          particle.angle += particle.angularSpeed * delta;
          particle.radial += particle.radialSpeed * delta;
        });
        world.particles = world.particles.filter((particle) => particle.life > 0);
        world.shake = Math.max(0, world.shake - delta * 28);
        world.flash = Math.max(0, world.flash - delta * 2.2);

        for (const terminal of TERMINALS) {
          if (world.terminals[terminal.id] || world.player.ringIndex !== terminal.ring) {
            world.terminalOffsets[terminal.id] = null;
            continue;
          }
          const terminalAngle = normalizeAngle(world.rings[terminal.ring].angle + terminal.localAngle);
          const offset = normalizeAngle(getPlayerWorldAngle(world) - terminalAngle);
          const previous = world.terminalOffsets[terminal.id];
          world.terminalOffsets[terminal.id] = offset;
          // Moving past the node counts as well: a step that overshoots it
          // flips the side the player is on without ever coming close.
          const sweptThrough =
            previous !== null &&
            previous * offset < 0 &&
            Math.abs(previous - offset) < TERMINAL_SWEEP_LIMIT;
          if (Math.abs(offset) < TERMINAL_REACH || sweptThrough) {
            world.terminals[terminal.id] = true;
            world.terminalOffsets[terminal.id] = null;
            callbacksRef.current.onTerminal(terminal.id);
          }
        }

        if (world.elapsed >= world.player.invulnerableUntil) {
          const playerAngle = getPlayerWorldAngle(world);
          for (const hazard of HAZARDS) {
            if (!hazard.rings.includes(world.player.ringIndex as never) || !isHazardActive(world, hazard.id)) continue;
            if (angleDistance(playerAngle, hazard.angle) < hazard.width) {
              world.player.health -= 1;
              world.player.invulnerableUntil = world.elapsed + 6;
              world.shake = 13;
              world.flash = 1;
              if (world.player.mode === "spoke") {
                world.player.mode = "ring";
                world.player.localAngle = normalizeAngle(
                  playerAngle - world.rings[world.player.ringIndex].angle,
                );
              }
              spawnBurst(world, hazard.color, 24);
              callbacksRef.current.onHit(hazard.label);
              if (world.player.health <= 0) callbacksRef.current.onLose("Критическое повреждение бегунка.");
              break;
            }
          }
        }
        if (world.phaseTime <= 0) {
          world.phaseTime = 0;
          callbacksRef.current.onLose("Контур разрядился раньше активации узла.");
        }
      } else {
        world.shake = Math.max(0, world.shake - delta * 28);
        world.flash = Math.max(0, world.flash - delta * 2.2);
      }

      if (canvasRef.current) drawArena(canvasRef.current, world, assetsRef.current);
      if (now - lastHudUpdate > 100) {
        lastHudUpdate = now;
        setHud(snapshotWorld(world));
      }
      animationFrame = requestAnimationFrame(frame);
    };

    animationFrame = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(animationFrame);
  }, []);

  useEffect(
    () => () => {
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
      void audioRef.current?.close();
    },
    [],
  );

  const resetTurn = useCallback(() => {
    resolutionRef.current = { action: false, bonus: false };
    setResolution({ action: false, bonus: false });
    feedbackRef.current = null;
    setFeedback(null);
    setSelectedAnswer(null);
    setRecallAnswer("");
    setFeedbackDetail("");
    recallRequestRef.current += 1;
    evaluatingRef.current = false;
    setIsEvaluating(false);
    impulseRef.current = 100;
    impulseExpiredRef.current = false;
    setImpulse(100);
  }, []);

  const openQuestion = useCallback((restart = false) => {
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    if (restart) restartQuestions();
    else nextQuestion();
    resetTurn();
  }, [nextQuestion, resetTurn, restartQuestions]);

  const scheduleNextQuestion = useCallback((delay = 140) => {
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    advanceTimerRef.current = setTimeout(() => {
      if (phaseRef.current !== "playing") return;
      openQuestion(false);
    }, delay);
  }, [openQuestion]);

  const startGame = useCallback(() => {
    worldRef.current = createWorld();
    setHud(snapshotWorld(worldRef.current));
    inventoryRef.current = [];
    setInventory([]);
    comboRef.current = 0;
    setCombo(0);
    setBestCombo(0);
    setLossReason("");
    setBanner("");
    openQuestion(true);
    setGamePhase("playing");
    playTone("move");
  }, [openQuestion, playTone, setGamePhase]);

  const completeResolutionPart = useCallback((part: "action" | "bonus") => {
    const next = { ...resolutionRef.current, [part]: false };
    resolutionRef.current = next;
    setResolution(next);
    if (!next.action && !next.bonus) {
      worldRef.current.score += Math.round(impulseRef.current * 2);
      impulseExpiredRef.current = true;
      scheduleNextQuestion(140);
    }
  }, [scheduleNextQuestion]);

  const expireImpulse = useCallback(() => {
    if (phaseRef.current !== "playing" || impulseExpiredRef.current) return;
    impulseExpiredRef.current = true;
    impulseRef.current = 0;
    setImpulse(0);
    resolutionRef.current = { action: false, bonus: false };
    setResolution({ action: false, bonus: false });
    if (feedbackRef.current !== "correct") {
      comboRef.current = 0;
      setCombo(0);
      worldRef.current.wrong += 1;
      feedbackRef.current = "wrong";
      setFeedback("wrong");
      releaseQuestion(question);
    }
    playTone("wrong");
    showBanner(feedbackRef.current === "correct" ? "ИМПУЛЬС ПОГАС · ХОД СГОРЕЛ" : "ИМПУЛЬС ПОГАС · НОВЫЙ ТЕСТ");
    scheduleNextQuestion(760);
  }, [playTone, question, releaseQuestion, scheduleNextQuestion, showBanner]);

  useEffect(() => {
    onImpulseExpiredRef.current = expireImpulse;
  }, [expireImpulse]);

  useEffect(() => {
    if (
      phase !== "playing"
      || sessionSettings.mode !== "recall"
      || feedback
      || resolution.action
      || isEvaluating
    ) return;
    const frame = window.requestAnimationFrame(() => {
      recallInputRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [feedback, isEvaluating, phase, question.id, resolution.action, sessionSettings.mode]);

  useEffect(() => {
    if (phase !== "playing" || feedback === "wrong" || isEvaluating || impulseExpiredRef.current) return;
    let lastTick = performance.now();
    const interval = window.setInterval(() => {
      const now = performance.now();
      const delta = Math.min(0.25, Math.max(0, (now - lastTick) / 1000));
      lastTick = now;
      if (evaluatingRef.current) return;
      const decay = resolutionRef.current.action ? IMPULSE_ACTION_DECAY : IMPULSE_QUESTION_DECAY;
      const next = Math.max(0, impulseRef.current - delta * decay);
      impulseRef.current = next;
      setImpulse(next);
      if (next <= 0 && !impulseExpiredRef.current) onImpulseExpiredRef.current();
    }, 80);
    return () => window.clearInterval(interval);
  }, [feedback, isEvaluating, phase, question.id, resolution.action]);

  const commitAnswer = useCallback(
    (correct: boolean, answerIndex: number | null = null, detail = "", wrongDelay: number | null = 2800) => {
      if (
        phaseRef.current !== "playing" ||
        feedbackRef.current !== null ||
        resolutionRef.current.action ||
        resolutionRef.current.bonus ||
        impulseExpiredRef.current
      ) return;
      if (answerIndex !== null) setSelectedAnswer(answerIndex);
      setFeedbackDetail(detail);
      const world = worldRef.current;
      if (correct) {
        const nextCombo = comboRef.current + 1;
        comboRef.current = nextCombo;
        setCombo(nextCombo);
        setBestCombo((value) => Math.max(value, nextCombo));
        world.correct += 1;
        world.score += 120 + nextCombo * 12 + Math.round(impulseRef.current);
        feedbackRef.current = "correct";
        setFeedback("correct");
        const bonusIds = Object.keys(BONUSES) as BonusId[];
        const bonusId = bonusIds[(questionNumber - 1) % bonusIds.length];
        const current = inventoryRef.current;
        const duplicateIndex = current.findIndex((bonus) => bonus.id === bonusId);
        let next = current;
        if (duplicateIndex >= 0) {
          next = current.map((bonus, index) =>
            index === duplicateIndex ? { ...bonus, level: 2 as const } : bonus,
          );
          showBanner("ВЕРНО · " + BONUSES[bonusId].name + " УСИЛЕН");
        } else if (current.length < 2) {
          next = [...current, { id: bonusId, level: 1 }];
          showBanner("ВЕРНО · " + BONUSES[bonusId].name + " В СЛОТЕ");
        } else {
          next = [...current.slice(1), { id: bonusId, level: 1 }];
          showBanner("ВЕРНО · " + BONUSES[bonusId].name + " ЗАМЕНИЛ СТАРЫЙ БОНУС");
        }
        inventoryRef.current = next;
        setInventory(next);
        const nextResolution = { action: true, bonus: false };
        resolutionRef.current = nextResolution;
        setResolution(nextResolution);
        spawnBurst(world, "#9dffe9", 12);
        playTone("correct");
      } else {
        comboRef.current = 0;
        setCombo(0);
        world.wrong += 1;
        feedbackRef.current = "wrong";
        setFeedback("wrong");
        releaseQuestion(question);
        playTone("wrong");
        if (wrongDelay !== null) scheduleNextQuestion(wrongDelay);
      }
    },
    [playTone, question, questionNumber, releaseQuestion, scheduleNextQuestion, showBanner],
  );

  const handleAnswer = useCallback((answerIndex: number) => {
    commitAnswer(answerIndex === question.correct, answerIndex);
  }, [commitAnswer, question.correct]);

  const submitRecallAnswer = useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const userAnswer = recallAnswer.trim();
    if (
      !userAnswer
      || sessionSettings.mode !== "recall"
      || phaseRef.current !== "playing"
      || feedbackRef.current !== null
      || resolutionRef.current.action
      || resolutionRef.current.bonus
      || evaluatingRef.current
      || impulseExpiredRef.current
    ) return;

    const activeQuestion = question;
    const expectedAnswer = activeQuestion.options[activeQuestion.correct];
    const requestId = ++recallRequestRef.current;
    evaluatingRef.current = true;
    setIsEvaluating(true);
    setFeedbackDetail("Проверяем немецкую формулировку…");

    let result: RecallEvaluation;
    const evaluationController = new AbortController();
    const evaluationTimeout = window.setTimeout(() => evaluationController.abort(), 9_000);
    try {
      const response = await fetch("/api/questions/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: activeQuestion.prompt,
          context: activeQuestion.context,
          translation: activeQuestion.translation,
          expectedAnswer,
          userAnswer,
          level: sessionSettings.level,
          lexicalTopic: sessionSettings.lexicalTopic,
          grammarTopic: sessionSettings.grammarTopic,
        }),
        signal: evaluationController.signal,
      });
      if (!response.ok) throw new Error(`evaluation_${response.status}`);
      const payload = await response.json() as Partial<RecallEvaluation>;
      if (
        typeof payload.correct !== "boolean"
        || typeof payload.explanation !== "string"
        || typeof payload.correctAnswer !== "string"
        || (payload.evaluator !== "local" && payload.evaluator !== "semantic")
      ) throw new Error("invalid_evaluation");
      result = payload as RecallEvaluation;
    } catch {
      const correct = normalizeRecallText(userAnswer) === normalizeRecallText(expectedAnswer);
      result = {
        correct,
        explanation: correct
          ? "Ответ совпадает с эталоном."
          : "Проверка другой формулировки недоступна; сравниваем со строгим эталоном.",
        correctAnswer: expectedAnswer,
        evaluator: "local",
      };
    } finally {
      window.clearTimeout(evaluationTimeout);
    }

    if (requestId !== recallRequestRef.current) return;
    evaluatingRef.current = false;
    setIsEvaluating(false);
    if (phaseRef.current !== "playing" || question.id !== activeQuestion.id) return;
    const detail = result.correct
      ? result.explanation
      : `${result.explanation} Правильно: ${result.correctAnswer}`;
    commitAnswer(result.correct, null, detail, null);
  }, [commitAnswer, question, recallAnswer, sessionSettings]);

  const applyBonus = useCallback(
    (bonusId: BonusId, level: 1 | 2 = 1) => {
      if (phaseRef.current !== "playing") return;
      const world = worldRef.current;
      const ringIndex = world.player.ringIndex;
      const ring = world.rings[ringIndex];
      const duration = 6 * (level === 2 ? 1.55 : 1);
      const neighborIndex = ringIndex === 0 ? 1 : ringIndex - 1;

      if (bonusId === "brake") {
        ring.temporaryMultiplier = 0.45;
        ring.temporaryUntil = world.elapsed + duration;
        world.rings[neighborIndex].temporaryMultiplier = 1.45;
        world.rings[neighborIndex].temporaryUntil = world.elapsed + duration;
      }
      if (bonusId === "reverse") ring.reversedUntil = world.elapsed + duration;
      if (bonusId === "overdrive") {
        ring.temporaryMultiplier = level === 2 ? 2.1 : 1.75;
        ring.temporaryUntil = world.elapsed + duration;
      }
      if (bonusId === "shift") {
        ring.angle = normalizeAngle(ring.angle + (level === 2 ? Math.PI / 3 : (Math.PI * 2) / 9));
      }
      if (bonusId === "blackout") {
        world.hazardsDisabledUntil = world.elapsed + duration;
        world.rings.forEach((targetRing) => {
          targetRing.temporaryMultiplier = 1.28;
          targetRing.temporaryUntil = world.elapsed + duration;
        });
      }
      world.score += 35 * level;
      spawnBurst(world, BONUSES[bonusId].color, level === 2 ? 22 : 14);
      showBanner(BONUSES[bonusId].name + (level === 2 ? " ×2" : "") + " · " + BONUSES[bonusId].effect);
      playTone("bonus");
    },
    [playTone, showBanner],
  );

  const activateStoredBonus = useCallback(
    (index: number) => {
      if (phaseRef.current !== "playing") return;
      const stored = inventoryRef.current[index];
      if (!stored) return;
      const cost = BONUSES[stored.id].impulseCost + (stored.level === 2 ? 8 : 0);
      if (impulseRef.current < cost) {
        showBanner("НЕ ХВАТАЕТ ИМПУЛЬСА · НУЖНО " + cost + "%");
        return;
      }
      impulseRef.current = Math.max(0, impulseRef.current - cost);
      setImpulse(impulseRef.current);
      const next = inventoryRef.current.filter((_, itemIndex) => itemIndex !== index);
      inventoryRef.current = next;
      setInventory(next);
      applyBonus(stored.id, stored.level);
    },
    [applyBonus, showBanner],
  );

  const performAction = useCallback(
    (action: ActionId) => {
      if (!resolutionRef.current.action || phaseRef.current !== "playing") return;
      const world = worldRef.current;
      const player = world.player;
      const beforeAngle = getPlayerWorldAngle(world);
      const requiredImpulse = action === "spoke" && player.mode === "spoke" ? 10 : ACTION_THRESHOLDS[action];
      if (impulseRef.current < requiredImpulse) {
        showBanner("ИМПУЛЬС СЛИШКОМ СЛАБ · НУЖНО " + requiredImpulse + "%");
        return;
      }
      let performed = true;

      if (action === "step-left" && player.mode === "ring") {
        player.localAngle = normalizeAngle(player.localAngle - STEP_ANGLE);
      } else if (action === "step-right" && player.mode === "ring") {
        player.localAngle = normalizeAngle(player.localAngle + STEP_ANGLE);
      } else if (action === "outer") {
        if (player.ringIndex === 0) {
          performed = false;
          showBanner("ТЫ УЖЕ НА ВНЕШНЕМ КОЛЬЦЕ");
        } else {
          const angle = getPlayerWorldAngle(world);
          player.ringIndex -= 1;
          if (player.mode === "ring") player.localAngle = normalizeAngle(angle - world.rings[player.ringIndex].angle);
        }
      } else if (action === "inner") {
        if (player.ringIndex === 2) {
          if (Object.values(world.terminals).every(Boolean)) {
            world.score += Math.round(world.phaseTime * 30) + 2200;
            spawnBurst(world, "#f5d94e", 48);
            setGamePhase("won");
            playTone("win");
            showBanner("СМЕНА ЗАВЕРШЕНА · КОНТУР СТАБИЛЕН");
          } else {
            performed = false;
            showBanner("СНАЧАЛА АКТИВИРУЙ УЗЛЫ A, B И C");
          }
        } else {
          const angle = getPlayerWorldAngle(world);
          player.ringIndex += 1;
          if (player.mode === "ring") player.localAngle = normalizeAngle(angle - world.rings[player.ringIndex].angle);
        }
      } else if (action === "spoke") {
        if (player.mode === "spoke") {
          const angle = getPlayerWorldAngle(world);
          player.mode = "ring";
          player.localAngle = normalizeAngle(angle - world.rings[player.ringIndex].angle);
        } else {
          const nearest = nearestSpoke(world);
          if (nearest.distance >= 0.28) {
            performed = false;
            showBanner("СПИЦА ЕЩЁ ДАЛЕКО · ВЫБЕРИ ДРУГОЙ ХОД");
          } else {
            player.mode = "spoke";
            player.spokeIndex = nearest.index;
          }
        }
      } else if (action === "jump") {
        if (player.mode !== "ring" || player.ringIndex === 1) {
          performed = false;
          showBanner("ПРЫЖОК ДОСТУПЕН ТОЛЬКО МЕЖДУ КРАЙНИМИ КОЛЬЦАМИ");
        } else {
          const angle = getPlayerWorldAngle(world);
          player.ringIndex = player.ringIndex === 0 ? 2 : 0;
          player.localAngle = normalizeAngle(angle - world.rings[player.ringIndex].angle);
        }
      } else {
        performed = false;
      }

      if (!performed) return;
      impulseRef.current = Math.max(0, impulseRef.current - requiredImpulse);
      setImpulse(impulseRef.current);
      world.score += 25;
      spawnBurst(world, "#ff9a62", 10, player.ringIndex, beforeAngle);
      playTone("move");
      completeResolutionPart("action");
    },
    [completeResolutionPart, playTone, setGamePhase, showBanner],
  );

  const releaseSpokePulse = useCallback(() => {
    const world = worldRef.current;
    if (phaseRef.current !== "playing" || world.spokeCharge < 99.5) return;
    world.spokeCharge = 0;
    world.rings.forEach((ring) => { ring.reversedUntil = world.elapsed + 4.5; });
    spawnBurst(world, "#d7fff6", 34);
    playTone("bonus");
    showBanner("ИМПУЛЬС СПИЦЫ · ВСЕ КОЛЬЦА РАЗВЕРНУТЫ НА 4.5 СЕК");
  }, [playTone, showBanner]);

  const toggleSound = useCallback(() => {
    setSoundEnabled((enabled) => {
      const next = !enabled;
      soundRef.current = next;
      if (next) playTone("move");
      return next;
    });
  }, [playTone]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest("input, select, textarea, button, a[href], [contenteditable='true']")) return;
      if (phaseRef.current === "briefing" && event.key === "Enter") {
        event.preventDefault();
        startGame();
        return;
      }
      if ((phaseRef.current === "won" || phaseRef.current === "lost") && event.key === "Enter") {
        event.preventDefault();
        startGame();
        return;
      }
      if (phaseRef.current !== "playing") return;

      if (sessionSettings.mode === "recall" && feedbackRef.current === "wrong" && event.key === "Enter") {
        event.preventDefault();
        openQuestion(false);
        return;
      }

      if (
        sessionSettings.mode === "recognition"
        && !feedbackRef.current
        && !resolutionRef.current.action
        && !resolutionRef.current.bonus
        && ["1", "2", "3", "4"].includes(event.key)
      ) {
        event.preventDefault();
        handleAnswer(Number(event.key) - 1);
        return;
      }
      if (resolutionRef.current.action) {
        const key = event.key.toLowerCase();
        if (key === "a" || event.key === "ArrowLeft") {
          event.preventDefault();
          performAction("step-left");
        } else if (key === "d" || event.key === "ArrowRight") {
          event.preventDefault();
          performAction("step-right");
        } else if (key === "w" || event.key === "ArrowUp") {
          event.preventDefault();
          performAction("outer");
        } else if (key === "s" || event.key === "ArrowDown") {
          event.preventDefault();
          performAction("inner");
        } else if (event.code === "Space") {
          event.preventDefault();
          performAction("spoke");
        } else if (key === "q") {
          event.preventDefault();
          performAction("jump");
        }
      }
      if (event.key.toLowerCase() === "z") activateStoredBonus(0);
      if (event.key.toLowerCase() === "x") activateStoredBonus(1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activateStoredBonus, feedback, handleAnswer, openQuestion, performAction, sessionSettings.mode, startGame]);

  const objective = useMemo(() => {
    if (terminalCount === 3) return "ПРОРВИСЬ В ЦЕНТР";
    if (terminalCount === 0) return "ВЫБЕРИ ПЕРВЫЙ УЗЕЛ";
    return "АКТИВИРУЙ ЕЩЁ " + (3 - terminalCount) + " " + (3 - terminalCount === 1 ? "УЗЕЛ" : "УЗЛА");
  }, [terminalCount]);

  const resultAccuracy =
    hud.correct + hud.wrong > 0
      ? Math.round((hud.correct / (hud.correct + hud.wrong)) * 100)
      : 0;
  const roundedImpulse = Math.max(0, Math.ceil(impulse));
  const impulseTone = impulse < 20 ? "is-critical" : impulse < 55 ? "is-warning" : "is-strong";
  const poolStatus = isRefilling
    ? `ПУЛ ${queuedCount.toString().padStart(2, "0")} · ПОПОЛНЯЕТСЯ`
    : queuedCount > 0
      ? `ПУЛ ${queuedCount.toString().padStart(2, "0")}`
      : "ПУЛ · РЕЗЕРВ";
  const visibleQuestionFocus = question.id.startsWith("reserve-")
    ? `${question.level ?? ""} · ${question.lexicalTopic ?? "общая лексика"} · ${question.grammarTopic ?? "общая грамматика"}`
    : `${sessionSettings.lexicalTopic} · ${sessionSettings.grammarTopic}`;

  return (
    <main className="game-shell" data-phase={phase}>
      <header className="topbar">
        <div className="brand-lockup">
          <span className="brand-kicker">Deutsch / arcade drill</span>
          <h1>RINGWERK</h1>
        </div>

        {phase !== "setup" && <div className="run-status" aria-label="Статус забега">
          <div className="timer-block">
            <span>ЗАРЯД КОНТУРА</span>
            <strong className={hud.time < 12 ? "is-critical" : ""}>
              {Math.max(0, Math.ceil(hud.time)).toString().padStart(2, "0")}
              <small>с</small>
            </strong>
          </div>
          <div className="integrity" aria-label={"Целостность: " + hud.health + " из 5"}>
            <span>ЦЕЛОСТНОСТЬ</span>
            <div>
              {[0, 1, 2, 3, 4].map((heart) => (
                <i key={heart} className={heart < hud.health ? "is-full" : ""} />
              ))}
            </div>
          </div>
          <button
            className="sound-toggle"
            type="button"
            onClick={toggleSound}
            aria-label={soundEnabled ? "Выключить звук" : "Включить звук"}
          >
            {soundEnabled ? "ЗВУК ON" : "ЗВУК OFF"}
          </button>
        </div>}
      </header>

      {phase === "setup" ? (
        <section className="learning-entry" aria-labelledby="learning-entry-title">
          <div className="entry-intro">
            <span className="overlay-kicker">НЕМЕЦКИЙ ЯЗЫК · ПРАКТИКА</span>
            <h2 id="learning-entry-title">Собери свою<br />учебную смену.</h2>
            <p>
              Выбери уровень и две темы. Пул заранее готовит упражнения именно под этот фокус,
              а встроенный резерв не даст игре зависнуть, если сеть задержится.
            </p>
            <div className="entry-loop" aria-label="Как устроена практика">
              <span><b>01</b> ответь по-немецки</span>
              <span><b>02</b> потрать импульс на движение</span>
              <span><b>03</b> доберись до трёх узлов</span>
            </div>
          </div>

          <div className="entry-settings-card">
            <fieldset className="entry-fieldset">
              <legend><b>УРОВЕНЬ</b><span>Сложность формулировок и грамматики</span></legend>
              <div className="entry-segmented">
                {LANGUAGE_LEVELS.map((level) => (
                  <button
                    key={level}
                    type="button"
                    className={draftSettings.level === level ? "is-selected" : ""}
                    aria-pressed={draftSettings.level === level}
                    onClick={() => updateDraftSettings({ level: level as LanguageLevel })}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset className="entry-fieldset">
              <legend><b>РЕЖИМ ОТВЕТА</b><span>Один общий пул, два способа вспомнить</span></legend>
              <div className="entry-mode-grid">
                <button
                  type="button"
                  className={draftSettings.mode === "recognition" ? "is-selected" : ""}
                  aria-pressed={draftSettings.mode === "recognition"}
                  onClick={() => updateDraftSettings({ mode: "recognition" as QuestionMode })}
                >
                  <b>УЗНАВАНИЕ</b><span>Выбрать одну из четырёх форм</span>
                </button>
                <button
                  type="button"
                  className={draftSettings.mode === "recall" ? "is-selected" : ""}
                  aria-pressed={draftSettings.mode === "recall"}
                  onClick={() => updateDraftSettings({ mode: "recall" as QuestionMode })}
                >
                  <b>ВОСПРОИЗВЕДЕНИЕ</b><span>Написать ответ без вариантов</span>
                </button>
              </div>
            </fieldset>

            <div className="entry-topic-grid">
              <label className="entry-select-field">
                <span><b>ЛЕКСИЧЕСКАЯ ТЕМА</b><small>Слова и ситуации</small></span>
                <select
                  value={draftSettings.lexicalTopic}
                  onChange={(event) => updateDraftSettings({ lexicalTopic: event.target.value as LexicalTopic })}
                >
                  {LEXICAL_TOPIC_GROUPS.map((group) => (
                    <optgroup key={group.label} label={group.label}>
                      {group.topics.map((topic) => <option key={topic} value={topic}>{topic}</option>)}
                    </optgroup>
                  ))}
                </select>
              </label>
              <label className="entry-select-field">
                <span><b>ГРАММАТИКА</b><small>Правило для закрепления</small></span>
                <select
                  value={draftSettings.grammarTopic}
                  onChange={(event) => updateDraftSettings({ grammarTopic: event.target.value as GrammarTopic })}
                >
                  {GRAMMAR_TOPIC_GROUPS.map((group) => (
                    <optgroup key={group.label} label={group.label}>
                      {group.topics.map((topic) => <option key={topic} value={topic}>{topic}</option>)}
                    </optgroup>
                  ))}
                </select>
              </label>
            </div>

            <div className="entry-confirm-row">
              <p>
                <b>{draftSettings.level} · {draftSettings.mode === "recall" ? "БЕЗ ВАРИАНТОВ" : "4 ВАРИАНТА"}</b>
                <span>{draftSettings.lexicalTopic} · {draftSettings.grammarTopic}</span>
              </p>
              <button className="primary-button" type="button" onClick={confirmLearningSettings} disabled={!settingsReady}>
                <span>ПОДТВЕРДИТЬ ФОКУС</span>
                <kbd>→</kbd>
              </button>
            </div>
          </div>
        </section>
      ) : (
      <section className="game-layout" aria-label="Игровой экран Ringwerk">
        <section className="arena-panel" aria-labelledby="arena-heading">
          <div className="arena-toolbar">
            <div className="live-state">
              <span className="live-dot" />
              <strong id="arena-heading">
                МИР ДВИЖЕТСЯ · БЕЗ ПАУЗЫ
              </strong>
            </div>
            <span className="location-chip">
              {RING_NAMES[hud.ringIndex]} · {hud.mode === "spoke" ? "НА СПИЦЕ" : "НА КОЛЬЦЕ"}
            </span>
            <span className={"threat-chip " + (hud.threat && hud.threat.seconds < 7 ? "is-near" : "")}>
              {hud.threat
                ? hud.threat.label + " ≈ " + Math.max(1, Math.ceil(hud.threat.seconds)) + "с"
                : "СЕКТОР ЧИСТ"}
            </span>
          </div>

          <div className="canvas-wrap">
            <canvas
              ref={canvasRef}
              aria-label={
                "Игрок на " +
                RING_LOCATIVE[hud.ringIndex] +
                " кольце. Активировано терминалов: " +
                terminalCount +
                " из 3."
              }
            />
            <div className="canvas-vignette" aria-hidden="true" />

            {banner && (
              <div className="event-banner" role="status" aria-live="polite">
                {banner}
              </div>
            )}

            {phase === "briefing" && (
              <div className="game-overlay briefing-overlay">
                <div className="overlay-copy">
                  <span className="overlay-kicker">ПРОТОКОЛ СМЕНЫ 01</span>
                  <h2>Мир не ждёт<br />твоего ответа.</h2>
                  <p>
                    С появлением теста загорается импульс 100% и сразу начинает тухнуть.
                    Верный ответ сохраняет остаток: шаг требует 10%, переход — 25%,
                    спица — 55%. Каждый активированный узел добавляет 60 секунд
                    заряда. После ответа механизм не замедляется.
                  </p>
                  <div className="briefing-focus">
                    <b>{sessionSettings.level} · {sessionSettings.mode === "recall" ? "ВОСПРОИЗВЕДЕНИЕ" : "УЗНАВАНИЕ"}</b>
                    <span>{sessionSettings.lexicalTopic} · {sessionSettings.grammarTopic}</span>
                  </div>
                </div>
                <ol className="rule-strip">
                  <li><b>01</b><span><strong>ОТВЕТЬ</strong>импульс уже сгорает</span></li>
                  <li><b>02</b><span><strong>РЕШИ</strong>ждать окно или идти сейчас</span></li>
                  <li><b>03</b><span><strong>БОНУС ЗА ВЕРНЫЙ</strong>протокол тратит часть заряда</span></li>
                </ol>
                <div className="briefing-actions">
                  <button className="primary-button" type="button" onClick={startGame}>
                    <span>ЗАПУСТИТЬ МЕХАНИЗМ</span>
                    <kbd>Enter</kbd>
                  </button>
                  <button className="secondary-button" type="button" onClick={returnToSetup}>
                    ИЗМЕНИТЬ ФОКУС
                  </button>
                </div>
              </div>
            )}

            {(phase === "won" || phase === "lost") && (
              <div className={"game-overlay result-overlay " + phase}>
                <span className="overlay-kicker">
                  {phase === "won" ? "СМЕНА ЗАВЕРШЕНА" : "КОНТУР ПОТЕРЯН"}
                </span>
                <h2>{phase === "won" ? "МЕХАНИЗМ ВЗЯТ" : "ПОПРОБУЙ ЕЩЁ РАЗ"}</h2>
                <p>
                  {phase === "won"
                    ? "Ты активировал три узла и успел уйти через центральный шлюз."
                    : lossReason}
                </p>
                <div className="result-stats">
                  <span><b>{hud.score.toLocaleString("ru-RU")}</b>СЧЁТ</span>
                  <span><b>{resultAccuracy}%</b>ТОЧНОСТЬ</span>
                  <span><b>×{bestCombo}</b>ЛУЧШАЯ СЕРИЯ</span>
                </div>
                <div className="briefing-actions">
                  <button className="primary-button" type="button" onClick={startGame}>
                    <span>{phase === "won" ? "ЕЩЁ СМЕНА" : "ПЕРЕЗАПУСК"}</span>
                    <kbd>Enter</kbd>
                  </button>
                  <button className="secondary-button" type="button" onClick={returnToSetup}>
                    СМЕНИТЬ УЧЕБНЫЙ ФОКУС
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="ring-readout" aria-label="Скорости колец">
            {RING_NAMES.map((name, index) => (
              <div key={name} className={hud.ringIndex === index ? "is-current" : ""}>
                <i style={{ backgroundColor: RING_COLORS[index] }} />
                <span>{name}</span>
                <strong>{hud.speeds[index] >= 0 ? "↻" : "↺"} {Math.abs(hud.speeds[index])}°/с</strong>
              </div>
            ))}
            <div className="score-readout">
              <span>СЧЁТ</span>
              <strong>{hud.score.toLocaleString("ru-RU")}</strong>
            </div>
          </div>
        </section>

        <aside className="control-panel">
          <section className="mission-card" aria-labelledby="mission-heading">
            <div className="panel-heading">
              <span>ЦЕЛЬ</span>
              <strong id="mission-heading">{objective}</strong>
            </div>
            <div className="terminal-track">
              {TERMINALS.map((terminal) => (
                <div
                  key={terminal.id}
                  className={hud.terminals[terminal.id] ? "is-active" : ""}
                  style={{ "--terminal-color": terminal.color } as React.CSSProperties}
                >
                  <b>{hud.terminals[terminal.id] ? "✓" : terminal.id}</b>
                  <span><strong>{terminal.name}</strong>{terminal.effect}</span>
                  <small>{terminal.cost}</small>
                </div>
              ))}
            </div>
          </section>

          <section className="inventory-card" aria-labelledby="inventory-heading">
            <div className="inventory-head">
              <div>
                <span>БОНУС ЗА КАЖДЫЙ ВЕРНЫЙ</span>
                <strong id="inventory-heading">Можно применить в любой момент забега · тратит импульс</strong>
              </div>
              <div className="spoke-meter">
                <span>СПИЦА {Math.round(hud.charge)}%</span>
                <i><b style={{ width: hud.charge + "%" }} /></i>
              </div>
            </div>
            <div className="inventory-slots">
              {[0, 1].map((slot) => {
                const stored = inventory[slot];
                const definition = stored ? BONUSES[stored.id] : null;
                return (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => activateStoredBonus(slot)}
                    disabled={!stored || phase !== "playing" || impulse < (definition?.impulseCost ?? 101) + (stored?.level === 2 ? 8 : 0)}
                    style={definition ? ({ "--bonus-color": definition.color } as React.CSSProperties) : undefined}
                  >
                    <kbd>{slot === 0 ? "Z" : "X"}</kbd>
                    {definition ? (
                      <><b>{definition.mark}</b><span><strong>{definition.name}{stored.level === 2 ? " ×2" : ""} · −{definition.impulseCost + (stored.level === 2 ? 8 : 0)}%</strong>{definition.effect}</span></>
                    ) : (
                      <span className="empty-slot">ПУСТО</span>
                    )}
                  </button>
                );
              })}
              <button
                className="pulse-button"
                type="button"
                onClick={releaseSpokePulse}
                disabled={hud.charge < 99.5 || phase !== "playing"}
              >
                <b>ϟ</b>
                <span><strong>ИМПУЛЬС</strong>разворот всех колец</span>
              </button>
            </div>
          </section>

          <section
            className={
              "quiz-card " +
              (feedback ? "is-" + feedback : "") +
              (resolution.action ? " is-action" : "")
            }
            aria-labelledby="quiz-heading"
          >
            <div className="quiz-meta">
              <span>
                {resolution.action
                  ? "ХОД · ВЫБЕРИ 1 ДЕЙСТВИЕ"
                  : "ТЕСТ " + String(questionNumber).padStart(2, "0")}
              </span>
              <span className="pool-state">{poolStatus}</span>
              <span className={combo >= 3 ? "combo-hot" : ""}>СЕРИЯ ×{combo}</span>
            </div>
            <div className="quiz-focus" title={visibleQuestionFocus}>
              <b>{sessionSettings.level}</b>
              <span>{sessionSettings.mode === "recall" ? "ВОСПРОИЗВЕДЕНИЕ" : "УЗНАВАНИЕ"}</span>
              <em>{visibleQuestionFocus}</em>
            </div>
            <div
              className={"impulse-meter " + impulseTone}
              role="progressbar"
              aria-label="Остаток импульса"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={roundedImpulse}
            >
              <div><span>ИМПУЛЬС</span><strong>{roundedImpulse}%</strong><small>{resolution.action ? "−4.5%/с" : "−3.3%/с"}</small></div>
              <i><b style={{ width: impulse + "%" }} /><em className="mark-10" /><em className="mark-25" /><em className="mark-55" /><em className="mark-80" /></i>
              <div className="impulse-thresholds"><span>ШАГ 10</span><span>ПЕРЕХОД 25</span><span>СПИЦА 55</span><span>ПРЫЖОК 80</span></div>
            </div>
            <p className="quiz-instruction">{question.prompt}</p>
            <h2 id="quiz-heading" lang="de">{question.context}</h2>
            {question.translation && <p className="quiz-translation">{question.translation}</p>}
            {!resolution.action ? (
              sessionSettings.mode === "recognition" ? (
                <div className="answer-grid">
                  {question.options.map((option, index) => {
                    const isSelected = selectedAnswer === index;
                    const isCorrect = feedback && index === question.correct;
                    return (
                      <button
                        key={option}
                        type="button"
                        onClick={() => handleAnswer(index)}
                        disabled={phase !== "playing" || feedback !== null || isEvaluating}
                        className={(isSelected ? "is-selected " : "") + (isCorrect ? "is-answer" : "")}
                      >
                        <kbd>{index + 1}</kbd>
                        <span>{option}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <form className="recall-form" onSubmit={submitRecallAnswer}>
                  <label htmlFor="recall-answer">
                    Ответ по-немецки
                    <small>ä / ö / ü можно писать как ae / oe / ue</small>
                  </label>
                  <div>
                    <input
                      ref={recallInputRef}
                      id="recall-answer"
                      lang="de"
                      type="text"
                      value={recallAnswer}
                      onChange={(event) => setRecallAnswer(event.target.value)}
                      placeholder="Напиши слово или фразу"
                      autoComplete="off"
                      spellCheck={false}
                      maxLength={600}
                      disabled={phase !== "playing" || feedback !== null || isEvaluating}
                      required
                    />
                    <button type="submit" disabled={!recallAnswer.trim() || feedback !== null || isEvaluating}>
                      {isEvaluating ? "ПРОВЕРЯЕМ…" : "ПРОВЕРИТЬ"}
                    </button>
                  </div>
                </form>
              )
            ) : (
              <div className="turn-action" aria-labelledby="action-heading">
                <div className="action-callout">
                  <strong id="action-heading">
                    {hud.mode === "spoke" ? "КУДА ПО СПИЦЕ?" : "КУДА ДВИГАЕМСЯ?"}
                  </strong>
                  <span>МИР ИДЁТ · ИМПУЛЬС ТУХНЕТ</span>
                </div>
                <div className="movement-grid">
                  {hud.mode === "ring" && (
                    <>
                      <button type="button" onClick={() => performAction("step-left")} disabled={impulse < 10}><kbd>A / ←</kbd><span>ШАГ ↺</span><small>≥10%</small></button>
                      <button type="button" onClick={() => performAction("outer")} disabled={hud.ringIndex === 0 || impulse < 25}><kbd>W / ↑</kbd><span>НАРУЖУ</span><small>≥25%</small></button>
                      <button type="button" onClick={() => performAction("inner")} disabled={(hud.ringIndex === 2 && !exitUnlocked) || impulse < 25}><kbd>S / ↓</kbd><span>{hud.ringIndex === 2 && exitUnlocked ? "В ВЫХОД" : "ВНУТРЬ"}</span><small>≥25%</small></button>
                      <button type="button" onClick={() => performAction("step-right")} disabled={impulse < 10}><kbd>D / →</kbd><span>ШАГ ↻</span><small>≥10%</small></button>
                    </>
                  )}
                  {hud.mode === "spoke" && (
                    <>
                      <button type="button" onClick={() => performAction("outer")} disabled={hud.ringIndex === 0 || impulse < 25}><kbd>W / ↑</kbd><span>ПО СПИЦЕ НАРУЖУ</span><small>≥25%</small></button>
                      <button type="button" onClick={() => performAction("inner")} disabled={(hud.ringIndex === 2 && !exitUnlocked) || impulse < 25}><kbd>S / ↓</kbd><span>{hud.ringIndex === 2 && exitUnlocked ? "В ВЫХОД" : "ПО СПИЦЕ ВНУТРЬ"}</span><small>≥25%</small></button>
                    </>
                  )}
                  <button
                    className="spoke-action"
                    type="button"
                    onClick={() => performAction("spoke")}
                    disabled={hud.mode === "ring" ? (!hud.nearSpoke || impulse < 55) : impulse < 10}
                  >
                    <kbd>Space</kbd>
                    <span>
                      {hud.mode === "spoke"
                        ? "СОЙТИ СО СПИЦЫ"
                        : hud.nearSpoke
                          ? "СХВАТИТЬ СПИЦУ"
                          : "СПИЦА ДАЛЕКО"}
                    </span>
                    <small>{hud.mode === "spoke" ? "≥10%" : "≥55%"}</small>
                  </button>
                  {hud.mode === "ring" && (
                    <button
                      className="jump-action"
                      type="button"
                      onClick={() => performAction("jump")}
                      disabled={hud.ringIndex === 1 || impulse < 80}
                    >
                      <kbd>Q</kbd><span>ПРЫЖОК ЧЕРЕЗ КОЛЬЦО</span><small>≥80%</small>
                    </button>
                  )}
                </div>
              </div>
            )}
            <div className="quiz-feedback" aria-live="polite">
              {feedback === "correct" && <><b>ВЕРНО</b><span>{feedbackDetail || question.rule} · осталось {roundedImpulse}%</span></>}
              {feedback === "wrong" && <><b>МИМО</b><span>{feedbackDetail || question.rule} · мир продолжает движение</span>{sessionSettings.mode === "recall" && <button type="button" onClick={() => openQuestion(false)}>ПОНЯТНО →</button>}</>}
              {!feedback && isEvaluating && <><b>ПРОВЕРКА</b><span>Импульс и арена зафиксированы: задержка сети не влияет на забег.</span></>}
              {!feedback && !isEvaluating && (
                <span>
                  {sessionSettings.mode === "recall"
                    ? "Введи ответ без вариантов. До отправки импульс уже сгорает."
                    : "Выбери форму. Импульс, таймер и механизм уже идут."}
                </span>
              )}
            </div>
          </section>

        </aside>
      </section>
      )}

      {phase !== "setup" && <footer className="game-footer">
        <p><span className="live-dot" /> Мир не останавливается; заработанный импульс продолжает сгорать.</p>
        <p className="key-legend">
          {sessionSettings.mode === "recognition" && <><kbd>1–4</kbd> ответ </>}
          <kbd>WASD</kbd> действие <kbd>Space</kbd> спица <kbd>Q</kbd> прыжок <kbd>Z / X</kbd> протокол
        </p>
      </footer>}
    </main>
  );
}
