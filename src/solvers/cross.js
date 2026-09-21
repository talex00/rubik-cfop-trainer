// Оптимальный крест: кодирование позиций четырёх крестовых рёбер
// относительно центров, таблица дистанций (обратный BFS по 24^4 состояниям)
// и поиск всех оптимальных решений (DFS с прунингом и канонизацией).

import { FACES, CENTER_IDS, EDGE_SLOTS, EDGE_SLOT_BY_FACES } from '../geometry.js';
import { FACE_KEYS, FACE_RANK, axisOfKey, invertKey, applyMoves } from '../moves.js';
import { buildTransTables } from './tables.js';

const T = buildTransTables(FACE_KEYS);
const INV = FACE_KEYS.map((key) => FACE_KEYS.indexOf(invertKey(key)));
const N_ENC = 24 ** 4; // 331776

export const CROSS_GOAL_ENC = (() => {
  let enc = 0;
  for (let i = 0; i < 4; i += 1) enc += (4 + i) * 2 * 24 ** i;
  return enc;
})();

// Один ход по коду креста. Код = сумма digit_i * 24^i, где digit = слот*2+флип,
// позиции отсортированы по домашним слотам (при граневых ходах центры неподвижны).
export function crossStep(enc, mi) {
  let out = 0;
  let rest = enc;
  let mul = 1;
  for (let i = 0; i < 4; i += 1) {
    const digit = rest % 24;
    rest = (rest - digit) / 24;
    const slot = digit >> 1;
    out += (T.edgeTo[slot][mi] * 2 + ((digit & 1) ^ T.edgeFlip[slot][mi])) * mul;
    mul *= 24;
  }
  return out;
}

// Информация о крестовых рёбрах относительно текущих центров.
export function crossInfo(state) {
  const crossColor = state[31];
  const pieces = [];
  for (let s = 0; s < 12; s += 1) {
    const slot = EDGE_SLOTS[s];
    const c0 = state[slot.facelets[0]]
    const c1 = state[slot.facelets[1]];
    if (c0 !== crossColor && c1 !== crossColor) continue;
    const flip = c0 === crossColor ? 0 : 1;
    const otherColor = c0 === crossColor ? c1 : c0;
    const centerIdx = CENTER_IDS.findIndex((id) => state[id] === otherColor);
    if (centerIdx === -1) throw new Error(`цвет «${otherColor}» не найден среди центров`);
    const homeSlot = EDGE_SLOT_BY_FACES.get(['D', FACES[centerIdx]].sort().join(''));
    pieces.push({ slot: s, homeSlot, flip, colors: [c0, c1], otherColor, sideFace: FACES[centerIdx], digit: s * 2 + flip });
  }
  if (pieces.length !== 4) {
    throw new Error(`крестовых рёбер должно быть 4, а найдено ${pieces.length}`);
  }
  pieces.sort((a, b) => a.homeSlot - b.homeSlot);
  let enc = 0;
  for (let i = 0; i < 4; i += 1) enc += pieces[i].digit * 24 ** i;
  return {
    crossColor,
    pieces,
    digits: pieces.map((p) => p.digit),
    homeSlots: pieces.map((p) => p.homeSlot),
    enc,
    goalEnc: CROSS_GOAL_ENC,
  };
}

// Таблица дистанций: dist[e] = оптимум(e -> цель) + 1; 0 — недостижимо.
const distCache = new Map();

export function crossDist(goalEnc = CROSS_GOAL_ENC) {
  let dist = distCache.get(goalEnc);
  if (dist) return dist;
  dist = new Uint8Array(N_ENC);
  const queue = new Int32Array(N_ENC);
  let head = 0;
  let tail = 0;
  dist[goalEnc] = 1;
  queue[tail++] = goalEnc;
  while (head < tail) {
    const cur = queue[head];
    head += 1;
    const d = dist[cur];
    for (let mi = 0; mi < 18; mi += 1) {
      const prev = crossStep(cur, INV[mi]);
      if (dist[prev] === 0) {
        dist[prev] = d + 1;
        queue[tail++] = prev;
      }
    }
  }
  distCache.set(goalEnc, dist);
  return dist;
}

// Все оптимальные решения креста (с ограничениями на количество и узлы).
export function solveCross(state, options = {}) {
  const { maxSolutions = 64, maxNodes = 2_000_000 } = options;
  const info = crossInfo(state);
  const dist = crossDist(info.goalEnc);
  const d0 = dist[info.enc] - 1;
  if (d0 < 0) throw new Error('Крест: состояние недостижимо');
  if (d0 === 0) return { length: 0, solutions: [[]], info };

  const solutions = [];
  let nodes = 0;

  function record(keys) {
    const finalState = applyMoves(state, keys);
    if (crossInfo(finalState).enc !== CROSS_GOAL_ENC) return; // страховка от рассинхрона
    solutions.push([...keys]);
  }

  function dfs(enc, depth, prevKey, keys) {
    if (solutions.length >= maxSolutions) return;
    if (enc === CROSS_GOAL_ENC) {
      record(keys);
      return;
    }
    if (depth === d0) return;
    nodes += 1;
    if (nodes > maxNodes) return;
    for (let mi = 0; mi < 18; mi += 1) {
      const key = FACE_KEYS[mi];
      if (prevKey !== null && axisOfKey(prevKey) === axisOfKey(key) && FACE_RANK.get(prevKey) >= FACE_RANK.get(key)) continue;
      const next = crossStep(enc, mi);
      const nd = dist[next];
      if (nd === 0 || nd - 1 > d0 - depth - 1) continue;
      keys.push(key);
      dfs(next, depth + 1, key, keys);
      keys.pop();
    }
  }

  dfs(info.enc, 0, null, []);
  if (solutions.length === 0) throw new Error('Крест: решение не найдено');
  solutions.sort((a, b) => a.length - b.length || a.join(' ').localeCompare(b.join(' ')));
  return { length: d0, solutions, info };
}

export function crossPiecesOf(state) {
  return crossInfo(state).pieces;
}

export function crossIntact(state) {
  return crossInfo(state).enc === CROSS_GOAL_ENC;
}

export function verifyCrossSolution(state, keys) {
  const finalState = applyMoves(state, keys);
  const info = crossInfo(finalState);
  return { ok: info.enc === CROSS_GOAL_ENC, state: finalState, info };
}
