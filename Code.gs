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
  return HtmlService.createHtmlOutputFromFile('Index')
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
