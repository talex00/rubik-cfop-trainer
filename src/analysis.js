// Анализ состояния: варианты оптимального креста с оценкой стоимости
// последующего F2L, жадное послойное решение F2L и сводный отчёт.

import { applyMoves } from './moves.js';
import { validateState } from './validator.js';
import { solveCross } from './solvers/cross.js';
import { solvePair, pairOf, pairOptimalLength, openPairs, layerStatus } from './solvers/f2l.js';

// Варианты оптимального креста: каждый оценивается суммой
// «длина креста + оптимальные дистанции четырёх пар F2L после креста».
export function analyzeCross(state, options = {}) {
  const { maxVariants = 8 } = options;
  const solved = solveCross(state, { maxSolutions: maxVariants });
  const variants = [];
  for (const keys of solved.solutions) {
    const after = applyMoves(state, keys);
    let pairCost = 0;
    for (let slot = 8; slot <= 11; slot += 1) {
      pairCost += pairOptimalLength(pairOf(after, slot));
    }
    variants.push({ keys, length: keys.length, totalCost: keys.length + pairCost });
  }
  variants.sort((a, b) => a.totalCost - b.totalCost
    || (a.keys.join(' ') < b.keys.join(' ') ? -1 : 1));
  return variants;
}

// Жадное решение F2L: на каждом шаге перебираем открытые пары,
// берём кратчайшее решение (затем меньше вращений, затем лексикографически).
export function analyzeF2L(state, options = {}) {
  const { maxSteps = 8 } = options;
  let cur = state;
  const locked = [];
  const steps = [];
  for (let step = 0; step < maxSteps; step += 1) {
    const opens = openPairs(cur);
    if (opens.length === 0) break;
    let best = null;
    let lastErr = null;
    for (const { pair } of opens) {
      let res;
      try {
        res = solvePair(cur, pair, { requireCross: true, lockPairs: locked, collectAlternatives: false });
      } catch (err) {
        lastErr = err;
        continue;
      }
      const keys = res.solutions[0];
      const rotCount = keys.reduce((n, key) => (key[0] === 'y' ? n + 1 : n), 0);
      const line = keys.join(' ');
      if (
        best === null
        || keys.length < best.keys.length
        || (keys.length === best.keys.length && rotCount < best.rotCount)
        || (keys.length === best.keys.length && rotCount === best.rotCount && line < best.line)
      ) {
        best = { keys, rotCount, line, res };
      }
    }
    if (best === null) {
      throw new Error(`Ни одна пара F2L не решается: ${lastErr ? lastErr.message : 'нет данных'}`);
    }
    cur = applyMoves(cur, best.keys);
    locked.push(best.res.pair);
    steps.push({ slot: best.res.pair.slot, keys: best.keys, length: best.keys.length });
  }
  const status = layerStatus(cur);
  if (!status.f2l) {
    const remaining = openPairs(cur);
    throw new Error(`F2L не завершено: осталось пар ${remaining.length}`);
  }
  return { steps, length: steps.reduce((n, s) => n + s.length, 0), state: cur, layerStatus: status };
}

// Сводный анализ: валидация, выбор лучшего креста по стоимости F2L, жадное F2L.
export function analyzeState(state, options = {}) {
  const validation = validateState(state);
  if (!validation.valid) {
    throw new Error(`Состояние невалидно: ${validation.problems[0]}`);
  }
  const variants = analyzeCross(state, options);
  if (variants.length === 0) throw new Error('Крест: решение не найдено');
  const best = variants[0];
  const afterCross = applyMoves(state, best.keys);
  const f2l = analyzeF2L(afterCross, options);
  return {
    validation,
    cross: { keys: best.keys, length: best.keys.length, totalCost: best.totalCost, variants },
    f2l,
    total: best.keys.length + f2l.length,
    state: f2l.state,
    layerStatus: f2l.layerStatus,
  };
}
