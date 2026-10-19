// ============================================================
// tests/backend_test.js — Code.gs 백엔드 검증 (데이터 보호 중심)
//
// 실제 구글 시트 대신 메모리 안의 가짜 시트/드라이브/속성 저장소를 만들고,
// Code.gs를 고치지 않은 그대로 node:vm에서 실행해 API를 불러 본다.
//   node tests/backend_test.js
// 실패하면 종료 코드 1. 외부 패키지가 필요 없다.
// ============================================================
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');
const assert = require('assert');

const CODE = fs.readFileSync(path.join(__dirname, '..', 'Code.gs'), 'utf8');

/* ---------- 가짜 Apps Script 환경 ---------- */

function toBytes(buf) { return Array.from(buf).map(b => (b > 127 ? b - 256 : b)); }
function fromBytes(v) { return Array.isArray(v) ? Buffer.from(v.map(b => b & 255)) : Buffer.from(String(v), 'utf8'); }

class FakeRange {
  constructor(sheet, r, c, nr, nc) { Object.assign(this, { sheet, r, c, nr: nr || 1, nc: nc || 1 }); }
  _cells(fn) {
    const out = [];
    for (let i = 0; i < this.nr; i++) {
      const row = [];
      for (let j = 0; j < this.nc; j++) row.push(fn(this.r + i, this.c + j));
      out.push(row);
    }
    return out;
  }
  getValues() { return this._cells((r, c) => this.sheet.get(r, c)); }
  getFormulas() { return this._cells((r, c) => this.sheet.getF(r, c)); }
  getValue() { return this.sheet.get(this.r, this.c); }
  setValue(v) { this.sheet.set(this.r, this.c, v); return this; }
  setValues(vals) {
    assert.strictEqual(vals.length, this.nr, 'setValues 행 수 불일치');
    vals.forEach((row, i) => {
      assert.strictEqual(row.length, this.nc, 'setValues 열 수 불일치');
      row.forEach((v, j) => this.sheet.set(this.r + i, this.c + j, v));
    });
    return this;
  }
  setNumberFormat() { return this; }
}

class FakeSheet {
  constructor(name, rows) { this.name = name; this.rows = rows || []; this.formulas = {}; this.hidden = false; }
  getName() { return this.name; }
  get(r, c) { const row = this.rows[r - 1]; const v = row ? row[c - 1] : undefined; return v === undefined || v === null ? '' : v; }
  getF(r, c) { return this.formulas[r + ':' + c] || ''; }
  set(r, c, v) {
    while (this.rows.length < r) this.rows.push([]);
    const row = this.rows[r - 1];
    while (row.length < c) row.push('');
    if (typeof v === 'string' && v[0] === '=') { this.formulas[r + ':' + c] = v; row[c - 1] = '(계산값)'; }
    else { delete this.formulas[r + ':' + c]; row[c - 1] = v; }
  }
  getLastRow() {
    for (let i = this.rows.length; i > 0; i--) if (this.rows[i - 1].some(v => v !== '' && v !== undefined && v !== null)) return i;
    return 0;
  }
  getLastColumn() {
    let max = 0;
    this.rows.forEach(row => { for (let j = row.length; j > max; j--) if (row[j - 1] !== '' && row[j - 1] !== undefined) { max = j; break; } });
    return max;
  }
  getRange(r, c, nr, nc) { return new FakeRange(this, r, c, nr, nc); }
  getDataRange() { return new FakeRange(this, 1, 1, Math.max(this.getLastRow(), 1), Math.max(this.getLastColumn(), 1)); }
  appendRow(vals) { const r = this.getLastRow() + 1; vals.forEach((v, j) => this.set(r, j + 1, v)); }
  deleteRow(r) { this.rows.splice(r - 1, 1); }
  hideSheet() { this.hidden = true; }
}

function makeEnv(opts) {
  opts = opts || {};
  const props = Object.assign({}, opts.props || {});
  const cache = {};
  const drive = { files: {}, folders: {}, copies: [], failCopy: false, nextId: 1 };
  const ss = {
    id: 'SS1',
    sheets: opts.sheets,
    getName() { return '와인리스트'; },
    getId() { return this.id; },
    getSheets() { return this.sheets; },
    getSheetByName(n) { return this.sheets.find(s => s.name === n) || null; },
    insertSheet(n) { const s = new FakeSheet(n, []); this.sheets.push(s); return s; },
  };
  function snapshot() { return JSON.stringify(ss.sheets.map(s => ({ name: s.name, rows: s.rows }))); }
  function folderObj(id) {
    return {
      getId: () => id,
      getFiles() {
        const list = Object.values(drive.files).filter(f => f.folder === id && !f.trashed);
        let i = 0;
        return { hasNext: () => i < list.length, next: () => list[i++] };
      },
      createFile(blob) { const fid = 'F' + drive.nextId++; drive.files[fid] = fileObj(fid, 'photo', id); return drive.files[fid]; },
    };
  }
  function fileObj(id, name, folder, created) {
    return {
      id, name, folder, trashed: false, created: created || new Date(),
      getId() { return id; }, getName() { return this.name; },
      getDateCreated() { return this.created; },
      setTrashed(v) { this.trashed = v; },
      setSharing() {},
    };
  }
  const now = { t: Date.now() };
  const ctx = {
    console,
    Logger: { log() {} },
    Session: { getScriptTimeZone: () => 'UTC' },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: k => (k in props ? props[k] : null),
        setProperty: (k, v) => { props[k] = String(v); },
        setProperties: o => { Object.keys(o).forEach(k => { props[k] = String(o[k]); }); },
        deleteProperty: k => { delete props[k]; },
      }),
    },
    LockService: { getScriptLock: () => ({ tryLock: () => true, waitLock: () => {}, releaseLock: () => {} }) },
    CacheService: {
      getScriptCache: () => ({
        get: k => (k in cache ? cache[k] : null),
        put: (k, v) => { cache[k] = String(v); },
        remove: k => { delete cache[k]; },
      }),
    },
    SpreadsheetApp: { getActiveSpreadsheet: () => ss, openById: () => ss },
    ContentService: { createTextOutput: s => ({ content: s, setMimeType() { return this; } }), MimeType: { JSON: 'json' } },
    DriveApp: {
      Access: { ANYONE_WITH_LINK: 1 }, Permission: { VIEW: 1 },
      getFileById(id) {
        assert.strictEqual(id, ss.id);
        return {
          makeCopy(name, folder) {
            if (drive.failCopy) throw new Error('드라이브 용량 부족(테스트)');
            const fid = 'B' + drive.nextId++;
            drive.files[fid] = fileObj(fid, name, folder.getId());
            drive.copies.push({ name, data: snapshot() });
            return drive.files[fid];
          },
        };
      },
      getFolderById(id) { if (!drive.folders[id]) throw new Error('없음'); return folderObj(id); },
      getFoldersByName(n) {
        const id = Object.keys(drive.folders).find(k => drive.folders[k] === n);
        let used = false;
        return { hasNext: () => !!id && !used, next: () => { used = true; return folderObj(id); } };
      },
      createFolder(n) { const id = 'D' + drive.nextId++; drive.folders[id] = n; return folderObj(id); },
    },
    UrlFetchApp: { fetch: () => { throw new Error('UrlFetchApp 목업이 설정되지 않음'); } },
    Utilities: {
      Charset: { UTF_8: 'UTF-8' },
      DigestAlgorithm: { SHA_256: 'sha256' },
      base64Encode: v => fromBytes(v).toString('base64'),
      base64EncodeWebSafe: v => fromBytes(v).toString('base64').replace(/\+/g, '-').replace(/\//g, '_'),
      base64Decode: s => toBytes(Buffer.from(s, 'base64')),
      base64DecodeWebSafe: s => toBytes(Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64')),
      newBlob: bytes => ({ getDataAsString: () => fromBytes(bytes).toString('utf8') }),
      computeDigest: (alg, s) => toBytes(crypto.createHash('sha256').update(fromBytes(s)).digest()),
      computeHmacSha256Signature: (v, k) => toBytes(crypto.createHmac('sha256', fromBytes(k)).update(fromBytes(v)).digest()),
      formatDate: (d, tz, fmt) => {
        const p = n => String(n).padStart(2, '0');
        return fmt.replace('yyyy', d.getUTCFullYear()).replace('MM', p(d.getUTCMonth() + 1)).replace('dd', p(d.getUTCDate()))
          .replace('HH', p(d.getUTCHours())).replace('mm', p(d.getUTCMinutes())).replace('ss', p(d.getUTCSeconds()));
      },
      sleep: () => {},
    },
    ScriptApp: { getService: () => ({ getUrl: () => '' }) },
  };
  vm.createContext(ctx);
  vm.runInContext(CODE, ctx, { filename: 'Code.gs' });

  function call(action, params) {
    const p = Object.assign({ action }, params || {});
    const out = ctx.route_(p);
    return JSON.parse(out.content);
  }
  return { ctx, props, cache, drive, ss, call, snapshot };
}

/* ---------- 기존 데이터가 들어 있는 시트(배포 전 상태) ---------- */

const OLD_WINE_HEADERS = ['와인명', '종류', '품종', '빈티지', '생산지/국가', '상태', '등록일', '마신날짜', '평점', '소유자'];
function oldSheets() {
  return [
    new FakeSheet('와인', [
      OLD_WINE_HEADERS.slice(),
      ['샤토 A', '레드', '메를로', '2018', '프랑스', '보유', '2026-01-01', '', '', 'kim'],
      ['샤토 B', '화이트', '샤르도네', '2020', '프랑스', '마심', '2026-01-02', '2026-02-01', 4, 'kim'],
      ['남의 와인', '레드', '시라', '2019', '호주', '보유', '2026-01-03', '', '', 'lee'],
    ]),
  ];
}

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ✓ ' + name); }
  catch (e) { console.error('  ✗ ' + name + '\n    ' + (e.stack || e)); process.exitCode = 1; }
}

console.log('backend_test');

test('배포 후 첫 요청: 컬럼을 바꾸기 전에 백업을 먼저 만들고, 기존 값은 그대로 둔다', () => {
  const env = makeEnv({ sheets: oldSheets() });
  const before = env.ss.sheets[0].rows.map(r => r.slice());
  env.call('checkToken', { token: '' });
  assert.strictEqual(env.drive.copies.length, 1, '백업 1개');
  // 백업 사본은 컬럼을 붙이기 전 상태여야 한다
  const backedUp = JSON.parse(env.drive.copies[0].data)[0].rows;
  assert.deepStrictEqual(backedUp, before);
  const headers = env.ss.sheets[0].rows[0];
  assert.deepStrictEqual(headers.slice(0, OLD_WINE_HEADERS.length), OLD_WINE_HEADERS, '기존 헤더 순서 유지');
  assert(headers.includes('삭제일') && headers.includes('삭제전상태'), '새 컬럼은 끝에 추가');
  for (let i = 1; i < before.length; i++) {
    assert.deepStrictEqual(env.ss.sheets[0].rows[i].slice(0, before[i].length), before[i], (i + 1) + '행 값 유지');
  }
  // 같은 버전에서는 다시 백업하지 않는다
  env.call('checkToken', { token: '' });
  assert.strictEqual(env.drive.copies.length, 1);
});

function setupUser(env, name, pw) {
  const r = env.call('enter', { name, pw });
  assert(r.ok, JSON.stringify(r));
  return r.token;
}

test('사용자 시트에 토큰버전 칸이 생기고, 기존 사용자 값은 그대로', () => {
  const sheets = oldSheets();
  const env0 = makeEnv({ sheets });
  setupUser(env0, 'kim', '1234');
  // 예전 버전처럼 6칸짜리 사용자 시트로 되돌려 놓고 새 버전 배포를 흉내낸다
  const us = sheets.find(s => s.name === '사용자');
  us.rows = us.rows.map(r => r.slice(0, 6));
  const env = makeEnv({ sheets, props: { AUTH_SECRET: env0.props.AUTH_SECRET } });
  const before = us.rows.map(r => r.slice());
  env.call('checkToken', { token: '' });
  assert.strictEqual(us.rows[0][6], '토큰버전');
  assert.deepStrictEqual(us.rows[1].slice(0, 6), before[1]);
});

test('사용자 시트 칸 제목이 예상과 다르면 덮어쓰지 않는다', () => {
  const sheets = oldSheets();
  sheets.push(new FakeSheet('사용자', [['아이디', '이름', '비번해시', '솔트', '가입일', '마지막로그인', '메모(손으로 적음)']]));
  const env = makeEnv({ sheets });
  env.call('checkToken', { token: '' });
  assert.strictEqual(sheets[1].rows[0][6], '메모(손으로 적음)');
  assert(!env.props.SETUP_DONE, '설정 완료로 표시하지 않음');
});

test('와인 삭제는 휴지통으로만 — 행은 남고, 목록에서 빠지고, 원래 상태로 되살아난다', () => {
  const env = makeEnv({ sheets: oldSheets() });
  const token = setupUser(env, 'kim', '1234');
  const sheet = env.ss.sheets[0];
  const rowsBefore = sheet.getLastRow();
  let r = env.call('deleteWine', { token, row: 3, expectedName: '샤토 B' });
  assert(r.ok, JSON.stringify(r));
  assert.strictEqual(sheet.getLastRow(), rowsBefore, '행 수 그대로');
  assert.strictEqual(sheet.get(3, 1), '샤토 B', '데이터 그대로');
  const names = env.call('getWines', { token }).wines.map(w => w['와인명']);
  assert.deepStrictEqual(names, ['샤토 A']);
  const del = env.call('getDeletedWines', { token });
  assert.strictEqual(del.length, 1);
  assert.strictEqual(del[0]['삭제전상태'], '마심');
  // 휴지통에 있는 동안엔 마시기·수정 등은 막힌다
  r = env.call('markDrunk', { token, row: 3, info: {}, expectedName: '샤토 B' });
  assert(/삭제된 와인/.test(r.error), JSON.stringify(r));
  r = env.call('restoreWine', { token, row: 3, expectedName: '샤토 B' });
  assert(r.ok && r.status === '마심', JSON.stringify(r));
  assert.strictEqual(env.call('getWines', { token }).wines.length, 2);
  assert.strictEqual(env.call('getDeletedWines', { token }).length, 0);
});

test('남의 와인은 삭제·되살리기 모두 안 된다', () => {
  const env = makeEnv({ sheets: oldSheets() });
  const token = setupUser(env, 'kim', '1234');
  assert(/내 와인이 아니에요/.test(env.call('deleteWine', { token, row: 4 }).error));
  assert(/내 와인이 아니에요/.test(env.call('restoreWine', { token, row: 4 }).error));
});

test('마시기/되돌리기: 그 사이 행이 바뀌었으면 거절하고 아무것도 안 쓴다', () => {
  const env = makeEnv({ sheets: oldSheets() });
  const token = setupUser(env, 'kim', '1234');
  const sheet = env.ss.sheets[0];
  const before = JSON.stringify(sheet.rows);
  let r = env.call('markDrunk', { token, row: 2, info: { '평점': 5 }, expectedName: '샤토 B' });
  assert(/목록이 바뀌었어요/.test(r.error), JSON.stringify(r));
  r = env.call('unmarkDrunk', { token, row: 3, expectedName: '샤토 A' });
  assert(/목록이 바뀌었어요/.test(r.error), JSON.stringify(r));
  assert.strictEqual(JSON.stringify(sheet.rows), before);
  r = env.call('markDrunk', { token, row: 2, info: { '평점': 5 }, expectedName: '샤토 A' });
  assert(r.ok);
  assert.strictEqual(sheet.get(2, 6), '마심');
  // 예전 버전 화면(와인명 안 보냄)도 계속 동작한다
  r = env.call('unmarkDrunk', { token, row: 2 });
  assert(r.ok);
});

test('비밀번호 5번 틀리면 맞는 비번도 잠시 막히고, 잠금이 풀리면 다시 들어온다', () => {
  const env = makeEnv({ sheets: oldSheets() });
  setupUser(env, 'kim', '1234');
  for (let i = 0; i < 4; i++) assert(/맞지 않아요/.test(env.call('enter', { name: 'kim', pw: '0000' }).error));
  assert(/잠겼어요/.test(env.call('enter', { name: 'kim', pw: '0000' }).error));
  assert(/잠겼어요/.test(env.call('enter', { name: 'kim', pw: '1234' }).error), '잠긴 동안은 맞는 비번도 거절');
  Object.keys(env.cache).forEach(k => delete env.cache[k]); // 10분 지남
  assert(env.call('enter', { name: 'kim', pw: '1234' }).ok);
});

test('비밀번호를 바꾸면 예전 토큰은 무효, 새 토큰은 유효', () => {
  const env = makeEnv({ sheets: oldSheets() });
  const oldToken = setupUser(env, 'kim', '1234');
  const otherDevice = env.call('enter', { name: 'kim', pw: '1234' }).token;
  const r = env.call('changePassword', { token: oldToken, newPw: '5678' });
  assert(r.ok && r.token, JSON.stringify(r));
  assert.strictEqual(env.call('checkToken', { token: otherDevice }).ok, false);
  assert.strictEqual(env.call('getWines', { token: otherDevice }).error, '로그인이 필요해요');
  assert.strictEqual(env.call('checkToken', { token: r.token }).ok, true);
  assert.strictEqual(env.call('getWines', { token: r.token }).wines.length, 2);
  assert(env.call('enter', { name: 'kim', pw: '5678' }).ok);
  assert(env.call('enter', { name: 'kim', pw: '1234' }).error);
});

test('업데이트 전에 받아 둔 예전 형식(v2) 토큰은 그대로 로그인 유지', () => {
  const env = makeEnv({ sheets: oldSheets() });
  setupUser(env, 'kim', '1234');
  const payload = '2|' + encodeURIComponent('kim') + '|' + (Date.now() + 86400000);
  const v2 = env.ctx.Utilities.base64EncodeWebSafe(payload + '|' + env.ctx.sign_(payload));
  assert.strictEqual(env.call('checkToken', { token: v2 }).ok, true);
  assert.strictEqual(env.call('getWines', { token: v2 }).wines.length, 2);
});

test('쓰기 요청 전에 하루 한 번 자동 백업 (읽기 요청은 백업 안 함)', () => {
  const env = makeEnv({ sheets: oldSheets() });
  const token = setupUser(env, 'kim', '1234');
  const n = env.drive.copies.length;
  env.call('getWines', { token });
  env.call('updateWine', { token, row: 2, data: { '메모': 'x' }, expectedName: '샤토 A' });
  assert.strictEqual(env.drive.copies.length, n, '방금 백업했으면 다시 안 함');
  env.props.LAST_BACKUP_AT = String(Date.now() - 25 * 3600 * 1000);
  env.call('getWines', { token });
  assert.strictEqual(env.drive.copies.length, n, '읽기는 백업 안 함');
  env.call('markDrunk', { token, row: 2, info: {}, expectedName: '샤토 A' });
  assert.strictEqual(env.drive.copies.length, n + 1, '하루 지난 뒤 첫 쓰기 전에 백업');
  assert.strictEqual(JSON.parse(env.drive.copies[n].data)[0].rows[1][5], '보유', '백업은 바꾸기 전 상태');
});

test('백업이 실패해도 일반 쓰기는 진행되고, 오류는 기록되며, 매 요청마다 재시도하지 않는다', () => {
  const env = makeEnv({ sheets: oldSheets() });
  const token = setupUser(env, 'kim', '1234');
  env.drive.failCopy = true;
  env.props.LAST_BACKUP_AT = '0';
  assert(env.call('updateWine', { token, row: 2, data: { '메모': 'a' }, expectedName: '샤토 A' }).ok);
  assert(/용량 부족/.test(env.props.LAST_BACKUP_ERROR));
  const failAt = env.props.LAST_BACKUP_FAIL_AT;
  assert(env.call('updateWine', { token, row: 2, data: { '메모': 'b' }, expectedName: '샤토 A' }).ok);
  assert.strictEqual(env.props.LAST_BACKUP_FAIL_AT, failAt, '1시간 안에는 재시도 안 함');
});

test('계정 삭제: 백업을 못 만들면 아무것도 지우지 않는다', () => {
  const env = makeEnv({ sheets: oldSheets() });
  const admin = setupUser(env, 'dkmk', '0000');
  setupUser(env, 'kim', '1234');
  const before = env.snapshot();
  env.drive.failCopy = true;
  const r = env.call('deleteUserAccount', { token: admin, id: 'kim' });
  assert(/백업을 만들지 못해서/.test(r.error), JSON.stringify(r));
  assert.strictEqual(env.snapshot(), before);
  env.drive.failCopy = false;
  const n = env.drive.copies.length;
  assert(env.call('deleteUserAccount', { token: admin, id: 'kim' }).ok);
  assert.strictEqual(env.drive.copies.length, n + 1);
  assert(JSON.parse(env.drive.copies[n].data)[0].rows.some(r => r[0] === '샤토 A'), '삭제 전 데이터가 백업에 있음');
});

test('오래된 백업 정리: 60개를 넘어도 30일이 안 지난 사본은 안 지운다', () => {
  const env = makeEnv({ sheets: oldSheets() });
  env.call('checkToken', { token: '' });
  const folderId = env.props.BACKUP_FOLDER_ID;
  const old = new Date(Date.now() - 40 * 86400000);
  for (let i = 0; i < 70; i++) {
    const created = i < 5 ? old : new Date(Date.now() - i * 1000);
    env.drive.files['X' + i] = {
      name: '[백업] t' + i, folder: folderId, trashed: false, created,
      getName() { return this.name; }, getDateCreated() { return this.created; }, setTrashed(v) { this.trashed = v; },
    };
  }
  env.ctx.pruneBackups_();
  const trashed = Object.values(env.drive.files).filter(f => f.trashed);
  assert.strictEqual(trashed.length, 5, '40일 지난 5개만 휴지통으로');
  assert(trashed.every(f => f.created === old));
});

test('와인 추가는 새 행 번호를 정확히 돌려주고 기존 행을 덮어쓰지 않는다', () => {
  const env = makeEnv({ sheets: oldSheets() });
  const token = setupUser(env, 'kim', '1234');
  const r = env.call('addWine', { token, data: { '와인명': '새 와인' } });
  assert.strictEqual(r.rowIndex, 5);
  const m = env.call('addWines', { token, list: [{ '와인명': 'C' }, { '와인명': 'D' }] });
  assert.deepStrictEqual(m.rowIndexes, [6, 7]);
  assert.deepStrictEqual(env.ss.sheets[0].rows.slice(1, 4).map(r => r[0]), ['샤토 A', '샤토 B', '남의 와인']);
});

test('AI 정보 채우기: 기다리는 사이 행이 바뀌면 안 쓰고, 수식 칸은 수식 그대로 둔다', () => {
  const env = makeEnv({ sheets: oldSheets() });
  const token = setupUser(env, 'kim', '1234');
  const sheet = env.ss.sheets[0];
  const memoCol = sheet.rows[0].indexOf('메모') + 1 || sheet.rows[0].length + 1;
  if (!sheet.rows[0].includes('메모')) sheet.set(1, memoCol, '메모');
  sheet.set(2, memoCol, '=A2&"!"');
  const ai = { candidates: [{ content: { parts: [{ text: JSON.stringify({ '서빙온도': '16-18°C', '테이스팅노트': '체리' }) }] } }] };
  env.props.GEMINI_API_KEY = 'k';
  // 1) 정상: 빈 칸만 채우고 수식은 유지
  env.ctx.UrlFetchApp.fetch = () => ({ getResponseCode: () => 200, getContentText: () => JSON.stringify(ai) });
  let r = env.call('suggestWineInfo', { token, row: 2 });
  assert.strictEqual(r['서빙온도'], '16-18°C', JSON.stringify(r));
  assert.strictEqual(sheet.getF(2, memoCol), '=A2&"!"', '수식 보존');
  assert.strictEqual(sheet.get(2, 1), '샤토 A');
  // 2) AI를 기다리는 사이 그 행이 다른 와인으로 바뀜
  env.ctx.UrlFetchApp.fetch = () => { sheet.set(3, 1, '바뀐 와인'); return { getResponseCode: () => 200, getContentText: () => JSON.stringify(ai) }; };
  const before = JSON.stringify(sheet.rows[2]);
  r = env.call('suggestWineInfo', { token, row: 3 });
  assert(/목록이 바뀌었어요/.test(r.error), JSON.stringify(r));
  assert.strictEqual(JSON.stringify(sheet.rows[2]), before.replace('샤토 B', '바뀐 와인'), '바뀐 행에 AI 값을 안 씀');
});

console.log(passed + '개 통과' + (process.exitCode ? ' (실패 있음)' : ''));
