// Геометрия кубика Рубика 3x3: разметка фейслетов, слоты деталей,
// построение перестановок для поворотов граней и всего куба.

export const FACES = ['U', 'R', 'F', 'D', 'L', 'B'];

// Центры граней (фейслеты 4, 13, 22, 31, 40, 49).
export const CENTER_IDS = [4, 13, 22, 31, 40, 49];

// Внешние нормали граней; оси: x -> R(+)/L(-), y -> U(+)/D(-), z -> F(+)/B(-).
const FACE_NORMALS = {
  U: [0, 1, 0],
  R: [1, 0, 0],
  F: [0, 0, 1],
  D: [0, -1, 0],
  L: [-1, 0, 0],
  B: [0, 0, -1],
};

// Разметка фейслетов. Каждая грань — сетка 3x3 (ряды сверху вниз,
// столбцы слева направо, если смотреть на грань снаружи).
// Возвращает [x, y, z] позиции наклейки на поверхности куба.
const FACE_LAYOUTS = {
  U: (row, col) => [col - 1, 1, row - 1],
  R: (row, col) => [1, 1 - row, 1 - col],
  F: (row, col) => [col - 1, 1 - row, 1],
  D: (row, col) => [col - 1, -1, 1 - row],
  L: (row, col) => [-1, 1 - row, col - 1],
  B: (row, col) => [1 - col, 1 - row, -1],
};

// Позиции и нормали всех 54 фейслетов.
export const FACELET_POS = new Array(54);
export const FACELET_NORMAL = new Array(54);

for (let f = 0; f < 6; f += 1) {
  const face = FACES[f];
  const layout = FACE_LAYOUTS[face];
  for (let i = 0; i < 9; i += 1) {
    const id = f * 9 + i;
    FACELET_POS[id] = layout(Math.floor(i / 3), i % 3);
    FACELET_NORMAL[id] = FACE_NORMALS[face];
  }
}

// Грань, на которой лежит фейслет.
export function faceOfFacelet(id) {
  return FACES[Math.floor(id / 9)];
}

// Слоты рёбер и углов (разметка Коциембы, порядок facelets внутри слота канонический).
export const EDGE_SLOTS = [
  [5, 10], [7, 19], [3, 37], [1, 46],
  [32, 16], [28, 25], [30, 43], [34, 52],
  [23, 12], [21, 41], [50, 39], [48, 14],
].map((facelets) => ({
  facelets,
  faces: facelets.map(faceOfFacelet),
}));

export const CORNER_SLOTS = [
  [8, 9, 20], [6, 18, 38], [0, 36, 47], [2, 45, 11],
  [29, 26, 15], [27, 44, 24], [33, 53, 42], [35, 17, 51],
].map((facelets) => ({
  facelets,
  faces: facelets.map(faceOfFacelet),
}));

const EDGE_NAMES = ['UR', 'UF', 'UL', 'UB', 'DR', 'DF', 'DL', 'DB', 'FR', 'FL', 'BL', 'BR'];
const CORNER_NAMES = ['URF', 'UFL', 'ULB', 'UBR', 'DFR', 'DLF', 'DBL', 'DRB'];
EDGE_SLOTS.forEach((slot, i) => { slot.name = EDGE_NAMES[i]; });
CORNER_SLOTS.forEach((slot, i) => { slot.name = CORNER_NAMES[i]; });

// Индекс слота по отсортированному набору граней, например 'DF' -> 5, 'FR' -> 8.
function slotKeyOfFaces(faces) {
  return [...faces].sort().join('');
}

export const EDGE_SLOT_BY_FACES = new Map(EDGE_SLOTS.map((slot, i) => [slotKeyOfFaces(slot.faces), i]));
export const CORNER_SLOT_BY_FACES = new Map(CORNER_SLOTS.map((slot, i) => [slotKeyOfFaces(slot.faces), i]));

// Поворот вектора на -90 градусов вокруг оси (правая система координат).
// Ось задаётся вектором с одной ненулевой компонентой: [±1,0,0], [0,±1,0], [0,0,±1].
function rotNeg90(v, axis) {
  const [ax, ay, az] = axis;
  // Знак оси: поворот вокруг -a на -90° равен повороту вокруг +a на +90°.
  const sign = ax !== 0 ? Math.sign(ax) : ay !== 0 ? Math.sign(ay) : Math.sign(az);
  const letter = ax !== 0 ? 'x' : ay !== 0 ? 'y' : 'z';
  const [x, y, z] = v;
  if (letter === 'x') {
    // -90° вокруг +x: (y, z) -> (z, -y); с учётом знака — наоборот.
    return sign > 0 ? [x, z, -y] : [x, -z, y];
  }
  if (letter === 'y') {
    // -90° вокруг +y: (x, z) -> (-z, x).
    return sign > 0 ? [-z, y, x] : [z, y, -x];
  }
  // -90° вокруг +z: (x, y) -> (y, -x).
  return sign > 0 ? [y, -x, z] : [-y, x, z];
}

// Перестановка фейслетов для поворота на -90° вокруг оси.
// layerDot === null — весь куб; иначе поворачиваются только фейслеты
// слоя, для которых скалярное произведение позиции на ось равно layerDot.
export function buildPermutation(axis, layerDot) {
  const perm = new Array(54);
  for (let s = 0; s < 54; s += 1) {
    const pos = FACELET_POS[s];
    const dot = pos[0] * axis[0] + pos[1] * axis[1] + pos[2] * axis[2];
    if (layerDot !== null && dot !== layerDot) {
      perm[s] = s;
      continue;
    }
    const np = rotNeg90(pos, axis);
    const nn = rotNeg90(FACELET_NORMAL[s], axis);
    perm[s] = faceletAt(np, nn);
  }
  return perm;
}

// Фейслет в заданной позиции с заданной нормалью.
function faceletAt(pos, normal) {
  const face = FACES.find((f) => {
    const n = FACE_NORMALS[f];
    return n[0] === normal[0] && n[1] === normal[1] && n[2] === normal[2];
  });
  const faceIndex = FACES.indexOf(face);
  const layout = FACE_LAYOUTS[face];
  const rowCol = { U: [pos[2] + 1, pos[0] + 1], D: [1 - pos[2], pos[0] + 1], R: [1 - pos[1], 1 - pos[2]], L: [1 - pos[1], pos[2] + 1], F: [1 - pos[1], pos[0] + 1], B: [1 - pos[1], 1 - pos[0]] }[face];
  const [row, col] = rowCol;
  return faceIndex * 9 + row * 3 + col;
}

// Внешняя нормаль грани.
export function faceNormal(face) {
  return FACE_NORMALS[face];
}
