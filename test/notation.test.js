// Тесты разбора и упрощения нотации.
import test from 'node:test';
import assert from 'node:assert/strict';

import { parseMoves, parseToken, simplify, movesToString } from '../src/notation.js';

test('разбор базовых ходов', () => {
  assert.deepEqual(parseMoves("R U R'"), ['R', 'U', "R'"]);
  assert.deepEqual(parseMoves('R2'), ['R2']);
  assert.deepEqual(parseMoves('  F   L2  B\' '), ['F', 'L2', "B'"]);
});

test('широкие ходы раскрываются в поворот куба и граневой ход', () => {
  assert.deepEqual(parseMoves('Rw'), ['x', 'L']);
  assert.deepEqual(parseMoves('u'), ['y', 'D']);
});

test('обратный широкий ход разворачивается и инвертируется', () => {
  assert.deepEqual(parseMoves("u'"), ["D'", "y'"]);
});

test('средние слои следуют за своими гранями', () => {
  assert.deepEqual(parseMoves('M2'), ['L2', 'R2', 'x2']);
  assert.deepEqual(parseMoves('S2'), ['F2', 'B2', 'z2']);
});

test('повороты куба разбираются как одиночные ключи', () => {
  assert.deepEqual(parseMoves("y'"), ["y'"]);
  assert.deepEqual(parseMoves('x2'), ['x2']);
});

test('simplify сливает ходы одной грани и убирает взаимно обратные', () => {
  assert.deepEqual(simplify(parseMoves("R L R'")), ['L']);
  assert.deepEqual(simplify(parseMoves('x x')), ['x2']);
  assert.deepEqual(simplify(parseMoves("R R'")), []);
  assert.deepEqual(simplify(parseMoves('U U U U')), []);
  assert.deepEqual(simplify(parseMoves("U U U' U2")), ["U'"]); // 1+1+3+2 = 7, 7 mod 4 = 3
});

test('movesToString склеивает ключи пробелами', () => {
  assert.equal(movesToString(["R", "U", "R'"]), "R U R'");
  assert.equal(movesToString([]), '');
});

test('некорректные ходы вызывают ошибку', () => {
  assert.throws(() => parseMoves('Q'));
  assert.throws(() => parseMoves('U3'));
  assert.throws(() => parseToken(''));
});
