// Тесты валидатора состояний.
import test from 'node:test';
import assert from 'node:assert/strict';

import { validateState } from '../src/validator.js';
import { solvedState, stateFromAlg } from '../src/state.js';
import { scrambleState } from '../src/scrambles.js';

// Детерминированный генератор (LCG) для воспроизводимых скрамблов.
function lcg(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

test('решённое состояние валидно', () => {
  assert.deepEqual(validateState(solvedState()), { valid: true, problems: [] });
});

test('состояния после произвольных последовательностей ходов валидны', () => {
  const algs = ["R U R' U'", "R' F R2 B' L2 D x y z", "M2 E2 S2", "Rw u2 F'"];
  for (const alg of algs) {
    assert.equal(validateState(stateFromAlg(alg)).valid, true, `алгоритм «${alg}»`);
  }
});

test('случайные скрамблы дают валидные состояния', () => {
  for (const seed of [1, 2, 3, 7, 20260921]) {
    const { state } = scrambleState(25, lcg(seed));
    assert.equal(validateState(state).valid, true, `seed ${seed}`);
  }
});

test('неверный тип и длина', () => {
  assert.equal(validateState(null).valid, false);
  assert.equal(validateState('x'.repeat(54)).valid, false);
  assert.equal(validateState(solvedState().slice(1)).valid, false);
});

test('недопустимый цвет', () => {
  const broken = solvedState();
  broken[0] = 'X';
  const res = validateState(broken);
  assert.equal(res.valid, false);
  assert.ok(res.problems[0].includes('Фейслет 0'));
});

test('нарушенные счётчики цветов', () => {
  const mono = Array.from({ length: 54 }, () => 'U');
  const res = validateState(mono);
  assert.equal(res.valid, false);
  assert.ok(res.problems.some((p) => p.includes('54 раз вместо 9')));
});

test('дублирующиеся центры ловятся до проверки целостности', () => {
  const glued = solvedState();
  glued[0] = glued[49]; // наклейка B попадает в угол ULB
  glued[49] = 'U';      // и центр B становится вторым центром U
  const res = validateState(glued);
  assert.equal(res.valid, false);
  assert.ok(res.problems.some((p) => p.includes('отсутствует среди центров')));
});

test('наклейки от разных деталей в одном слоте', () => {
  const broken = solvedState();
  const f = broken[20]; // F-наклейка угла URF
  broken[20] = broken[41]; // L-наклейка ребра FL
  broken[41] = f;
  const res = validateState(broken);
  assert.equal(res.valid, false);
  assert.ok(res.problems.some((p) => p.includes('в слоте URF')));
  assert.ok(res.problems.some((p) => p.includes('в слоте FL')));
});

test('закрутка одного угла', () => {
  const twisted = solvedState();
  twisted[8] = 'R';
  twisted[9] = 'F';
  twisted[20] = 'U';
  const res = validateState(twisted);
  assert.equal(res.valid, false);
  assert.ok(res.problems.some((p) => p.includes('закрутка')));
});

test('флип одного ребра', () => {
  const flipped = solvedState();
  flipped[28] = 'F';
  flipped[25] = 'D';
  const res = validateState(flipped);
  assert.equal(res.valid, false);
  assert.ok(res.problems.some((p) => p.includes('флип')));
});

test('перестановка двух рёбер нарушает чётность', () => {
  const swapped = solvedState();
  const f = swapped[10]; // F-наклейка ребра UF
  swapped[10] = swapped[37]; // L-наклейка ребра UL
  swapped[37] = f;
  const res = validateState(swapped);
  assert.equal(res.valid, false);
  assert.ok(res.problems.some((p) => p.includes('чётность')));
});
