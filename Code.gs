/**
 * 와인리스트 모바일 웹앱 백엔드
 * "와인리스트" 스프레드시트에 바인딩된 Apps Script 프로젝트에 붙여넣으세요.
 * (스프레드시트 열기 → 확장 프로그램 → Apps Script)
 *
 * 최초 1회 설정:
 * 1) 프로젝트 설정 → 스크립트 속성에 아래 두 개 추가
 *    - WINE_PIN         : 나와 아내가 같이 쓸 4자리 PIN (예: 1234)
 *    - GEMINI_API_KEY   : Gemini API 무료 키 (https://aistudio.google.com/apikey 에서 발급)
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

function getSheet_() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
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

/**
 * 셀러 사진 속 라벨을 Gemini로 인식해서 후보 필드 추출.
 * 반환: { 와인명, 종류, 품종, 생산지_국가, 빈티지 } 추정값 (사용자가 폼에서 확인/수정)
 */
function recognizeLabel(photoDataUrl) {
  var apiKey = prop_('GEMINI_API_KEY');
  if (!apiKey) throw new Error('GEMINI_API_KEY가 설정되지 않았어요 (스크립트 속성에 추가해주세요)');

  var m = /^data:(image\/\w+);base64,(.+)$/.exec(photoDataUrl);
  if (!m) throw new Error('잘못된 이미지 형식입니다');
  var mimeType = m[1];
  var base64 = m[2];

  var prompt = '이 사진은 와인 라벨입니다. 다음 JSON 형식으로만 답하세요(설명 문장 없이 JSON만): ' +
    '{"와인명":"","종류":"레드/화이트/스파클링/로제/주정강화 중 하나","품종":"","생산지_국가":"","빈티지":""}' +
    ' 라벨에서 읽을 수 없는 항목은 빈 문자열로 두세요.';

  var payload = {
    contents: [{
      parts: [
        { text: prompt },
        { inline_data: { mime_type: mimeType, data: base64 } }
      ]
    }]
  };

  var url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + apiKey;
  var resp = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  var status = resp.getResponseCode();
  if (status !== 200) {
    throw new Error('와인 인식 실패 (' + status + '): ' + resp.getContentText().slice(0, 200));
  }
  var json = JSON.parse(resp.getContentText());
  var text = json.candidates[0].content.parts[0].text;
  text = text.replace(/```json/g, '').replace(/```/g, '').trim();
  var parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw new Error('인식 결과를 해석하지 못했어요: ' + text.slice(0, 150));
  }
  return parsed;
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
 * 음식 입력 → 보유 와인 중 추천. 추천페어링/함께한음식(과거 마심 기록)/종류/품종에서 키워드 매칭.
 */
function recommendByFood(food) {
  food = String(food || '').trim();
  if (!food) return [];
  var data = getWines();
  var keywords = food.split(/[\s,·・\/]+/).filter(Boolean);

  function score(w) {
    var hay = [w['추천 페어링'], w['함께한음식'], w['종류'], w['품종'], w['와인배경']].join(' ');
    var s = 0;
    keywords.forEach(function (k) {
      if (hay.indexOf(k) !== -1) s += 1;
    });
    return s;
  }

  return data.wines
    .filter(function (w) { return w['상태'] === '보유'; })
    .map(function (w) { return { wine: w, score: score(w) }; })
    .filter(function (x) { return x.score > 0; })
    .sort(function (a, b) { return b.score - a.score; })
    .slice(0, 5)
    .map(function (x) { return x.wine; });
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
