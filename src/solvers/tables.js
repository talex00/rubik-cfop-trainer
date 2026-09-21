// Таблицы переходов слотов рёбер и углов по заданному набору ходов.

import { EDGE_SLOTS, CORNER_SLOTS, EDGE_SLOT_BY_FACES, CORNER_SLOT_BY_FACES } from '../geometry.js';
import { KEY_PERMS } from '../moves.js';

export const EDGE_SLOT_OF_FACELET = new Array(54).fill(-1);
export const CORNER_SLOT_OF_FACELET = new Array(54).fill(-1);
EDGE_SLOTS.forEach((slot, i) => slot.facelets.forEach((f) => { EDGE_SLOT_OF_FACELET[f] = i; }));
CORNER_SLOTS.forEach((slot, i) => slot.facelets.forEach((f) => { CORNER_SLOT_OF_FACELET[f] = i; }));

// Слот ребра с заданными цветами (порядок цветов не важен).
export function findEdgeByColors(state, a, b) {
  for (let s = 0; s < 12; s += 1) {
    const slot = EDGE_SLOTS[s];
    const c0 = state[slot.facelets[0]];
    const c1 = state[slot.facelets[1]];
    if ((c0 === a && c1 === b) || (c0 === b && c1 === a)) return s;
  }
  throw new Error(`ребро с цветами «${a}», «${b}» не найдено`);
}

// Слот угла с заданными цветами (порядок цветов не важен).
export function findCornerByColors(state, a, b, c) {
  for (let s = 0; s < 8; s += 1) {
    const colors = CORNER_SLOTS[s].facelets.map((f) => state[f]);
    if (colors.includes(a) && colors.includes(b) && colors.includes(c)) return s;
  }
  throw new Error(`угол с цветами «${a}», «${b}», «${c}» не найден`);
}

// Где какая деталь и как она ориентирована (в системе цветов-букв).
export function readEdges(state) {
  return EDGE_SLOTS.map((slot) => {
    const c0 = state[slot.facelets[0]];
    const c1 = state[slot.facelets[1]];
    const piece = EDGE_SLOT_BY_FACES.get([c0, c1].sort().join(''));
    if (piece === undefined) throw new Error(`в слоте ${slot.name} наклейки от разных деталей`);
    return { piece, flip: c0 === EDGE_SLOTS[piece].faces[0] ? 0 : 1 };
  });
}

export function readCorners(state) {
  return CORNER_SLOTS.map((slot) => {
    const colors = slot.facelets.map((f) => state[f]);
    const piece = CORNER_SLOT_BY_FACES.get([...colors].sort().join(''));
    if (piece === undefined) throw new Error(`в слоте ${slot.name} наклейки от разных деталей`);
    return { piece, twist: colors.indexOf(CORNER_SLOTS[piece].faces[0]) };
  });
}

// Таблицы переходов: edgeTo[s][ki] — слот, в который уходит ребро из слота s
// под ходом keys[ki]; edgeFlip — приращение флипа; cornerTo/cornerTwist —
// аналогично для углов (twist суммируется по модулю 3).
export function buildTransTables(keys) {
  const n = keys.length;
  for (const key of keys) {
    if (!KEY_PERMS.has(key)) throw new Error(`Неизвестный ход: «${String(key)}»`);
  }
  const edgeTo = [];
  const edgeFlip = [];
  const cornerTo = [];
  const cornerTwist = [];
  for (let s = 0; s < 12; s += 1) { edgeTo.push(new Array(n)); edgeFlip.push(new Array(n)); }
  for (let s = 0; s < 8; s += 1) { cornerTo.push(new Array(n)); cornerTwist.push(new Array(n)); }
  for (let ki = 0; ki < n; ki += 1) {
    const perm = KEY_PERMS.get(keys[ki]);
    for (let s = 0; s < 12; s += 1) {
      const slot = EDGE_SLOTS[s];
      const t = EDGE_SLOT_OF_FACELET[perm[slot.facelets[0]]];
      edgeTo[s][ki] = t;
      edgeFlip[s][ki] = perm[slot.facelets[0]] === EDGE_SLOTS[t].facelets[0] ? 0 : 1;
    }
    for (let s = 0; s < 8; s += 1) {
      const slot = CORNER_SLOTS[s];
      const dest = perm[slot.facelets[0]];
      const t = CORNER_SLOT_OF_FACELET[dest];
      cornerTo[s][ki] = t;
      cornerTwist[s][ki] = CORNER_SLOTS[t].facelets.indexOf(dest);
    }
  }
  for (let ki = 0; ki < n; ki += 1) {
    for (let s = 0; s < 12; s += 1) {
      if (edgeTo[s][ki] < 0 || edgeTo[s][ki] > 11 || edgeFlip[s][ki] < 0 || edgeFlip[s][ki] > 1) {
        throw new Error(`Таблицы переходов некорректны для хода «${keys[ki]}»`);
      }
    }
    for (let s = 0; s < 8; s += 1) {
      if (cornerTo[s][ki] < 0 || cornerTo[s][ki] > 7 || cornerTwist[s][ki] < 0 || cornerTwist[s][ki] > 2) {
        throw new Error(`Таблицы переходов некорректны для хода «${keys[ki]}»`);
      }
    }
  }
  return { n, keys: [...keys], edgeTo, edgeFlip, cornerTo, cornerTwist };
}
