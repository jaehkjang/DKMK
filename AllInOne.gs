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
 *    - WINE_PIN         : 나와 아내가 같이 쓸 4자리 PIN (예: 1234)
 *    - GEMINI_API_KEY   : Gemini API 무료 키 (https://aistudio.google.com/apikey 에서 발급)
 *    - SHEET_ID         : (B 방식일 때만) 와인리스트 스프레드시트 ID
 * 2) 이 파일의 setupColumns 함수를 에디터에서 한 번 실행 (시트에 새 컬럼 헤더 추가)
 */

var NEW_COLUMNS = ['어울리는잔', '서빙방법', '와인배경', '평점', '한줄평', '함께한음식', '라벨사진'];
var PHOTO_FOLDER_NAME = '와인라벨사진';

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

function doGet() {
  return HtmlService.createHtmlOutput(INDEX_HTML)
    .setTitle('와인리스트')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
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

/** PIN 확인 (공유 로그인) */
function checkPin(pin) {
  var real = prop_('WINE_PIN');
  return !!real && String(pin) === String(real);
}

/** 전체 와인 목록 조회 */
function getWines() {
  var sheet = getSheet_();
  var lastRow = sheet.getLastRow();
  var headers = getHeaders_();
  if (lastRow < 2) return { headers: headers, wines: [] };

  var values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  var tz = Session.getScriptTimeZone() || 'Asia/Seoul';
  var wines = [];
  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    var obj = { rowIndex: i + 2 };
    for (var c = 0; c < headers.length; c++) {
      var v = row[c];
      obj[headers[c]] = (v instanceof Date) ? Utilities.formatDate(v, tz, 'yyyy-MM-dd') : v;
    }
    wines.push(obj);
  }
  return { headers: headers, wines: wines };
}

/** 새 와인 추가 (상태=보유, 등록일=오늘 자동). photoDataUrl은 선택. */
function addWine(data, photoDataUrl) {
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
function recognizeLabel(photoDataUrl) {
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
function recognizeCellar(photoDataUrl) {
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

  var existing = getWines().wines;
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
function addWines(list) {
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
      return c[h] || '';
    });
  });
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, headers.length).setValues(rows);
  return { added: rows.length };
}

/** 마심 표시: 상태→마심, 마신날짜/평점/한줄평/함께한음식 기록 */
function markDrunk(rowIndex, info) {
  var sheet = getSheet_();
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
function unmarkDrunk(rowIndex) {
  var sheet = getSheet_();
  var headers = getHeaders_();
  sheet.getRange(rowIndex, colIndex1_(headers, '상태')).setValue('보유');
  sheet.getRange(rowIndex, colIndex1_(headers, '마신날짜')).setValue('');
  return { ok: true };
}

/**
 * 품종/종류 키워드로 "이미 마신" 와인 조회 (추가할 때 비교용)
 */
function getDrunkMatches(keyword) {
  if (!keyword) return [];
  keyword = String(keyword).trim();
  if (!keyword) return [];
  var data = getWines();
  return data.wines.filter(function (w) {
    if (w['상태'] !== '마심') return false;
    var 품종 = String(w['품종'] || '');
    var 종류 = String(w['종류'] || '');
    return 품종.indexOf(keyword) !== -1 || 종류.indexOf(keyword) !== -1;
  });
}

/**
 * 음식 입력 → 보유 와인 중 추천.
 * AI가 실제 페어링 지식으로 순위와 이유를 정해준다(키워드가 안 겹쳐도 추천 가능).
 * API 실패 시 키워드 매칭으로 자동 대체.
 * 반환: [{ wine, reason }]
 */
function recommendByFood(food) {
  food = String(food || '').trim();
  if (!food) return [];

  var owned = getWines().wines.filter(function (w) { return w['상태'] === '보유'; });
  if (!owned.length) return [];

  try {
    var menu = owned.map(function (w) {
      return {
        id: w.rowIndex,
        이름: w['와인명'],
        종류: w['종류'],
        품종: w['품종'],
        생산지: w['생산지/국가'],
        기존페어링: w['추천 페어링']
      };
    });

    var prompt = '너는 소믈리에다. 아래는 우리 집 와인 셀러에 지금 있는 와인 목록이다.\n' +
      JSON.stringify(menu) + '\n\n' +
      '오늘 먹을 음식: "' + food + '"\n\n' +
      '이 음식에 가장 잘 어울리는 와인을 이 목록 안에서만 골라 좋은 순서대로 최대 3개 추천해라. ' +
      '한식이면 양념의 맛(맵기·단맛·기름기)까지 고려해라. ' +
      '아래 JSON 배열로만 답하라.\n' +
      '[{"id":숫자, "reason":"왜 어울리는지 한국어 한 문장"}]';

    var picks = callGemini_([{ text: prompt }]);
    var list = Array.isArray(picks) ? picks : (picks.recommendations || picks.list || []);

    var out = [];
    list.forEach(function (p) {
      for (var i = 0; i < owned.length; i++) {
        if (owned[i].rowIndex === p.id) {
          out.push({ wine: owned[i], reason: p.reason || '' });
          break;
        }
      }
    });
    if (out.length) return out;
  } catch (e) {
    // AI 실패 시 아래 키워드 매칭으로 넘어감
  }

  return recommendByKeyword_(food, owned);
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

/** 소비 통계: 월별 / 종류별 / 가격대별 마신 와인 집계 */
function getStats() {
  var data = getWines();
  var drunk = data.wines.filter(function (w) { return w['상태'] === '마심'; });

  var byMonth = {}, byType = {}, byPrice = {};
  drunk.forEach(function (w) {
    var month = (w['마신날짜'] || '').slice(0, 7); // yyyy-MM
    if (month) byMonth[month] = (byMonth[month] || 0) + 1;

    var type = w['종류'] || '기타';
    byType[type] = (byType[type] || 0) + 1;

    var priceNum = parseInt(String(w['평균가격(국내·원)'] || '').replace(/[^0-9]/g, ''), 10);
    var bracket = !priceNum ? '가격정보없음'
      : priceNum < 30000 ? '3만원 미만'
      : priceNum < 70000 ? '3~7만원'
      : priceNum < 150000 ? '7~15만원'
      : '15만원 이상';
    byPrice[bracket] = (byPrice[bracket] || 0) + 1;
  });

  return { totalDrunk: drunk.length, byMonth: byMonth, byType: byType, byPrice: byPrice };
}


/* ===================== 화면(Index.html) ===================== */

var INDEX_HTML = `<!DOCTYPE html>
<html>
<head>
  <base target="_top">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
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
      font-family:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Segoe UI",Roboto,sans-serif;
      background:var(--bg); color:var(--tx);
      padding-bottom:86px; font-size:15px;
    }
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
    #pinScreen .glass { font-size:60px; }
    #pinScreen .t { font-size:22px; font-weight:700; letter-spacing:-.3px; }
    #pinInput {
      width:190px; text-align:center; font-size:30px; letter-spacing:14px; text-indent:14px;
      padding:14px 0; border-radius:16px; border:none; background:rgba(255,255,255,.16);
      color:#fff; font-weight:700;
    }
    #pinInput::placeholder { color:rgba(255,255,255,.5); letter-spacing:2px; text-indent:0; font-size:16px; font-weight:400; }
    #pinBtn { padding:14px 44px; border-radius:16px; border:none; background:#fff; color:var(--wine); font-size:16px; font-weight:800; }
    #pinErr { color:#FFD9DF; font-size:14px; height:18px; }

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
    .bar-row { display:flex; align-items:center; gap:11px; padding:8px 0; }
    .bar-row .k { flex:0 0 88px; font-size:13.5px; font-weight:700; }
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
    <div class="glass">🍷</div>
    <div class="t">우리집 와인</div>
    <input id="pinInput" inputmode="numeric" maxlength="4" placeholder="PIN 4자리">
    <button id="pinBtn" onclick="submitPin()">열기</button>
    <div id="pinErr"></div>
  </div>

  <header>
    <div class="row">
      <h1 id="pgTitle">셀러</h1>
      <span class="count" id="pgCount"></span>
    </div>
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

    var QUICK_FOODS = ['삼겹살', '스테이크', '치킨', '파스타', '회', '치즈'];

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

    /* ---------- 잠금 ---------- */
    function submitPin() {
      google.script.run.withSuccessHandler(function (ok) {
        if (ok) {
          localStorage.setItem('wine_unlocked', '1');
          document.getElementById('pinScreen').style.display = 'none';
          load();
        } else {
          document.getElementById('pinErr').textContent = 'PIN이 맞지 않아요';
          document.getElementById('pinInput').value = '';
        }
      }).checkPin(document.getElementById('pinInput').value);
    }
    if (localStorage.getItem('wine_unlocked') === '1') document.getElementById('pinScreen').style.display = 'none';

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
      }).getWines();
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
        .markDrunk(PENDING_ROW, {
          '평점': CURRENT_RATING,
          '한줄평': document.getElementById('drinkComment').value,
          '함께한음식': document.getElementById('drinkFood').value
        });
    }
    function doUnmark(r) {
      google.script.run.withSuccessHandler(function () {
        toast('셀러로 되돌렸어요'); load();
      }).withFailureHandler(function (e) { toast('실패: ' + e.message); }).unmarkDrunk(r);
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
      el.innerHTML = QUICK_FOODS.map(function (f) {
        return '<button type="button" style="--c:var(--wine);--c-soft:var(--wine-soft)">' + f + '</button>';
      }).join('');
      el.querySelectorAll('button').forEach(function (b) {
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
      }).recognizeLabel(PHOTO_DATAURL);
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
      }).recognizeCellar(PHOTO_DATAURL);
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
      }).addWines(sel);
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
        }).getDrunkMatches(kw);
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
      }).addWine(data, PHOTO_DATAURL);
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
          var reason = x.reason ? '<div class="reason">' + esc(x.reason) + '</div>' : '';
          return cardHtml(w, reason);
        }).join('');
      }).withFailureHandler(function (e) {
        area.innerHTML = '<div class="empty"><span class="big">😵</span>' + esc(e.message) + '</div>';
      }).recommendByFood(food);
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
              '<div class="bar-wrap"><div class="bar" style="--c:' + c + ';width:' + (e[1] / max * 100) + '%"></div></div>' +
              '<div class="n">' + e[1] + '</div></div>';
          }).join('');
        }
        area.innerHTML =
          '<div class="hero"><div class="n">' + s.totalDrunk + '</div><div class="l">지금까지 마신 와인</div></div>' +
          sect('종류별', s.byType, true) +
          sect('월별', s.byMonth, false) +
          sect('가격대별', s.byPrice, false);
      }).withFailureHandler(function (e) {
        area.innerHTML = '<div class="empty"><span class="big">😵</span>' + esc(e.message) + '</div>';
      }).getStats();
    }

    renderTypeChips();
    renderQuickFoods();
    if (localStorage.getItem('wine_unlocked') === '1') load();
  </script>
</body>
</html>
`;
