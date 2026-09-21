// Валидатор состояния куба: тип, счётчики цветов, центры, целостность
// деталей, дубликаты, закрутка углов, флип рёбер и чётность перестановок.

import { FACES, CENTER_IDS, EDGE_SLOTS, CORNER_SLOTS, EDGE_SLOT_BY_FACES, CORNER_SLOT_BY_FACES } from './geometry.js';

const COLOR_SET = new Set(FACES);

function permParity(perm) {
  let parity = 0;
  for (let i = 0; i < perm.length; i += 1) {
    for (let j = i + 1; j < perm.length; j += 1) {
      if (perm[i] > perm[j]) parity ^= 1;
    }
  }
  return parity;
}

export function validateState(state) {
  // 1. Тип и длина.
  if (!Array.isArray(state)) {
    return { valid: false, problems: ['Состояние должно быть массивом из 54 элементов'] };
  }
  if (state.length !== 54) {
    return { valid: false, problems: [`Состояние должно содержать 54 элемента, а не ${state.length}`] };
  }

  // 2. Каждый фейслет — цвет URFDLB.
  const colorProblems = [];
  for (let i = 0; i < 54; i += 1) {
    if (!COLOR_SET.has(state[i])) {
      colorProblems.push(`Фейслет ${i} должен быть одним из цветов URFDLB, а не «${String(state[i])}»`);
    }
  }
  if (colorProblems.length > 0) return { valid: false, problems: colorProblems };

  // 3. Каждый цвет встречается ровно 9 раз.
  const counts = new Map(FACES.map((f) => [f, 0]));
  for (const color of state) counts.set(color, counts.get(color) + 1);
  const countProblems = [];
  for (const face of FACES) {
    const n = counts.get(face);
    if (n !== 9) countProblems.push(`цвет «${face}» встречается ${n} раз вместо 9`);
  }
  if (countProblems.length > 0) return { valid: false, problems: countProblems };

  // 4. Все шесть центров различны.
  const centerSet = new Set(CENTER_IDS.map((id) => state[id]));
  if (centerSet.size !== 6) {
    const problems = [];
    for (const face of FACES) {
      if (!centerSet.has(face)) problems.push(`цвет «${face}» отсутствует среди центров`);
    }
    return { valid: false, problems };
  }

  // 5. Целостность: наклейки каждого слота принадлежат одной детали.
  const edgePieces = new Array(12).fill(-1);
  const cornerPieces = new Array(8).fill(-1);
  const integrityProblems = [];
  for (let s = 0; s < 12; s += 1) {
    const slot = EDGE_SLOTS[s];
    const colors = slot.facelets.map((f) => state[f]);
    const piece = EDGE_SLOT_BY_FACES.get([...colors].sort().join(''));
    if (piece === undefined) integrityProblems.push(`в слоте ${slot.name} наклейки от разных деталей`);
    else edgePieces[s] = piece;
  }
  for (let s = 0; s < 8; s += 1) {
    const slot = CORNER_SLOTS[s];
    const colors = slot.facelets.map((f) => state[f]);
    const piece = CORNER_SLOT_BY_FACES.get([...colors].sort().join(''));
    if (piece === undefined) integrityProblems.push(`в слоте ${slot.name} наклейки от разных деталей`);
    else cornerPieces[s] = piece;
  }
  if (integrityProblems.length > 0) return { valid: false, problems: integrityProblems };

  // 6. Дубликаты деталей.
  const dupProblems = [];
  const edgeSeen = new Map();
  const cornerSeen = new Map();
  for (let s = 0; s < 12; s += 1) {
    const list = edgeSeen.get(edgePieces[s]) ?? [];
    list.push(EDGE_SLOTS[s].name);
    edgeSeen.set(edgePieces[s], list);
  }
  for (let s = 0; s < 8; s += 1) {
    const list = cornerSeen.get(cornerPieces[s]) ?? [];
    list.push(CORNER_SLOTS[s].name);
    cornerSeen.set(cornerPieces[s], list);
  }
  for (const [piece, slots] of edgeSeen) {
    if (slots.length > 1) dupProblems.push(`деталь ${EDGE_SLOTS[piece].name} встречается в слотах ${slots.join(', ')}`);
  }
  for (const [piece, slots] of cornerSeen) {
    if (slots.length > 1) dupProblems.push(`деталь ${CORNER_SLOTS[piece].name} встречается в слотах ${slots.join(', ')}`);
  }
  if (dupProblems.length > 0) return { valid: false, problems: dupProblems };

  // 7. Закрутка, флип и чётность — накапливаются вместе.
  const problems = [];

  let twistSum = 0;
  for (let s = 0; s < 8; s += 1) {
    const slot = CORNER_SLOTS[s];
    const refColor = CORNER_SLOTS[cornerPieces[s]].faces[0]; // всегда U или D
    twistSum += slot.facelets.findIndex((f) => state[f] === refColor);
  }
  if (twistSum % 3 !== 0) problems.push(`закрутка углов: сумма ориентаций ${twistSum} не кратна трём`);

  let flipSum = 0;
  for (let s = 0; s < 12; s += 1) {
    const slot = EDGE_SLOTS[s];
    const refColor = EDGE_SLOTS[edgePieces[s]].faces[0];
    if (state[slot.facelets[0]] !== refColor) flipSum += 1;
  }
  if (flipSum % 2 !== 0) problems.push(`флип рёбер: сумма ориентаций ${flipSum} нечётна`);

  const centerPerm = CENTER_IDS.map((id) => FACES.indexOf(state[id]));
  const parity = permParity(edgePieces) ^ permParity(cornerPieces) ^ permParity(centerPerm);
  if (parity !== 0) problems.push(`чётность перестановок нарушена: углы ⊕ рёбра ⊕ центры = ${parity}`);

  return { valid: problems.length === 0, problems };
}
