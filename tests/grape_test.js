// ============================================================
// tests/grape_test.js — 통계 화면의 품종 묶기 검사
//   node tests/grape_test.js
// app.js에서 /* GRAPES:BEGIN */ ~ /* GRAPES:END */ 구간만 잘라 실행한다(화면/DOM 없이).
// ============================================================
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const src = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const a = src.indexOf('/* GRAPES:BEGIN');
const b = src.indexOf('/* GRAPES:END */');
assert(a !== -1 && b > a, 'app.js에 GRAPES 구간 표시가 없음');
const ctx = {};
vm.createContext(ctx);
vm.runInContext(src.slice(a, b), ctx);

let passed = 0;
function t(name, fn) { fn(); passed++; console.log('  ✓ ' + name); }
const C = raw => JSON.parse(JSON.stringify(ctx.classifyGrapes(raw)));

t('나라마다 이름이 다른 같은 품종은 한 묶음', () => {
  assert.strictEqual(C('시라').key, C('쉬라즈').key);
  assert.strictEqual(C('Shiraz').key, C('시라').key);
  assert.strictEqual(C('피노 누아').key, C('슈페트부르군더').key);
  assert.strictEqual(C('진판델').key, C('프리미티보').key);
  assert.strictEqual(C('그르나슈').key, C('가르나차').key);
  assert.strictEqual(C('피노 그리').key, C('피노 그리지오').key);
  assert.strictEqual(C('템프라니요').key, C('틴토 피노').key);
  assert.strictEqual(C('시라').kind, 'single');
  assert.strictEqual(C('시라').names.length, 2);
});

t('띄어쓰기·표기 차이와 괄호 영문 병기도 같은 품종', () => {
  assert.strictEqual(C('카베르네 소비뇽').key, C('까베르네소비뇽').key);
  assert.strictEqual(C('카베르네 소비뇽 (Cabernet Sauvignon)').key, C('카베르네 소비뇽').key);
  assert.strictEqual(C('샤도네이').key, C('샤르도네').key);
  assert.strictEqual(C('쉬라즈 100%').key, C('시라').key);
});

t('비슷한 이름이어도 다른 품종은 따로', () => {
  assert.notStrictEqual(C('쁘띠 시라').key, C('시라').key);
  assert.notStrictEqual(C('피노 누아').key, C('피노 그리').key);
  assert.notStrictEqual(C('카베르네 프랑').key, C('카베르네 소비뇽').key);
});

t('서로 다른 품종이 섞이면 블렌딩, 섞인 품종과 비율을 그대로 보존', () => {
  const c = C('카베르네 소비뇽 60%·메를로 40%');
  assert.strictEqual(c.kind, 'blend');
  assert.deepStrictEqual(c.parts.map(p => p.name), ['카베르네 소비뇽', '메를로']);
  assert.deepStrictEqual(c.parts.map(p => p.pct), ['60%', '40%']);
  assert.strictEqual(C('그르나슈, 시라, 무르베드르').parts.length, 3);
  assert.strictEqual(C('Grenache + Syrah').kind, 'blend');
});

t('같은 품종을 두 나라 이름으로 적은 건 블렌딩이 아님', () => {
  assert.strictEqual(C('시라/쉬라즈').kind, 'single');
  assert.strictEqual(C('피노 누아(슈페트부르군더)').kind, 'single');
});

t('"블렌드"라고만 적혀 있어도 블렌딩', () => {
  assert.strictEqual(C('레드 블렌드').kind, 'blend');
  const b = C('보르도 블렌드 (카베르네 소비뇽, 메를로)');
  assert.strictEqual(b.kind, 'blend');
  assert.deepStrictEqual(b.parts.map(p => p.name), ['카베르네 소비뇽', '메를로']);
});

t('목록에 없는 품종은 적힌 이름 그대로, 빈 칸은 품종 미상', () => {
  const c = C('사페라비');
  assert.strictEqual(c.kind, 'single');
  assert.strictEqual(c.label, '사페라비');
  assert.strictEqual(C('').kind, 'unknown');
  assert.strictEqual(C(undefined).kind, 'unknown');
});

console.log(passed + '개 통과');
