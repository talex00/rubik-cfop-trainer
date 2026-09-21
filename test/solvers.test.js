// Тесты таблиц переходов, креста, пар F2L и полного анализа.
import test from 'node:test';
import assert from 'node:assert/strict';

import { FACE_KEYS, applyMoves, invertKey } from '../src/moves.js';
import { solvedState, stateFromAlg } from '../src/state.js';
import { buildTransTables, findEdgeByColors, findCornerByColors } from '../src/solvers/tables.js';
import { solveCross, crossInfo, crossIntact, CROSS_GOAL_ENC } from '../src/solvers/cross.js';
import {
  F2L_KEYS, CENTER_ARRANGEMENTS, CFG_PERM, cfgOf,
  pairOf, pairEncode, stepFull, solvePair, openPairs, layerStatus,
} from '../src/solvers/f2l.js';
import { analyzeState, analyzeF2L } from '../src/analysis.js';
import { scrambleState } from '../src/scrambles.js';

// Детерминированный генератор (LCG) для воспроизводимых скрамблов.
function lcg(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

test('таблицы переходов: размеры и обратимость', () => {
  const T = buildTransTables(FACE_KEYS);
  assert.equal(T.n, 18);
  for (let s = 0; s < 12; s += 1) {
    assert.equal(T.edgeTo[s].length, 18);
    assert.equal(T.edgeFlip[s].length, 18);
  }
  for (let s = 0; s < 8; s += 1) {
    assert.equal(T.cornerTo[s].length, 18);
    assert.equal(T.cornerTwist[s].length, 18);
  }
  // Обратный ход возвращает деталь в слот и восстанавливает ориентацию.
  for (let s = 0; s < 12; s += 1) {
    for (let ki = 0; ki < 18; ki += 1) {
      const t = T.edgeTo[s][ki];
      const inv = FACE_KEYS.indexOf(invertKey(FACE_KEYS[ki]));
      assert.equal(T.edgeTo[t][inv], s);
      assert.equal(T.edgeFlip[s][ki] ^ T.edgeFlip[t][inv], 0);
    }
  }
});

test('поиск деталей по цветам', () => {
  const state = solvedState();
  assert.equal(findEdgeByColors(state, 'D', 'F'), 5);
  assert.equal(findEdgeByColors(state, 'F', 'R'), 8);
  assert.equal(findCornerByColors(state, 'D', 'F', 'R'), 4);
  assert.throws(() => findEdgeByColors(state, 'U', 'D'));
});

test('крест: решённое состояние', () => {
  const state = solvedState();
  const info = crossInfo(state);
  assert.equal(info.enc, CROSS_GOAL_ENC);
  assert.equal(info.pieces.length, 4);
  assert.equal(crossIntact(state), true);
  const res = solveCross(state, {});
  assert.equal(res.length, 0);
  assert.deepEqual(res.solutions, [[]]);
});

test('крест после R решается обратным ходом', () => {
  const state = stateFromAlg('R');
  const res = solveCross(state, { maxSolutions: 64 });
  assert.equal(res.length, 1);
  assert.equal(res.solutions.length, 1);
  assert.deepEqual(res.solutions[0], ["R'"]);
  assert.equal(crossIntact(applyMoves(state, res.solutions[0])), true);
});

test('крест на детерминированном скрамбле оптимален и верифицируется', () => {
  const { state } = scrambleState(25, lcg(20260921));
  const res = solveCross(state, { maxSolutions: 8 });
  assert.ok(res.length <= 8);
  assert.ok(res.solutions.length > 0);
  for (const keys of res.solutions) {
    assert.equal(keys.length, res.length);
    assert.equal(crossIntact(applyMoves(state, keys)), true);
  }
});

test('орбита центров: 24 уникальные ориентации', () => {
  assert.equal(CENTER_ARRANGEMENTS.length, 24);
  assert.equal(new Set(CENTER_ARRANGEMENTS).size, 24);
  assert.ok(CENTER_ARRANGEMENTS.includes('URFDLB'));
  assert.equal(cfgOf(solvedState()), 0);
});

test('недостижимая конфигурация центров вызывает ошибку', () => {
  const broken = solvedState();
  broken[4] = 'R';
  broken[13] = 'U';
  assert.throws(() => cfgOf(broken), /недостижима/);
});

test('переходы конфигураций: y четыре раза возвращает исходную', () => {
  for (let cfg = 0; cfg < 24; cfg += 1) {
    let cur = cfg;
    for (let i = 0; i < 4; i += 1) cur = CFG_PERM[0][cur];
    assert.equal(cur, cfg, `cfg ${cfg}`);
  }
  assert.equal(CFG_PERM[0][0], CENTER_ARRANGEMENTS.indexOf('UBRDFL'));
});

test('stepFull согласован с перекодировкой реального состояния', () => {
  for (const alg of ['', 'R', "R U R'"]) {
    const state = stateFromAlg(alg);
    for (const slot of [8, 9]) {
      const pair = pairOf(state, slot);
      for (let ki = 0; ki < F2L_KEYS.length; ki += 1) {
        const key = F2L_KEYS[ki];
        const enc = stepFull(pair.enc, ki);
        const moved = pairEncode(applyMoves(state, [key]), pair);
        assert.equal(enc, moved, `alg=${alg} slot=${slot} key=${key}`);
      }
    }
  }
});

test('пара на решённом кубе уже собрана', () => {
  const state = solvedState();
  const pair = pairOf(state, 8);
  const res = solvePair(state, pair, {});
  assert.equal(res.optimalLength, 0);
  assert.deepEqual(res.solutions, [[]]);
});

test('пара FR после R решается обратным ходом', () => {
  const state = stateFromAlg('R');
  const pair = pairOf(state, 8);
  const res = solvePair(state, pair, { requireCross: false, collectAlternatives: false });
  assert.equal(res.optimalLength, 1);
  assert.equal(res.length, 1);
  assert.deepEqual(res.solutions[0], ["R'"]);
});

test('после R U R-штрих открыта только пара FR', () => {
  const state = stateFromAlg("R U R'");
  const opens = openPairs(state);
  assert.deepEqual(opens.map((o) => o.slot), [8]);
});

test('layerStatus распознаёт состояние слоёв', () => {
  assert.deepEqual(layerStatus(solvedState()), { cross: true, middles: true, corners: true, f2l: true });
  const afterR = layerStatus(stateFromAlg('R'));
  assert.equal(afterR.cross, false);
  assert.equal(afterR.middles, false);
  assert.equal(afterR.f2l, false);
});

test('analyzeF2L закрывает единственную открытую пару', () => {
  const state = stateFromAlg("R U R'");
  const res = analyzeF2L(state);
  assert.equal(res.steps.length, 1);
  assert.equal(res.steps[0].slot, 8);
  assert.equal(res.length, res.steps[0].length);
  assert.equal(res.layerStatus.f2l, true);
});

test('analyzeState на детерминированном скрамбле', () => {
  const { state } = scrambleState(25, lcg(1000));
  const rep = analyzeState(state);
  assert.equal(rep.validation.valid, true);
  assert.equal(rep.cross.length, 6);
  assert.equal(rep.f2l.steps.length, 4);
  assert.equal(rep.total, 32);
  assert.equal(rep.total, rep.cross.length + rep.f2l.length);
  assert.equal(rep.layerStatus.f2l, true);
  // Цепочка ходов приводит к состоянию из отчёта, и слои собраны.
  const chain = [...rep.cross.keys, ...rep.f2l.steps.flatMap((s) => s.keys)];
  assert.equal(chain.length, rep.total);
  assert.deepEqual(applyMoves(state, chain), rep.state);
  assert.deepEqual(layerStatus(rep.state), { cross: true, middles: true, corners: true, f2l: true });
});
