// Состояние кубика: массив из 54 цветов фейслетов в разметке Коциембы
// (U1..U9, R1..R9, F1..F9, D1..D9, L1..L9, B1..B9, нумерация с нуля).

import { applyMoves } from './moves.js';
import { parseMoves } from './notation.js';
import { FACES, CENTER_IDS } from './geometry.js';

export function solvedState() {
  const state = new Array(54);
  for (let i = 0; i < 54; i += 1) state[i] = FACES[Math.floor(i / 9)];
  return state;
}

export function stateFromKeys(keys, from = solvedState()) {
  return applyMoves(from, keys);
}

export function stateFromAlg(alg, from = solvedState()) {
  return stateFromKeys(parseMoves(alg), from);
}

export function faceletStringToState(input) {
  if (typeof input !== 'string') {
    throw new Error('Состояние должно быть строкой из 54 символов URFDLB');
  }
  const clean = input.replace(/\s+/g, '').toUpperCase();
  if (!/^[URFDLB]{54}$/.test(clean)) {
    throw new Error(`Некорректная строка состояния: ожидаются 54 символа URFDLB, получено: «${input.trim().slice(0, 40)}»`);
  }
  return [...clean];
}

export function stateToFaceletString(state) {
  return state.join('');
}

// Цвета центров в порядке позиций U, R, F, D, L, B.
export function centerColors(state) {
  return CENTER_IDS.map((id) => state[id]);
}
