/**
 * ⚠️ 이 파일은 build_single.js가 자동으로 만든 것입니다. 직접 고치지 마세요.
 *    고칠 때는 Code.gs / Index.html 을 고치고 `node build_single.js` 를 다시 실행하세요.
 *
 * [이 파일을 쓰는 이유]
 * Apps Script에서 HTML 파일을 따로 만들지 않아도 되도록 화면(Index.html)까지
 * 이 파일 하나에 담았습니다. Apps Script 새 프로젝트에 이 파일 내용만
 * 통째로 붙여넣으면 끝입니다.
 */
/**
 * 와인리스트 모바일 웹앱 백엔드
 *
 * 두 가지 방식 모두 지원합니다.
 *  A) 시트에 붙는 방식 — 스프레드시트 → 확장 프로그램 → Apps Script
 *  B) 따로 만드는 방식 — script.google.com → 새 프로젝트
 *     (이 경우 스크립트 속성에 SHEET_ID를 넣어주면 됩니다. 시트 주소창의
 *      docs.google.com/spreadsheets/d/[여기가 SHEET_ID]/edit 부분)
 *
 * 최초 1회 설정:
 * 1) 프로젝트 설정 → 스크립트 속성에 추가
 *    - GEMINI_API_KEY   : Gemini API 무료 키 (https://aistudio.google.com/apikey 에서 발급)
 *    - SHEET_ID         : (B 방식일 때만) 와인리스트 스프레드시트 ID
 * 2) 배포 → 웹 앱. 첫 접속 때 컬럼/아이콘 설정이 자동으로 끝납니다.
 *    코드를 고친 뒤에는 [배포 관리] → 연필(수정) → 버전: 새 버전 → 배포
 *    (이렇게 해야 주소가 그대로 유지됩니다. [새 배포]를 누르면 주소가 바뀝니다)
 *
 * 셀러(계정):
 *  - 첫 화면에서 이름과 비밀번호만 넣습니다. 처음 보는 이름이면 셀러를 새로 만들고,
 *    이미 있는 이름이면 비번을 확인하고 그 셀러로 들어갑니다. 가입/로그인 구분이 없습니다.
 *  - 그래서 같은 이름·비번을 아는 사람끼리 셀러 하나를 같이 씁니다(부부 공유).
 *  - 셀러가 다르면 서로의 와인이 보이지 않습니다(소유자 컬럼으로 분리).
 *  - 맨 처음 만든 셀러가 기존에 쌓여 있던(소유자 없는) 와인을 넘겨받습니다.
 *  - 비번은 솔트 + SHA-256 반복 해시로 저장하며, 원문은 어디에도 남지 않습니다.
 */

var NEW_COLUMNS = ['어울리는잔', '서빙방법', '와인배경', '평점', '한줄평', '함께한음식', '라벨사진', '소유자'];
var PHOTO_FOLDER_NAME = '와인라벨사진';
var APP_TITLE = '와인 딸까 말까';
var ICON_FILE_NAME = '와인앱아이콘.png';
/* 홈 화면 아이콘(512px 와인잔). setupIcon이 드라이브에 올려 공개 주소로 만든다. */
var ICON_PNG_B64 = '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/j5PgyHbFShmewOJkAQgqL6DPV0duxPhde7q8HzQsAQgrn3bdiTCswwiE4C4Nj67OBGeZRCZAMS16udzE+FZBpEJQFxrn5jfvmZ9IrCOtRvWPv5MIioBiCu79Dfvm7cnAnv6G9/t7+tLRCUAoS295wEHAWFlu/9L756TCEwAQssOAuZ86gs9nZ2JYLKNfv9Nn7f7H5wARLfp2cVzbvpCIphso29y/0943glM2rlqdfvqdROvmVms8WiQ/Mv2/efc9PkV9z+cCE8AOGT7slWrH3ly/MzLGlqHJPJr10tr7/7jT6578lcJUircPG5GgsMKpdLUP/zdqz71seaRwxP5snfLtme+cfuiO+/14AeOEgCqGHvF9InXXj3uqstGTb8ocSbbtHDJ+qf/cfUjT2145tkExxMAXsPQ8yY3Oi90Btq7dXt2wifBibnox2vYsfxFTwuDXBIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACCo/w8AAP//6FCw1gAAAAZJREFUAwB7xrhGLN1mFAAAAABJRU5ErkJggg==';

/** 최초 1회 실행: 새 컬럼 헤더를 시트 끝에 추가 (기존 데이터는 건드리지 않음) */
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

function doGet(e) {
  ensureSetup_();
  var raw = INDEX_HTML;

  // 주소에 ?t=토큰 이 붙어 있으면 그대로 로그인 상태로 연다.
  // Apps Script는 화면을 매번 다른 googleusercontent 주소로 서빙해서 브라우저
  // 저장소가 남지 않는다. 그래서 "로그인 기억"은 주소가 담당한다.
  var token = (e && e.parameter) ? e.parameter.t : '';
  if (token && verifyToken_(token)) {
    raw = raw.replace("'/*TOKEN*/'", JSON.stringify(String(token)));
  }

  var out = HtmlService.createHtmlOutput(raw)
    .setTitle(APP_TITLE)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);

  // 홈 화면 아이콘은 이 바깥 페이지의 파비콘에서 가져간다.
  // 우리 HTML 안의 <link rel="icon">은 iframe 안이라 폰이 보지 못한다.
  //
  // setFaviconUrl은 주소를 까다롭게 검사해서 거부하면 예외를 던진다.
  // 아이콘 하나 때문에 앱 전체가 안 열리면 안 되므로 반드시 감싼다.
  var icon = prop_('ICON_URL');
  if (icon && prop_('ICON_URL_BAD') !== icon) {
    try {
      out.setFaviconUrl(icon);
    } catch (err) {
      // 거부된 주소를 기억해 두고 매 요청마다 다시 시도하지 않는다
      PropertiesService.getScriptProperties().setProperty('ICON_URL_BAD', icon);
      Logger.log('파비콘 거부됨: ' + icon + ' — ' + err.message);
    }
  }
  return out;
}

/** 배포된 웹 앱 주소 (홈 화면 추가 안내용) */
function getAppUrl() {
  try {
    return ScriptApp.getService().getUrl();
  } catch (err) {
    return '';
  }
}

/**
 * 아이콘을 드라이브에 올려 공개 주소를 만들고 ICON_URL 속성에 저장한다.
 * setFaviconUrl은 데이터 URI를 받지 않아 호스팅이 필요하고, 주소 형식도 까다롭다.
 * 그래서 여러 형식을 시도해 "정말 이미지를 돌려주는" 것만 저장한다.
 */
function setupIcon() {
  var props = PropertiesService.getScriptProperties();
  var folders = DriveApp.getFoldersByName(PHOTO_FOLDER_NAME);
  var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(PHOTO_FOLDER_NAME);

  // 다시 실행해도 파일이 쌓이지 않도록 이전 것은 정리
  var old = folder.getFilesByName(ICON_FILE_NAME);
  while (old.hasNext()) old.next().setTrashed(true);

  var blob = Utilities.newBlob(Utilities.base64Decode(ICON_PNG_B64), 'image/png', ICON_FILE_NAME);
  var file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  var id = file.getId();

  var candidates = [
    'https://drive.google.com/uc?export=view&id=' + id,
    'https://lh3.googleusercontent.com/d/' + id,
    'https://drive.google.com/thumbnail?id=' + id + '&sz=w512'
  ];

  props.deleteProperty('ICON_URL_BAD');
  for (var i = 0; i < candidates.length; i++) {
    if (servesImage_(candidates[i])) {
      props.setProperty('ICON_URL', candidates[i]);
      return candidates[i];
    }
  }

  // 어느 것도 이미지를 돌려주지 않으면 아이콘을 포기한다(앱은 그대로 동작).
  props.deleteProperty('ICON_URL');
  Logger.log('아이콘 주소를 만들지 못했습니다. 기본 아이콘으로 동작합니다.');
  return '';
}

/** 그 주소가 실제로 이미지를 돌려주는지 확인 */
function servesImage_(url) {
  try {
    var resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true });
    if (resp.getResponseCode() !== 200) return false;
    var headers = resp.getHeaders();
    var type = String(headers['Content-Type'] || headers['content-type'] || '');
    return type.indexOf('image/') === 0;
  } catch (err) {
    return false;
  }
}

/**
 * 설정이 제대로 됐는지 점검한다. 에디터에서 실행하고 실행 로그를 보면 된다.
 * 아이콘이 안 바뀔 때 어디가 문제인지 확인하는 용도.
 */
function checkSetup() {
  var lines = [];
  var sheetId = prop_('SHEET_ID');
  var gem = prop_('GEMINI_API_KEY');
  var icon = prop_('ICON_URL');

  lines.push('GEMINI_API_KEY  : ' + (gem ? '설정됨' : '없음 (사진 인식/AI 추천만 못 씀)'));
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

  lines.push('ICON_URL        : ' + (icon ? icon : '없음 (기본 아이콘으로 동작)'));
  var bad = prop_('ICON_URL_BAD');
  if (bad) lines.push('  ⚠ 이 주소는 파비콘으로 거부됐습니다. setupIcon을 다시 실행해보세요.');
  if (icon) {
    try {
      var resp = UrlFetchApp.fetch(icon, { muteHttpExceptions: true, followRedirects: true });
      var code = resp.getResponseCode();
      var type = resp.getHeaders()['Content-Type'] || resp.getHeaders()['content-type'] || '?';
      lines.push('아이콘 접근     : ' + (code === 200 ? 'OK' : '❌') + ' HTTP ' + code + ' / ' + type);
      if (code !== 200) lines.push('  → 드라이브 공유 설정 문제일 수 있습니다. setupIcon을 다시 실행해보세요.');
    } catch (err) {
      lines.push('아이콘 접근     : ❌ ' + err.message);
    }
  }

  lines.push('웹 앱 주소      : ' + (getAppUrl() || '아직 배포 안 됨'));
  var out = lines.join('\n');
  Logger.log(out);
  return out;
}

/**
 * 첫 접속 때 컬럼 추가와 아이콘 등록을 알아서 끝낸다.
 * 배포할 때 이미 권한을 받아두므로, 사용자가 setup을 따로 실행할 필요가 없다.
 * 한 번 성공하면 SETUP_DONE 표시가 남아 다시 돌지 않는다.
 */
function ensureSetup_() {
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty('SETUP_DONE') === '1') return;
  try {
    setupColumns();
    setupIcon();
    props.setProperty('SETUP_DONE', '1');
  } catch (err) {
    // 설정이 실패해도 앱은 뜨게 둔다. 원인은 checkSetup으로 확인.
    Logger.log('자동 설정 실패: ' + err.message);
  }
}

/** 수동으로 다시 설정하고 싶을 때 (자동 설정이 실패했을 때 등) */
function setup() {
  PropertiesService.getScriptProperties().deleteProperty('SETUP_DONE');
  setupColumns();
  var iconUrl = setupIcon();
  Logger.log('설정 완료. 아이콘 주소: ' + iconUrl);
  Logger.log('이제 [배포 관리] → 연필(수정) → 버전: 새 버전 → 배포 를 해주세요.');
  return iconUrl;
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

/**
 * 서명된 토큰. 서버에 세션을 따로 저장하지 않아도 위조를 막을 수 있다.
 * 이 환경은 브라우저 저장소가 안 남아서 토큰이 주소(?t=)에 실려 다닌다.
 */
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

/** 토큰이 아직 쓸 만한지 확인 (앱 시작 때) */
function checkToken(token) {
  try {
    var user = requireUser_(token);
    return { ok: true, name: String(user['이름']), id: String(user['아이디']) };
  } catch (err) {
    return { ok: false };
  }
}

/** 가입한 사람이 있는지 (없으면 첫 화면을 회원가입으로 연다) */
function hasAnyUser() {
  try {
    return userRows_().length > 0;
  } catch (err) {
    return true;
  }
}

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
  var photoUrl = '';
  if (photoDataUrl) {
    photoUrl = savePhoto_(photoDataUrl, data['와인명'] || 'wine');
  }
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

function savePhoto_(dataUrl, name) {
  var m = /^data:(image\/\w+);base64,(.+)$/.exec(dataUrl);
  if (!m) throw new Error('잘못된 이미지 형식입니다');
  var mimeType = m[1];
  var base64 = m[2];
  var blob = Utilities.newBlob(Utilities.base64Decode(base64), mimeType, name + '_' + Date.now());

  var folders = DriveApp.getFoldersByName(PHOTO_FOLDER_NAME);
  var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(PHOTO_FOLDER_NAME);
  var file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return 'https://drive.google.com/uc?id=' + file.getId();
}

/* ===================== Gemini 공용 ===================== */

var GEMINI_MODEL = 'gemini-2.0-flash';

/** Gemini 호출 후 JSON 응답을 파싱해서 반환. parts는 [{text:..}, {inline_data:..}] 형태. */
function callGemini_(parts) {
  var apiKey = prop_('GEMINI_API_KEY');
  if (!apiKey) throw new Error('GEMINI_API_KEY가 설정되지 않았어요 (스크립트 속성에 추가해주세요)');

  var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + GEMINI_MODEL + ':generateContent?key=' + apiKey;
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
    '라벨에서 읽을 수 없는 항목은 빈 문자열로 두세요. ' +
    '와인명은 라벨에 적힌 원문 표기(주로 영문/이탈리아어 등)를 그대로 쓰고, 종류·품종·생산지는 한국어로 쓰세요.';
  return callGemini_([{ text: prompt }, imagePart_(photoDataUrl)]);
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
    '각 병마다 하나의 객체를 만들고, 읽을 수 없는 항목은 빈 문자열로 두세요. ' +
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
 * 음식 입력 → 보유 와인 중 추천.
 * 각 와인의 "추천 페어링" 필드(셀러에 이미 적어둔 정보)를 최우선 근거로 삼고,
 * 거기 없어도 품종/종류로 AI가 순위·이유를 정한다(키워드가 안 겹쳐도 추천 가능).
 * API 실패 시 키워드 매칭으로 자동 대체.
 * 반환: [{ wine, reason, matched }] — matched는 셀러 페어링 정보에 직접 근거했는지
 */
function recommendByFood(token, food) {
  requireUser_(token);
  food = String(food || '').trim();
  if (!food) return [];

  var owned = getWines(token).wines.filter(function (w) { return w['상태'] === '보유'; });
  if (!owned.length) return [];

  // 셀러에 이미 적힌 페어링 문구와 글자가 직접 겹치는 와인 — 우리 데이터가 근거인 경우
  var directIds = {};
  owned.forEach(function (w) {
    var text = String(w['추천 페어링'] || '');
    if (text && food && text.indexOf(food) !== -1) directIds[w.rowIndex] = true;
  });

  try {
    var menu = owned.map(function (w) {
      return {
        id: w.rowIndex,
        이름: w['와인명'],
        종류: w['종류'],
        품종: w['품종'],
        생산지: w['생산지/국가'],
        기존페어링: w['추천 페어링'] || ''
      };
    });

    var prompt = '너는 소믈리에다. 아래는 우리 집 와인 셀러에 지금 있는 와인 목록이고, ' +
      '각 와인의 "기존페어링" 필드에는 우리가 이미 적어둔 어울리는 음식 정보가 있다.\n' +
      JSON.stringify(menu) + '\n\n' +
      '오늘 먹을 음식: "' + food + '"\n\n' +
      '이 음식에 가장 잘 어울리는 와인을 이 목록 안에서만 좋은 순서로 최대 3개 추천해라. ' +
      '와인의 "기존페어링" 필드에 이 음식(또는 같은 계열의 음식)이 이미 적혀 있으면 그것을 최우선 근거로 삼고, ' +
      'reason에 그 문구를 언급해라. 기존페어링에 없어도 품종·종류로 보아 잘 어울리면 추천해도 된다. ' +
      '한식이면 양념의 맛(맵기·단맛·기름기)까지 고려해라. ' +
      '아래 JSON 배열로만 답하라.\n' +
      '[{"id":숫자, "reason":"왜 어울리는지 한국어 한 문장", "fromCellarPairing":true또는false}]';

    var picks = callGemini_([{ text: prompt }]);
    var list = Array.isArray(picks) ? picks : (picks.recommendations || picks.list || []);

    var out = [];
    list.forEach(function (p) {
      for (var i = 0; i < owned.length; i++) {
        if (owned[i].rowIndex === p.id) {
          out.push({
            wine: owned[i],
            reason: p.reason || '',
            matched: !!p.fromCellarPairing || !!directIds[p.id]
          });
          break;
        }
      }
    });
    if (out.length) return out;
  } catch (e) {
    // AI 실패 시 아래 키워드 매칭으로 넘어감
  }

  return recommendByKeyword_(food, owned).map(function (x) {
    x.matched = !!directIds[x.wine.rowIndex];
    return x;
  });
}

/** AI를 못 쓸 때 쓰는 단순 키워드 매칭 대체 로직 */
function recommendByKeyword_(food, owned) {
  var keywords = food.split(/[\s,·・\/]+/).filter(Boolean);
  return owned
    .map(function (w) {
      var hay = [w['추천 페어링'], w['함께한음식'], w['종류'], w['품종'], w['와인배경']].join(' ');
      var s = 0;
      keywords.forEach(function (k) { if (hay.indexOf(k) !== -1) s += 1; });
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

    var priceNum = parseInt(String(w['평균가격(국내·원)'] || '').replace(/[^0-9]/g, ''), 10);
    var bracket = !priceNum ? '가격정보없음'
      : priceNum < 30000 ? '3만원 미만'
      : priceNum < 70000 ? '3~7만원'
      : priceNum < 150000 ? '7~15만원'
      : '15만원 이상';
    byPrice[bracket] = (byPrice[bracket] || 0) + 1;
  });

  return { totalDrunk: drunk.length, byMonth: byMonth, byType: byType, byGrape: byGrape, byPrice: byPrice };
}


/* ===================== 화면(Index.html) ===================== */

var INDEX_HTML = `<!DOCTYPE html>
<html>
<head>
  <base target="_top">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
  <!-- 홈 화면에 추가했을 때 앱처럼 보이도록 -->
  <meta name="theme-color" content="#8C1D33">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-title" content="와인">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <link rel="apple-touch-icon" href="data:image/png;base64,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">
  <link rel="icon" type="image/png" href="data:image/png;base64,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">
  <style>
    :root {
      --bg:#FAF6F1; --surface:#FFFFFF; --line:#EDE3D8;
      --tx:#2E2A26; --sub:#8A7F74;
      --wine:#8C1D33; --wine-soft:#F7E9EC;
      --gold:#C8952A; --ok:#3E7C4A;
      --shadow:0 1px 3px rgba(60,40,30,.07), 0 6px 16px rgba(60,40,30,.05);
    }
    * { box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
    html, body { overscroll-behavior-y:none; }
    body {
      margin:0 auto; max-width:480px; min-height:100vh;
      /* 단어 중간이 잘려서 다음 줄로 안 넘어가게. 줄바꿈은 띄어쓰기 단위로만 일어난다 */
      word-break:keep-all; overflow-wrap:normal;
      font-family:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Segoe UI",Roboto,sans-serif;
      background:var(--bg); color:var(--tx);
      padding-bottom:86px; font-size:15px;
    }
    /* 배경 와인잔 워터마크 — 빈 공간에만 은은하게 비친다 */
    body::before {
      content:''; position:fixed; z-index:0; pointer-events:none;
      left:50%; bottom:2%; transform:translateX(-50%);
      width:min(88vw, 380px); height:60vh; opacity:.045;
      background:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Cpath d='M31 17h38v13c0 10.5-8.5 19-19 19s-19-8.5-19-19z' fill='%238C1D33'/%3E%3Cpath d='M48 49h4v26h-4z' fill='%238C1D33'/%3E%3Crect x='33' y='75' width='34' height='5.5' rx='2.75' fill='%238C1D33'/%3E%3C/svg%3E") no-repeat center/contain;
    }
    header, main, nav { position:relative; z-index:1; }
    main { padding:0 16px; }
    .page { display:none; }
    .page.on { display:block; animation:fade .18s ease; }
    @keyframes fade { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:none} }

    /* ---------- 잠금 화면 ---------- */
    #pinScreen {
      position:fixed; inset:0; z-index:60; background:var(--wine);
      display:flex; flex-direction:column; align-items:center; justify-content:center; gap:18px;
      color:#fff;
    }
    #pinScreen .glass {
      width:82px; height:82px;
      background:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Cpath d='M31 17h38v13c0 10.5-8.5 19-19 19s-19-8.5-19-19z' fill='%23ffffff'/%3E%3Cpath d='M32.4 27h35.2v3c0 10.5-8.5 19-17.6 19s-17.6-8.5-17.6-19z' fill='%23E8A0AF'/%3E%3Cpath d='M48 49h4v26h-4z' fill='%23ffffff'/%3E%3Crect x='33' y='75' width='34' height='5.5' rx='2.75' fill='%23ffffff'/%3E%3C/svg%3E") no-repeat center/contain;
    }
    #pinScreen .t { font-size:22px; font-weight:700; letter-spacing:-.3px; }
    .auth-form { display:flex; flex-direction:column; gap:10px; width:250px; }
    .auth-hint { width:min(86vw, 320px); text-align:center; font-size:12.5px; line-height:1.7; color:rgba(255,255,255,.62); }
    .auth-form input {
      width:100%; padding:14px 16px; border-radius:14px; border:none;
      background:rgba(255,255,255,.16); color:#fff; font-size:16px; font-weight:600;
    }
    .auth-form input::placeholder { color:rgba(255,255,255,.55); font-weight:400; }
    .auth-form input:focus { outline:2px solid rgba(255,255,255,.5); }
    #authBtn { padding:15px; border-radius:14px; border:none; background:#fff; color:var(--wine); font-size:16px; font-weight:800; margin-top:2px; }
    #authBtn:disabled { opacity:.6; }
    #pinErr { color:#FFD9DF; font-size:13.5px; min-height:18px; text-align:center; width:250px; line-height:1.5; }

    /* ---------- 헤더 ---------- */
    header { padding:20px 16px 12px; }
    header .row { display:flex; align-items:baseline; justify-content:space-between; }
    header h1 { margin:0; font-size:24px; font-weight:800; letter-spacing:-.6px; }
    header .count { font-size:13px; color:var(--sub); }

    /* ---------- 세그먼트 ---------- */
    .seg { display:flex; background:#F0E7DC; border-radius:12px; padding:4px; margin-bottom:14px; }
    .seg div { flex:1; text-align:center; padding:9px 0; border-radius:9px; font-size:14px; font-weight:700; color:var(--sub); }
    .seg div.on { background:var(--surface); color:var(--wine); box-shadow:0 1px 3px rgba(60,40,30,.12); }

    /* ---------- 검색 ---------- */
    .search { position:relative; margin-bottom:14px; }
    .search input {
      width:100%; padding:13px 14px 13px 40px; border-radius:13px; border:1px solid var(--line);
      background:var(--surface); color:var(--tx); font-size:15px;
    }
    .search::before { content:'🔍'; position:absolute; left:14px; top:50%; transform:translateY(-50%); font-size:14px; opacity:.5; }
    input, textarea { font-family:inherit; }
    input:focus, textarea:focus { outline:2px solid var(--wine-soft); outline-offset:0; border-color:var(--wine); }

    /* ---------- 와인 카드 ---------- */
    .card {
      position:relative; background:var(--surface); border-radius:16px; padding:15px 15px 15px 22px;
      margin-bottom:11px; box-shadow:var(--shadow); overflow:hidden;
    }
    .card::before { content:''; position:absolute; left:0; top:0; bottom:0; width:6px; background:var(--c, #9A8C7E); }
    .card.dim { opacity:.62; }
    .card .name { font-size:16px; font-weight:700; letter-spacing:-.3px; line-height:1.3; padding-right:6px; }
    .card .line { display:flex; align-items:center; gap:7px; margin-top:7px; flex-wrap:wrap; }
    .tag { font-size:12px; font-weight:700; padding:3px 9px; border-radius:8px; background:var(--c-soft,#F0EBE5); color:var(--c,#6B6259); }
    .dot { font-size:12.5px; color:var(--sub); }
    .card .foot { display:flex; align-items:center; justify-content:space-between; margin-top:13px; gap:10px; }
    .stars { color:var(--gold); font-size:14px; letter-spacing:1px; }
    .drink-btn {
      border:none; background:var(--wine); color:#fff; font-size:14px; font-weight:800;
      padding:10px 20px; border-radius:11px; white-space:nowrap;
    }
    .undo-btn { border:1px solid var(--line); background:var(--surface); color:var(--sub); font-size:13px; font-weight:700; padding:9px 16px; border-radius:11px; }
    .when { font-size:12.5px; color:var(--sub); }

    .reason { margin-top:10px; background:var(--wine-soft); color:#6E1729; font-size:13.5px; line-height:1.5; padding:10px 12px; border-radius:11px; }

    .empty { text-align:center; color:var(--sub); padding:56px 16px; font-size:14px; line-height:1.7; }
    .empty .big { font-size:44px; display:block; margin-bottom:10px; }
    .loading { text-align:center; color:var(--sub); padding:44px 0; font-size:14px; }

    /* ---------- 탭바 ---------- */
    nav {
      position:fixed; bottom:0; left:50%; transform:translateX(-50%);
      width:100%; max-width:480px; display:flex;
      background:rgba(255,255,255,.94); backdrop-filter:blur(12px);
      border-top:1px solid var(--line); padding-bottom:env(safe-area-inset-bottom);
    }
    nav div { flex:1; text-align:center; padding:9px 0 10px; color:var(--sub); font-size:11px; font-weight:700; }
    nav div .ic { display:block; font-size:21px; margin-bottom:2px; filter:grayscale(1) opacity(.5); }
    nav div.on { color:var(--wine); }
    nav div.on .ic { filter:none; }

    /* ---------- 입력 폼 ---------- */
    .field { margin-bottom:12px; }
    .field input, .field textarea {
      width:100%; padding:13px 14px; border-radius:13px; border:1px solid var(--line);
      background:var(--surface); color:var(--tx); font-size:15px;
    }
    .field textarea { resize:vertical; min-height:52px; }
    .field.big input { font-size:18px; font-weight:700; padding:15px 14px; }
    .duo { display:flex; gap:10px; }
    .duo .field { flex:1; }

    .chips { display:flex; gap:7px; flex-wrap:wrap; margin-bottom:14px; }
    .chips button {
      border:1.5px solid var(--line); background:var(--surface); color:var(--sub);
      padding:9px 15px; border-radius:11px; font-size:14px; font-weight:700;
    }
    .chips button.on { border-color:var(--c); background:var(--c-soft); color:var(--c); }
    .chips.sub button { font-size:13px; padding:7px 13px; opacity:.9; }
    .chips.sub:empty { display:none; }
    .match-badge { display:inline-flex; align-items:center; gap:4px; font-size:11.5px; font-weight:800; color:var(--ok); background:#E7F2E9; padding:3px 9px; border-radius:20px; margin-top:8px; }

    .more-toggle { width:100%; text-align:center; padding:12px; color:var(--sub); font-size:13.5px; font-weight:700; background:none; border:none; }
    #moreFields { display:none; }
    #moreFields.on { display:block; }

    .primary-btn {
      width:100%; padding:16px; border:none; border-radius:14px;
      background:var(--wine); color:#fff; font-size:16px; font-weight:800; margin-top:4px;
    }
    .primary-btn:disabled { opacity:.5; }

    /* ---------- 사진 ---------- */
    .shoot { display:flex; gap:10px; margin-bottom:16px; }
    .shoot label {
      flex:1; text-align:center; padding:18px 8px; border-radius:16px; background:var(--surface);
      border:1.5px dashed var(--line); box-shadow:var(--shadow);
    }
    .shoot label .ic { display:block; font-size:28px; margin-bottom:5px; }
    .shoot label .t { font-size:13.5px; font-weight:800; }
    .shoot label .s { font-size:11.5px; color:var(--sub); margin-top:2px; }
    .shoot input { display:none; }
    /* 결과가 접히지 않도록 미리보기는 썸네일 높이로 제한 */
    #photoPreview img { width:100%; max-height:150px; object-fit:cover; border-radius:14px; margin-bottom:12px; display:block; }
    .note { font-size:13px; padding:11px 13px; border-radius:11px; background:var(--wine-soft); color:#6E1729; margin-bottom:12px; line-height:1.5; }
    .btn-copy { display:inline-block; margin-right:6px; margin-bottom:6px; border:none; background:var(--wine); color:#fff; font-size:12.5px; font-weight:700; padding:9px 15px; border-radius:9px; text-decoration:none; }
    .btn-copy.ghost { background:transparent; color:var(--wine); border:1px solid var(--wine); }

    /* 홈 화면 추가 / 공유 */
    .act-row { display:flex; gap:10px; margin:12px 0 8px; }
    .act {
      flex:1; background:var(--surface); border:1px solid var(--line); border-radius:14px;
      padding:14px 8px; font-size:13px; font-weight:700; color:var(--tx); box-shadow:var(--shadow);
    }
    .act .ic { display:block; font-size:22px; margin-bottom:5px; }
    .step { display:flex; gap:11px; align-items:flex-start; padding:11px 0; border-bottom:1px solid var(--line); font-size:14.5px; line-height:1.55; }
    .step:last-child { border-bottom:none; }
    .step .num {
      flex:0 0 22px; height:22px; border-radius:50%; background:var(--wine); color:#fff;
      font-size:12px; font-weight:800; display:flex; align-items:center; justify-content:center; margin-top:1px;
    }
    .note.warn { background:#FFF3E0; color:#8A5A00; }

    /* 셀러 인식 결과 */
    .pick {
      display:flex; align-items:center; gap:12px; background:var(--surface); border-radius:14px;
      padding:13px 14px; margin-bottom:9px; box-shadow:var(--shadow);
    }
    .pick .box { width:24px; height:24px; border-radius:8px; border:2px solid var(--line); flex:0 0 24px; display:flex; align-items:center; justify-content:center; font-size:14px; color:#fff; }
    .pick.on .box { background:var(--wine); border-color:var(--wine); }
    .pick .info { flex:1; min-width:0; }
    .pick .nm { font-size:14.5px; font-weight:700; line-height:1.3; }
    .pick .sb { font-size:12px; color:var(--sub); margin-top:3px; }
    .pick.dup { opacity:.55; }

    /* ---------- 모달 ---------- */
    .modal-bg { position:fixed; inset:0; background:rgba(46,42,38,.45); display:none; align-items:flex-end; z-index:50; }
    .modal-bg.on { display:flex; }
    .modal {
      background:var(--bg); width:100%; max-width:480px; margin:0 auto;
      border-radius:24px 24px 0 0; padding:10px 18px 30px; max-height:88vh; overflow-y:auto;
      animation:up .22s ease;
    }
    @keyframes up { from{transform:translateY(30px)} to{transform:none} }
    .grip { width:38px; height:4px; border-radius:4px; background:var(--line); margin:0 auto 16px; }
    .modal h3 { margin:0 0 4px; font-size:20px; font-weight:800; letter-spacing:-.4px; line-height:1.3; }

    .facts { margin-top:16px; }
    .fact { display:flex; gap:11px; padding:12px 0; border-bottom:1px solid var(--line); align-items:flex-start; }
    .fact:last-child { border-bottom:none; }
    .fact .k { flex:0 0 78px; color:var(--sub); font-size:13.5px; }
    .fact .v { flex:1; font-size:14.5px; line-height:1.5; }

    .star-pick { display:flex; gap:10px; justify-content:center; font-size:38px; margin:6px 0 20px; }
    .star-pick span { color:var(--line); }
    .star-pick span.on { color:var(--gold); }

    /* ---------- 통계 ---------- */
    .hero { background:var(--wine); color:#fff; border-radius:18px; padding:22px; text-align:center; margin-bottom:18px; }
    .hero .n { font-size:44px; font-weight:800; line-height:1; }
    .hero .l { font-size:13px; opacity:.85; margin-top:7px; }
    .sect { font-size:13px; font-weight:800; color:var(--sub); margin:20px 0 10px; }
    /* 레이블을 바 위에 따로 두어, 길거나 괄호 붙은 이름(품종 등)도 한 줄에 다 들어오게 한다 */
    .bar-row { padding:8px 0; }
    .bar-row .k { display:block; font-size:13.5px; font-weight:700; white-space:nowrap; margin-bottom:6px; }
    .bar-row .row2 { display:flex; align-items:center; gap:11px; }
    .bar-wrap { flex:1; height:22px; background:#F0E7DC; border-radius:7px; overflow:hidden; }
    .bar { height:100%; background:var(--c,var(--wine)); border-radius:7px; }
    .bar-row .n { flex:0 0 26px; text-align:right; font-size:13.5px; font-weight:800; color:var(--sub); }

    #toast {
      position:fixed; bottom:96px; left:50%; transform:translateX(-50%);
      background:var(--tx); color:#fff; padding:12px 22px; border-radius:14px; font-size:14px; font-weight:700;
      opacity:0; transition:opacity .2s; pointer-events:none; z-index:70; max-width:88%; text-align:center;
    }
    #toast.show { opacity:.95; }
  </style>
</head>
<body>

  <div id="pinScreen">
    <div class="glass"></div>
    <div class="t">와인 딸까 말까</div>

    <form class="auth-form" onsubmit="submitAuth(event)">
      <input id="authId" placeholder="셀러 이름" autocomplete="username" autocapitalize="none" spellcheck="false">
      <input id="authPw" type="password" placeholder="비밀번호 4자리 숫자" autocomplete="current-password"
        inputmode="numeric" pattern="[0-9]*" maxlength="4" oninput="this.value=this.value.replace(/\\D/g,'').slice(0,4)">
      <button id="authBtn" type="submit">시작하기</button>
    </form>
    <div id="pinErr"></div>
    <div class="auth-hint">처음 쓰는 이름이면 셀러가 새로 만들어져요. 같은 이름·비밀번호를 넣으면 둘이 같은 셀러를 봅니다.</div>
  </div>

  <header>
    <div class="row">
      <h1 id="pgTitle">셀러</h1>
      <span class="count" id="pgCount"></span>
    </div>
    <div id="bookmarkTip"></div>
  </header>

  <main>
    <!-- 셀러 -->
    <div id="pgCellar" class="page on">
      <div class="seg">
        <div class="on" data-s="보유" onclick="setSeg('보유')">보유</div>
        <div data-s="마심" onclick="setSeg('마심')">마신 와인</div>
      </div>
      <div class="search"><input id="search" placeholder="와인 이름, 품종…" oninput="renderList()"></div>
      <div id="listArea"><div class="loading">불러오는 중…</div></div>
    </div>

    <!-- 추천 -->
    <div id="pgFood" class="page">
      <div class="field big">
        <input id="foodInput" placeholder="오늘 뭐 먹어요?" onkeydown="if(event.key==='Enter')doRecommend()">
      </div>
      <div class="chips" id="foodQuick"></div>
      <div class="chips sub" id="foodSub"></div>
      <button class="primary-btn" onclick="doRecommend()">어울리는 와인 찾기</button>
      <div id="foodArea" style="margin-top:18px;"></div>
    </div>

    <!-- 추가 -->
    <div id="pgAdd" class="page">
      <div class="shoot">
        <label for="photoOne">
          <span class="ic">🍾</span>
          <span class="t">라벨 찍기</span>
          <span class="s">한 병</span>
          <input type="file" id="photoOne" accept="image/*" capture="environment" onchange="onPhoto(event,'one')">
        </label>
        <label for="photoAll">
          <span class="ic">📸</span>
          <span class="t">셀러 찍기</span>
          <span class="s">여러 병 한번에</span>
          <input type="file" id="photoAll" accept="image/*" capture="environment" onchange="onPhoto(event,'all')">
        </label>
      </div>

      <div id="photoPreview"></div>
      <div id="photoNote"></div>

      <!-- 셀러 인식 결과 선택 -->
      <div id="pickArea" style="display:none;">
        <div id="pickList"></div>
        <button class="primary-btn" id="pickBtn" onclick="addPicked()">담기</button>
        <button class="more-toggle" onclick="cancelPick()">취소</button>
      </div>

      <!-- 직접 입력 폼 -->
      <form id="addForm" onsubmit="submitAdd(event)">
        <div class="field big"><input id="f_와인명" placeholder="와인 이름" required></div>
        <div class="chips" id="typeChips"></div>
        <div class="duo">
          <div class="field"><input id="f_품종" placeholder="품종" oninput="checkSimilar()"></div>
          <div class="field"><input id="f_빈티지" placeholder="빈티지"></div>
        </div>
        <div class="field"><input id="f_생산지/국가" placeholder="생산지 / 국가"></div>
        <div class="field"><input id="f_평균가격(국내·원)" placeholder="가격 (원)" inputmode="numeric"></div>
        <div id="similarHint"></div>

        <button type="button" class="more-toggle" onclick="toggleMore()"><span id="moreLabel">＋ 자세히 입력</span></button>
        <div id="moreFields">
          <div class="field"><textarea id="f_추천 페어링" placeholder="어울리는 음식"></textarea></div>
          <div class="duo">
            <div class="field"><input id="f_어울리는잔" placeholder="어울리는 잔"></div>
            <div class="field"><input id="f_서빙방법" placeholder="서빙 온도 / 방법"></div>
          </div>
          <div class="field"><textarea id="f_와인배경" placeholder="와인 배경·스토리"></textarea></div>
          <div class="field"><input id="f_평균가격(글로벌·USD)" placeholder="해외가 (USD)"></div>
          <div class="field"><textarea id="f_메모" placeholder="메모"></textarea></div>
        </div>

        <button class="primary-btn" id="addBtn" type="submit">셀러에 넣기</button>
      </form>
    </div>

    <!-- 기록 -->
    <div id="pgStat" class="page">
      <div id="statArea"><div class="loading">불러오는 중…</div></div>
    </div>
  </main>

  <nav id="tabbar">
    <div class="on" data-p="Cellar" onclick="showPage('Cellar')"><span class="ic">🍷</span>셀러</div>
    <div data-p="Food" onclick="showPage('Food')"><span class="ic">🍽️</span>추천</div>
    <div data-p="Add" onclick="showPage('Add')"><span class="ic">📸</span>추가</div>
    <div data-p="Stat" onclick="showPage('Stat')"><span class="ic">📊</span>기록</div>
  </nav>

  <div class="modal-bg" id="detailModal" onclick="if(event.target===this) cm('detailModal')">
    <div class="modal"><div class="grip"></div><div id="detailBody"></div></div>
  </div>

  <div class="modal-bg" id="installModal" onclick="if(event.target===this) cm('installModal')">
    <div class="modal"><div class="grip"></div><div id="installBody"></div></div>
  </div>

  <div class="modal-bg" id="drinkModal" onclick="if(event.target===this) cm('drinkModal')">
    <div class="modal">
      <div class="grip"></div>
      <h3 id="drinkTitle"></h3>
      <div class="star-pick" id="starPick"></div>
      <div class="field"><textarea id="drinkComment" placeholder="어땠어요?"></textarea></div>
      <div class="field"><input id="drinkFood" placeholder="뭐랑 드셨어요?"></div>
      <button class="primary-btn" onclick="confirmDrink()">기록하기</button>
      <button class="more-toggle" onclick="cm('drinkModal')">닫기</button>
    </div>
  </div>

  <div id="toast"></div>

  <script>
    var ALL_WINES = [], SEG = '보유', PENDING_ROW = null, CURRENT_RATING = 5;
    var PHOTO_DATAURL = null, PICKS = [], PICK_ON = {}, SELECTED_TYPE = '';

    var TYPES = [
      { n:'레드',        c:'#8C1D33', s:'#F7E9EC' },
      { n:'화이트',      c:'#B08512', s:'#FBF2DC' },
      { n:'스파클링',    c:'#8A7A1F', s:'#F7F4DE' },
      { n:'로제',        c:'#C1607A', s:'#FBEDF1' },
      { n:'주정강화',    c:'#7A4420', s:'#F5EAE1' }
    ];
    function typeStyle(t) {
      t = String(t || '');
      for (var i = 0; i < TYPES.length; i++) {
        if (t.indexOf(TYPES[i].n) !== -1) return TYPES[i];
      }
      if (t.indexOf('포트') !== -1) return TYPES[4];
      return { n:t || '기타', c:'#9A8C7E', s:'#F0EBE5' };
    }

    /**
     * 음식 빠른 선택. 종류가 많은 카테고리(치킨/파스타/치즈)는 하위 메뉴로 세분화한다.
     * children이 없으면 눌렀을 때 바로 검색, 있으면 하위 칩을 펼친다.
     */
    var FOOD_MENU = [
      { label: '삼겹살' },
      { label: '스테이크' },
      { label: '회' },
      { label: '치킨', children: ['후라이드', '양념치킨', '간장치킨', '마늘치킨', '핫윙', '순살치킨'] },
      { label: '파스타', children: ['토마토파스타', '크림파스타', '오일파스타', '로제파스타', '봉골레파스타', '미트소스파스타'] },
      { label: '치즈', children: ['브리치즈', '까망베르', '체다치즈', '블루치즈', '고다치즈', '파르미지아노'] }
    ];
    var OPEN_FOOD_CAT = null;

    /* ---------- 헬퍼 ---------- */
    function om(id) { document.getElementById(id).classList.add('on'); }
    function cm(id) { document.getElementById(id).classList.remove('on'); }
    function esc(s) {
      if (s === undefined || s === null) return '';
      return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    function toast(m) {
      var t = document.getElementById('toast');
      t.textContent = m; t.classList.add('show');
      setTimeout(function () { t.classList.remove('show'); }, 1900);
    }
    function findWine(r) {
      for (var i = 0; i < ALL_WINES.length; i++) if (ALL_WINES[i].rowIndex === r) return ALL_WINES[i];
      return null;
    }
    function starsHtml(n) {
      n = parseInt(n, 10) || 0;
      var s = '';
      for (var i = 1; i <= 5; i++) s += (i <= n ? '★' : '☆');
      return s;
    }

    /* ---------- 로그인 ----------
     * 주소에 ?t=토큰 이 붙어 있으면 서버가 아래 값에 토큰을 심어서 내려준다.
     * Apps Script는 화면을 매번 다른 googleusercontent 주소의 iframe으로 서빙해서
     * localStorage가 남지 않는다. 그래서 "로그인 기억"은 주소 자체가 담당한다.
     */
    var TOKEN = '/*TOKEN*/';
    var ME = '';

    /** 이름 + 비번 하나로 끝. 없는 이름이면 셀러가 새로 생기고, 있으면 그 셀러로 들어간다. */
    function submitAuth(ev) {
      ev.preventDefault();
      var name = document.getElementById('authId').value.trim();
      var pw = document.getElementById('authPw').value;
      var err = document.getElementById('pinErr');
      if (!name || !pw) { err.textContent = '이름과 비밀번호를 입력해주세요'; return; }
      if (!/^\\d{4}$/.test(pw)) { err.textContent = '비밀번호는 4자리 숫자로 입력해주세요'; return; }

      var btn = document.getElementById('authBtn');
      btn.disabled = true; btn.textContent = '잠시만요…';
      err.textContent = '';

      google.script.run.withSuccessHandler(function (res) {
        btn.disabled = false; btn.textContent = '시작하기';
        if (!res || res.error) { err.textContent = (res && res.error) || '문제가 생겼어요'; return; }
        TOKEN = res.token; ME = res.name;
        document.getElementById('pinScreen').style.display = 'none';
        if (res.moved) toast('기존 와인 ' + res.moved + '병을 가져왔어요');
        else if (res.created) toast(res.name + ' 셀러를 만들었어요 🍾');
        showBookmarkTip();
        load();
      }).withFailureHandler(function (e) {
        btn.disabled = false; btn.textContent = '시작하기';
        err.textContent = e.message || '문제가 생겼어요';
      }).enter(name, pw);
    }

    /** 로그인 직후 한 번, 홈 화면에 추가하라고 가볍게 안내 */
    function showBookmarkTip() {
      var box = document.getElementById('bookmarkTip');
      box.innerHTML = '<div class="note">📱 <b>홈 화면에 두면 앱처럼 쓸 수 있어요</b>' +
        '<div style="margin-top:9px">' +
        '<button type="button" class="btn-copy" onclick="openInstall()">홈 화면에 추가</button>' +
        '<button type="button" class="btn-copy ghost" onclick="document.getElementById(\\'bookmarkTip\\').innerHTML=\\'\\'">나중에</button>' +
        '</div></div>';
    }

    /* ---------- 홈 화면 추가 / 공유 ---------- */

    /** 기기 판별. 안내 문구가 기기마다 달라야 해서 필요하다. */
    function platform() {
      var ua = navigator.userAgent || '';
      // 아이패드는 최근 iOS에서 데스크톱 UA를 쓴다 → 터치 지원 여부로 함께 판별
      var isIOS = /iPad|iPhone|iPod/.test(ua) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      if (isIOS) return 'ios';
      if (/Android/i.test(ua)) return 'android';
      return 'desktop';
    }

    var INSTALL_STEPS = {
      ios: {
        title: '아이폰 홈 화면에 추가',
        steps: [
          '아래 <b>내 주소로 열기</b>를 누르세요',
          '화면 아래 <b>공유 버튼 <span style="font-size:15px">⬆️</span></b>를 누르세요',
          '목록을 내려서 <b>홈 화면에 추가</b>를 누르세요',
          '오른쪽 위 <b>추가</b>를 누르면 끝'
        ],
        warn: '사파리에서만 됩니다. 크롬으로 열었다면 사파리로 다시 열어주세요.'
      },
      android: {
        title: '안드로이드 홈 화면에 추가',
        steps: [
          '아래 <b>내 주소로 열기</b>를 누르세요',
          '크롬 오른쪽 위 <b>⋮</b>를 누르세요',
          '<b>홈 화면에 추가</b> (또는 <b>앱 설치</b>)를 누르세요',
          '<b>추가</b>를 누르면 끝'
        ],
        warn: '크롬에서 하시는 게 가장 잘 됩니다.'
      },
      desktop: {
        title: '바로가기 만들기',
        steps: [
          '아래 <b>내 주소로 열기</b>를 누르세요',
          '주소창 오른쪽 <b>설치 아이콘</b>을 누르거나',
          '<b>Ctrl+D</b>(맥은 <b>⌘+D</b>)로 즐겨찾기에 추가하세요'
        ],
        warn: ''
      }
    };

    function openInstall() {
      var box = document.getElementById('installBody');
      box.innerHTML = '<h3>📱 준비 중…</h3>';
      om('installModal');

      google.script.run.withSuccessHandler(function (url) {
        var g = INSTALL_STEPS[platform()];
        var mine = url ? url + '?t=' + encodeURIComponent(TOKEN) : '';
        var list = g.steps.map(function (s, i) {
          return '<div class="step"><span class="num">' + (i + 1) + '</span><span>' + s + '</span></div>';
        }).join('');

        box.innerHTML = '<h3>' + esc(g.title) + '</h3>' +
          '<div class="facts" style="margin-top:12px">' + list + '</div>' +
          (g.warn ? '<div class="note warn" style="margin-top:12px">⚠️ ' + g.warn + '</div>' : '') +
          (mine
            ? '<a class="primary-btn" style="display:block;text-align:center;text-decoration:none;margin-top:14px" href="' + esc(mine) + '" target="_top">내 주소로 열기</a>' +
              '<div class="note" style="margin-top:10px">🔑 이 주소에는 자동 로그인 열쇠가 들어 있어요. <b>남에게 보내지 마세요.</b> 다른 사람에게는 아래 <b>앱 공유</b>를 쓰시면 됩니다.</div>'
            : '<div class="note warn" style="margin-top:14px">주소를 가져오지 못했어요. 잠시 후 다시 시도해주세요.</div>') +
          '<button class="more-toggle" onclick="cm(\\'installModal\\')">닫기</button>';
      }).withFailureHandler(function (e) {
        box.innerHTML = '<h3>📱 홈 화면에 추가</h3><div class="note warn" style="margin-top:12px">' + esc(e.message) + '</div>' +
          '<button class="more-toggle" onclick="cm(\\'installModal\\')">닫기</button>';
      }).getAppUrl();
    }

    /** 앱 공유. 토큰이 빠진 기본 주소만 보낸다(받은 사람은 이름·비번을 알아야 들어옴). */
    function shareApp() {
      google.script.run.withSuccessHandler(function (url) {
        if (!url) { toast('주소를 가져오지 못했어요'); return; }
        var data = { title: '와인 딸까 말까', text: '우리집 와인 셀러 앱이에요', url: url };
        // 아이폰·안드로이드의 기본 공유 시트. iframe 안에서는 막히는 경우가 있어 실패하면 복사로.
        if (navigator.share) {
          navigator.share(data).catch(function () { copyText(url); });
        } else {
          copyText(url);
        }
      }).withFailureHandler(function (e) { toast('실패: ' + e.message); }).getAppUrl();
    }

    function copyText(text) {
      var done = function () { toast('주소를 복사했어요 📋'); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text, done); });
      } else {
        fallbackCopy(text, done);
      }
    }
    function fallbackCopy(text, done) {
      var t = document.createElement('textarea');
      t.value = text;
      t.style.position = 'fixed'; t.style.opacity = '0';
      document.body.appendChild(t);
      t.select(); t.setSelectionRange(0, text.length);
      var okCopy = false;
      try { okCopy = document.execCommand('copy'); } catch (e) {}
      document.body.removeChild(t);
      if (okCopy) done(); else toast('복사가 안 돼요. 주소창을 길게 눌러 복사해주세요');
    }

    /** 주소에 실려온 토큰이 아직 유효한지 확인하고 앱을 연다 */
    function bootstrap() {
      if (!TOKEN) return;
      google.script.run.withSuccessHandler(function (res) {
        if (res && res.ok) {
          ME = res.name;
          document.getElementById('pinScreen').style.display = 'none';
          load();
        } else {
          TOKEN = '';
          document.getElementById('pinErr').textContent = '다시 들어와주세요';
        }
      }).withFailureHandler(function () {
        TOKEN = '';
      }).checkToken(TOKEN);
    }

    /* ---------- 화면 전환 ---------- */
    var TITLES = { Cellar:'셀러', Food:'추천', Add:'와인 추가', Stat:'기록' };
    function showPage(p) {
      ['Cellar', 'Food', 'Add', 'Stat'].forEach(function (n) {
        document.getElementById('pg' + n).classList.toggle('on', n === p);
      });
      document.querySelectorAll('#tabbar div').forEach(function (t) { t.classList.toggle('on', t.dataset.p === p); });
      document.getElementById('pgTitle').textContent = TITLES[p];
      document.getElementById('pgCount').textContent = '';
      if (p === 'Cellar') { load(); }
      if (p === 'Stat') loadStats();
      window.scrollTo(0, 0);
    }

    function load() {
      google.script.run.withSuccessHandler(function (d) {
        ALL_WINES = d.wines; renderList();
      }).withFailureHandler(function (e) {
        document.getElementById('listArea').innerHTML = '<div class="empty"><span class="big">😵</span>불러오지 못했어요<br>' + esc(e.message) + '</div>';
      }).getWines(TOKEN);
    }

    /* ---------- 목록 ---------- */
    function setSeg(v) {
      SEG = v;
      document.querySelectorAll('.seg div').forEach(function (d) { d.classList.toggle('on', d.dataset.s === v); });
      renderList();
    }
    /** 와인을 담은 직후엔 '마신 와인'이 아니라 방금 담은 게 보이는 보유 칸으로 */
    function goCellarOwned() {
      SEG = '보유';
      document.querySelectorAll('.seg div').forEach(function (d) { d.classList.toggle('on', d.dataset.s === '보유'); });
      showPage('Cellar');
    }

    function renderList() {
      var q = (document.getElementById('search').value || '').trim().toLowerCase();
      var list = ALL_WINES.filter(function (w) {
        if ((w['상태'] || '보유') !== SEG) return false;
        if (!q) return true;
        return [w['와인명'], w['품종'], w['종류'], w['생산지/국가']].join(' ').toLowerCase().indexOf(q) !== -1;
      });
      list.sort(function (a, b) {
        var ka = SEG === '마심' ? (a['마신날짜'] || '') : (a['등록일'] || '');
        var kb = SEG === '마심' ? (b['마신날짜'] || '') : (b['등록일'] || '');
        return kb.localeCompare(ka);
      });

      document.getElementById('pgCount').textContent = list.length ? list.length + '병' : '';

      var area = document.getElementById('listArea');
      if (!list.length) {
        area.innerHTML = q
          ? '<div class="empty"><span class="big">🔍</span>찾는 와인이 없어요</div>'
          : (SEG === '보유'
            ? '<div class="empty"><span class="big">🍷</span>셀러가 비어 있어요<br>아래 <b>추가</b>에서 사진을 찍어보세요</div>'
            : '<div class="empty"><span class="big">🥂</span>아직 마신 기록이 없어요</div>');
        return;
      }
      // map이 index를 두 번째 인자로 넘기지 않도록 감싼다(extraHtml 자리)
      area.innerHTML = list.map(function (w) { return cardHtml(w); }).join('');
    }

    function cardHtml(w, extraHtml) {
      var isDrunk = w['상태'] === '마심';
      var t = typeStyle(w['종류']);
      var bits = [w['빈티지'], (w['생산지/국가'] || '').split('/').pop()].filter(Boolean);
      var sub = bits.length ? '<span class="dot">' + esc(bits.join(' · ')) + '</span>' : '';
      var grape = w['품종'] ? '<span class="dot">' + esc(String(w['품종']).split(/[·,]/)[0]) + '</span>' : '';

      var foot = isDrunk
        ? '<span class="when">' + esc(w['마신날짜']) + '</span>' +
          (w['평점'] ? '<span class="stars">' + starsHtml(w['평점']) + '</span>' : '') +
          '<button class="undo-btn" onclick="event.stopPropagation();doUnmark(' + w.rowIndex + ')">되돌리기</button>'
        : '<span></span><button class="drink-btn" onclick="event.stopPropagation();openDrinkModal(' + w.rowIndex + ')">마시기</button>';

      return '<div class="card' + (isDrunk ? ' dim' : '') + '" style="--c:' + t.c + ';--c-soft:' + t.s + '" onclick="openDetail(' + w.rowIndex + ')">' +
        '<div class="name">' + esc(w['와인명']) + '</div>' +
        '<div class="line"><span class="tag">' + esc(t.n) + '</span>' + grape + sub + '</div>' +
        (extraHtml || '') +
        '<div class="foot">' + foot + '</div>' +
        '</div>';
    }

    /* ---------- 상세 ---------- */
    function openDetail(r) {
      var w = findWine(r); if (!w) return;
      var t = typeStyle(w['종류']);
      var facts = [
        ['🍇 품종', w['품종']],
        ['📍 생산지', w['생산지/국가']],
        ['📅 빈티지', w['빈티지']],
        ['💰 가격', w['평균가격(국내·원)']],
        ['🥂 잔', w['어울리는잔']],
        ['🌡 서빙', w['서빙방법']],
        ['🍽 페어링', w['추천 페어링']],
        ['📖 배경', w['와인배경']],
        ['📝 메모', w['메모']]
      ];
      if (w['상태'] === '마심') {
        facts.push(['🍷 마신날', w['마신날짜']]);
        facts.push(['⭐ 평점', w['평점'] ? starsHtml(w['평점']) : '']);
        facts.push(['💬 한줄평', w['한줄평']]);
        facts.push(['🍴 함께한 음식', w['함께한음식']]);
      }
      var photo = w['라벨사진'] ? '<img src="' + esc(w['라벨사진']) + '" style="width:100%;border-radius:14px;margin:14px 0 4px;">' : '';
      document.getElementById('detailBody').innerHTML =
        '<h3>' + esc(w['와인명']) + '</h3>' +
        '<div class="line" style="margin-top:8px"><span class="tag" style="--c:' + t.c + ';--c-soft:' + t.s + '">' + esc(t.n) + '</span></div>' +
        photo +
        '<div class="facts">' + facts.filter(function (f) { return f[1]; }).map(function (f) {
          return '<div class="fact"><div class="k">' + f[0] + '</div><div class="v">' + esc(f[1]) + '</div></div>';
        }).join('') + '</div>' +
        '<button class="more-toggle" onclick="cm(\\'detailModal\\')">닫기</button>';
      om('detailModal');
    }

    /* ---------- 마시기 ---------- */
    function openDrinkModal(r) {
      var w = findWine(r);
      PENDING_ROW = r; CURRENT_RATING = 5;
      document.getElementById('drinkTitle').textContent = w ? w['와인명'] : '';
      document.getElementById('drinkComment').value = '';
      document.getElementById('drinkFood').value = '';
      renderStars(); om('drinkModal');
    }
    function renderStars() {
      var el = document.getElementById('starPick');
      el.innerHTML = '';
      for (var i = 1; i <= 5; i++) {
        var s = document.createElement('span');
        s.textContent = '★';
        s.className = i <= CURRENT_RATING ? 'on' : '';
        s.onclick = (function (v) { return function () { CURRENT_RATING = v; renderStars(); }; })(i);
        el.appendChild(s);
      }
    }
    function confirmDrink() {
      google.script.run.withSuccessHandler(function () {
        toast('기록했어요 🍷'); cm('drinkModal'); load();
      }).withFailureHandler(function (e) { toast('실패: ' + e.message); })
        .markDrunk(TOKEN, PENDING_ROW, {
          '평점': CURRENT_RATING,
          '한줄평': document.getElementById('drinkComment').value,
          '함께한음식': document.getElementById('drinkFood').value
        });
    }
    function doUnmark(r) {
      google.script.run.withSuccessHandler(function () {
        toast('셀러로 되돌렸어요'); load();
      }).withFailureHandler(function (e) { toast('실패: ' + e.message); }).unmarkDrunk(TOKEN, r);
    }

    /* ---------- 추가: 종류 칩 ---------- */
    function renderTypeChips() {
      var el = document.getElementById('typeChips');
      el.innerHTML = TYPES.map(function (t) {
        return '<button type="button" data-t="' + t.n + '" style="--c:' + t.c + ';--c-soft:' + t.s + '">' + t.n + '</button>';
      }).join('');
      el.querySelectorAll('button').forEach(function (b) {
        b.onclick = function () {
          SELECTED_TYPE = (SELECTED_TYPE === b.dataset.t) ? '' : b.dataset.t;
          el.querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x.dataset.t === SELECTED_TYPE); });
          checkSimilar();
        };
      });
    }
    function renderQuickFoods() {
      var el = document.getElementById('foodQuick');
      el.innerHTML = FOOD_MENU.map(function (item) {
        var hasKids = item.children && item.children.length;
        var isOpen = OPEN_FOOD_CAT === item.label;
        var arrow = hasKids ? (isOpen ? ' ▲' : ' ▼') : '';
        return '<button type="button" class="' + (isOpen ? 'on' : '') + '" data-cat="' + esc(item.label) + '" style="--c:var(--wine);--c-soft:var(--wine-soft)">' + esc(item.label) + arrow + '</button>';
      }).join('');
      el.querySelectorAll('button').forEach(function (b) {
        var item = FOOD_MENU.filter(function (f) { return f.label === b.dataset.cat; })[0];
        b.onclick = function () {
          if (item.children && item.children.length) {
            OPEN_FOOD_CAT = (OPEN_FOOD_CAT === item.label) ? null : item.label;
            renderQuickFoods();
          } else {
            document.getElementById('foodInput').value = item.label;
            doRecommend();
          }
        };
      });

      var sub = document.getElementById('foodSub');
      var open = FOOD_MENU.filter(function (f) { return f.label === OPEN_FOOD_CAT; })[0];
      if (!open) { sub.innerHTML = ''; return; }
      sub.innerHTML = open.children.map(function (c) {
        return '<button type="button" style="--c:var(--wine);--c-soft:var(--wine-soft)">' + esc(c) + '</button>';
      }).join('');
      sub.querySelectorAll('button').forEach(function (b) {
        b.onclick = function () { document.getElementById('foodInput').value = b.textContent; doRecommend(); };
      });
    }
    function toggleMore() {
      var m = document.getElementById('moreFields');
      m.classList.toggle('on');
      document.getElementById('moreLabel').textContent = m.classList.contains('on') ? '− 접기' : '＋ 자세히 입력';
    }

    /* ---------- 사진 ---------- */
    function onPhoto(e, mode) {
      var f = e.target.files[0]; if (!f) return;
      var rd = new FileReader();
      rd.onload = function () {
        PHOTO_DATAURL = rd.result;
        document.getElementById('photoPreview').innerHTML = '<img src="' + rd.result + '">';
        var note = document.getElementById('photoNote');
        note.innerHTML = '<div class="note">📖 라벨 읽는 중…</div>';
        if (mode === 'one') recognizeOne(note); else recognizeAll(note);
      };
      rd.readAsDataURL(f);
      e.target.value = '';
    }

    function recognizeOne(note) {
      google.script.run.withSuccessHandler(function (g) {
        note.innerHTML = '<div class="note">✨ 자동으로 채웠어요. 확인하고 고쳐주세요</div>';
        if (g['와인명']) document.getElementById('f_와인명').value = g['와인명'];
        if (g['품종']) document.getElementById('f_품종').value = g['품종'];
        if (g['빈티지']) document.getElementById('f_빈티지').value = g['빈티지'];
        if (g['생산지_국가']) document.getElementById('f_생산지/국가').value = g['생산지_국가'];
        if (g['종류']) {
          SELECTED_TYPE = typeStyle(g['종류']).n;
          document.querySelectorAll('#typeChips button').forEach(function (x) { x.classList.toggle('on', x.dataset.t === SELECTED_TYPE); });
        }
        checkSimilar();
      }).withFailureHandler(function (err) {
        note.innerHTML = '<div class="note warn">읽지 못했어요. 직접 입력해주세요<br><small>' + esc(err.message) + '</small></div>';
      }).recognizeLabel(TOKEN, PHOTO_DATAURL);
    }

    function recognizeAll(note) {
      google.script.run.withSuccessHandler(function (list) {
        if (!list || !list.length) {
          note.innerHTML = '<div class="note warn">병을 찾지 못했어요. 라벨이 잘 보이게 다시 찍어주세요</div>';
          return;
        }
        PICKS = list; PICK_ON = {};
        list.forEach(function (c, i) { PICK_ON[i] = !c.existingRowIndex; });
        var dup = list.filter(function (c) { return c.existingRowIndex; }).length;
        note.innerHTML = '<div class="note">🍾 ' + list.length + '병 찾았어요' + (dup ? ' (이미 있는 ' + dup + '병 제외)' : '') + '</div>';
        document.getElementById('addForm').style.display = 'none';
        document.getElementById('pickArea').style.display = 'block';
        renderPicks();
      }).withFailureHandler(function (err) {
        note.innerHTML = '<div class="note warn">인식 실패<br><small>' + esc(err.message) + '</small></div>';
      }).recognizeCellar(TOKEN, PHOTO_DATAURL);
    }

    function renderPicks() {
      document.getElementById('pickList').innerHTML = PICKS.map(function (c, i) {
        var t = typeStyle(c['종류']);
        var sub = [c['품종'], c['빈티지'], c['생산지_국가']].filter(Boolean).join(' · ');
        var dup = c.existingRowIndex ? ' dup' : '';
        var dupTxt = c.existingRowIndex ? ' · 이미 있음' : '';
        return '<div class="pick' + (PICK_ON[i] ? ' on' : '') + dup + '" onclick="togglePick(' + i + ')">' +
          '<div class="box">' + (PICK_ON[i] ? '✓' : '') + '</div>' +
          '<div class="info"><div class="nm">' + esc(c['와인명'] || '(이름 미상)') + '</div>' +
          '<div class="sb">' + esc(sub) + dupTxt + '</div></div>' +
          '<span class="tag" style="--c:' + t.c + ';--c-soft:' + t.s + '">' + esc(t.n) + '</span></div>';
      }).join('');
      var n = Object.keys(PICK_ON).filter(function (k) { return PICK_ON[k]; }).length;
      var btn = document.getElementById('pickBtn');
      btn.textContent = n ? n + '병 담기' : '담을 와인을 선택하세요';
      btn.disabled = !n;
    }
    function togglePick(i) { PICK_ON[i] = !PICK_ON[i]; renderPicks(); }
    function cancelPick() {
      document.getElementById('pickArea').style.display = 'none';
      document.getElementById('addForm').style.display = 'block';
      document.getElementById('photoPreview').innerHTML = '';
      document.getElementById('photoNote').innerHTML = '';
      PICKS = []; PICK_ON = {}; PHOTO_DATAURL = null;
    }
    function addPicked() {
      var sel = PICKS.filter(function (c, i) { return PICK_ON[i]; });
      if (!sel.length) return;
      var btn = document.getElementById('pickBtn');
      btn.disabled = true; btn.textContent = '담는 중…';
      google.script.run.withSuccessHandler(function (r) {
        toast(r.added + '병 담았어요 🍾');
        cancelPick(); goCellarOwned();
      }).withFailureHandler(function (e) {
        toast('실패: ' + e.message); btn.disabled = false; renderPicks();
      }).addWines(TOKEN, sel);
    }

    /* ---------- 중복 힌트 ---------- */
    var simTimer = null;
    function checkSimilar() {
      clearTimeout(simTimer);
      var kw = document.getElementById('f_품종').value || SELECTED_TYPE;
      simTimer = setTimeout(function () {
        var box = document.getElementById('similarHint');
        if (!kw || kw.trim().length < 2) { box.innerHTML = ''; return; }
        google.script.run.withSuccessHandler(function (ms) {
          box.innerHTML = (ms && ms.length)
            ? '<div class="note">💡 비슷한 걸 ' + ms.length + '번 마셔봤어요: ' + ms.map(function (m) { return esc(m['와인명']); }).join(', ') + '</div>'
            : '';
        }).getDrunkMatches(TOKEN, kw);
      }, 400);
    }

    /* ---------- 추가 저장 ---------- */
    function submitAdd(e) {
      e.preventDefault();
      var fields = ['와인명', '품종', '빈티지', '생산지/국가', '평균가격(국내·원)', '평균가격(글로벌·USD)', '추천 페어링', '어울리는잔', '서빙방법', '와인배경', '메모'];
      var data = { '종류': SELECTED_TYPE };
      fields.forEach(function (f) {
        var el = document.getElementById('f_' + f);
        if (el) data[f] = el.value;
      });
      if (!data['와인명']) { toast('와인 이름을 적어주세요'); return; }

      var btn = document.getElementById('addBtn');
      btn.disabled = true; btn.textContent = '담는 중…';
      google.script.run.withSuccessHandler(function () {
        toast('셀러에 담았어요 🍾');
        document.querySelectorAll('#addForm input, #addForm textarea').forEach(function (el) { el.value = ''; });
        document.querySelectorAll('#typeChips button').forEach(function (x) { x.classList.remove('on'); });
        SELECTED_TYPE = ''; PHOTO_DATAURL = null;
        document.getElementById('similarHint').innerHTML = '';
        document.getElementById('photoPreview').innerHTML = '';
        document.getElementById('photoNote').innerHTML = '';
        btn.disabled = false; btn.textContent = '셀러에 넣기';
        goCellarOwned();
      }).withFailureHandler(function (e2) {
        toast('실패: ' + e2.message);
        btn.disabled = false; btn.textContent = '셀러에 넣기';
      }).addWine(TOKEN, data, PHOTO_DATAURL);
    }

    /* ---------- 추천 ---------- */
    function doRecommend() {
      var food = document.getElementById('foodInput').value.trim();
      if (!food) { toast('뭘 드실지 적어주세요'); return; }
      var area = document.getElementById('foodArea');
      area.innerHTML = '<div class="loading">🍷 고르는 중…</div>';
      google.script.run.withSuccessHandler(function (list) {
        if (!list || !list.length) {
          area.innerHTML = '<div class="empty"><span class="big">🤔</span>지금 셀러에서<br>딱 맞는 걸 찾지 못했어요</div>';
          return;
        }
        area.innerHTML = list.map(function (x) {
          var w = x.wine || x;
          var badge = x.matched ? '<div class="match-badge">🍷 이 와인 페어링 정보에 있어요</div>' : '';
          var reason = x.reason ? '<div class="reason">' + esc(x.reason) + '</div>' : '';
          return cardHtml(w, badge + reason);
        }).join('');
      }).withFailureHandler(function (e) {
        area.innerHTML = '<div class="empty"><span class="big">😵</span>' + esc(e.message) + '</div>';
      }).recommendByFood(TOKEN, food);
    }

    /* ---------- 기록 ---------- */
    function loadStats() {
      var area = document.getElementById('statArea');
      area.innerHTML = '<div class="loading">불러오는 중…</div>';
      google.script.run.withSuccessHandler(function (s) {
        if (!s.totalDrunk) {
          area.innerHTML = '<div class="empty"><span class="big">📊</span>마신 와인이 쌓이면<br>여기에 기록이 보여요</div>';
          return;
        }
        function sect(title, obj, colorByType) {
          var es = Object.keys(obj).map(function (k) { return [k, obj[k]]; }).sort(function (a, b) { return b[1] - a[1]; });
          var max = es.reduce(function (m, e) { return Math.max(m, e[1]); }, 1);
          return '<div class="sect">' + title + '</div>' + es.map(function (e) {
            var c = colorByType ? typeStyle(e[0]).c : 'var(--wine)';
            return '<div class="bar-row"><div class="k">' + esc(e[0]) + '</div>' +
              '<div class="row2"><div class="bar-wrap"><div class="bar" style="--c:' + c + ';width:' + (e[1] / max * 100) + '%"></div></div>' +
              '<div class="n">' + e[1] + '</div></div></div>';
          }).join('');
        }
        area.innerHTML =
          '<div class="hero"><div class="n">' + s.totalDrunk + '</div><div class="l">지금까지 마신 와인</div></div>' +
          sect('종류별', s.byType, true) +
          sect('품종별', s.byGrape, false) +
          sect('월별', s.byMonth, false) +
          sect('가격대별', s.byPrice, false) +
          '<div style="text-align:center;margin:26px 0 6px;font-size:12.5px;color:var(--sub)">' +
          '🍷 ' + esc(ME) + ' 셀러</div>' +
          '<div class="act-row">' +
          '<button class="act" onclick="openInstall()"><span class="ic">📱</span>홈 화면에 추가</button>' +
          '<button class="act" onclick="shareApp()"><span class="ic">🔗</span>앱 공유</button>' +
          '</div>';
      }).withFailureHandler(function (e) {
        area.innerHTML = '<div class="empty"><span class="big">😵</span>' + esc(e.message) + '</div>';
      }).getStats(TOKEN);
    }

    renderTypeChips();
    renderQuickFoods();
    bootstrap();
  </script>
</body>
</html>
`;
