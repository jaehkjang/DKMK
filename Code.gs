/**
 * 와인 셀러 앱 백엔드 — 순수 JSON API.
 *
 * 화면(HTML/CSS/JS)은 이 파일이 서빙하지 않습니다. GitHub Pages에 올라간
 * 정적 페이지(api.js)가 이 API를 fetch()로 호출하는 구조입니다(온그린과 동일).
 * 그래서 이 파일에는 화면 관련 코드가 전혀 없고, doGet/doPost가 action 이름으로
 * 아래 함수들에 요청을 그대로 넘겨주는 라우터 역할만 합니다.
 *
 * 최초 1회 설정:
 * 1) 프로젝트 설정 → 스크립트 속성에 추가
 *    - GEMINI_API_KEY   : Gemini API 무료 키 (https://aistudio.google.com/apikey 에서 발급)
 *    - SHEET_ID         : (B 방식일 때만) 와인리스트 스프레드시트 ID
 * 2) 배포 → 웹 앱. 첫 요청 때 컬럼 설정이 자동으로 끝납니다.
 *    코드를 고친 뒤에는 [배포 관리] → 연필(수정) → 버전: 새 버전 → 배포
 *    (이렇게 해야 주소가 그대로 유지됩니다. [새 배포]를 누르면 주소가 바뀝니다)
 * 3) 배포 후 나온 웹 앱 URL을 api.js의 API.URL에 붙여넣습니다.
 *
 * 웹 앱 배포 설정: 실행 계정 "나", 액세스 "모든 사용자" (그래야 GitHub Pages에서
 * 로그인 없이 fetch가 통과합니다 — 로그인은 이 앱 자체의 셀러 이름/비번이 대신합니다).
 *
 * 셀러(계정):
 *  - 첫 화면에서 이름과 비밀번호(4자리 숫자)만 넣습니다. 처음 보는 이름이면 셀러를
 *    새로 만들고, 이미 있는 이름이면 비번을 확인하고 그 셀러로 들어갑니다.
 *  - 그래서 같은 이름·비번을 아는 사람끼리 셀러 하나를 같이 씁니다(부부 공유).
 *  - 셀러가 다르면 서로의 와인이 보이지 않습니다(소유자 컬럼으로 분리).
 *  - 맨 처음 만든 셀러가 기존에 쌓여 있던(소유자 없는) 와인을 넘겨받습니다.
 *  - 비번은 솔트 + SHA-256 반복 해시로 저장하며, 원문은 어디에도 남지 않습니다.
 */

var NEW_COLUMNS = ['어울리는잔', '서빙방법', '와인배경', '평점', '한줄평', '함께한음식', '라벨사진', '소유자',
  '서빙온도', '에어링시간', '완벽한잔', '완벽한잔별점', '내잔추천', '내잔추천별점', '추천페어링별점', '재구매의향',
  '베스트페어링', '베스트페어링별점'];
var PHOTO_FOLDER_NAME = '와인라벨사진';

/* ===================== API 라우터 ===================== */

/**
 * 읽기 요청. 쿼리스트링만 쓰는 "단순 요청"이라 브라우저가 프리플라이트를 안 붙인다.
 * 예: ?action=getWines&token=...
 */
function doGet(e) {
  return route_((e && e.parameter) || {});
}

/**
 * 쓰기 요청(또는 사진처럼 큰 데이터). Content-Type을 text/plain으로 보내야
 * "단순 요청"으로 취급돼 프리플라이트가 안 붙는다 — 그래서 본문은 JSON 문자열이지만
 * 여기서 직접 JSON.parse 한다.
 */
function doPost(e) {
  var body = {};
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return json_({ error: '요청 형식이 잘못됐어요' });
  }
  return route_(body);
}

function route_(params) {
  ensureSetup_();
  var action = params.action;
  try {
    return json_(dispatch_(action, params));
  } catch (err) {
    return json_({ error: err.message || String(err) });
  }
}

function dispatch_(action, p) {
  var token = p.token;
  switch (action) {
    case 'enter':            return enter(p.name, p.pw);
    case 'checkToken':       return checkToken(token);
    case 'changePassword':   return changePassword(token, p.newPw);
    case 'getWines':         return getWines(token);
    case 'addWine':          return addWine(token, p.data, p.photo);
    case 'addWines':         return addWines(token, p.list);
    case 'updateWine':       return updateWine(token, p.row, p.data, p.photo);
    case 'deleteWine':       return deleteWine(token, p.row);
    case 'markDrunk':        return markDrunk(token, p.row, p.info);
    case 'unmarkDrunk':      return unmarkDrunk(token, p.row);
    case 'recognizeLabel':   return recognizeLabel(token, p.photo);
    case 'recognizeCellar':  return recognizeCellar(token, p.photo);
    case 'getDrunkMatches':  return getDrunkMatches(token, p.keyword);
    case 'recommendByFood':  return recommendByFood(token, p.food);
    case 'getStats':         return getStats(token);
    case 'getGlasses':       return getGlasses(token);
    case 'addGlass':         return addGlass(token, p.name);
    case 'deleteGlass':      return deleteGlass(token, p.row);
    case 'suggestWineInfo':  return suggestWineInfo(token, p.row);
    default: throw new Error('알 수 없는 요청이에요: ' + action);
  }
}

/** Apps Script 웹 앱은 커스텀 CORS 헤더를 못 붙이지만, 이 방식의 응답은 자동으로 허용된다. */
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* ===================== 설정 ===================== */

/** 최초 1회: 새 컬럼 헤더를 시트 끝에 추가 (기존 데이터는 건드리지 않음) */
function setupColumns() {
  var sheet = getSheet_();
  var headers = getHeaders_();
  var lastCol = sheet.getLastColumn();
  NEW_COLUMNS.forEach(function (name) {
    if (headers.indexOf(name) === -1) {
      lastCol += 1;
      sheet.getRange(1, lastCol).setValue(name);
    }
  });
}

/**
 * 첫 요청 때 컬럼 설정을 알아서 끝낸다.
 * 한 번 성공하면 SETUP_DONE 표시가 남아 다시 돌지 않는다.
 */
function ensureSetup_() {
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty('SETUP_DONE') === '1') return;
  try {
    setupColumns();
    props.setProperty('SETUP_DONE', '1');
  } catch (err) {
    // 설정이 실패해도 API는 계속 동작하게 둔다. 원인은 checkSetup으로 확인.
    Logger.log('자동 설정 실패: ' + err.message);
  }
}

/** 수동으로 다시 설정하고 싶을 때 (자동 설정이 실패했을 때 등) */
function setup() {
  PropertiesService.getScriptProperties().deleteProperty('SETUP_DONE');
  setupColumns();
  Logger.log('설정 완료. [배포 관리] → 연필(수정) → 버전: 새 버전 → 배포 를 해주세요.');
}

/** 설정이 제대로 됐는지 점검한다. 에디터에서 실행하고 실행 로그를 보면 된다. */
function checkSetup() {
  var lines = [];
  var sheetId = prop_('SHEET_ID');
  var gem = prop_('GEMINI_API_KEY');

  if (!gem) {
    lines.push('GEMINI_API_KEY  : 없음 (사진 인식/AI 추천만 못 씀)');
  } else {
    try {
      callGemini_([{ text: '{"ok":true} 라고만 답하세요.' }]);
      lines.push('GEMINI_API_KEY  : 설정됨, 정상 동작 확인');
    } catch (err) {
      lines.push('GEMINI_API_KEY  : ❌ ' + err.message);
    }
  }
  lines.push('SHEET_ID        : ' + (sheetId ? sheetId : '없음 (시트에 붙인 방식이면 정상)'));

  try {
    var sheet = getSheet_();
    lines.push('시트 연결       : OK — "' + sheet.getName() + '", ' + (sheet.getLastRow() - 1) + '행');
    var headers = getHeaders_();
    var missing = NEW_COLUMNS.filter(function (c) { return headers.indexOf(c) === -1; });
    lines.push('신규 컬럼       : ' + (missing.length ? '❌ 없음 → ' + missing.join(', ') + ' (setup 실행 필요)' : 'OK'));
  } catch (err) {
    lines.push('시트 연결       : ❌ ' + err.message);
  }

  try {
    lines.push('웹 앱 주소      : ' + (ScriptApp.getService().getUrl() || '아직 배포 안 됨'));
  } catch (err) {
    lines.push('웹 앱 주소      : 아직 배포 안 됨');
  }

  var out = lines.join('\n');
  Logger.log(out);
  return out;
}

/**
 * 스프레드시트 가져오기.
 * SHEET_ID 속성이 있으면 그걸로 열고(따로 만든 프로젝트), 없으면 붙어 있는 시트를 쓴다.
 */
function getSS_() {
  var id = prop_('SHEET_ID');
  if (id) return SpreadsheetApp.openById(id);

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error('시트를 찾을 수 없어요. 프로젝트 설정 → 스크립트 속성에 SHEET_ID를 추가해주세요.');
  }
  return ss;
}

function getSheet_() {
  return getSS_().getSheets()[0];
}

function getHeaders_() {
  var sheet = getSheet_();
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
}

function colIndex1_(headers, name) {
  var idx = headers.indexOf(name);
  if (idx === -1) throw new Error('컬럼을 찾을 수 없습니다: ' + name + ' (setupColumns를 먼저 실행하세요)');
  return idx + 1;
}

function todayStr_() {
  var tz = Session.getScriptTimeZone() || 'Asia/Seoul';
  return Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
}

function prop_(key) {
  return PropertiesService.getScriptProperties().getProperty(key);
}

/* ===================== 계정 ===================== */

var USER_SHEET = '사용자';
var USER_COLUMNS = ['아이디', '이름', '비번해시', '솔트', '가입일', '마지막로그인'];
var OWNER_COLUMN = '소유자';
var HASH_ROUNDS = 1000;
var TOKEN_DAYS = 365;

/** 사용자 시트 (없으면 만든다) */
function userSheet_() {
  var ss = getSS_();
  var sh = ss.getSheetByName(USER_SHEET);
  if (!sh) {
    sh = ss.insertSheet(USER_SHEET);
    sh.getRange(1, 1, 1, USER_COLUMNS.length).setValues([USER_COLUMNS]);
    sh.hideSheet();
  }
  return sh;
}

function userRows_() {
  var sh = userSheet_();
  var last = sh.getLastRow();
  if (last < 2) return [];
  var values = sh.getRange(2, 1, last - 1, USER_COLUMNS.length).getValues();
  return values.map(function (r, i) {
    var o = { rowIndex: i + 2 };
    USER_COLUMNS.forEach(function (c, j) { o[c] = r[j]; });
    return o;
  });
}

function findUser_(id) {
  var target = String(id || '').trim().toLowerCase();
  if (!target) return null;
  var rows = userRows_();
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i]['아이디']).trim().toLowerCase() === target) return rows[i];
  }
  return null;
}

function randomHex_(bytes) {
  var out = '';
  for (var i = 0; i < bytes; i++) {
    out += ('0' + Math.floor(Math.random() * 256).toString(16)).slice(-2);
  }
  return out;
}

/**
 * 비번 해시. Apps Script에는 bcrypt가 없어서 솔트 + SHA-256 반복으로 대신한다.
 * 평문이나 단순 해시보다 무차별 대입에 훨씬 오래 버틴다.
 */
function hashPw_(pw, salt) {
  var cur = salt + '|' + pw;
  for (var i = 0; i < HASH_ROUNDS; i++) {
    cur = Utilities.base64Encode(
      Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, cur, Utilities.Charset.UTF_8)
    );
  }
  return cur;
}

/** 토큰 서명용 비밀키 (없으면 만들어 저장) */
function authSecret_() {
  var props = PropertiesService.getScriptProperties();
  var s = props.getProperty('AUTH_SECRET');
  if (!s) {
    s = randomHex_(32);
    props.setProperty('AUTH_SECRET', s);
  }
  return s;
}

function sign_(payload) {
  return Utilities.base64EncodeWebSafe(
    Utilities.computeHmacSha256Signature(payload, authSecret_())
  );
}

/** 서명된 토큰. 서버에 세션을 따로 저장하지 않아도 위조를 막을 수 있다. */
function makeToken_(userId) {
  var exp = Date.now() + TOKEN_DAYS * 24 * 60 * 60 * 1000;
  var payload = userId + '|' + exp;
  return Utilities.base64EncodeWebSafe(payload + '|' + sign_(payload));
}

function verifyToken_(token) {
  if (!token) return null;
  try {
    var raw = Utilities.newBlob(Utilities.base64DecodeWebSafe(String(token))).getDataAsString();
    var parts = raw.split('|');
    if (parts.length !== 3) return null;
    var payload = parts[0] + '|' + parts[1];
    if (sign_(payload) !== parts[2]) return null;
    if (Number(parts[1]) < Date.now()) return null;
    return parts[0];
  } catch (err) {
    return null;
  }
}

/** 토큰에서 사용자를 꺼낸다. 유효하지 않으면 예외. 모든 데이터 함수의 첫 관문. */
function requireUser_(token) {
  var id = verifyToken_(token);
  if (!id) throw new Error('로그인이 필요해요');
  var user = findUser_(id);
  if (!user) throw new Error('계정을 찾을 수 없어요');
  return user;
}

/** 이름을 조회 키로 정규화 (대소문자·앞뒤 공백 무시 → 같은 셀러로 들어가게) */
function normName_(name) {
  return String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * 셀러 입장. 회원가입과 로그인이 하나다.
 *  - 처음 보는 이름이면 셀러를 새로 만든다
 *  - 이미 있는 이름이면 비번을 확인하고 그 셀러로 들어간다
 * 그래서 같은 이름·비번을 아는 사람끼리 하나의 셀러를 같이 쓴다.
 */
function enter(name, pw) {
  var display = String(name || '').trim();
  pw = String(pw || '');
  var key = normName_(display);

  if (key.length < 2) return { error: '이름은 2자 이상이어야 해요' };
  if (!/^\d{4}$/.test(pw)) return { error: '비밀번호는 4자리 숫자로 입력해주세요' };

  var existing = findUser_(key);
  if (existing) {
    if (hashPw_(pw, existing['솔트']) !== existing['비번해시']) {
      return { error: '비밀번호가 맞지 않아요' };
    }
    userSheet_().getRange(existing.rowIndex, USER_COLUMNS.indexOf('마지막로그인') + 1).setValue(todayStr_());
    return { ok: true, token: makeToken_(key), name: String(existing['이름']), created: false };
  }

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (err) {
    return { error: '잠시 후 다시 시도해주세요' };
  }
  try {
    // 잠금을 잡는 사이에 누가 먼저 만들었을 수 있다
    var again = findUser_(key);
    if (again) {
      if (hashPw_(pw, again['솔트']) !== again['비번해시']) return { error: '비밀번호가 맞지 않아요' };
      return { ok: true, token: makeToken_(key), name: String(again['이름']), created: false };
    }

    var isFirst = userRows_().length === 0;
    var salt = randomHex_(16);
    userSheet_().appendRow([key, display, hashPw_(pw, salt), salt, todayStr_(), todayStr_()]);

    // 첫 셀러라면 소유자가 비어 있던 기존 와인을 넘겨받는다
    var moved = isFirst ? claimOrphanWines_(key) : 0;

    return { ok: true, token: makeToken_(key), name: display, created: true, moved: moved };
  } finally {
    lock.releaseLock();
  }
}

/** 소유자가 비어 있는 와인 행을 지정한 셀러로 넘긴다 */
function claimOrphanWines_(id) {
  var sheet = getSheet_();
  var last = sheet.getLastRow();
  if (last < 2) return 0;

  var col = colIndex1_(getHeaders_(), OWNER_COLUMN);
  var range = sheet.getRange(2, col, last - 1, 1);
  var values = range.getValues();
  var count = 0;
  for (var i = 0; i < values.length; i++) {
    if (!String(values[i][0]).trim()) {
      values[i][0] = id;
      count++;
    }
  }
  if (count) range.setValues(values);
  return count;
}

/** 비밀번호 변경. 로그인된 토큰(=이미 본인 확인됨) 상태면 새 4자리 숫자로 바로 교체한다(솔트도 새로 만듦). */
function changePassword(token, newPw) {
  var user = requireUser_(token);
  newPw = String(newPw || '');

  if (!/^\d{4}$/.test(newPw)) return { error: '새 비밀번호는 4자리 숫자로 입력해주세요' };

  var salt = randomHex_(16);
  var sheet = userSheet_();
  sheet.getRange(user.rowIndex, USER_COLUMNS.indexOf('비번해시') + 1).setValue(hashPw_(newPw, salt));
  sheet.getRange(user.rowIndex, USER_COLUMNS.indexOf('솔트') + 1).setValue(salt);
  return { ok: true };
}

/** 토큰이 아직 쓸 만한지 확인 (앱 시작 때) */
function checkToken(token) {
  try {
    var user = requireUser_(token);
    return { ok: true, name: String(user['이름']), id: String(user['아이디']) };
  } catch (err) {
    return { ok: false };
  }
}

/* ===================== 와인 목록 ===================== */

/** 내 와인 목록만 조회 */
function getWines(token) {
  var me = String(requireUser_(token)['아이디']);
  var sheet = getSheet_();
  var lastRow = sheet.getLastRow();
  var headers = getHeaders_();
  if (lastRow < 2) return { headers: headers, wines: [] };

  var values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  var ownerIdx = headers.indexOf(OWNER_COLUMN);
  var tz = Session.getScriptTimeZone() || 'Asia/Seoul';
  var wines = [];
  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    // 남의 와인은 아예 내려보내지 않는다
    if (ownerIdx !== -1 && String(row[ownerIdx]).trim() !== me) continue;
    var obj = { rowIndex: i + 2 };
    for (var c = 0; c < headers.length; c++) {
      var v = row[c];
      obj[headers[c]] = (v instanceof Date) ? Utilities.formatDate(v, tz, 'yyyy-MM-dd') : v;
    }
    wines.push(obj);
  }
  return { headers: headers, wines: wines };
}

/** 이 행이 정말 내 것인지 확인하고 시트를 돌려준다 (행 번호를 바꿔치기한 요청 차단) */
function requireOwnedRow_(me, rowIndex) {
  var sheet = getSheet_();
  rowIndex = Number(rowIndex);
  if (!rowIndex || rowIndex < 2 || rowIndex > sheet.getLastRow()) throw new Error('없는 와인이에요');
  var col = colIndex1_(getHeaders_(), OWNER_COLUMN);
  if (String(sheet.getRange(rowIndex, col).getValue()).trim() !== me) {
    throw new Error('내 와인이 아니에요');
  }
  return sheet;
}

/** 새 와인 추가 (상태=보유, 등록일=오늘 자동). photoDataUrl은 선택. */
function addWine(token, data, photoDataUrl) {
  var me = String(requireUser_(token)['아이디']);
  var sheet = getSheet_();
  var headers = getHeaders_();
  var photoUrl = photoDataUrl ? resolvePhotoUrl_(photoDataUrl, (data && data['와인명']) || 'wine') : '';
  var row = headers.map(function (h) {
    if (h === '상태') return '보유';
    if (h === '등록일') return todayStr_();
    if (h === '마신날짜') return '';
    if (h === '라벨사진') return photoUrl;
    if (h === OWNER_COLUMN) return me;
    return (data && data[h]) || '';
  });
  sheet.appendRow(row);
  return { ok: true };
}

/** 잘못 등록된 정보를 고칠 수 있는 필드. 상태/등록일/마신날짜/소유자처럼
 * 다른 동작(마시기/되돌리기/셀러 분리)이 관리하는 컬럼은 여기서 손대지 않는다. */
var EDITABLE_FIELDS = ['와인명', '종류', '품종', '빈티지', '생산지/국가', '평균가격(국내·원)',
  '평균가격(글로벌·USD)', '추천 페어링', '어울리는잔', '서빙방법', '와인배경', '메모'];

/** 와인 정보 수정. photoDataUrl을 보내면 라벨 사진을 새로 찍은 걸로 교체한다. */
function updateWine(token, rowIndex, data, photoDataUrl) {
  var me = String(requireUser_(token)['아이디']);
  var sheet = requireOwnedRow_(me, rowIndex);
  var headers = getHeaders_();
  EDITABLE_FIELDS.forEach(function (h) {
    if (headers.indexOf(h) === -1 || !data || data[h] === undefined) return;
    sheet.getRange(rowIndex, colIndex1_(headers, h)).setValue(data[h]);
  });
  if (photoDataUrl) {
    var photoUrl = resolvePhotoUrl_(photoDataUrl, (data && data['와인명']) || 'wine');
    sheet.getRange(rowIndex, colIndex1_(headers, '라벨사진')).setValue(photoUrl);
  }
  return { ok: true };
}

/**
 * recognizeLabel이 인식과 동시에 이미 드라이브에 올려서 URL을 돌려준 경우,
 * addWine/updateWine에서 같은 사진을 또 업로드하지 않고 그 URL을 그대로 쓴다.
 * (원본 data: URL이 왔으면 지금 새로 업로드한다 — 직접입력·수정 시 새 사진 등)
 */
function resolvePhotoUrl_(photoDataUrl, name) {
  if (/^https?:\/\//.test(photoDataUrl)) return photoDataUrl;
  return savePhoto_(photoDataUrl, name);
}

/** 실수로 등록한 와인 삭제. */
function deleteWine(token, rowIndex) {
  var me = String(requireUser_(token)['아이디']);
  var sheet = requireOwnedRow_(me, rowIndex);
  sheet.deleteRow(Number(rowIndex));
  return { ok: true };
}

/* ===================== 내 잔 ===================== */

var GLASS_SHEET = '내잔';
var GLASS_COLUMNS = ['이름', '소유자'];

/** 잔 시트 (없으면 만든다) */
function glassSheet_() {
  var ss = getSS_();
  var sh = ss.getSheetByName(GLASS_SHEET);
  if (!sh) {
    sh = ss.insertSheet(GLASS_SHEET);
    sh.getRange(1, 1, 1, GLASS_COLUMNS.length).setValues([GLASS_COLUMNS]);
    sh.hideSheet();
  }
  return sh;
}

/** 내가 등록해둔 잔 목록 */
function getGlasses(token) {
  var me = String(requireUser_(token)['아이디']);
  var sheet = glassSheet_();
  var last = sheet.getLastRow();
  if (last < 2) return [];
  var values = sheet.getRange(2, 1, last - 1, GLASS_COLUMNS.length).getValues();
  var out = [];
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][1]).trim() !== me) continue;
    out.push({ rowIndex: i + 2, '이름': values[i][0] });
  }
  return out;
}

/** 잔 추가 (같은 이름 중복 등록 방지) */
function addGlass(token, name) {
  var me = String(requireUser_(token)['아이디']);
  name = String(name || '').trim();
  if (!name) return { error: '잔 이름을 적어주세요' };
  var existing = getGlasses(token);
  if (existing.some(function (g) { return g['이름'] === name; })) return { error: '이미 등록된 잔이에요' };
  glassSheet_().appendRow([name, me]);
  return { ok: true };
}

/** 잔 삭제 */
function deleteGlass(token, rowIndex) {
  var me = String(requireUser_(token)['아이디']);
  var sheet = glassSheet_();
  rowIndex = Number(rowIndex);
  if (!rowIndex || rowIndex < 2 || rowIndex > sheet.getLastRow()) throw new Error('없는 잔이에요');
  if (String(sheet.getRange(rowIndex, 2).getValue()).trim() !== me) throw new Error('내 잔이 아니에요');
  sheet.deleteRow(rowIndex);
  return { ok: true };
}

/**
 * 라벨/직접입력으로 못 채운 정보를 AI 한 번 호출로 몰아서 보충한다:
 *  - 품종·생산지(비어 있을 때만 — 와인명으로 미루어 일반적으로 알려진 정보만 채움)
 *  - 서빙온도·에어링(디캔팅) 시간
 *  - 잔 추천 두 가지: 완벽한잔(내가 뭘 갖고 있든 이상적으로 맞는 잔) /
 *    내잔추천(내가 등록해둔 잔 목록 중 가장 잘 맞는 것, 없거나 마땅치 않으면 null)
 *  - 추천 음식 두 가지: 베스트페어링(구하기 쉬운지와 무관하게 가장 이상적인 페어링) /
 *    추천 페어링(한국에서 구하기 쉬운 음식 위주)
 *  - 가격대(가격최소~가격최대 범위로 추정, 확실하면 최소=최대)
 * 잔 두 가지와 음식 두 목록 모두 5점 만점 별점이 붙는다(완벽할 때만 5점).
 * 빈티지는 절대 채우지 않는다 — 실제 병에 인쇄된 사실이라 AI가 추측하면 틀릴 수 있다.
 * 이미 값이 있는 필드는 절대 덮어쓰지 않고, 새로 채운 값만 시트에 저장해서
 * 다음엔 다시 AI를 부르지 않는다.
 */
function suggestWineInfo(token, rowIndex) {
  var me = String(requireUser_(token)['아이디']);
  var sheet = requireOwnedRow_(me, rowIndex);
  var headers = getHeaders_();
  var row = sheet.getRange(rowIndex, 1, 1, headers.length).getValues()[0];
  var wine = {};
  headers.forEach(function (h, i) { wine[h] = row[i]; });

  var myGlasses = getGlasses(token).map(function (g) { return g['이름']; });
  var glassText = myGlasses.length
    ? ('내가 가진 잔 목록: ' + JSON.stringify(myGlasses) + '\n"내잔추천"에는 이 중에서 이 와인에 가장 잘 맞는 잔을 하나 골라 넣어라. 아무리 봐도 마땅한 게 없으면 내잔추천은 null로 남겨라.')
    : '등록해둔 잔이 없으니 "내잔추천"은 null로 남겨라.';

  var missing = [];
  if (!wine['품종']) missing.push('품종');
  if (!wine['생산지/국가']) missing.push('생산지_국가');
  var missingText = missing.length
    ? ('\n\n이 와인은 아직 ' + JSON.stringify(missing) + ' 정보가 비어 있다. 와인명(생산자·원산지 명칭)으로 미루어 ' +
      '일반적으로 알려진 정보면 채워 넣고, 전혀 짐작이 안 가면 빈 문자열로 남겨라.')
    : '';

  var prompt = '너는 소믈리에다. 아래 와인 정보를 보고 서빙 방법, 어울리는 잔, 어울리는 음식, 와인 배경, 가격대를 추천해라.\n' +
    JSON.stringify({ 와인명: wine['와인명'], 종류: wine['종류'], 품종: wine['품종'], 생산지: wine['생산지/국가'], 빈티지: wine['빈티지'] }) +
    missingText + '\n\n' + glassText + '\n\n' +
    '"완벽한잔"에는 내가 뭘 가지고 있는지와 무관하게 이 와인에 이상적으로 가장 잘 맞는 잔 종류를 넣어라. ' +
    '음식 추천은 두 가지로 나눠서 해라 — ' +
    '"베스트페어링"에는 구하기 쉬운지와 무관하게 이 와인에 정말 이상적으로 어울리는 음식을 2~4가지 적어라. ' +
    '"한국페어링"에는 한국에서 흔히 사 먹거나 만들어 먹을 수 있는 음식 중에서 2~4가지를 적어라(예: "삼겹살, 훈제오리, 숙성 치즈"). ' +
    '두 목록이 겹쳐도 되고, 한국페어링이 곧 베스트인 경우도 있다. ' +
    '"배경"에는 이 와인/생산자에 대해 알려진 이야기(스타일, 유명한 이유, 등급, 자매 와인 등)를 한국어로 두세 문장 적어라. ' +
    '아는 게 전혀 없으면 빈 문자열로 남겨라. ' +
    '"가격최소"/"가격최대"에는 한국 시장 기준 대략적인 소매가 범위를 원화 숫자로 추정해라(예: 70000, 90000 — 확실하면 둘을 같게 써도 된다). ' +
    '전혀 짐작이 안 가면 둘 다 0으로 남겨라. ' +
    '잔 두 개(완벽한잔, 내잔추천)와 음식 두 목록(베스트페어링, 한국페어링) 모두 5점 만점 별점을 매겨라 — ' +
    '정말 완벽하게 어울릴 때만 5점을 주고, 자신 없으면 4점 이하로 줘라.\n\n' +
    '아래 JSON으로만 답해라.\n' +
    '{"품종":"...", "생산지_국가":"...", ' +
    '"서빙온도":"예: 16-18°C", "에어링시간":"예: 디캔팅 30분 또는 필요 없음", ' +
    '"완벽한잔":{"이름":"...","별점":1~5}, "내잔추천":{"이름":"...","별점":1~5} 또는 null, ' +
    '"베스트페어링":{"내용":"...","별점":1~5}, "한국페어링":{"내용":"...","별점":1~5}, ' +
    '"배경":"...", "가격최소":숫자, "가격최대":숫자}';

  var result = callGemini_([{ text: prompt }]);
  if (!result) throw new Error('추천을 만들지 못했어요');

  var priceMin = parseInt(result['가격최소'], 10) || 0;
  var priceMax = parseInt(result['가격최대'], 10) || 0;
  var priceText = '';
  if (priceMin > 0 || priceMax > 0) {
    var lo = priceMin || priceMax, hi = priceMax || priceMin;
    priceText = (lo === hi ? lo.toLocaleString('ko-KR') : lo.toLocaleString('ko-KR') + '~' + hi.toLocaleString('ko-KR')) + '원 (추정)';
  }

  var updates = {
    '품종': result['품종'] || '',
    '생산지/국가': result['생산지_국가'] || '',
    '서빙온도': result['서빙온도'] || '',
    '에어링시간': result['에어링시간'] || '',
    '완벽한잔': (result['완벽한잔'] && result['완벽한잔']['이름']) || '',
    '완벽한잔별점': (result['완벽한잔'] && result['완벽한잔']['별점']) || '',
    '내잔추천': (result['내잔추천'] && result['내잔추천']['이름']) || '',
    '내잔추천별점': (result['내잔추천'] && result['내잔추천']['별점']) || '',
    '베스트페어링': (result['베스트페어링'] && result['베스트페어링']['내용']) || '',
    '베스트페어링별점': (result['베스트페어링'] && result['베스트페어링']['별점']) || '',
    '추천 페어링': (result['한국페어링'] && result['한국페어링']['내용']) || '',
    '추천페어링별점': (result['한국페어링'] && result['한국페어링']['별점']) || '',
    '와인배경': result['배경'] || '',
    // AI 추정치라는 걸 분명히 하려고 값 자체에 "(추정)"을 붙여둔다 — 실제로 지불한 가격과
    // 혼동되지 않게. 사용자가 실제 가격을 알면 수정 화면에서 언제든 덮어쓸 수 있다.
    '평균가격(국내·원)': priceText
  };

  // 원래 비어 있던 필드만 채워서 저장 — 이미 값이 있으면 덮어쓰지 않는다
  var out = {};
  Object.keys(updates).forEach(function (h) {
    if (wine[h]) { out[h] = wine[h]; return; }
    if (updates[h] === '' || headers.indexOf(h) === -1) { out[h] = ''; return; }
    sheet.getRange(rowIndex, colIndex1_(headers, h)).setValue(updates[h]);
    out[h] = updates[h];
  });
  return out;
}

/**
 * 사진 폴더를 매번 이름으로 검색하면(DriveApp.getFoldersByName) 느리다.
 * 한 번 찾은 폴더 ID를 스크립트 속성에 저장해두고 다음부터는 ID로 바로 연다.
 */
function photoFolder_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('PHOTO_FOLDER_ID');
  if (id) {
    try { return DriveApp.getFolderById(id); } catch (err) { /* 폴더가 지워졌으면 아래에서 새로 찾는다 */ }
  }
  var folders = DriveApp.getFoldersByName(PHOTO_FOLDER_NAME);
  var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(PHOTO_FOLDER_NAME);
  props.setProperty('PHOTO_FOLDER_ID', folder.getId());
  return folder;
}

function savePhoto_(dataUrl, name) {
  var m = /^data:(image\/\w+);base64,(.+)$/.exec(dataUrl);
  if (!m) throw new Error('잘못된 이미지 형식입니다');
  var mimeType = m[1];
  var base64 = m[2];
  var blob = Utilities.newBlob(Utilities.base64Decode(base64), mimeType, name + '_' + Date.now());

  var folder = photoFolder_();
  var file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  // drive.google.com/uc?id=... 는 <img>로 바로 못 띄우는 경우가 많아졌다(바이러스 검사
  // 경고 페이지로 리다이렉트되거나 임베드가 막힘). googleusercontent CDN 주소가 안정적이다.
  return 'https://lh3.googleusercontent.com/d/' + file.getId() + '=s1000';
}

/* ===================== Gemini 공용 ===================== */

var GEMINI_MODEL = 'gemini-3.6-flash';

/** Gemini 호출 후 JSON 응답을 파싱해서 반환. parts는 [{text:..}, {inline_data:..}] 형태. */
function callGemini_(parts) {
  var apiKey = prop_('GEMINI_API_KEY');
  if (apiKey) apiKey = apiKey.trim();
  if (!apiKey) throw new Error('GEMINI_API_KEY가 설정되지 않았어요 (스크립트 속성에 추가해주세요)');

  var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + GEMINI_MODEL + ':generateContent?key=' + encodeURIComponent(apiKey);
  var resp = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({
      contents: [{ parts: parts }],
      generationConfig: { responseMimeType: 'application/json' }
    }),
    muteHttpExceptions: true
  });

  var status = resp.getResponseCode();
  if (status === 401 || status === 403) {
    throw new Error('GEMINI_API_KEY가 잘못됐거나 만료됐어요. https://aistudio.google.com/apikey 에서 키를 다시 확인하고 스크립트 속성에 다시 저장한 뒤, 배포 관리 → 새 버전으로 재배포해주세요. (' + status + ')');
  }
  if (status === 404 && /is no longer available/.test(resp.getContentText())) {
    throw new Error('AI 모델(' + GEMINI_MODEL + ')이 구글에서 서비스 종료됐어요. Code.gs의 GEMINI_MODEL 값을 https://ai.google.dev/gemini-api/docs/models 에서 최신 모델 이름으로 바꾸고 재배포해주세요. (404)');
  }
  if (status !== 200) {
    throw new Error('AI 호출 실패 (' + status + '): ' + resp.getContentText().slice(0, 200));
  }
  var json = JSON.parse(resp.getContentText());
  if (!json.candidates || !json.candidates.length) throw new Error('AI가 응답하지 않았어요');

  var text = json.candidates[0].content.parts[0].text;
  text = text.replace(/```json/g, '').replace(/```/g, '').trim();
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error('AI 응답을 해석하지 못했어요: ' + text.slice(0, 150));
  }
}

/** dataURL을 Gemini inline_data 파트로 변환 */
function imagePart_(photoDataUrl) {
  var m = /^data:(image\/\w+);base64,(.+)$/.exec(photoDataUrl);
  if (!m) throw new Error('잘못된 이미지 형식입니다');
  return { inline_data: { mime_type: m[1], data: m[2] } };
}

var WINE_FIELDS_SPEC = '{"와인명":"","종류":"레드/화이트/스파클링/로제/주정강화 중 하나","품종":"","생산지_국가":"","빈티지":""}';

/**
 * 라벨 사진 1장 → 와인 1병 정보 추출.
 * 반환: { 와인명, 종류, 품종, 생산지_국가, 빈티지 }
 */
function recognizeLabel(token, photoDataUrl) {
  requireUser_(token);
  var prompt = '이 사진은 와인 라벨입니다. 아래 JSON 형식으로만 답하세요.\n' +
    WINE_FIELDS_SPEC + '\n' +
    '와인명·빈티지는 라벨에 실제로 인쇄된 대로만 읽어라(추측 금지) — 안 보이면 빈 문자열로 둬라. ' +
    '종류·품종·생산지는 라벨에 글자로 안 적혀 있어도, 원산지 명칭(AOC/DOC 등)이나 생산자로 미루어 ' +
    '일반적으로 알려진 정보라면 네 와인 지식으로 채워 넣어라(예: 프랑스 "Chablis"면 화이트/샤르도네/프랑스). ' +
    '그래도 전혀 짐작이 안 가면 빈 문자열로 둬라. ' +
    '와인명은 라벨에 적힌 원문 표기(주로 영문/이탈리아어 등)를 그대로 쓰고, 종류·품종·생산지는 한국어로 쓰세요.';
  var result = callGemini_([{ text: prompt }, imagePart_(photoDataUrl)]);
  // 인식 성공 시 사진을 여기서 미리 드라이브에 올려둔다. 그러면 나중에
  // addWine/updateWine에 이 URL을 그대로 넘겨서, 같은 사진을 두 번(인식할 때·
  // 저장할 때) 안 실어 날라도 된다 — 와인 추가 체감 속도의 절반은 이 중복 업로드였다.
  if (result && !result.error) {
    try {
      result._photoUrl = savePhoto_(photoDataUrl, result['와인명'] || 'wine');
    } catch (err) {
      // 사진 저장이 실패해도 인식 결과 자체는 그대로 돌려준다.
      // addWine이 원본 데이터를 받으면 그때 다시 시도된다.
    }
  }
  return result;
}

/**
 * 셀러 사진 1장 → 보이는 와인 여러 병을 한 번에 추출.
 * 이미 시트에 있는 와인은 existingRowIndex를 채워서 중복 추가를 막는다.
 * 반환: [{ 와인명, 종류, 품종, 생산지_국가, 빈티지, existingRowIndex }]
 */
function recognizeCellar(token, photoDataUrl) {
  requireUser_(token);
  var prompt = '이 사진은 와인 셀러(또는 와인 여러 병이 놓인 선반) 사진입니다. ' +
    '사진에서 식별 가능한 와인 병을 모두 찾아 JSON 배열로만 답하세요.\n' +
    '[' + WINE_FIELDS_SPEC + ']\n' +
    '각 병마다 하나의 객체를 만들고, 와인명·빈티지는 라벨에 실제로 인쇄된 대로만 읽어라(추측 금지, 안 보이면 빈 문자열). ' +
    '종류·품종·생산지는 라벨에 글자로 안 적혀 있어도 원산지 명칭·생산자로 미루어 일반적으로 알려진 정보면 채워 넣고, ' +
    '전혀 짐작이 안 가면 빈 문자열로 두세요. ' +
    '와인명조차 전혀 판독할 수 없는 병은 배열에서 제외하세요. ' +
    '와인명은 라벨 원문 표기 그대로, 종류·품종·생산지는 한국어로 쓰세요.';

  var result = callGemini_([{ text: prompt }, imagePart_(photoDataUrl)]);
  if (!result) return [];
  // 모델이 배열 대신 {wines:[...]} 로 감싸 주는 경우 대비
  var list = Array.isArray(result) ? result : (result.wines || result.list || []);

  var existing = getWines(token).wines;
  list.forEach(function (cand) {
    var match = findExisting_(existing, cand['와인명']);
    cand.existingRowIndex = match ? match.rowIndex : null;
    cand.existingStatus = match ? match['상태'] : null;
  });
  return list;
}

/** 와인명으로 기존 행 찾기 (대소문자/공백 무시, 부분 포함 허용) */
function findExisting_(wines, name) {
  if (!name) return null;
  var norm = function (s) { return String(s || '').toLowerCase().replace(/[\s,.'"-]/g, ''); };
  var target = norm(name);
  if (!target) return null;
  for (var i = 0; i < wines.length; i++) {
    var cur = norm(wines[i]['와인명']);
    if (!cur) continue;
    if (cur === target || cur.indexOf(target) !== -1 || target.indexOf(cur) !== -1) return wines[i];
  }
  return null;
}

/** 셀러 인식 결과 중 선택한 것들을 한 번에 추가 */
function addWines(token, list) {
  var me = String(requireUser_(token)['아이디']);
  if (!list || !list.length) return { added: 0 };
  var sheet = getSheet_();
  var headers = getHeaders_();
  var today = todayStr_();

  var rows = list.map(function (c) {
    return headers.map(function (h) {
      if (h === '상태') return '보유';
      if (h === '등록일') return today;
      if (h === '마신날짜') return '';
      if (h === '생산지/국가') return c['생산지_국가'] || c['생산지/국가'] || '';
      if (h === OWNER_COLUMN) return me;
      return c[h] || '';
    });
  });
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, headers.length).setValues(rows);
  return { added: rows.length };
}

/** 마심 표시: 상태→마심, 마신날짜/평점/한줄평/함께한음식 기록 */
function markDrunk(token, rowIndex, info) {
  var me = String(requireUser_(token)['아이디']);
  var sheet = requireOwnedRow_(me, rowIndex);
  var headers = getHeaders_();
  sheet.getRange(rowIndex, colIndex1_(headers, '상태')).setValue('마심');
  sheet.getRange(rowIndex, colIndex1_(headers, '마신날짜')).setValue(todayStr_());
  if (info) {
    if (info['평점'] !== undefined) sheet.getRange(rowIndex, colIndex1_(headers, '평점')).setValue(info['평점']);
    if (info['한줄평']) sheet.getRange(rowIndex, colIndex1_(headers, '한줄평')).setValue(info['한줄평']);
    if (info['함께한음식']) sheet.getRange(rowIndex, colIndex1_(headers, '함께한음식')).setValue(info['함께한음식']);
    if (info['재구매의향']) sheet.getRange(rowIndex, colIndex1_(headers, '재구매의향')).setValue(info['재구매의향']);
  }
  return { ok: true };
}

/** 마심 취소(되돌리기) */
function unmarkDrunk(token, rowIndex) {
  var me = String(requireUser_(token)['아이디']);
  var sheet = requireOwnedRow_(me, rowIndex);
  var headers = getHeaders_();
  sheet.getRange(rowIndex, colIndex1_(headers, '상태')).setValue('보유');
  sheet.getRange(rowIndex, colIndex1_(headers, '마신날짜')).setValue('');
  return { ok: true };
}

/**
 * 품종/종류 키워드로 "이미 마신" 와인 조회 (추가할 때 비교용)
 */
function getDrunkMatches(token, keyword) {
  if (!keyword) return [];
  keyword = String(keyword).trim();
  if (!keyword) return [];
  var data = getWines(token);
  return data.wines.filter(function (w) {
    if (w['상태'] !== '마심') return false;
    var 품종 = String(w['품종'] || '');
    var 종류 = String(w['종류'] || '');
    return 품종.indexOf(keyword) !== -1 || 종류.indexOf(keyword) !== -1;
  });
}

/**
 * 음식 입력 → 보유 와인 중 추천. 여러 음식을 "·"로 이어 한 번에 물어볼 수 있다
 * (화면에서 칩을 여러 개 고르면 이렇게 합쳐서 보낸다). food가 빈 문자열이면
 * "안주 없이 그냥 마실 와인 추천" 모드로 동작한다.
 * 각 와인의 "추천 페어링" 필드(셀러에 이미 적어둔 정보)를 최우선 근거로 삼고,
 * 거기 없어도 품종/종류로 AI가 순위·이유를 정한다(키워드가 안 겹쳐도 추천 가능).
 * 예전에 마시고 별점을 높게 준 기록이 있으면 그 취향(품종·종류)도 우선순위에 반영한다.
 * 정말 잘 어울리는 와인이 없으면 억지로 채우지 않고 빈 배열을 돌려준다.
 * API 실패 시(food가 있을 때만) 키워드 매칭으로 자동 대체.
 * 반환: [{ wine, reason, matched }] — matched는 셀러 페어링 정보에 직접 근거했는지
 */
function recommendByFood(token, food) {
  requireUser_(token);
  food = String(food || '').trim();

  var all = getWines(token).wines;
  var owned = all.filter(function (w) { return w['상태'] === '보유'; });
  if (!owned.length) return [];

  // 예전에 마시고 평점을 높게 준 것들 — 취향 참고용(이 와인 자체는 이미 셀러에 없을 수 있음)
  var liked = all
    .filter(function (w) { return w['상태'] === '마심' && Number(w['평점']) >= 4; })
    .sort(function (a, b) { return Number(b['평점']) - Number(a['평점']); })
    .slice(0, 5)
    .map(function (w) { return { 품종: w['품종'] || '', 종류: w['종류'] || '', 평점: w['평점'], 한줄평: w['한줄평'] || '' }; });

  // 셀러에 이미 적힌 페어링 문구와 글자가 직접 겹치는 와인 — 우리 데이터가 근거인 경우
  var directIds = {};
  if (food) {
    owned.forEach(function (w) {
      var text = String(w['추천 페어링'] || '') + ' ' + String(w['베스트페어링'] || '');
      if (!text.trim()) return;
      var hit = food.split(/[·,]+/).some(function (f) { f = f.trim(); return f && text.indexOf(f) !== -1; });
      if (hit) directIds[w.rowIndex] = true;
    });
  }

  try {
    var menu = owned.map(function (w) {
      return {
        id: w.rowIndex,
        이름: w['와인명'],
        종류: w['종류'],
        품종: w['품종'],
        생산지: w['생산지/국가'],
        기존페어링: w['추천 페어링'] || '',
        베스트페어링: w['베스트페어링'] || ''
      };
    });

    var prefText = liked.length ?
      ('\n\n참고로 이 사람이 예전에 마시고 평점을 높게 준 기록이다(취향 참고용, 이 와인들 자체가 지금 셀러에 있다는 뜻은 아니다):\n' +
        JSON.stringify(liked) +
        '\n비슷한 품종·스타일의 와인이 지금 목록에 있으면 그 취향도 반영해서 우선순위를 살짝 더 높이고, ' +
        '취향이 반영됐으면 reason에 짧게 그 이유(예: "전에 좋아하셨던 산지오베제 계열")를 언급해라.') : '';

    var askText = food
      ? ('오늘 먹을 음식(여러 개면 가운데 점 · 으로 구분됨): "' + food + '"' + prefText + '\n\n' +
        '이 음식(들)에 가장 잘 어울리는 와인을 이 목록 안에서만 좋은 순서로 최대 3개 추천해라. ' +
        '음식이 여러 개면 그 자리에 다 같이 두루 잘 어울리는 와인을 우선하고, 마땅한 게 없으면 음식별로 가장 좋은 조합을 하나씩 골라도 된다. ' +
        '와인의 "기존페어링" 필드에 이 음식(또는 같은 계열의 음식)이 이미 적혀 있으면 그것을 최우선 근거로 삼고, ' +
        'reason에 그 문구를 언급해라. 기존페어링에 없어도 품종·종류로 보아 잘 어울리면 추천해도 된다. ' +
        '한식이면 양념의 맛(맵기·단맛·기름기)까지 고려해라.')
      : ('오늘은 곁들일 음식 없이 와인만 마시고 싶다.' + prefText + '\n\n' +
        '이 목록 안에서 오늘 그냥 마시기 좋은 와인을 좋은 순서로 최대 3개 추천해라. ' +
        '와인 자체의 스타일·마시기 편한 정도(가벼움/묵직함)·평소 취향을 근거로 골라라.');

    var prompt = '너는 소믈리에다. 아래는 우리 집 와인 셀러에 지금 있는 와인 목록이고, ' +
      '각 와인의 "기존페어링" 필드에는 우리가 이미 적어둔 어울리는 음식 정보가 있다.\n' +
      JSON.stringify(menu) + '\n\n' + askText + '\n\n' +
      '정말 잘 어울리거나 마실 만하다고 자신 있게 말할 수 있는 와인만 골라라. ' +
      '억지로 3개를 채우지 말고, 그런 와인이 하나도 없으면 빈 배열을 반환해라. ' +
      '각 추천에는 5점 만점 별점을 매겨라 — 정말 완벽하게 어울릴 때만 5점을 주고, 자신 없으면 4점 이하로 줘라. ' +
      '아래 JSON 배열로만 답하라.\n' +
      '[{"id":숫자, "reason":"왜 어울리는지 한국어 한 문장", "별점":1~5, "fromCellarPairing":true또는false}]';

    var picks = callGemini_([{ text: prompt }]);
    var list = Array.isArray(picks) ? picks : (picks.recommendations || picks.list || []);

    var out = [];
    list.forEach(function (p) {
      for (var i = 0; i < owned.length; i++) {
        if (owned[i].rowIndex === p.id) {
          out.push({
            wine: owned[i],
            reason: p.reason || '',
            '별점': p['별점'] || 0,
            matched: !!p.fromCellarPairing || !!directIds[p.id]
          });
          break;
        }
      }
    });
    return out;
  } catch (e) {
    // AI 실패 시(음식이 있을 때만) 아래 키워드 매칭으로 넘어감
    if (!food) return [];
  }

  return recommendByKeyword_(food, owned, liked).map(function (x) {
    x.matched = !!directIds[x.wine.rowIndex];
    return x;
  });
}

/**
 * AI를 못 쓸 때 쓰는 단순 키워드 매칭 대체 로직.
 * food는 "·"로 여러 음식이 이어질 수 있고, 겹치는 음식이 많을수록 점수가 쌓인다.
 * liked(예전에 평점 높았던 품종·종류)와 겹치면 동점일 때 우선하도록 소폭 가산한다.
 */
function recommendByKeyword_(food, owned, liked) {
  var keywords = food.split(/[\s,·・\/]+/).filter(Boolean);
  var likedGrapes = {}, likedTypes = {};
  (liked || []).forEach(function (l) {
    if (l.품종) likedGrapes[l.품종] = true;
    if (l.종류) likedTypes[l.종류] = true;
  });
  return owned
    .map(function (w) {
      var hay = [w['추천 페어링'], w['베스트페어링'], w['함께한음식'], w['종류'], w['품종'], w['와인배경']].join(' ');
      var s = 0;
      keywords.forEach(function (k) { if (hay.indexOf(k) !== -1) s += 1; });
      if (s > 0 && (likedGrapes[w['품종']] || likedTypes[w['종류']])) s += 0.5;
      return { wine: w, score: s };
    })
    .filter(function (x) { return x.score > 0; })
    .sort(function (a, b) { return b.score - a.score; })
    .slice(0, 3)
    .map(function (x) { return { wine: x.wine, reason: '' }; });
}

/**
 * "품종" 필드에서 개별 품종 이름만 뽑아낸다.
 * 예: "카베르네 소비뇽 60%·메를로 40%" → ["카베르네 소비뇽", "메를로"]
 * 블렌드 와인 한 병은 섞인 품종 각각에 1씩 잡힌다(비율 가중은 하지 않음 — 병 수 기준 집계).
 */
function parseGrapes_(raw) {
  return String(raw || '')
    .split(/[·,、]/)
    .map(function (s) {
      return s.replace(/\d+(\.\d+)?\s*%/g, '').replace(/[()]/g, '').trim();
    })
    .filter(Boolean);
}

/** 소비 통계: 월별 / 종류별 / 품종별 / 가격대별 마신 와인 집계 */
function getStats(token) {
  var data = getWines(token);
  var drunk = data.wines.filter(function (w) { return w['상태'] === '마심'; });

  var byMonth = {}, byType = {}, byGrape = {}, byPrice = {};
  drunk.forEach(function (w) {
    var month = (w['마신날짜'] || '').slice(0, 7); // yyyy-MM
    if (month) byMonth[month] = (byMonth[month] || 0) + 1;

    var type = w['종류'] || '기타';
    byType[type] = (byType[type] || 0) + 1;

    var grapes = parseGrapes_(w['품종']);
    if (!grapes.length) grapes = ['품종 미상'];
    grapes.forEach(function (g) { byGrape[g] = (byGrape[g] || 0) + 1; });

    var priceMatch = String(w['평균가격(국내·원)'] || '').match(/[\d,]+/);
    var priceNum = priceMatch ? parseInt(priceMatch[0].replace(/,/g, ''), 10) : 0;
    var bracket = !priceNum ? '가격정보없음'
      : priceNum < 30000 ? '3만원 미만'
      : priceNum < 70000 ? '3~7만원'
      : priceNum < 150000 ? '7~15만원'
      : '15만원 이상';
    byPrice[bracket] = (byPrice[bracket] || 0) + 1;
  });

  return { totalDrunk: drunk.length, byMonth: byMonth, byType: byType, byGrape: byGrape, byPrice: byPrice };
}
