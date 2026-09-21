// Скрамблы: случайные последовательности граневых ходов
// без двух подряд ходов одной оси.

import { FACE_KEYS, axisOfKey } from './moves.js';
import { stateFromKeys } from './state.js';
import { movesToString } from './notation.js';

export function randomScramble(length = 20, rand = Math.random) {
  if (!Number.isInteger(length) || length < 0) {
    throw new Error(`Длина скрамбла должна быть целым неотрицательным числом, а не ${JSON.stringify(length)}`);
  }
  const keys = [];
  let prevAxis = null;
  while (keys.length < length) {
    const key = FACE_KEYS[Math.floor(rand() * FACE_KEYS.length)];
    const axis = axisOfKey(key);
    if (axis === prevAxis) continue;
    keys.push(key);
    prevAxis = axis;
  }
  return keys;
}

export function scrambleState(length = 20, rand = Math.random) {
  const keys = randomScramble(length, rand);
  return { alg: movesToString(keys), keys, state: stateFromKeys(keys) };
}
