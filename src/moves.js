// Ходы кубика Рубика.
// Ход — строка вида 'U', 'U2', "U'", 'x', 'x2', "x'".
// Граневой ход — поворот слоя грани на -90° вокруг внешней нормали.
// Поворот куба x/y/z — поворот всего куба на -90° вокруг оси +x/+y/+z
// (x действует как R, y — как U, z — как F).

import { FACES, faceNormal, buildPermutation } from './geometry.js';

export const FACE_ORDER = FACES;

// Ранг грани (для канонизации порядков ходов одной оси).
export const FACE_RANK = new Map(FACE_ORDER.map((face, i) => [face, i]));

const AXIS_OF_FACE = { U: 'y', D: 'y', R: 'x', L: 'x', F: 'z', B: 'z' };

export function isFaceKey(key) {
  return /^[URFDLB]['2]?$/.test(key);
}

export function faceOfKey(key) {
  return key[0];
}

export function keyAmount(key) {
  if (key.endsWith('2')) return 2;
  if (key.endsWith("'")) return 3;
  return 1;
}

// Ключ по базе (грань или ось) и величине (1, 2 или 3 четверти оборота).
export function keyFromParts(base, amount) {
  const amt = ((amount % 4) + 4) % 4;
  if (amt === 1) return base;
  if (amt === 2) return `${base}2`;
  if (amt === 3) return `${base}'`;
  return null;
}

export function faceKeyFromAmount(face, amount) {
  return keyFromParts(face, amount);
}

export function rotKeyFromAmount(axis, amount) {
  return keyFromParts(axis, amount);
}

export function axisOfKey(key) {
  const base = key[0];
  if (base === 'x' || base === 'y' || base === 'z') return base;
  return AXIS_OF_FACE[base];
}

function composePerms(a, b) {
  const out = new Array(54);
  for (let s = 0; s < 54; s += 1) out[s] = b[a[s]];
  return out;
}

function buildKeyPerm(axis, layerDot, amount) {
  const single = buildPermutation(axis, layerDot);
  if (amount === 2) return composePerms(single, single);
  if (amount === 3) return composePerms(composePerms(single, single), single);
  return single;
}

export const FACE_KEYS = [];
export const ROT_KEYS = [];
export const ALL_KEYS = [];
for (const face of FACE_ORDER) {
  for (const amount of [1, 2, 3]) {
    const key = keyFromParts(face, amount);
    FACE_KEYS.push(key);
    ALL_KEYS.push(key);
  }
}
for (const axis of ['x', 'y', 'z']) {
  for (const amount of [1, 2, 3]) {
    const key = keyFromParts(axis, amount);
    ROT_KEYS.push(key);
    ALL_KEYS.push(key);
  }
}

export const KEY_PERMS = new Map();
for (const face of FACE_ORDER) {
  for (const amount of [1, 2, 3]) {
    KEY_PERMS.set(keyFromParts(face, amount), buildKeyPerm(faceNormal(face), 1, amount));
  }
}
const AXIS_UNIT = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };
for (const axis of ['x', 'y', 'z']) {
  for (const amount of [1, 2, 3]) {
    KEY_PERMS.set(keyFromParts(axis, amount), buildKeyPerm(AXIS_UNIT[axis], null, amount));
  }
}

export function permOfKey(key) {
  const perm = KEY_PERMS.get(key);
  if (!perm) throw new Error(`Неизвестный ход: «${String(key)}»`);
  return perm;
}

// perm[s] — куда переезжает наклейка из позиции s.
export function applyPerm(perm, state) {
  const out = new Array(54);
  for (let s = 0; s < 54; s += 1) out[perm[s]] = state[s];
  return out;
}

// Ходы применяются слева направо.
export function applyMoves(state, keys) {
  let cur = state;
  for (const key of keys) cur = applyPerm(permOfKey(key), cur);
  return cur;
}

export function invertKey(key) {
  return keyFromParts(key[0], 4 - keyAmount(key));
}

export function invertMoves(keys) {
  return [...keys].reverse().map(invertKey);
}
