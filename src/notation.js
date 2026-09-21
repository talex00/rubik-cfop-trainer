// Нотация: разбор ходов (грани, широкие ходы, средние слои, повороты куба)
// и упрощение последовательностей.

import { keyAmount, keyFromParts, invertKey, axisOfKey } from './moves.js';

const TOKEN_RE = /^([URFDLBurfdlbMESxyz])(w)?(['’2]?)$/;

// Раскрытие широких ходов (два слоя) в поворот куба и граневой ход.
const WIDE_EXPANSIONS = {
  U: ['y', 'D'],
  D: ["y'", 'U'],
  R: ['x', 'L'],
  L: ["x'", 'R'],
  F: ['z', 'B'],
  B: ["z'", 'F'],
};

// Раскрытие средних слоёв: M следует за L, E — за D, S — за F.
const SLICE_EXPANSIONS = {
  M: ["L'", 'R', "x'"],
  E: ["D'", 'U', "y'"],
  S: ["F'", 'B', 'z'],
};

// Разбор одного токена; возвращает массив ключей.
// '2' — каждый элемент последовательности удваивается;
// «'» — последовательность разворачивается и каждый ход инвертируется.
export function parseToken(token) {
  if (typeof token !== 'string') throw new Error(`Некорректный ход: «${String(token)}»`);
  const match = TOKEN_RE.exec(token);
  if (!match) throw new Error(`Некорректный ход: «${token}»`);
  const [, baseRaw, wideMark, suffixRaw] = match;
  const suffix = suffixRaw === '’' ? "'" : suffixRaw;
  let keys;
  if (wideMark || /^[urfdlb]$/.test(baseRaw)) {
    const face = baseRaw.toUpperCase();
    if (!WIDE_EXPANSIONS[face]) throw new Error(`Широкий ход не поддерживается: «${token}»`);
    keys = [...WIDE_EXPANSIONS[face]];
  } else if (baseRaw === 'M' || baseRaw === 'S' || baseRaw === 'E') {
    keys = [...SLICE_EXPANSIONS[baseRaw]];
  } else if (baseRaw === 'x' || baseRaw === 'y' || baseRaw === 'z') {
    keys = [baseRaw];
  } else {
    keys = [baseRaw.toUpperCase()];
  }
  if (suffix === '2') {
    return keys.map((k) => keyFromParts(k[0], (keyAmount(k) * 2) % 4));
  }
  if (suffix === "'") {
    return keys.reverse().map(invertKey);
  }
  return keys;
}

export function parseKeys(tokens) {
  if (!Array.isArray(tokens)) throw new Error('Ожидается массив ходов');
  const out = [];
  for (const token of tokens) out.push(...parseToken(token));
  return out;
}

export function parseMoves(alg) {
  if (typeof alg !== 'string') throw new Error(`Некорректный алгоритм: «${String(alg)}»`);
  return parseKeys(alg.trim().split(/\s+/).filter(Boolean));
}

// Упрощение: слияние соседних ходов одной грани/оси с учётом того,
// что ходы одной оси коммутируют (R L R' -> L, x x -> x2, R R' -> пусто).
export function simplify(keys) {
  const out = [];
  for (const key of keys) {
    const axis = axisOfKey(key);
    const amount = keyAmount(key);
    let merged = false;
    for (let j = out.length - 1; j >= 0; j -= 1) {
      if (axisOfKey(out[j]) !== axis) break;
      if (out[j][0] === key[0]) {
        const total = (keyAmount(out[j]) + amount) % 4;
        if (total === 0) out.splice(j, 1);
        else out[j] = keyFromParts(key[0], total);
        merged = true;
        break;
      }
    }
    if (!merged) out.push(key);
  }
  return out;
}

export function movesToString(keys) {
  return keys.join(' ');
}
