// Пары F2L (угол нижнего слоя + ребро среднего слоя): кодирование пары
// относительно текущих центров, орбита из 24 ориентаций куба, таблица
// дистанций (обратный BFS) и поиск решений пары с сохранением креста
// и ранее собранных пар. Вращения y — законные ходы поиска.

import { FACES, CENTER_IDS, EDGE_SLOTS, CORNER_SLOTS, EDGE_SLOT_BY_FACES, CORNER_SLOT_BY_FACES } from '../geometry.js';
import { FACE_KEYS, FACE_RANK, axisOfKey, invertKey, applyMoves } from '../moves.js';
import { solvedState, centerColors, stateFromKeys } from '../state.js';
import { buildTransTables, findEdgeByColors, findCornerByColors } from './tables.js';
import { crossIntact } from './cross.js';

// Ключи поиска: 18 поворотов граней + 3 вращения куба вокруг вертикали.
export const F2L_KEYS = [...FACE_KEYS, 'y', 'y2', "y'"];
const Y_KEYS = ['y', 'y2', "y'"];
const KEY_COUNT = F2L_KEYS.length; // 21
const ROT_BASE = FACE_KEYS.length; // 18: индексы 18..20 — вращения y

// Таблицы переходов слотов и ориентаций по всем ключам поиска.
const T = buildTransTables(F2L_KEYS);
const F2L_INV = F2L_KEYS.map((key) => F2L_KEYS.indexOf(invertKey(key)));

// Код пары: (слот угла * 3 + закрутка) * 576 + (слот ребра * 2 + флип) * 24 + cfg.
// 24 * 24 * 24 = 13824 состояния.
export const N_PAIR = 13824;

// Орбита центров: 24 ориентации куба, порождённые поворотами x/y/z.
const ROT_GEN = ['x', "x'", 'y', "y'", 'z', "z'"];
export const CENTER_ARRANGEMENTS = [];
const arrangementIndex = new Map();
const orbitStates = [];
{
  const start = solvedState();
  const key0 = centerColors(start).join('');
  arrangementIndex.set(key0, 0);
  CENTER_ARRANGEMENTS.push(key0);
  orbitStates.push(start);
  for (let head = 0; head < orbitStates.length; head += 1) {
    const st = orbitStates[head];
    for (const rot of ROT_GEN) {
      const ns = stateFromKeys([rot], st);
      const key = centerColors(ns).join('');
      if (!arrangementIndex.has(key)) {
        arrangementIndex.set(key, CENTER_ARRANGEMENTS.length);
        CENTER_ARRANGEMENTS.push(key);
        orbitStates.push(ns);
      }
    }
  }
}

// Индекс конфигурации центров состояния (0..23).
export function cfgOf(state) {
  const idx = arrangementIndex.get(centerColors(state).join(''));
  if (idx === undefined) throw new Error('Конфигурация центров недостижима поворотами куба');
  return idx;
}

// Переходы конфигураций центров под y, y2, y-штрих.
export const CFG_PERM = Y_KEYS.map((yk) =>
  CENTER_ARRANGEMENTS.map((_, cfg) =>
    arrangementIndex.get(centerColors(stateFromKeys([yk], orbitStates[cfg])).join(''))));

// Один ход по коду пары; вращения y двигают и центры (CFG_PERM).
export function stepFull(enc, ki) {
  const cDigit = Math.floor(enc / 576);
  const eDigit = Math.floor(enc / 24) % 24;
  const cfg = enc % 24;
  const cornerSlot = Math.floor(cDigit / 3);
  const twist = cDigit % 3;
  const edgeSlot = Math.floor(eDigit / 2);
  const flip = eDigit % 2;
  const nCfg = ki >= ROT_BASE ? CFG_PERM[ki - ROT_BASE][cfg] : cfg;
  const nCS = T.cornerTo[cornerSlot][ki];
  const nTwist = (twist + T.cornerTwist[cornerSlot][ki]) % 3;
  const nES = T.edgeTo[edgeSlot][ki];
  const nFlip = flip ^ T.edgeFlip[edgeSlot][ki];
  return (nCS * 3 + nTwist) * 576 + (nES * 2 + nFlip) * 24 + nCfg;
}

// Пара F2L для слота среднего слоя (8..11 = FR, FL, BL, BR):
// угол {d, a, b} и ребро {a, b}, где d — цвет центра грани D,
// a — цвет на позиции faces[0] (F/B), b — на позиции faces[1] (R/L).
export function pairOf(state, slot) {
  if (!Number.isInteger(slot) || slot < 8 || slot > 11) {
    throw new Error(`Слот пары F2L должен быть одним из 8..11, а не ${JSON.stringify(slot)}`);
  }
  const info = EDGE_SLOTS[slot];
  const d = state[31];
  const a = state[CENTER_IDS[FACES.indexOf(info.faces[0])]];
  const b = state[CENTER_IDS[FACES.indexOf(info.faces[1])]];
  const ref = a;
  const pair = { slot, d, a, b, ref, sig: `${d},${a < b ? a : b},${a < b ? b : a},${ref}` };
  pair.enc = pairEncode(state, pair);
  return pair;
}

// Код пары по её цветам в заданном состоянии.
export function pairEncode(state, pair) {
  const cfg = cfgOf(state);
  const cSlot = findCornerByColors(state, pair.d, pair.a, pair.b);
  const twist = CORNER_SLOTS[cSlot].facelets.findIndex((f) => state[f] === pair.d);
  const eSlot = findEdgeByColors(state, pair.a, pair.b);
  const flip = state[EDGE_SLOTS[eSlot].facelets[0]] === pair.ref ? 0 : 1;
  return (cSlot * 3 + twist) * 576 + (eSlot * 2 + flip) * 24 + cfg;
}

// Цели пары: код собранной пары для каждой из 24 конфигураций центров.
// Для конфигураций, где цель не определена (цвет d не на грани D), — -1.
const goalsCache = new Map();
export function pairGoals(pair) {
  let goals = goalsCache.get(pair.sig);
  if (goals) return goals;
  const { a, b, ref } = pair;
  goals = new Array(24).fill(-1);
  for (let cfg = 0; cfg < 24; cfg += 1) {
    const arr = CENTER_ARRANGEMENTS[cfg];
    const pa = FACES[arr.indexOf(a)];
    const pb = FACES[arr.indexOf(b)];
    const goalES = EDGE_SLOT_BY_FACES.get([pa, pb].sort().join(''));
    const goalCS = CORNER_SLOT_BY_FACES.get(['D', pa, pb].sort().join(''));
    if (goalES === undefined || goalCS === undefined) continue;
    const flipGoal = arr[FACES.indexOf(EDGE_SLOTS[goalES].faces[0])] === ref ? 0 : 1;
    goals[cfg] = goalCS * 3 * 576 + (goalES * 2 + flipGoal) * 24 + cfg;
  }
  goalsCache.set(pair.sig, goals);
  return goals;
}

// Таблица дистанций пары: dist[e] = оптимум(e -> цель) + 1; 0 — недостижимо.
// Мультиточечный обратный BFS от целей всех достижимых конфигураций.
const pairDistCache = new Map();
export function pairDistTable(pair) {
  let dist = pairDistCache.get(pair.sig);
  if (dist) return dist;
  const goals = pairGoals(pair);
  dist = new Uint8Array(N_PAIR);
  const queue = [];
  for (const g of goals) {
    if (g >= 0 && dist[g] === 0) {
      dist[g] = 1;
      queue.push(g);
    }
  }
  for (let head = 0; head < queue.length; head += 1) {
    const cur = queue[head];
    const d = dist[cur];
    if (d >= 255) continue;
    for (let ki = 0; ki < KEY_COUNT; ki += 1) {
      const pred = stepFull(cur, F2L_INV[ki]);
      if (dist[pred] === 0) {
        dist[pred] = d + 1;
        queue.push(pred);
      }
    }
  }
  pairDistCache.set(pair.sig, dist);
  return dist;
}

// Оптимальная длина решения пары (без учёта сохранности креста).
export function pairOptimalLength(pair) {
  const dv = pairDistTable(pair)[pair.enc];
  if (dv === 0) throw new Error(`Пара F2L: состояние недостижимо (слот ${EDGE_SLOTS[pair.slot].name})`);
  return dv - 1;
}

// Собран ли угол пары в состоянии.
export function pairCornerSolvedIn(state, pair) {
  const g = pairGoals(pair)[cfgOf(state)];
  if (g < 0) return false;
  const goalCS = Math.floor(Math.floor(g / 576) / 3);
  const cSlot = findCornerByColors(state, pair.d, pair.a, pair.b);
  if (cSlot !== goalCS) return false;
  return CORNER_SLOTS[cSlot].facelets.findIndex((f) => state[f] === pair.d) === 0;
}

// Собрано ли ребро пары в состоянии.
export function pairEdgeSolvedIn(state, pair) {
  const g = pairGoals(pair)[cfgOf(state)];
  if (g < 0) return false;
  const eDigit = Math.floor(g / 24) % 24;
  const goalES = Math.floor(eDigit / 2);
  const goalFlip = eDigit % 2;
  const eSlot = findEdgeByColors(state, pair.a, pair.b);
  if (eSlot !== goalES) return false;
  const flip = state[EDGE_SLOTS[eSlot].facelets[0]] === pair.ref ? 0 : 1;
  return flip === goalFlip;
}

// Собрана ли пара в состоянии.
export function pairSolvedIn(state, pair) {
  return pairCornerSolvedIn(state, pair) && pairEdgeSolvedIn(state, pair);
}

// Нерешённые пары среднего слоя.
export function openPairs(state) {
  const res = [];
  for (let slot = 8; slot <= 11; slot += 1) {
    const pair = pairOf(state, slot);
    if (!pairSolvedIn(state, pair)) res.push({ slot, pair });
  }
  return res;
}

// Статус слоёв относительно текущих центров.
export function layerStatus(state) {
  const cross = crossIntact(state);
  let middles = true;
  let corners = true;
  for (let slot = 8; slot <= 11; slot += 1) {
    const pair = pairOf(state, slot);
    if (!pairEdgeSolvedIn(state, pair)) middles = false;
    if (!pairCornerSolvedIn(state, pair)) corners = false;
  }
  return { cross, middles, corners, f2l: cross && middles && corners };
}

// Канонизация последовательности: без двух вращений подряд (y y = y2),
// без U/D сразу после вращения (коммутируют с y — грань переносим вперёд),
// грани одной оси — в порядке возрастания ранга.
function followKey(prevKi, ki) {
  if (prevKi < 0) return true;
  const prevRot = prevKi >= ROT_BASE;
  const curRot = ki >= ROT_BASE;
  if (prevRot && curRot) return false;
  if (prevRot && !curRot) {
    const face = F2L_KEYS[ki][0];
    return face !== 'U' && face !== 'D';
  }
  if (curRot) return true;
  if (axisOfKey(F2L_KEYS[prevKi]) !== axisOfKey(F2L_KEYS[ki])) return true;
  return FACE_RANK.get(F2L_KEYS[prevKi][0]) < FACE_RANK.get(F2L_KEYS[ki][0]);
}

// Поиск решений пары: DFS по коду с таблицей дистанций, бюджеты от
// оптимума до оптимум + maxOverrun, канонизация, верификация решений
// на реальном состоянии (пара собрана, крест цел, заблокированные пары целы).
export function solvePair(state, pair, options = {}) {
  const {
    requireCross = true,
    lockPairs = [],
    maxCollect = 32,
    maxNodes = 400_000,
    maxOverrun = 3,
    collectAlternatives = true,
  } = options;
  const dist = pairDistTable(pair);
  const goals = pairGoals(pair);
  const dv0 = dist[pair.enc];
  if (dv0 === 0) {
    throw new Error(`Пара F2L: стартовое состояние недостижимо (слот ${EDGE_SLOTS[pair.slot].name})`);
  }
  const d0 = dv0 - 1;

  const solutions = [];
  const seen = new Set();

  function record(keys) {
    const line = keys.join(' ');
    if (seen.has(line)) return;
    const finalState = applyMoves(state, keys);
    if (!pairSolvedIn(finalState, pair)) return;
    if (requireCross && !crossIntact(finalState)) return;
    for (const lock of lockPairs) {
      if (!pairSolvedIn(finalState, lock)) return;
    }
    seen.add(line);
    solutions.push([...keys]);
  }

  if (d0 === 0) {
    record([]);
    if (solutions.length > 0) return { length: 0, optimalLength: 0, solutions, pair };
  }

  let budget = d0;
  let nodes = 0;
  let stopped = false;

  function dfs(enc, depth, prevKi, keys) {
    if (solutions.length >= maxCollect) return;
    if (enc === goals[enc % 24]) {
      record(keys);
      return;
    }
    if (depth >= budget) return;
    nodes += 1;
    if (nodes > maxNodes) {
      stopped = true;
      return;
    }
    for (let ki = 0; ki < KEY_COUNT; ki += 1) {
      if (!followKey(prevKi, ki)) continue;
      const next = stepFull(enc, ki);
      const nd = dist[next];
      if (nd === 0 || nd - 1 > budget - depth - 1) continue;
      keys.push(F2L_KEYS[ki]);
      dfs(next, depth + 1, ki, keys);
      keys.pop();
      if (stopped) return;
    }
  }

  let firstFoundBudget = -1;
  let lastBudget = d0;
  for (budget = d0; budget <= d0 + maxOverrun; budget += 1) {
    lastBudget = budget;
    nodes = 0;
    stopped = false;
    dfs(pair.enc, 0, -1, []);
    if (solutions.length > 0) {
      if (firstFoundBudget < 0) firstFoundBudget = budget;
      if (!collectAlternatives || firstFoundBudget > d0 || budget >= d0 + 1) break;
    }
    if (stopped && nodes > maxNodes) break;
  }

  if (solutions.length === 0) {
    throw new Error(`Пара F2L: решение не найдено (слот ${EDGE_SLOTS[pair.slot].name}, бюджет ${lastBudget})`);
  }

  const rotCount = (keys) => keys.reduce((n, key) => (key[0] === 'y' ? n + 1 : n), 0);
  solutions.sort((a, b) => a.length - b.length
    || rotCount(a) - rotCount(b)
    || (a.join(' ') < b.join(' ') ? -1 : 1));
  return { length: solutions[0].length, optimalLength: d0, solutions, pair };
}
