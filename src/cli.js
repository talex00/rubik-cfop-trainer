#!/usr/bin/env node
// CLI MVP-тренажёра: скрамблы, валидация состояний, оптимальный крест,
// решение пар F2L и полный разбор (крест + F2L) с русским выводом.

import { scrambleState } from './scrambles.js';
import { movesToString } from './notation.js';
import { stateToFaceletString, stateFromAlg, faceletStringToState } from './state.js';
import { validateState } from './validator.js';
import { applyMoves } from './moves.js';
import { solveCross, crossIntact } from './solvers/cross.js';
import { solvePair, pairOf, pairSolvedIn, layerStatus } from './solvers/f2l.js';
import { analyzeState } from './analysis.js';
import { EDGE_SLOTS } from './geometry.js';

const SLOT_BY_NAME = new Map(['FR', 'FL', 'BL', 'BR'].map((name, i) => [name, 8 + i]));

function usage() {
  console.log('Использование: rubik-cfop <команда> [аргументы]');
  console.log('');
  console.log('Команды:');
  console.log('  demo                — случайный скрамбл и полный разбор (крест + F2L)');
  console.log('  scramble [n]        — случайный скрамбл длины n (по умолчанию 20)');
  console.log('  validate [вход]     — проверка корректности состояния');
  console.log('  cross [вход]        — все оптимальные решения креста');
  console.log('  f2l --slot ИМЯ [вход] — решение пары F2L (слот FR, FL, BL или BR)');
  console.log('  solve [вход]        — полный разбор: крест + F2L');
  console.log('');
  console.log(`Вход — строка ходов (например, "R U R' F2") или`);
  console.log('строка состояния из 54 символов URFDLB (разметка Коциембы).');
  console.log('Без входа используется случайный скрамбл.');
}

function fail(message) {
  console.error(`Ошибка: ${message}`);
  process.exit(1);
}

function isFaceletInput(input) {
  return /^[URFDLB]{54}$/i.test(input.replace(/\s+/g, ''));
}

function stateFromInput(input) {
  if (isFaceletInput(input)) {
    try {
      return faceletStringToState(input);
    } catch (err) {
      fail(err.message);
    }
  }
  try {
    return stateFromAlg(input);
  } catch (err) {
    fail(`не удалось разобрать вход: ${err.message}`);
  }
}

// Разбор аргументов: позиционные параметры и опции --slot X / --slot=X.
function parseOptions(args) {
  const opts = { positional: [], slot: null, help: false };
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === '--slot') {
      const value = args[i + 1];
      if (!value) fail('после --slot ожидается имя слота: FR, FL, BL или BR');
      opts.slot = value.toUpperCase();
      i += 1;
    } else if (a.startsWith('--slot=')) {
      opts.slot = a.slice(7).toUpperCase();
    } else if (a === '--help' || a === '-h') {
      opts.help = true;
    } else {
      opts.positional.push(a);
    }
  }
  return opts;
}

function printScrambleHeader(state, alg) {
  console.log(`Скрамбл: ${alg}`);
  console.log(`Состояние: ${stateToFaceletString(state)}`);
  console.log('');
}

function printReport(state) {
  const started = Date.now();
  let report;
  try {
    report = analyzeState(state);
  } catch (err) {
    fail(err.message);
  }
  console.log(report.cross.length === 0 ? 'Крест уже собран.' : `Крест (${report.cross.length}): ${movesToString(report.cross.keys)}`);
  if (report.cross.variants.length > 1) {
    console.log('Варианты креста (стоимость = длина + оценка F2L):');
    for (let i = 0; i < Math.min(3, report.cross.variants.length); i += 1) {
      const v = report.cross.variants[i];
      console.log(`  ${i + 1}. ${movesToString(v.keys)}  (${v.length} ходов, стоимость ${v.totalCost})`);
    }
  }
  console.log('');
  console.log('F2L:');
  for (const step of report.f2l.steps) {
    console.log(`  Слот ${EDGE_SLOTS[step.slot].name} (${step.length}): ${movesToString(step.keys)}`);
  }
  console.log('');
  console.log(`Итого: ${report.total} ходов (крест ${report.cross.length} + F2L ${report.f2l.length})`);
  const st = report.layerStatus;
  console.log(`Слои: крест ${st.cross ? 'собран' : 'не собран'}, средний ${st.middles ? 'собран' : 'не собран'}, углы ${st.corners ? 'собраны' : 'не собраны'}`);
  console.log(`Состояние после решения: ${stateToFaceletString(report.state)}`);
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`Время анализа: ${seconds} с`);
}

function cmdDemo() {
  const { alg, state } = scrambleState(25);
  printScrambleHeader(state, alg);
  printReport(state);
}

function cmdScramble(opts) {
  let length = 20;
  if (opts.positional.length > 0) {
    length = Number.parseInt(opts.positional[0], 10);
    if (!Number.isInteger(length) || length < 0) {
      fail(`длина скрамбла должна быть целым неотрицательным числом, а не «${opts.positional[0]}»`);
    }
  }
  const { alg, state } = scrambleState(length);
  console.log(`Скрамбл: ${alg}`);
  console.log(`Состояние: ${stateToFaceletString(state)}`);
}

function cmdValidate(opts) {
  if (opts.positional.length === 0) fail('укажите состояние: строку ходов или 54 символа URFDLB');
  const state = stateFromInput(opts.positional[0]);
  const { valid, problems } = validateState(state);
  if (valid) {
    console.log('Состояние корректно.');
    return;
  }
  console.log('Состояние некорректно:');
  for (const problem of problems) console.log(`  — ${problem}`);
  process.exitCode = 1;
}

function cmdCross(opts) {
  let state;
  if (opts.positional.length > 0) {
    state = stateFromInput(opts.positional[0]);
  } else {
    const { alg, state: scrambled } = scrambleState(25);
    printScrambleHeader(scrambled, alg);
    state = scrambled;
  }
  let res;
  try {
    res = solveCross(state, { maxSolutions: 8 });
  } catch (err) {
    fail(err.message);
  }
  if (res.length === 0) {
    console.log('Крест уже собран.');
    return;
  }
  console.log(`Крест (${res.length}): ${movesToString(res.solutions[0])}`);
  if (res.solutions.length > 1) {
    console.log('Альтернативы того же оптимума:');
    for (let i = 1; i < res.solutions.length && i <= 3; i += 1) {
      console.log(`  ${i}. ${movesToString(res.solutions[i])}`);
    }
  }
}

function cmdF2L(opts) {
  if (!opts.slot) fail('укажите слот пары: --slot FR, FL, BL или BR');
  const slotIdx = SLOT_BY_NAME.get(opts.slot);
  if (slotIdx === undefined) fail(`неизвестный слот «${opts.slot}»: доступны FR, FL, BL, BR`);
  let state;
  if (opts.positional.length > 0) {
    state = stateFromInput(opts.positional[0]);
  } else {
    const { alg, state: scrambled } = scrambleState(25);
    printScrambleHeader(scrambled, alg);
    const cross = solveCross(scrambled, { maxSolutions: 1 });
    console.log(`Крест (${cross.length}): ${movesToString(cross.solutions[0])}`);
    console.log('');
    state = cross.solutions[0].length > 0 ? applyMoves(scrambled, cross.solutions[0]) : scrambled;
  }
  let pair;
  try {
    pair = pairOf(state, slotIdx);
  } catch (err) {
    fail(err.message);
  }
  if (pairSolvedIn(state, pair)) {
    console.log(`Пара ${EDGE_SLOTS[slotIdx].name} уже собрана.`);
    return;
  }
  let res;
  try {
    res = solvePair(state, pair, { requireCross: crossIntact(state) });
  } catch (err) {
    fail(err.message);
  }
  console.log(`Пара ${EDGE_SLOTS[slotIdx].name}: оптимальная длина ${res.optimalLength}, найдено за ${res.length}`);
  console.log(`Решение: ${movesToString(res.solutions[0])}`);
  if (res.solutions.length > 1) {
    console.log('Альтернативы:');
    for (let i = 1; i < res.solutions.length && i <= 3; i += 1) {
      console.log(`  ${i}. ${movesToString(res.solutions[i])}`);
    }
  }
  const after = applyMoves(state, res.solutions[0]);
  console.log(`Состояние после решения: ${stateToFaceletString(after)}`);
  const st = layerStatus(after);
  console.log(`Слои: крест ${st.cross ? 'собран' : 'не собран'}, средний ${st.middles ? 'собран' : 'не собран'}, углы ${st.corners ? 'собраны' : 'не собраны'}`);
}

function cmdSolve(opts) {
  let state;
  if (opts.positional.length > 0) {
    state = stateFromInput(opts.positional[0]);
  } else {
    const { alg, state: scrambled } = scrambleState(25);
    printScrambleHeader(scrambled, alg);
    state = scrambled;
  }
  printReport(state);
}

const [command, ...rest] = process.argv.slice(2);
const opts = parseOptions(rest);

if (opts.help || !command) {
  usage();
  process.exitCode = 0;
} else {
  switch (command) {
    case 'demo':
      cmdDemo();
      break;
    case 'scramble':
      cmdScramble(opts);
      break;
    case 'validate':
      cmdValidate(opts);
      break;
    case 'cross':
      cmdCross(opts);
      break;
    case 'f2l':
      cmdF2L(opts);
      break;
    case 'solve':
      cmdSolve(opts);
      break;
    default:
      usage();
      console.error(`Ошибка: неизвестная команда «${command}»`);
      process.exitCode = 1;
  }
}
