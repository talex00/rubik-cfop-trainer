// Тесты геометрии, ходов и состояния кубика.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  FACES, CENTER_IDS, EDGE_SLOTS, CORNER_SLOTS,
  EDGE_SLOT_BY_FACES, CORNER_SLOT_BY_FACES,
} from '../src/geometry.js';
import { FACE_KEYS, ROT_KEYS, ALL_KEYS, applyMoves, invertKey, invertMoves } from '../src/moves.js';
import {
  solvedState, stateFromAlg, stateFromKeys, faceletStringToState,
  stateToFaceletString, centerColors,
} from '../src/state.js';

test('решённое состояние: 54 фейслета, по девять каждого цвета', () => {
  const state = solvedState();
  assert.equal(state.length, 54);
  for (const face of FACES) {
    assert.equal(state.filter((c) => c === face).length, 9);
  }
});

test('центры граней занимают позиции 4, 13, 22, 31, 40, 49', () => {
  const state = solvedState();
  for (let f = 0; f < 6; f += 1) {
    assert.equal(state[CENTER_IDS[f]], FACES[f]);
  }
});

test('слоты: 12 рёбер и 8 углов, наклейки не повторяются', () => {
  assert.equal(EDGE_SLOTS.length, 12);
  assert.equal(CORNER_SLOTS.length, 8);
  const seen = new Set();
  for (const slot of [...EDGE_SLOTS, ...CORNER_SLOTS]) {
    for (const f of slot.facelets) {
      assert.equal(seen.has(f), false);
      seen.add(f);
    }
  }
  assert.equal(seen.size, 48);
});

test('индексы слотов по наборам граней', () => {
  assert.equal(EDGE_SLOT_BY_FACES.get('DF'), 5);
  assert.equal(EDGE_SLOT_BY_FACES.get('FR'), 8);
  assert.equal(EDGE_SLOT_BY_FACES.get('BL'), 10);
  assert.equal(CORNER_SLOT_BY_FACES.get('DFR'), 4);
  assert.equal(CORNER_SLOT_BY_FACES.get('FRU'), 0); // ключ — отсортированные буквы граней
});

test('ключи: 18 граневых, 9 вращений, 27 всего', () => {
  assert.equal(FACE_KEYS.length, 18);
  assert.equal(ROT_KEYS.length, 9);
  assert.equal(ALL_KEYS.length, 27);
});

test('четыре четверти любого хода возвращают исходное состояние', () => {
  const state = stateFromAlg("F' L2 B");
  for (const key of ALL_KEYS) {
    assert.deepEqual(applyMoves(state, [key, key, key, key]), state, `ключ ${key}`);
  }
});

test('обратный ход отменяет прямой', () => {
  const state = stateFromAlg("R U2 F' L");
  for (const key of ALL_KEYS) {
    assert.deepEqual(applyMoves(state, [key, invertKey(key)]), state, `ключ ${key}`);
  }
});

test('двойной ход равен композиции двух одиночных', () => {
  const state = stateFromAlg("B D2");
  for (const base of ['U', 'R', 'F', 'D', 'L', 'B', 'x', 'y', 'z']) {
    assert.deepEqual(applyMoves(state, [base, base]), applyMoves(state, [`${base}2`]), `база ${base}`);
  }
});

test('invertMoves возвращает состояние к исходному', () => {
  const keys = ["R", "U", "R'", "F2", "y", "L2", "B'"];
  const state = stateFromKeys(keys);
  assert.deepEqual(applyMoves(state, invertMoves(keys)), solvedState());
});

test('facelet-строки: конвертация туда и обратно, пробелы и регистр', () => {
  const state = stateFromAlg("R U R' U' L' U' L U");
  const str = stateToFaceletString(state);
  assert.equal(str.length, 54);
  assert.deepEqual(faceletStringToState(str), state);
  assert.deepEqual(faceletStringToState(str.toLowerCase()), state);
  assert.deepEqual(faceletStringToState(str.replace(/(.{9})/g, '$1 ')), state);
});

test('faceletStringToState отвергает неверные строки', () => {
  assert.throws(() => faceletStringToState('R'.repeat(53)), /Некорректная строка состояния/);
  assert.throws(() => faceletStringToState(42), /Состояние должно быть строкой/);
});

test('повороты куба переставляют центры', () => {
  assert.equal(centerColors(solvedState()).join(''), 'URFDLB');
  assert.equal(centerColors(stateFromAlg('x')).join(''), 'FRDBLU');
  assert.equal(centerColors(stateFromAlg('y')).join(''), 'UBRDFL');
  assert.equal(centerColors(stateFromAlg('z')).join(''), 'LUFRDB');
});
