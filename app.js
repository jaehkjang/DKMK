// ============================================================
// app.js — 두뇌 방
// 로그인, 화면 전환, 렌더링, 서버 호출 결과 처리 등 모든 로직이 여기 있습니다.
// 서버와 주고받는 코드 자체는 api.js에만 있습니다.
// ============================================================

var ALL_WINES = [], STAT_SEG = '통계', PENDING_ROW = null, CURRENT_RATING = 5;
var PHOTO_DATAURL = null, PHOTO_UPLOADED_URL = null, PICKS = [], PICK_ON = {}, SELECTED_TYPE = '';
var TOKEN = '', ME = '', EDIT_ROW = null, DETAIL_ROW = null, IS_ADMIN = false;
// 수정 폼을 열 때 보고 있던 와인명 — 그 사이 다른 사람이 셀러를 바꿔서 행 번호가
// 밀렸는지 제출할 때 서버가 확인할 수 있게 같이 보낸다.
var EDIT_ORIG_NAME = '';
var WINES_LOADED = false; // 탭을 오갈 때마다 매번 서버에 다시 안 물어보려고 세션 동안 캐시

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
 * 음식 빠른 선택. 카테고리(요리 문화권) 탭 하나를 고르면 그 아래 구체적인 메뉴들이
 * 바로 펼쳐지는 1단 구조 — 예전처럼 "양식 → 이탈리안 → ..." 식으로 여러 번 펼쳐야
 * 하는 깊은 메뉴가 아니라, 대표 메뉴만 추려서 한 번에 고를 수 있게 했다.
 * 칩은 여러 개 골라도 되는 다중 선택이라(SELECTED_FOODS), 오늘 먹는 음식이
 * 여럿이면 다 같이 어울리는 와인을 찾아준다.
 */
var FOOD_MENU = [
  { label: '한식', icon: '🍚', children: ['육전', '호박전', '된장찌개', '삼겹살', '보쌈', '족발', '피순대', '찹쌀순대'] },
  { label: '중식', icon: '🥢', children: ['탕수육', '양장피', '라조기', '지삼선', '향라육슬', '어향육슬', '어향가지', '깐풍기'] },
  { label: '일식', icon: '🍣', children: ['숙성회'] },
  { label: '이탈리안', icon: '🍝', children: ['페페로니피자', '미트피자', '오일파스타', '토마토해산물파스타', '명란파스타', '라구파스타'] },
  { label: '아시안', icon: '🍛', children: ['카오팟무', '타코', '부리또', '화이타(새우)', '화이타(돼지고기)', '화이타(소고기)'] },
  { label: '스테이크', icon: '🥩', children: ['등심', '안심', '채끝살'] },
  { label: '아메리칸', icon: '🍔', children: ['햄버거'] }
];
var ACTIVE_FOOD_CAT = FOOD_MENU[0].label;
var SELECTED_FOODS = [];

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
/**
 * 이 와인에 대해 AI에게 정보를 물어볼 때가 됐는지.
 * 한 번 물어본 와인은 "정보갱신일"이 찍히니, 아직 빈칸이 남아 있어도 다시 묻지 않는다 —
 * AI도 끝내 못 알아내는 와인이 있는데, 그런 와인은 상세를 열 때마다 매번 똑같은 질문을
 * 다시 하게 돼서 느리고 API 비용도 계속 나갔다. 대신 3개월이 지나면 한 번 더 물어본다
 * (페어링 캐시와 같은 주기).
 */
function infoAskDue(w) {
  var stamped = String(w['정보갱신일'] || '');
  if (!stamped) return true;
  var cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - 3);
  var y = cutoff.getFullYear(), m = ('0' + (cutoff.getMonth() + 1)).slice(-2), d = ('0' + cutoff.getDate()).slice(-2);
  return stamped < (y + '-' + m + '-' + d);
}

/** 상세/일괄채우기에서 "아직 비어 있는 정보가 있나" 판단 (같은 기준을 두 곳에서 쓴다) */
function infoIncomplete(w) {
  return !w['서빙온도'] || !w['완벽한잔'] || !w['추천 페어링'] || !w['베스트페어링'] ||
    !w['품종'] || !w['생산지/국가'] || !w['와인배경'] || !w['평균가격(국내·원)'] ||
    !w['당도'] || !w['산도'] || !w['타닌'] || !w['바디감'];
}

function starsHtml(n) {
  n = parseInt(n, 10) || 0;
  var s = '';
  for (var i = 1; i <= 5; i++) s += (i <= n ? '★' : '☆');
  return s;
}

/* ---------- 로그인 ----------
 * 토큰은 api.js가 localStorage에 저장한다. GitHub Pages는 주소가 고정이라
 * (Apps Script HtmlService의 매번 바뀌는 iframe 주소와 달리) 저장소가 정상적으로 남는다.
 * 그래서 주소에 토큰을 실어 나르는 요령이 필요 없다.
 */

/** 이름 + 비번 하나로 끝. 없는 이름이면 셀러가 새로 생기고, 있으면 그 셀러로 들어간다. */
function submitAuth(ev) {
  ev.preventDefault();
  var name = document.getElementById('authId').value.trim();
  var pw = document.getElementById('authPw').value;
  var err = document.getElementById('pinErr');
  if (!name || !pw) { err.textContent = '이름과 비밀번호를 입력해주세요'; return; }
  if (!/^\d{4}$/.test(pw)) { err.textContent = '비밀번호는 4자리 숫자로 입력해주세요'; return; }

  var btn = document.getElementById('authBtn');
  btn.disabled = true; btn.textContent = '잠시만요…';
  err.textContent = '';

  callAPI(function () { return API.enter(name, pw); }).then(function (res) {
    btn.disabled = false; btn.textContent = '시작하기';
    if (!res || res.error) { err.textContent = (res && res.error) || '문제가 생겼어요'; return; }
    API.setToken(res.token);
    TOKEN = res.token; ME = res.name; IS_ADMIN = !!res.isAdmin;
    AUTH_RECOVERY_SHOWN = false; // 새로 로그인했으니 다음에 또 끊기면 다시 감지할 수 있게
    document.getElementById('pinScreen').style.display = 'none';
    if (res.moved) toast('기존 와인 ' + res.moved + '병을 가져왔어요');
    else if (res.created) toast(res.name + ' 셀러를 만들었어요 🍾');
    load();
  });
}

function openSettings() {
  document.getElementById('pwNew').value = '';
  document.getElementById('pwNew2').value = '';
  document.getElementById('pwErr').textContent = '';
  if (!BULK_FILL_RUNNING) document.getElementById('bulkFillStatus').textContent = '';
  loadGlasses();
  document.getElementById('adminSection').style.display = IS_ADMIN ? '' : 'none';
  if (IS_ADMIN) loadAdminOverview();
  om('settingsModal');
}

function openHelp() {
  om('helpModal');
}

/** 관리자(dkmk)만 볼 수 있는 전체 사용자 현황 — 매번 최신으로 보여줘야 해서 캐시하지 않는다. */
function loadAdminOverview() {
  var el = document.getElementById('adminOverview');
  el.innerHTML = '<div class="loading" style="padding:8px 0">불러오는 중…</div>';
  callAPI(function () { return API.getAdminOverview(); }).then(function (data) {
    if (!data || data.error) { el.innerHTML = '<div class="note">' + esc((data && data.error) || '불러오지 못했어요') + '</div>'; return; }
    if (!data.users.length) { el.innerHTML = '<div class="note">아직 가입한 사용자가 없어요</div>'; return; }
    el.innerHTML = '<div class="admin-summary">총 ' + data.totalUsers + '명 · 등록된 와인 ' + data.totalWines + '병</div>' +
      data.users.map(function (u) {
        // 관리자 자기 자신은 삭제 버튼을 아예 안 보여준다(서버도 막지만, UI에서도 헷갈리지 않게).
        var delBtn = u.아이디 === 'dkmk' ? '' :
          '<button type="button" class="admin-del-btn" data-id="' + esc(u.아이디) + '" data-name="' + esc(u.이름) + '">삭제</button>';
        return '<div class="admin-row">' +
          '<div class="admin-row-top"><b>' + esc(u.이름) + '</b><span class="admin-id">@' + esc(u.아이디) + '</span>' + delBtn + '</div>' +
          '<div class="admin-row-stats">보유 ' + u.보유 + '병 · 마심 ' + u.마심 + '병 · 가입 ' + esc(u.가입일) +
          ' · 최근 로그인 ' + esc(u.마지막로그인) + (u.마지막활동 ? ' · 최근 활동 ' + esc(u.마지막활동) : '') + '</div>' +
          '</div>';
      }).join('');
    // 아이디·이름을 onclick 문자열 안에 직접 끼워 넣지 않는다 — esc()는 속성값 이스케이프용이라
    // 작은따옴표(')는 그대로 통과시킨다. 이름에 작은따옴표가 있으면 인라인 onclick이 깨지므로
    // (예: "O'Brien"), data-* 속성에 담아 아래에서 안전하게 읽어온다.
    el.querySelectorAll('.admin-del-btn').forEach(function (b) {
      b.onclick = function () { deleteUserAccountConfirm(b.dataset.id, b.dataset.name); };
    });
  });
}

/**
 * 사용자 아이디 삭제(관리자 전용). 계정뿐 아니라 그 사람의 와인·잔까지 전부
 * 지워지는 되돌릴 수 없는 동작이라, 체크박스 하나로는 부족해서 아이디를
 * 직접 타이핑해서 확인받는다(실수로 잘못 누르는 걸 막으려고).
 */
function deleteUserAccountConfirm(id, name) {
  var typed = prompt('"' + name + '"(@' + id + ') 계정과 등록된 와인·잔이 전부 영구 삭제돼요. 되돌릴 수 없어요.\n\n확인하려면 아이디(' + id + ')를 정확히 입력하세요:');
  if (typed === null) return;
  if (typed.trim().toLowerCase() !== id.toLowerCase()) { toast('아이디가 일치하지 않아 취소했어요'); return; }
  callAPI(function () { return API.deleteUserAccount(id); }).then(function (res) {
    if (!res || res.error) { toast('실패: ' + ((res && res.error) || '')); return; }
    toast('삭제했어요 (와인 ' + res.deletedWines + '병, 잔 ' + res.deletedGlasses + '개 포함)');
    loadAdminOverview();
  });
}

/**
 * 이미 등록된 와인 중 서빙온도·완벽한잔·추천 페어링·생산지가 비어 있는 것들을
 * suggestWineInfo로 한 번에 채운다. 한꺼번에 다 요청하면 API 한도에 걸리기
 * 쉬워서 하나씩 순서대로 부르고, 몇 개째인지 상태 줄에 보여준다.
 */
var BULK_FILL_RUNNING = false;
function bulkFillWineInfo() {
  if (BULK_FILL_RUNNING) return;
  var status = document.getElementById('bulkFillStatus');

  function start(wines) {
    // 마신 와인은 건너뛴다 — 이미 비운 병이라 서빙·페어링 정보를 채워봐야 쓸 데가 없고,
    // 한 병당 AI 호출이 한 번씩 나가서 시간과 비용만 든다(버튼 문구도 "보유 와인").
    var targets = wines.filter(function (w) {
      return w['상태'] === '보유' && infoIncomplete(w) && infoAskDue(w);
    });
    if (!targets.length) { status.textContent = '이미 다 채워져 있어요 ✨'; return; }

    BULK_FILL_RUNNING = true;
    var i = 0, failed = 0, lastErr = '';
    function next() {
      if (i >= targets.length) {
        BULK_FILL_RUNNING = false;
        // 실패한 걸 성공이라고 하지 않는다 — 몇 병이 왜 안 됐는지 그대로 알려준다.
        status.textContent = failed
          ? (targets.length - failed) + '병 완료, ' + failed + '병 실패' + (lastErr ? ' (' + lastErr + ')' : '')
          : targets.length + '병 업데이트 완료 ✨';
        load();
        return;
      }
      var w = targets[i];
      status.textContent = '업데이트 중… (' + (i + 1) + '/' + targets.length + ') ' + w['와인명'];
      callAPI(function () { return API.suggestWineInfo(w.rowIndex); }).then(function (res) {
        if (!res || res.error) { failed++; lastErr = (res && res.error) || '응답 없음'; }
        i++;
        next();
      });
    }
    next();
  }

  if (WINES_LOADED) {
    start(ALL_WINES);
  } else {
    status.textContent = '불러오는 중…';
    callAPI(function () { return API.getWines(); }).then(function (d) {
      if (!d || d.error) { status.textContent = '실패: ' + ((d && d.error) || ''); return; }
      ALL_WINES = d.wines; WINES_LOADED = true;
      start(ALL_WINES);
    });
  }
}

/* ---------- 내 잔 관리 ---------- */
var MY_GLASSES = [];
var GLASSES_LOADED = false; // 세션 동안 한 번만 불러온다 — 설정을 열 때마다 서버를 또 부르지 않는다

function loadGlasses() {
  if (GLASSES_LOADED) { renderGlassChips(); return; }
  document.getElementById('glassChips').innerHTML = '<div class="loading" style="padding:8px 0">불러오는 중…</div>';
  callAPI(function () { return API.getGlasses(); }).then(function (list) {
    MY_GLASSES = (list && !list.error) ? list : [];
    GLASSES_LOADED = true;
    renderGlassChips();
  });
}

function renderGlassChips() {
  var el = document.getElementById('glassChips');
  if (!MY_GLASSES.length) {
    el.innerHTML = '<div class="note" style="margin:0">등록된 잔이 없어요</div>';
    return;
  }
  el.innerHTML = MY_GLASSES.map(function (g) {
    return '<button type="button" onclick="removeGlass(' + g.rowIndex + ')">' + esc(g['이름']) + ' ✕</button>';
  }).join('');
}

function submitAddGlass(e) {
  e.preventDefault();
  var input = document.getElementById('glassNameInput');
  var name = input.value.trim();
  if (!name) return;
  callAPI(function () { return API.addGlass(name); }).then(function (res) {
    if (!res || res.error) { toast('실패: ' + ((res && res.error) || '')); return; }
    input.value = '';
    // 새로 추가된 한 줄만 아는 상태라 다시 불러올 필요 없이 바로 붙인다.
    MY_GLASSES.push({ rowIndex: res.rowIndex, '이름': name });
    renderGlassChips();
  });
}

function removeGlass(rowIndex) {
  var g = MY_GLASSES.filter(function (x) { return x.rowIndex === rowIndex; })[0];
  if (!g || !confirm(g['이름'] + ' 잔을 삭제할까요?')) return;
  callAPI(function () { return API.deleteGlass(rowIndex); }).then(function (res) {
    if (!res || res.error) { toast('실패: ' + ((res && res.error) || '')); return; }
    // 시트에서 그 줄이 삭제되면 아래 줄들이 한 칸씩 당겨지니, 로컬 목록도 같이 맞춰준다
    // (다시 불러오지 않고도 다음 삭제가 엉뚱한 줄을 가리키지 않게).
    MY_GLASSES = MY_GLASSES
      .filter(function (x) { return x.rowIndex !== rowIndex; })
      .map(function (x) { return x.rowIndex > rowIndex ? { rowIndex: x.rowIndex - 1, '이름': x['이름'] } : x; });
    renderGlassChips();
  });
}

function submitChangePw(e) {
  e.preventDefault();
  var newPw = document.getElementById('pwNew').value;
  var newPw2 = document.getElementById('pwNew2').value;
  var err = document.getElementById('pwErr');
  err.textContent = '';
  if (!/^\d{4}$/.test(newPw)) {
    err.textContent = '비밀번호는 4자리 숫자로 입력해주세요';
    return;
  }
  if (newPw !== newPw2) {
    err.textContent = '새 비밀번호 확인이 일치하지 않아요';
    return;
  }
  callAPI(function () { return API.changePassword(newPw); }).then(function (res) {
    if (!res || res.error) { err.textContent = (res && res.error) || '문제가 생겼어요'; return; }
    document.getElementById('pwNew').value = '';
    document.getElementById('pwNew2').value = '';
    toast('비밀번호를 바꿨어요 🔒');
    cm('settingsModal');
  });
}

/* ---------- 홈 화면 추가 / 공유 ----------
 * 이제 이 페이지 자체가 최상위 주소(iframe 아님)라, 특별한 요령 없이
 * 브라우저 기본 메뉴 안내만 보여주면 된다. 서버 호출도 필요 없다.
 * 설치 방법은 앱 안에서 따로 안내하지 않고, 공유 메시지 본문에 실어 보낸다
 * (받는 사람 기기를 알 수 없으니 아이폰/안드로이드 방법을 함께 적는다).
 */

/**
 * 홈 화면에 추가하는 방법. 설정 화면에 보여주는 안내와 링크 공유 때 같이 보내는
 * 문구가 서로 달라지지 않게, 여기 한 곳에만 적어두고 양쪽에서 가져다 쓴다.
 */
var INSTALL_HOWTO_TITLE = '📲 홈 화면에 추가하면 앱처럼 쓸 수 있어요';
var INSTALL_STEPS = [
  { os: '📱 아이폰 (사파리)', steps: [
    '이 링크를 사파리로 열기',
    '하단(또는 상단) 공유 버튼(⬆️) 탭',
    '아래로 스크롤해서 "홈 화면에 추가" 선택 → 추가'
  ] },
  { os: '🤖 안드로이드 (크롬)', steps: [
    '이 링크를 크롬으로 열기',
    '우측 상단 점 세 개(⋮) 메뉴 탭',
    '"설치 및 바로가기 만들기"(또는 "홈 화면에 추가") 선택 → 설치'
  ] }
];

/** 공유 메시지에 실어 보낼 평문 버전 */
function installHowtoText() {
  return INSTALL_HOWTO_TITLE + '\n\n' + INSTALL_STEPS.map(function (g) {
    return g.os + '\n' + g.steps.map(function (s, i) { return (i + 1) + '. ' + s; }).join('\n');
  }).join('\n\n');
}

/** 설정 화면에 보여줄 HTML 버전 (같은 내용) */
function renderInstallHowto() {
  var el = document.getElementById('installHowto');
  if (!el) return;
  el.innerHTML = INSTALL_STEPS.map(function (g) {
    return '<div class="howto-os">' + esc(g.os) + '</div><ol class="howto-steps">' +
      g.steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol>';
  }).join('');
}

/** 주소에는 로그인 정보가 없으니(로그인은 localStorage에만 있음) 이 페이지 주소만 보낸다. */
function shareApp() {
  var url = location.origin + location.pathname;
  var intro = '🍷 와인 딸까 말까\n' +
    '우리 집 와인 셀러를 관리하는 앱이에요. 라벨 사진 한 장이면 와인 이름·품종·생산지를 알아서 인식하고, ' +
    '서빙 온도·어울리는 잔·어울리는 음식까지 AI가 알려줘요. 마신 와인은 평점이랑 기록도 남길 수 있어요.';
  // url을 별도 필드로만 넘기면 카카오톡 등 일부 공유 대상이 그 값을 무시하고
  // text만 보여줘서 정작 링크가 안 보이는 경우가 있다 — text 안에도 링크를 직접 넣어
  // 어떤 공유 대상이든 항상 링크가 보이게 한다.
  var data = {
    title: '와인 딸까 말까',
    text: intro + '\n\n' + installHowtoText() + '\n\n👉 ' + url,
    url: url
  };
  if (navigator.share) {
    navigator.share(data).catch(function () { copyText(url); });
  } else {
    copyText(url);
  }
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

/**
 * 와인 목록을 이 기기에 저장해 두는 캐시. 앱을 열 때 서버 응답(Apps Script는 한 번에
 * 1~3초씩 걸린다)을 기다리지 않고 지난번 목록부터 바로 그리고, 서버에서 최신 목록이
 * 오면 조용히 바꿔 그린다. 토큰과 묶어 저장해서 다른 셀러로 들어가면 쓰지 않고,
 * 로그아웃하면 지운다.
 */
var WINES_CACHE_KEY = 'dkmk_wines_cache';
function saveWinesCache() {
  try {
    localStorage.setItem(WINES_CACHE_KEY, JSON.stringify({ token: TOKEN, me: ME, admin: IS_ADMIN, wines: ALL_WINES }));
  } catch (e) { /* 저장 공간이 없거나 막힌 환경이면 캐시 없이 동작 */ }
}
function readWinesCache() {
  try {
    var c = JSON.parse(localStorage.getItem(WINES_CACHE_KEY) || 'null');
    if (c && c.token === TOKEN && Array.isArray(c.wines)) return c;
  } catch (e) { /* 깨진 캐시는 무시 */ }
  return null;
}
function clearWinesCache() {
  try { localStorage.removeItem(WINES_CACHE_KEY); } catch (e) { /* 무시 */ }
}

/**
 * 저장된 토큰으로 앱을 연다. 예전엔 토큰 확인 → 목록 조회를 차례로 기다려서 서버를
 * 두 번 왕복할 때까지 빈 화면이었는데, 지금은
 *  1) 이 기기에 저장해 둔 목록이 있으면 그걸로 바로 화면을 열고
 *  2) 토큰 확인과 목록 조회를 동시에 보낸다.
 * 토큰이 무효면 둘 중 먼저 오는 쪽에서 로그인 화면으로 돌아간다(목록 조회도 같은 토큰
 * 검사를 거치므로 남의 데이터가 섞일 일은 없다). 저장된 목록이 없을 때만 확인이 끝날 때까지
 * 로그인 입력창 대신 "불러오는 중…"을 보여준다.
 */
function bootstrap() {
  TOKEN = API.loadToken();
  if (!TOKEN) { showAuthForm(); return; }
  var cached = readWinesCache();
  if (cached) {
    ME = cached.me || ''; IS_ADMIN = !!cached.admin;
    ALL_WINES = cached.wines; WINES_LOADED = true;
    document.getElementById('pinScreen').style.display = 'none';
    renderList();
  }
  callAPI(function () { return API.checkToken(); }).then(function (res) {
    if (res && res.ok) {
      ME = res.name; IS_ADMIN = !!res.isAdmin;
      AUTH_RECOVERY_SHOWN = false;
      document.getElementById('pinScreen').style.display = 'none';
      if (WINES_LOADED) saveWinesCache();
    } else if (cached && res && res.error) {
      // 인터넷이 잠깐 끊긴 것뿐이면 로그아웃시키지 않고 저장된 목록을 계속 보여준다
      toast(res.error);
    } else {
      logout('다시 들어와주세요');
    }
  });
  load();
}

function showAuthForm() {
  document.getElementById('authLoading').style.display = 'none';
  document.getElementById('authForm').style.display = '';
}

/** 설정에서 누르는 로그아웃 버튼 */
function logoutConfirm() {
  if (!confirm('로그아웃할까요?')) return;
  cm('settingsModal');
  logout();
}

/**
 * 로그아웃. 설정에서 사용자가 직접 누르거나(msg 없이 호출), 어떤 이유로든 토큰이
 * 더 이상 유효하지 않다는 응답을 받았을 때(handleAuthExpired) 자동으로도 불린다.
 * 세션 캐시(ALL_WINES 등)도 같이 비워야 다음 로그인 때 남의 데이터가 잠깐이라도
 * 안 섞여 보인다.
 */
function logout(msg) {
  API.setToken('');
  TOKEN = ''; ME = ''; IS_ADMIN = false;
  WINES_LOADED = false; ALL_WINES = [];
  clearWinesCache();
  FOOD_REQUIRED_HTML = '';
  GLASSES_LOADED = false; MY_GLASSES = [];
  document.querySelectorAll('.modal-bg').forEach(function (m) { m.classList.remove('on'); });
  document.getElementById('pinScreen').style.display = '';
  document.getElementById('pinErr').textContent = msg || '';
  showAuthForm();
}

/**
 * 어떤 이유로든(계정이 삭제됐거나, 토큰 서명 키가 바뀌었거나, 그 밖의 알 수 없는
 * 원인으로) 서버가 "로그인이 필요해요"/"계정을 찾을 수 없어요"를 돌려주면 여기로
 * 온다. 이게 없으면 사용자는 같은 오류만 계속 보면서 빠져나갈 방법이 없다 —
 * 로그아웃 버튼도 없이 갇히는 셈이라, 원인을 몰라도 일단 다시 로그인할 수 있는
 * 화면으로 돌려보내는 게 가장 확실한 복구 방법이다.
 */
var AUTH_RECOVERY_SHOWN = false;
function handleAuthExpired() {
  if (AUTH_RECOVERY_SHOWN) return; // 여러 요청이 동시에 실패해도 중복으로 처리하지 않는다
  AUTH_RECOVERY_SHOWN = true;
  logout('로그인이 풀렸어요. 다시 들어와주세요.');
}

/* ---------- 화면 전환 ---------- */
var TITLES = { Cellar:'셀러', Food:'페어링 추천', Stat:'기록' };
function showPage(p) {
  ['Cellar', 'Food', 'Stat'].forEach(function (n) {
    document.getElementById('pg' + n).classList.toggle('on', n === p);
  });
  document.querySelectorAll('#tabbar div').forEach(function (t) { t.classList.toggle('on', t.dataset.p === p); });
  document.getElementById('pgTitle').textContent = TITLES[p];
  document.getElementById('pgCount').textContent = '';
  // 이미 한 번 불러온 목록이 있으면 일단 캐시로 즉시 그려서 탭 전환이 빠르게 느껴지게
  // 하고, 그 뒤에 곧바로 서버에서 다시 불러와 조용히 최신 상태로 맞춘다 — 같은 아이디를
  // 여러 사람이 같이 쓸 때, 다른 사람이 그 사이 지우거나 바꾼 게 셀러 탭을 열 때마다
  // 반드시 반영되게 하려는 것(캐시만 믿고 안 부르면 그 변화가 영영 안 보일 수 있다).
  if (p === 'Cellar') { if (WINES_LOADED) renderList(); load(); }
  if (p === 'Stat') { syncStatSeg(); if (WINES_LOADED) { loadStats(); load(); } else loadStats(); }
  if (p === 'Food') {
    renderCellarPairingChips();
    renderFoodRequired();
  }
  window.scrollTo(0, 0);
}

/**
 * 보유 와인 중 "음식 페어링이 사실상 필수적인" 스타일만 AI로 골라서 보여준다 —
 * "안주없이 마실 와인 추천받기"의 반대. 서버에서 셀러 구성이 그대로면 캐시로
 * 바로 돌려주기 때문에, Food 탭에 들어올 때마다 매번 AI를 새로 부르지는 않는다.
 */
var FOOD_REQUIRED_HTML = ''; // 지난번 결과 — 탭에 다시 들어오면 이걸 먼저 보여주고 뒤에서 새로 받는다
function renderFoodRequired() {
  var area = document.getElementById('foodRequiredArea');
  area.innerHTML = FOOD_REQUIRED_HTML || '<div class="loading">🍷 고르는 중…</div>';
  callAPI(function () { return API.recommendFoodRequired(); }).then(function (res) {
    if (!res || res.error) {
      if (FOOD_REQUIRED_HTML) return; // 지난번 결과를 보여주는 중이면 그대로 둔다
      area.innerHTML = '<div class="empty"><span class="big">😵</span>' + esc(res && res.error) + '</div>';
      return;
    }
    var picks = res.picks || [];
    area.innerHTML = picks.length
      ? picks.map(function (x) {
          var stars = x['별점'] ? '<span class="stars">' + starsHtml(x['별점']) + '</span> ' : '';
          var reason = (stars || x.reason) ? '<div class="reason">' + stars + esc(x.reason || '') + '</div>' : '';
          return cardHtml(x.wine, reason);
        }).join('')
      : '<div class="empty"><span class="big">🍇</span>지금 셀러엔<br>그런 와인이 없어요</div>';
    FOOD_REQUIRED_HTML = area.innerHTML;
  });
}

function load() {
  var token = TOKEN;
  callAPI(function () { return API.getWines(); }).then(function (d) {
    if (token !== TOKEN) return; // 그 사이 로그아웃했거나 다른 셀러로 들어갔으면 버린다
    if (!d || d.error) {
      // 이미 보여주고 있는 목록(저장된 목록 포함)이 있으면 지우지 않고 알림만 띄운다
      if (WINES_LOADED) { toast('최신 목록을 못 불러왔어요: ' + ((d && d.error) || '')); return; }
      document.getElementById('listArea').innerHTML = '<div class="empty"><span class="big">😵</span>불러오지 못했어요<br>' + esc(d && d.error) + '</div>';
      return;
    }
    ALL_WINES = d.wines; WINES_LOADED = true; saveWinesCache(); renderList();
    // 기록 탭 목록에서 와인을 되돌리거나 고친 경우, 통계와 열려 있던 목록이 옛 데이터로 남지 않게
    if (document.getElementById('pgStat').classList.contains('on')) {
      cm('statListModal'); renderStats(); renderDrunkList();
    }
  });
}

/* ---------- 목록 ---------- */
/**
 * 셀러 탭은 보유 와인 목록만, 기록 탭은 "통계 | 마신 와인" 두 칸.
 * 와인 추가는 탭 안의 칸이 아니라 따로 뜨는 창(#addModal)에서 한다 — 셀러는 떠 있는
 * "＋ 와인 추가" 버튼, 기록은 (통계·마신 와인 어느 칸이든) 떠 있는 "＋ 마신 와인 기록" 버튼으로 연다.
 */
/** 와인을 담은 직후엔 방금 담은 게 보이는 셀러 목록으로 */
function goCellarOwned() { showPage('Cellar'); }

function setStatSeg(v) {
  STAT_SEG = v;
  syncStatSeg();
  window.scrollTo(0, 0);
}
function syncStatSeg() {
  document.querySelectorAll('#statSeg > div').forEach(function (d) { d.classList.toggle('on', d.dataset.s === STAT_SEG); });
  document.getElementById('statPane').style.display = STAT_SEG === '통계' ? '' : 'none';
  document.getElementById('drunkPane').style.display = STAT_SEG === '마심' ? '' : 'none';
  if (document.getElementById('pgStat').classList.contains('on')) {
    document.getElementById('pgCount').textContent = '';
    if (STAT_SEG === '마심') renderDrunkList();
  }
}
function goStatSeg(seg) {
  STAT_SEG = seg;
  showPage('Stat');
}

function wineMatches(w, q) {
  if (!q) return true;
  return [w['와인명'], w['품종'], w['종류'], w['생산지/국가']].join(' ').toLowerCase().indexOf(q) !== -1;
}

/** 셀러 탭 "보유" 칸 목록 */
function renderList() {
  var q = (document.getElementById('search').value || '').trim().toLowerCase();
  var list = ALL_WINES.filter(function (w) {
    return (w['상태'] || '보유') === '보유' && wineMatches(w, q);
  });
  list.sort(function (a, b) { return String(b['등록일'] || '').localeCompare(String(a['등록일'] || '')); });

  if (document.getElementById('pgCellar').classList.contains('on')) {
    document.getElementById('pgCount').textContent = list.length ? list.length + '병' : '';
  }

  var area = document.getElementById('listArea');
  if (!list.length) {
    area.innerHTML = q
      ? '<div class="empty"><span class="big">🔍</span>찾는 와인이 없어요</div>'
      : '<div class="empty"><span class="big">🍷</span>셀러가 비어 있어요<br><b>＋ 와인 추가</b>를 눌러 사진을 찍어보세요</div>';
    return;
  }
  // map이 index를 두 번째 인자로 넘기지 않도록 감싼다(extraHtml 자리)
  area.innerHTML = list.map(function (w) { return cardHtml(w); }).join('');
}

/** 기록 탭 "마신 와인" 칸 목록 — 최근에 마신 순 */
function renderDrunkList() {
  if (STAT_SEG !== '마심') return;
  var area = document.getElementById('drunkListArea');
  if (!WINES_LOADED) { area.innerHTML = '<div class="loading">불러오는 중…</div>'; return; }
  var q = (document.getElementById('drunkSearch').value || '').trim().toLowerCase();
  var list = ALL_WINES.filter(function (w) { return w['상태'] === '마심' && wineMatches(w, q); });
  list.sort(function (a, b) { return String(b['마신날짜'] || '').localeCompare(String(a['마신날짜'] || '')); });

  if (document.getElementById('pgStat').classList.contains('on')) {
    document.getElementById('pgCount').textContent = list.length ? list.length + '병' : '';
  }

  if (!list.length) {
    area.innerHTML = q
      ? '<div class="empty"><span class="big">🔍</span>찾는 와인이 없어요</div>'
      : '<div class="empty"><span class="big">🥂</span>아직 마신 기록이 없어요<br><b>＋ 마신 와인 기록</b>을 눌러 남겨보세요</div>';
    return;
  }
  area.innerHTML = list.map(function (w) { return cardHtml(w); }).join('');
}

/**
 * 가격을 저가/중가/고가/프리미엄 색으로 구분한 작은 배지로 만든다. 목록에서 한눈에
 * 싼 와인인지 비싼 와인인지 보이게 하려는 것 — 기록 탭 가격대 통계와 같은 기준
 * (3만/7만/15만원)을 쓴다. 범위로 적혀 있으면("70,000~90,000원") 평균값으로 등급을
 * 매기고, 표시는 "7~9만원"처럼 축약해서 카드에 자리를 많이 안 차지하게 한다.
 */
function priceBadge(w) {
  var nums = String(w['평균가격(국내·원)'] || '').match(/[\d,]+/g);
  if (!nums) return '';
  var vals = nums.map(function (s) { return parseInt(s.replace(/,/g, ''), 10); }).filter(Boolean);
  if (!vals.length) return '';
  var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
  var avg = (lo + hi) / 2;
  // 저가 등급은 var(--ok)(다른 곳과 공유하는 차분한 초록) 대신 눈에 더 쨍하게 띄는
  // 밝은 초록을 따로 쓴다 — "이건 확실히 싸다"는 게 목록에서 바로 보이도록.
  var tier = avg < 30000 ? { c: '#0FA958', s: '#DEF7E7' }
    : avg < 70000 ? { c: 'var(--gold)', s: '#FBF2DC' }
    : avg < 150000 ? { c: '#C1650A', s: '#FBEAD9' }
    : { c: 'var(--wine)', s: 'var(--wine-soft)' };
  var fmt = function (v) { return v >= 10000 ? Math.round(v / 10000) + '만' : Math.round(v / 1000) + '천'; };
  var loStr = fmt(lo), hiStr = fmt(hi);
  // 단위(만/천)가 둘 다 같으면 "7만~9만원" 대신 "7~9만원"처럼 뒤쪽 하나에만 붙인다.
  var text = lo === hi ? loStr + '원'
    : (loStr.slice(-1) === hiStr.slice(-1) ? loStr.slice(0, -1) : loStr) + '~' + hiStr + '원';
  return '<span class="tag" style="--c:' + tier.c + ';--c-soft:' + tier.s + '">' + text + '</span>';
}

/** 생산지/국가 텍스트(자유 서술이라 형식이 다양함)에서 국가 이름을 찾아 국기 이모지로.
 * 못 찾으면 빈 문자열 — 국가 표기가 없거나 목록에 없는 나라면 그냥 텍스트만 보여준다. */
var COUNTRY_FLAGS = [
  ['프랑스', '🇫🇷'], ['이탈리아', '🇮🇹'], ['스페인', '🇪🇸'], ['포르투갈', '🇵🇹'],
  ['독일', '🇩🇪'], ['오스트리아', '🇦🇹'], ['헝가리', '🇭🇺'], ['그리스', '🇬🇷'],
  ['조지아', '🇬🇪'], ['스위스', '🇨🇭'], ['불가리아', '🇧🇬'], ['루마니아', '🇷🇴'],
  ['크로아티아', '🇭🇷'], ['슬로베니아', '🇸🇮'], ['영국', '🇬🇧'],
  ['미국', '🇺🇸'], ['캐나다', '🇨🇦'], ['멕시코', '🇲🇽'],
  ['칠레', '🇨🇱'], ['아르헨티나', '🇦🇷'], ['브라질', '🇧🇷'], ['우루과이', '🇺🇾'],
  ['오스트레일리아', '🇦🇺'], ['호주', '🇦🇺'], ['뉴질랜드', '🇳🇿'],
  ['남아프리카공화국', '🇿🇦'], ['남아공', '🇿🇦'],
  ['일본', '🇯🇵'], ['중국', '🇨🇳'], ['대한민국', '🇰🇷'], ['한국', '🇰🇷'],
  ['이스라엘', '🇮🇱'], ['레바논', '🇱🇧'], ['튀르키예', '🇹🇷'], ['터키', '🇹🇷']
];
function countryFlag(w) {
  var s = String(w['생산지/국가'] || '');
  for (var i = 0; i < COUNTRY_FLAGS.length; i++) {
    if (s.indexOf(COUNTRY_FLAGS[i][0]) !== -1) return COUNTRY_FLAGS[i][1];
  }
  return '';
}

function cardHtml(w, extraHtml) {
  var isDrunk = w['상태'] === '마심';
  var t = typeStyle(w['종류']);
  var flag = countryFlag(w);
  var countryText = (w['생산지/국가'] || '').split('/').pop();
  var bits = [w['빈티지'], countryText ? (flag ? flag + ' ' + countryText : countryText) : ''].filter(Boolean);
  var sub = bits.length ? '<span class="dot">' + esc(bits.join(' · ')) + '</span>' : '';
  var grape = w['품종'] ? '<span class="dot">' + esc(String(w['품종']).split(/[·,]/)[0]) + '</span>' : '';
  var price = priceBadge(w);

  var foot = isDrunk
    ? '<span class="when">' + esc(w['마신날짜']) + '</span>' +
      (w['평점'] ? '<span class="stars">' + starsHtml(w['평점']) + '</span>' : '') +
      '<button class="undo-btn" onclick="event.stopPropagation();doUnmark(' + w.rowIndex + ')">되돌리기</button>'
    : '<span></span><button class="drink-btn" onclick="event.stopPropagation();openDrinkModal(' + w.rowIndex + ')">마시기</button>';

  var thumb = w['라벨사진'] ? '<img class="card-thumb" src="' + esc(w['라벨사진']) + '" alt="" loading="lazy" decoding="async">' : '';

  return '<div class="card' + (isDrunk ? ' dim' : '') + '" style="--c:' + t.c + ';--c-soft:' + t.s + '" onclick="openDetail(' + w.rowIndex + ')">' +
    '<div class="card-head">' + thumb +
    '<div class="card-head-text">' +
    '<div class="name">' + esc(w['와인명']) + '</div>' +
    '<div class="line"><span class="tag">' + esc(t.n) + '</span>' + price + grape + sub + '</div>' +
    '</div></div>' +
    (extraHtml || '') +
    '<div class="foot">' + foot + '</div>' +
    '</div>';
}

/* ---------- 상세 ---------- */
function openDetail(r) {
  var w = findWine(r);
  if (!w) { toast('목록이 바뀌었어요, 새로고침할게요'); load(); return; }
  DETAIL_ROW = r;
  // 비어 있는 정보가 있고, 아직 AI에게 안 물어봤을 때만 한 번에 보충한다.
  // 응답이 와도 결과만 그 자리에 반영하고 다시 조회하지 않는다(재호출 루프 방지).
  // 물어본 뒤엔 서버가 "정보갱신일"을 찍어서, AI가 끝내 못 알아낸 와인이라도
  // 상세를 열 때마다 같은 질문을 반복하지 않는다(3개월 뒤 한 번 더 물어봄).
  var needSuggest = infoIncomplete(w) && infoAskDue(w);
  var photo = w['라벨사진'] ? '<img src="' + esc(w['라벨사진']) + '" style="width:100%;border-radius:14px;margin:14px 0 4px;">' : '';
  var t = typeStyle(w['종류']);
  document.getElementById('detailBody').innerHTML =
    '<h3>' + esc(w['와인명']) + '</h3>' +
    '<div class="line" style="margin-top:8px"><span class="tag" style="--c:' + t.c + ';--c-soft:' + t.s + '">' + esc(t.n) + '</span></div>' +
    photo +
    '<div class="facts" id="detailFacts">' + detailFactsHtml(w) + '</div>' +
    '<div id="styleBox">' + styleChartHtml(w) + '</div>' +
    '<div id="servingBox">' + (servingFactsHtml(w) || (needSuggest ? '<div class="note" id="servingSuggest" style="margin-top:12px">🍷 부족한 정보 AI로 채우는 중…</div>' : '')) + '</div>' +
    '<div class="act-row" style="margin-top:14px">' +
    '<button class="act" onclick="shareWine(' + r + ')"><span class="ic">🔗</span>공유</button>' +
    '<button class="act" onclick="startEdit(' + r + ')"><span class="ic">✏️</span>수정</button>' +
    '<button class="act" onclick="deleteWineConfirm(' + r + ')"><span class="ic">🗑</span>삭제</button>' +
    '</div>' +
    '<button class="more-toggle" onclick="cm(\'detailModal\')">닫기</button>';
  om('detailModal');

  if (needSuggest) {
    callAPI(function () { return API.suggestWineInfo(r); }).then(function (res) {
      if (DETAIL_ROW !== r) return; // 그 사이 다른 와인을 열었으면 무시
      if (!res || res.error) {
        var note = document.getElementById('servingSuggest');
        if (note) note.remove();
        return;
      }
      ['품종', '생산지/국가', '서빙온도', '에어링시간', '완벽한잔', '완벽한잔별점',
        '내잔추천', '내잔추천별점', '추천 페어링', '추천페어링별점',
        '베스트페어링', '베스트페어링별점',
        '와인배경', '평균가격(국내·원)', '정보갱신일',
        '당도', '산도', '타닌', '바디감'].forEach(function (k) {
        if (res[k]) w[k] = res[k];
      });
      var factsEl = document.getElementById('detailFacts');
      if (factsEl) factsEl.innerHTML = detailFactsHtml(w);
      var styleEl = document.getElementById('styleBox');
      if (styleEl) styleEl.innerHTML = styleChartHtml(w);
      var servingEl = document.getElementById('servingBox');
      if (servingEl) servingEl.innerHTML = servingFactsHtml(w);
    });
  }
}

/**
 * 당도·산도·타닌·바디감(각 1~5)을 막대로 보여주는 와인 스타일 차트.
 * 기록 탭 통계와 같은 막대 스타일(.bar-row/.bar-wrap/.bar)을 그대로 재사용한다 —
 * 이 앱 전체가 하나의 막대 그래프 표현을 쓰도록 통일해서, 새 UI 패턴을 안 늘린다.
 * 넷 다 아직 안 채워졌으면(AI가 아직 안 다녀갔으면) 빈 문자열을 돌려준다.
 */
function styleChartHtml(w) {
  var dims = [
    ['당도', w['당도'], '드라이', '스위트'],
    ['산도', w['산도'], '밋밋함', '신맛강함'],
    ['타닌', w['타닌'], '부드러움', '떫음'],
    ['바디감', w['바디감'], '가벼움', '묵직함']
  ];
  var rows = dims.filter(function (d) { return d[1]; });
  if (!rows.length) return '';
  return '<div class="sect" style="margin:20px 0 6px">🍇 와인 스타일</div>' +
    rows.map(function (d) {
      var v = parseInt(d[1], 10) || 0;
      return '<div class="bar-row"><div class="k">' + d[0] +
        ' <span class="style-range">(' + d[2] + ' ↔ ' + d[3] + ')</span></div>' +
        '<div class="row2"><div class="bar-wrap"><div class="bar" style="--c:var(--wine);width:' + (v / 5 * 100) + '%"></div></div>' +
        '<div class="n">' + v + '/5</div></div></div>';
    }).join('');
}

/** "38000"처럼 숫자만 입력했으면 "38,000원"으로 보기 좋게 바꾼다. 이미 단위나
 * 다른 글자가 섞여 있으면(예: "38000원 세일가") 손대지 않고 입력한 그대로 보여준다. */
function fmtWonIfNumeric(v) {
  var s = String(v || '').trim();
  if (!s) return '';
  return /^[\d,]+$/.test(s) ? Number(s.replace(/,/g, '')).toLocaleString('ko-KR') + '원' : s;
}

/** 상세 상단의 기본 정보(품종·생산지·빈티지·가격 등) 칸 */
function detailFactsHtml(w) {
  // AI가 채워주는 서빙온도/완벽한잔이 이미 있으면 옛날 방식 수동 입력 필드(어울리는잔/서빙방법)는
  // 같은 내용이 중복되니 숨긴다. 추천 페어링은 별점과 함께 servingFactsHtml에서 보여준다.
  var hasAiServing = w['서빙온도'] || w['완벽한잔'];
  var facts = [
    ['🍇 품종', w['품종']],
    ['📍 생산지', w['생산지/국가']],
    ['📅 빈티지', w['빈티지']],
    ['💰 가격', w['평균가격(국내·원)']],
    ['🥂 잔', hasAiServing ? '' : w['어울리는잔']],
    ['🌡 서빙', hasAiServing ? '' : w['서빙방법']],
    ['🛒 구매처', w['구매처']],
    ['💵 구매 가격', fmtWonIfNumeric(w['구매가격'])],
    ['📖 배경', w['와인배경']],
    ['📝 메모', w['메모']]
  ];
  if (w['상태'] === '마심') {
    facts.push(['🍷 마신날', w['마신날짜']]);
    facts.push(['⭐ 평점', w['평점'] ? starsHtml(w['평점']) : '']);
    facts.push(['🔁 재구매 의향', w['재구매의향']]);
    facts.push(['💬 한줄평', w['한줄평']]);
    facts.push(['🍴 함께한 음식', w['함께한음식']]);
  }
  return facts.filter(function (f) { return f[1]; }).map(function (f) {
    return '<div class="fact"><div class="k">' + f[0] + '</div><div class="v">' + esc(f[1]) + '</div></div>';
  }).join('');
}

/**
 * 서빙 온도 · 에어링(디캔팅) 시간 · 잔 추천 두 가지(완벽한 잔 / 내 잔 추천) ·
 * 페어링 음식 두 가지(클래식 페어링 / 제안 페어링)를 각각 따로 보여준다.
 * 잔 두 종류와 페어링 두 종류에는 5점 만점 별점이 함께 붙는다(완벽할 때만 5개).
 */
function servingFactsHtml(w) {
  var rows = [];
  if (w['서빙온도']) rows.push(['🌡️ 서빙 온도', w['서빙온도']]);
  if (w['에어링시간']) rows.push(['⏱ 에어링 시간', w['에어링시간']]);
  if (w['완벽한잔']) rows.push(['🥂 완벽한 잔', w['완벽한잔'] + ' ' + starsHtml(w['완벽한잔별점'])]);
  if (w['내잔추천']) rows.push(['🍷 내 잔 추천', w['내잔추천'] + ' ' + starsHtml(w['내잔추천별점'])]);
  if (w['베스트페어링']) rows.push(['🍽 클래식 페어링 음식', w['베스트페어링'] + (w['베스트페어링별점'] ? ' ' + starsHtml(w['베스트페어링별점']) : '')]);
  if (w['추천 페어링']) rows.push(['🍽 제안 페어링 음식', w['추천 페어링'] + (w['추천페어링별점'] ? ' ' + starsHtml(w['추천페어링별점']) : '')]);
  if (!rows.length) return '';
  return '<div class="facts" style="margin-top:0">' + rows.map(function (f) {
    return '<div class="fact"><div class="k">' + f[0] + '</div><div class="v">' + esc(f[1]) + '</div></div>';
  }).join('') + '</div>';
}

/**
 * 와인 상세 정보를 공유한다. 보유 와인이든 마신 와인이든 내용은 똑같다 —
 * 품종·생산지·빈티지·가격·서빙 정보·잔 추천·페어링·배경만 보낸다.
 * 마신 기록(별점·한줄평·재구매 의향·마신 날짜)은 내 개인 평가라서 일부러 뺀다.
 */
function shareWineText(w) {
  var lines = ['🍷 ' + (w['와인명'] || '')];
  var t = typeStyle(w['종류']);
  lines.push(t.n);
  [['품종', w['품종']], ['생산지', w['생산지/국가']], ['빈티지', w['빈티지']], ['가격', w['평균가격(국내·원)']]]
    .forEach(function (f) { if (f[1]) lines.push(f[0] + ': ' + f[1]); });
  if (w['서빙온도']) lines.push('서빙 온도: ' + w['서빙온도']);
  if (w['에어링시간']) lines.push('에어링 시간: ' + w['에어링시간']);
  if (w['완벽한잔']) lines.push('완벽한 잔: ' + w['완벽한잔'] + (w['완벽한잔별점'] ? ' ' + starsHtml(w['완벽한잔별점']) : ''));
  // "내 잔 추천"은 내가 등록해둔 잔 중에서 고른 거라 나한테만 의미 있다 — 받는 사람은
  // 같은 잔을 안 갖고 있을 테니 공유 내용에서는 뺀다(완벽한 잔은 누구에게나 유효해서 남김).
  if (w['베스트페어링']) lines.push('클래식 페어링 음식: ' + w['베스트페어링'] + (w['베스트페어링별점'] ? ' ' + starsHtml(w['베스트페어링별점']) : ''));
  if (w['추천 페어링']) lines.push('제안 페어링 음식: ' + w['추천 페어링'] + (w['추천페어링별점'] ? ' ' + starsHtml(w['추천페어링별점']) : ''));
  if (w['와인배경']) lines.push('\n' + w['와인배경']);
  return lines.join('\n');
}
function shareWine(r) {
  var w = findWine(r); if (!w) return;
  var text = shareWineText(w);
  var title = w['와인명'] || '와인 정보';

  function shareTextOnly() {
    if (navigator.share) navigator.share({ title: title, text: text }).catch(function () { copyText(text); });
    else copyText(text);
  }

  if (!w['라벨사진'] || !navigator.share) { shareTextOnly(); return; }

  // 사진도 같이 보내본다. 구글 CDN에서 받아오는 사진이라 fetch가 막힐 수도 있고
  // (브라우저에 <img>로 보여주는 건 되지만 fetch로 바이트를 읽어오는 건 CORS가
  // 따로 허용돼야 한다), 파일 공유 자체를 브라우저가 지원 안 할 수도 있다 —
  // 어느 쪽이든 실패하면 조용히 텍스트만 공유한다(사용자가 보기엔 그냥 평소처럼 동작).
  fetch(w['라벨사진']).then(function (res) {
    if (!res.ok) throw new Error('fetch failed');
    return res.blob();
  }).then(function (blob) {
    var file = new File([blob], '와인라벨.jpg', { type: blob.type || 'image/jpeg' });
    var data = { title: title, text: text, files: [file] };
    if (navigator.canShare && !navigator.canShare(data)) throw new Error('file share unsupported');
    return navigator.share(data);
  }).catch(function (err) {
    // 사용자가 공유 시트를 직접 취소한 경우(AbortError)까지 텍스트로 재시도하면
    // 원치 않는 동작이 겹쳐 뜬다 — 그때는 그냥 둔다.
    if (err && err.name === 'AbortError') return;
    shareTextOnly();
  });
}

/** 실수로 등록한 와인 삭제 (되돌리기 불가라 한 번 더 확인) */
function deleteWineConfirm(r) {
  var w = findWine(r);
  if (!w) { toast('목록이 바뀌었어요, 새로고침할게요'); load(); return; }
  if (!confirm((w['와인명'] || '이 와인') + '을(를) 삭제할까요? 되돌릴 수 없어요.')) return;
  callAPI(function () { return API.deleteWine(r, w['와인명']); }).then(function (res) {
    if (!res || res.error) {
      toast('실패: ' + ((res && res.error) || ''));
      // 목록이 밀려서 실패한 거면 지금 든 rowIndex들을 더는 믿을 수 없으니 새로고침한다.
      load();
      return;
    }
    cm('detailModal');
    toast('삭제했어요');
    load();
  });
}

/** 잘못 입력된 정보를 고치러 "추가" 화면으로 이동 (같은 폼을 재사용) */
function startEdit(r) {
  var w = findWine(r);
  if (!w) { toast('목록이 바뀌었어요, 새로고침할게요'); cm('detailModal'); load(); return; }
  EDIT_ROW = r;
  EDIT_ORIG_NAME = w['와인명'] || '';
  cm('detailModal');

  var fields = ['와인명', '품종', '빈티지', '생산지/국가', '메모', '구매처', '구매가격'];
  fields.forEach(function (f) {
    var el = document.getElementById('f_' + f);
    if (el) el.value = w[f] || '';
  });
  SELECTED_TYPE = typeStyle(w['종류']).n;
  document.querySelectorAll('#typeChips button').forEach(function (x) { x.classList.toggle('on', x.dataset.t === SELECTED_TYPE); });

  document.getElementById('similarHint').innerHTML = '';
  PHOTO_DATAURL = null; PHOTO_UPLOADED_URL = null;
  document.getElementById('photoPreview').innerHTML = w['라벨사진'] ? '<img src="' + esc(w['라벨사진']) + '">' : '';
  document.getElementById('photoNote').innerHTML = '<div class="note">사진을 새로 찍으면 라벨 사진이 교체돼요. 그대로 두면 기존 사진이 유지돼요</div>';
  document.getElementById('addForm').style.display = '';
  document.getElementById('pickArea').style.display = 'none';
  document.getElementById('addBtn').textContent = '수정하기';

  // 이미 마신 와인이면 별점도 여기서 고칠 수 있게 — 마시기 기록 당시 잘못 눌렀을 때
  // 다시 "마시기"를 거치지 않고 바로잡게 하려는 것.
  var isDrunk = w['상태'] === '마심';
  document.getElementById('editRatingBox').style.display = isDrunk ? '' : 'none';
  if (isDrunk) { EDIT_RATING = parseInt(w['평점'], 10) || 0; renderEditStars(); }

  ADD_MODE = isDrunk ? '마심' : '보유';
  showAddModal();
}

/**
 * 와인 추가 창. mode '보유' = 셀러에 넣기(셀러 탭의 떠 있는 버튼),
 * '마심' = 셀러에 없던 와인을 바로 마신 와인으로 기록(기록 탭의 버튼, 평점·한줄평 등 같이 받음).
 * 같은 모드로 다시 열면 쓰다 만 내용은 그대로 두고, 수정 중이었거나 모드가 바뀌면 새 폼으로 연다.
 */
var ADD_MODE = '보유';
function openAdd(mode) {
  if (EDIT_ROW !== null || ADD_MODE !== mode) { ADD_MODE = mode; resetAddForm(); }
  showAddModal();
}
/** 지금 모드(ADD_MODE)와 수정 여부(EDIT_ROW)에 맞춰 창 모양을 맞추고 연다 */
function showAddModal() {
  var drunkMode = ADD_MODE === '마심';
  var editing = EDIT_ROW !== null;
  document.getElementById('addModalTitle').textContent = editing ? '와인 수정' : (drunkMode ? '마신 와인 기록' : '와인 추가');
  // 여러 병 한번에 찍기는 셀러에 담을 때만 쓴다
  document.getElementById('photoAllLabel').style.display = drunkMode ? 'none' : '';
  if (drunkMode && document.getElementById('pickArea').style.display !== 'none') cancelPick();
  document.getElementById('addDrinkBox').style.display = (drunkMode && !editing) ? '' : 'none';
  if (drunkMode && !editing) { renderAddStars(); renderAddRepurchaseChips(); }
  if (!editing) document.getElementById('addBtn').textContent = drunkMode ? '마신 와인 기록하기' : '셀러에 넣기';
  om('addModal');
  document.querySelector('#addModal .modal').scrollTop = 0;
}
/** 창 닫기. 수정하다 닫았으면 다음에 "추가"를 열 때 그 와인이 남아있지 않게 비운다 */
function closeAdd() {
  cm('addModal');
  if (EDIT_ROW !== null) resetAddForm();
}

function resetAddForm() {
  EDIT_ROW = null;
  EDIT_ORIG_NAME = '';
  document.querySelectorAll('#addForm input, #addForm textarea').forEach(function (el) { el.value = ''; });
  document.querySelectorAll('#typeChips button').forEach(function (x) { x.classList.remove('on'); });
  SELECTED_TYPE = ''; PHOTO_DATAURL = null; PHOTO_UPLOADED_URL = null;
  document.getElementById('similarHint').innerHTML = '';
  document.getElementById('photoPreview').innerHTML = '';
  document.getElementById('photoNote').innerHTML = '';
  document.getElementById('addBtn').textContent = ADD_MODE === '마심' ? '마신 와인 기록하기' : '셀러에 넣기';
  document.getElementById('editRatingBox').style.display = 'none';
  EDIT_RATING = 0;
  ADD_RATING = 5; ADD_REPURCHASE = '';
  document.getElementById('addDrinkBox').style.display = ADD_MODE === '마심' ? '' : 'none';
  if (ADD_MODE === '마심') { renderAddStars(); renderAddRepurchaseChips(); }
}

/* ---------- 마시기 ---------- */
// 별점(만족도)과는 다른 축이다 — 맛있어도 비싸면 재구매 의향은 낮을 수 있다.
var REPURCHASE_OPTIONS = ['쟁여두고 싶다', '가격 좋으면 산다', '한 번이면 족하다'];
var CURRENT_REPURCHASE = '';

function openDrinkModal(r) {
  var w = findWine(r);
  PENDING_ROW = r; CURRENT_RATING = 5; CURRENT_REPURCHASE = '';
  document.getElementById('drinkTitle').textContent = w ? w['와인명'] : '';
  document.getElementById('drinkComment').value = '';
  document.getElementById('drinkFood').value = '';
  renderStars(); renderRepurchaseChips(); om('drinkModal');
}
/** 별점 입력 UI. 마시기 모달과 수정 폼(마신 와인의 평점 고치기)이 같이 쓴다. */
function renderStarPicker(elId, current, onPick) {
  var el = document.getElementById(elId);
  el.innerHTML = '';
  for (var i = 1; i <= 5; i++) {
    var s = document.createElement('span');
    s.textContent = '★';
    s.className = i <= current ? 'on' : '';
    s.onclick = (function (v) { return function () { onPick(v); }; })(i);
    el.appendChild(s);
  }
}
function renderStars() {
  renderStarPicker('starPick', CURRENT_RATING, function (v) { CURRENT_RATING = v; renderStars(); });
}

/** 수정 폼에서 마신 와인의 평점을 고칠 때 쓰는 상태 */
var EDIT_RATING = 0;
function renderEditStars() {
  renderStarPicker('editStarPick', EDIT_RATING, function (v) { EDIT_RATING = v; renderEditStars(); });
}
/** 재구매 의향 칩. 마시기 모달과 기록 탭의 마신 와인 추가 폼이 같이 쓴다. */
function renderRepurchasePicker(elId, current, onPick) {
  var el = document.getElementById(elId);
  el.innerHTML = REPURCHASE_OPTIONS.map(function (o) {
    return '<button type="button" class="' + (current === o ? 'on' : '') + '" style="--c:var(--wine);--c-soft:var(--wine-soft)">' + esc(o) + '</button>';
  }).join('');
  el.querySelectorAll('button').forEach(function (b, i) {
    b.onclick = function () { onPick(current === REPURCHASE_OPTIONS[i] ? '' : REPURCHASE_OPTIONS[i]); };
  });
}
function renderRepurchaseChips() {
  renderRepurchasePicker('repurchaseChips', CURRENT_REPURCHASE, function (v) { CURRENT_REPURCHASE = v; renderRepurchaseChips(); });
}

/** 기록 탭에서 마신 와인을 바로 추가할 때 쓰는 평점·재구매 의향 상태 */
var ADD_RATING = 5, ADD_REPURCHASE = '';
function renderAddStars() {
  renderStarPicker('addStarPick', ADD_RATING, function (v) { ADD_RATING = v; renderAddStars(); });
}
function renderAddRepurchaseChips() {
  renderRepurchasePicker('addRepurchaseChips', ADD_REPURCHASE, function (v) { ADD_REPURCHASE = v; renderAddRepurchaseChips(); });
}
function confirmDrink() {
  var info = {
    '평점': CURRENT_RATING,
    '한줄평': document.getElementById('drinkComment').value,
    '함께한음식': document.getElementById('drinkFood').value,
    '재구매의향': CURRENT_REPURCHASE
  };
  callAPI(function () { return API.markDrunk(PENDING_ROW, info); }).then(function (res) {
    if (!res || res.error) { toast('실패: ' + ((res && res.error) || '')); return; }
    toast('기록했어요 🍷'); cm('drinkModal'); load();
  });
}
function doUnmark(r) {
  callAPI(function () { return API.unmarkDrunk(r); }).then(function (res) {
    if (!res || res.error) { toast('실패: ' + ((res && res.error) || '')); return; }
    toast('셀러로 되돌렸어요'); load();
  });
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
/**
 * 음식 칩은 여러 개 골라도 되는 다중 선택이다(SELECTED_FOODS). 다시 누르면 선택 해제.
 * 음식을 하나라도 고른 상태면 바로 추천을 다시 부르고, 마지막 하나를 해제하면
 * 결과 영역을 비운다 — 매번 "찾기" 버튼을 새로 누르지 않아도 즉시 반영된다.
 */
function toggleFoodSelection(label) {
  var i = SELECTED_FOODS.indexOf(label);
  if (i === -1) SELECTED_FOODS.push(label); else SELECTED_FOODS.splice(i, 1);
  renderQuickFoods();
  renderCellarPairingChips();
  if (SELECTED_FOODS.length) doRecommend();
  else document.getElementById('foodArea').innerHTML = '';
}

/**
 * 카테고리 탭(한식/중식/…) 한 줄 + 고른 카테고리의 메뉴 칩 한 줄, 그 아래
 * 지금까지 고른 음식을 모아 보여주는 요약 칩까지 — 세 블록을 한 번에 그린다.
 */
function renderQuickFoods() {
  var cats = document.getElementById('foodCats');
  cats.innerHTML = FOOD_MENU.map(function (item) {
    var isOn = ACTIVE_FOOD_CAT === item.label;
    return '<button type="button" class="' + (isOn ? 'on' : '') + '" data-cat="' + esc(item.label) + '">' + esc(item.icon || '') + ' ' + esc(item.label) + '</button>';
  }).join('');
  cats.querySelectorAll('button').forEach(function (b) {
    b.onclick = function () { ACTIVE_FOOD_CAT = b.dataset.cat; renderQuickFoods(); };
  });

  var dishes = document.getElementById('foodDishes');
  var cat = FOOD_MENU.filter(function (c) { return c.label === ACTIVE_FOOD_CAT; })[0];
  var list = cat ? cat.children : [];
  dishes.innerHTML = list.map(function (label) {
    var isSelected = SELECTED_FOODS.indexOf(label) !== -1;
    return '<button type="button" class="' + (isSelected ? 'on' : '') + '" style="--c:var(--wine);--c-soft:var(--wine-soft)">' + esc(label) + '</button>';
  }).join('');
  dishes.querySelectorAll('button').forEach(function (b) {
    b.onclick = function () { toggleFoodSelection(b.textContent); };
  });

  renderSelectedFoodChips();
}

/** 카테고리를 옮겨도 지금까지 고른 음식이 안 보이지 않도록 별도 요약 줄로 항상 보여준다. */
function renderSelectedFoodChips() {
  var el = document.getElementById('foodSelectedChips');
  if (!el) return;
  el.innerHTML = SELECTED_FOODS.map(function (label) {
    return '<button type="button" class="on" style="--c:var(--wine);--c-soft:var(--wine-soft)">' + esc(label) + ' <span class="x">✕</span></button>';
  }).join('');
  el.querySelectorAll('button').forEach(function (b, i) {
    b.onclick = function () { toggleFoodSelection(SELECTED_FOODS[i]); };
  });
}

/**
 * 셀러 와인들의 "추천 페어링" 문구에서 짧은 음식 키워드를 뽑아 퀵칩으로 함께 보여준다.
 * FOOD_MENU(일반적인 음식 목록)와 우리 셀러에 실제로 적힌 페어링 정보를 섞어서 보여주는 것 —
 * 이 칩을 고르면 그 문구가 그대로 검색어가 되니 항상 "페어링 정보에 있어요" 배지가 뜬다.
 */
function cellarPairingKeywords() {
  var set = {};
  ALL_WINES.forEach(function (w) {
    var text = (String(w['추천 페어링'] || '') + ',' + String(w['베스트페어링'] || ''))
      .replace(/베스트\s*:/g, '').replace(/한국\s*:/g, '');
    text.split(/[·,\/]+/).forEach(function (part) {
      var t = part.trim();
      if (t && t.length <= 10 && !/[.!?]/.test(t)) set[t] = true;
    });
  });
  return Object.keys(set).slice(0, 10);
}
function renderCellarPairingChips() {
  var label = document.getElementById('foodCellarLabel');
  var el = document.getElementById('foodCellarChips');
  if (!label || !el) return;
  var keywords = cellarPairingKeywords();
  if (!keywords.length) { label.style.display = 'none'; el.innerHTML = ''; return; }
  label.style.display = '';
  el.innerHTML = keywords.map(function (k) {
    var isSelected = SELECTED_FOODS.indexOf(k) !== -1;
    return '<button type="button" class="' + (isSelected ? 'on' : '') + '" style="--c:var(--wine);--c-soft:var(--wine-soft)">' + esc(k) + '</button>';
  }).join('');
  el.querySelectorAll('button').forEach(function (b) {
    b.onclick = function () { toggleFoodSelection(b.textContent); };
  });
}
/* ---------- 사진 ----------
 * 폰 카메라 원본은 보통 몇 MB나 돼서, 그대로 보내면 AI 인식(recognizeLabel)과
 * 저장(addWine)에 매번 그 큰 용량을 두 번 실어 날라야 해서 느리다. 캔버스로
 * 줄이고 압축해서 보내면 라벨 글자를 읽는 데는 지장 없으면서 훨씬 빠르다.
 */
function onPhoto(e, mode) {
  var f = e.target.files[0]; if (!f) return;
  e.target.value = '';
  PHOTO_UPLOADED_URL = null; // 새 사진을 골랐으니 전에 올려둔 URL은 더 이상 안 맞다
  var note = document.getElementById('photoNote');
  note.innerHTML = '<div class="note">📖 사진 준비 중…</div>';
  // 셀러 사진은 병이 여러 개라 조금 더 크게 남겨야 각 라벨 글자가 읽힌다
  var maxDim = mode === 'all' ? 1600 : 1280;
  compressImage(f, maxDim, 0.85).then(function (dataUrl) {
    PHOTO_DATAURL = dataUrl;
    document.getElementById('photoPreview').innerHTML = '<img src="' + dataUrl + '">';
    note.innerHTML = '<div class="note">📖 라벨 읽는 중…</div>';
    if (mode === 'one') recognizeOne(note); else recognizeAll(note);
  }).catch(function () {
    // 압축이 안 되는 환경이면 원본이라도 그대로 쓴다(느리더라도 동작은 하게)
    var rd = new FileReader();
    rd.onload = function () {
      PHOTO_DATAURL = rd.result;
      document.getElementById('photoPreview').innerHTML = '<img src="' + rd.result + '">';
      note.innerHTML = '<div class="note">📖 라벨 읽는 중…</div>';
      if (mode === 'one') recognizeOne(note); else recognizeAll(note);
    };
    rd.readAsDataURL(f);
  });
}

/** 이미지를 maxDim(긴 변 기준) 이하로 줄이고 JPEG로 압축해 데이터 URL로 반환 */
function compressImage(file, maxDim, quality) {
  return new Promise(function (resolve, reject) {
    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function () {
      URL.revokeObjectURL(url);
      var scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      var cw = Math.max(1, Math.round(img.width * scale));
      var ch = Math.max(1, Math.round(img.height * scale));
      var canvas = document.createElement('canvas');
      canvas.width = cw; canvas.height = ch;
      var ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('canvas 미지원')); return; }
      ctx.drawImage(img, 0, 0, cw, ch);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('이미지를 불러오지 못했어요')); };
    img.src = url;
  });
}

function recognizeOne(note) {
  callAPI(function () { return API.recognizeLabel(PHOTO_DATAURL); }).then(function (g) {
    if (!g || g.error) {
      note.innerHTML = '<div class="note warn">읽지 못했어요. 직접 입력해주세요<br><small>' + esc(g && g.error) + '</small></div>';
      return;
    }
    note.innerHTML = '<div class="note">✨ 자동으로 채웠어요. 확인하고 고쳐주세요</div>';
    // 인식할 때 서버가 사진을 이미 올려뒀으면 그 URL을 기억해뒀다가 저장할 때
    // 재사용한다 — 같은 사진을 또 업로드하지 않아도 된다.
    if (g['_photoUrl']) PHOTO_UPLOADED_URL = g['_photoUrl'];
    if (g['와인명']) document.getElementById('f_와인명').value = g['와인명'];
    if (g['품종']) document.getElementById('f_품종').value = g['품종'];
    if (g['빈티지']) document.getElementById('f_빈티지').value = g['빈티지'];
    if (g['생산지_국가']) document.getElementById('f_생산지/국가').value = g['생산지_국가'];
    if (g['종류']) {
      SELECTED_TYPE = typeStyle(g['종류']).n;
      document.querySelectorAll('#typeChips button').forEach(function (x) { x.classList.toggle('on', x.dataset.t === SELECTED_TYPE); });
    }
    checkSimilar();
  });
}

function recognizeAll(note) {
  callAPI(function () { return API.recognizeCellar(PHOTO_DATAURL); }).then(function (list) {
    if (!list || list.error) {
      note.innerHTML = '<div class="note warn">인식 실패<br><small>' + esc(list && list.error) + '</small></div>';
      return;
    }
    if (!list.length) {
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
  });
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
  callAPI(function () { return API.addWines(sel); }).then(function (r) {
    if (!r || r.error) { toast('실패: ' + ((r && r.error) || '')); btn.disabled = false; renderPicks(); return; }
    toast(r.added + '병 담았어요 🍾');
    cancelPick(); cm('addModal'); goCellarOwned();
  });
}

/**
 * 중복 힌트. ALL_WINES가 이미 세션에 캐시돼 있어서(load()) 서버를 안 부르고
 * 그 자리에서 바로 걸러 보여준다 — 타이핑할 때마다 즉시 뜬다.
 */
function checkSimilar() {
  var kw = (document.getElementById('f_품종').value || SELECTED_TYPE).trim();
  var box = document.getElementById('similarHint');
  if (kw.length < 2) { box.innerHTML = ''; return; }
  var ms = ALL_WINES.filter(function (w) {
    if (w['상태'] !== '마심') return false;
    return String(w['품종'] || '').indexOf(kw) !== -1 || String(w['종류'] || '').indexOf(kw) !== -1;
  });
  box.innerHTML = ms.length
    ? '<div class="note">💡 비슷한 걸 ' + ms.length + '번 마셔봤어요: ' + ms.map(function (m) { return esc(m['와인명']); }).join(', ') + '</div>'
    : '';
}

/* ---------- 추가 / 수정 저장 ---------- */
function submitAdd(e) {
  e.preventDefault();
  var fields = ['와인명', '품종', '빈티지', '생산지/국가', '메모', '구매처', '구매가격'];
  var data = { '종류': SELECTED_TYPE };
  fields.forEach(function (f) {
    var el = document.getElementById('f_' + f);
    if (el) data[f] = el.value;
  });
  if (!data['와인명']) { toast('와인 이름을 적어주세요'); return; }

  var editing = EDIT_ROW !== null;
  var editingDrunk = editing && document.getElementById('editRatingBox').style.display !== 'none';
  if (editingDrunk) data['평점'] = EDIT_RATING;
  // 인식할 때 사진을 이미 올려뒀으면(PHOTO_UPLOADED_URL) 그 주소를 그대로 쓰고,
  // 아니면(직접입력·인식 실패 등) 원본 데이터를 지금 올린다.
  var photo = PHOTO_UPLOADED_URL || PHOTO_DATAURL;
  if (!editing && ADD_MODE === '마심') { submitAddDrunk(data, photo); return; }
  var btn = document.getElementById('addBtn');
  btn.disabled = true; btn.textContent = editing ? '수정하는 중…' : '담는 중…';
  callAPI(function () {
    return editing ? API.updateWine(EDIT_ROW, data, photo, EDIT_ORIG_NAME) : API.addWine(data, photo);
  }).then(function (res) {
    if (!res || res.error) {
      toast('실패: ' + ((res && res.error) || ''));
      btn.disabled = false; btn.textContent = editing ? '수정하기' : '셀러에 넣기';
      // 그 사이 목록이 밀려서 생긴 실패면(다른 사람이 셀러를 바꿨을 때) 지금 든 rowIndex가
      // 더 이상 못 믿을 값이니, 다시 시도하기 전에 최신 목록으로 새로고침해둔다.
      if (editing) load();
      return;
    }
    toast(editing ? '수정했어요' : '셀러에 담았어요 🍾');
    cm('addModal');
    resetAddForm();
    btn.disabled = false;
    // 마신 와인을 수정했으면 기록 탭 "마신 와인" 칸으로, 새로 담았거나 보유 와인을 고쳤으면
    // 셀러 "보유" 칸으로 — 안 그러면 방금 고친 와인이 안 보이는 곳으로 튕겨서 "수정이 안 됐나?" 싶어진다.
    editingDrunk ? goStatSeg('마심') : goCellarOwned();
  });
}

/**
 * 기록 탭에서 셀러에 없던 와인을 바로 "마신 와인"으로 남긴다.
 * 서버에 따로 엔드포인트를 두지 않고 기존 addWine(보유로 한 줄 추가) → markDrunk(마심 처리)
 * 두 단계로 처리한다. addWine이 새 행 번호(rowIndex)를 돌려주면 그걸 쓰고, 예전 버전 서버라
 * 안 돌려주면 목록을 다시 받아서 방금 추가된(같은 이름의 가장 아래) 보유 행을 찾는다.
 */
function submitAddDrunk(data, photo) {
  var info = {
    '평점': ADD_RATING,
    '한줄평': document.getElementById('addDrinkComment').value,
    '함께한음식': document.getElementById('addDrinkFood').value,
    '재구매의향': ADD_REPURCHASE
  };
  var btn = document.getElementById('addBtn');
  btn.disabled = true; btn.textContent = '기록하는 중…';
  function fail(msg) {
    toast('실패: ' + (msg || ''));
    btn.disabled = false; btn.textContent = '마신 와인 기록하기';
  }
  callAPI(function () { return API.addWine(data, photo); }).then(function (res) {
    if (!res || res.error) { fail(res && res.error); return null; }
    if (res.rowIndex) return res.rowIndex;
    return callAPI(function () { return API.getWines(); }).then(function (d) {
      if (!d || d.error) return 0;
      var row = 0;
      d.wines.forEach(function (w) {
        if (w['와인명'] === data['와인명'] && (w['상태'] || '보유') === '보유' && w.rowIndex > row) row = w.rowIndex;
      });
      return row;
    });
  }).then(function (row) {
    if (row === null) return; // addWine 단계에서 이미 실패 처리함
    if (!row) {
      // 셀러에는 담겼는데 마심 처리를 못 한 경우 — 보유 칸에서 "마시기"로 마저 기록할 수 있다
      fail('셀러에는 담겼는데 마신 기록을 못 남겼어요. 셀러에서 "마시기"를 눌러주세요');
      load();
      return;
    }
    return callAPI(function () { return API.markDrunk(row, info); }).then(function (r) {
      if (!r || r.error) { fail((r && r.error) || '셀러에는 담겼는데 마신 기록을 못 남겼어요'); load(); return; }
      toast('기록했어요 🍷');
      cm('addModal');
      resetAddForm();
      btn.disabled = false;
      goStatSeg('마심');
    });
  });
}

/* ---------- 추천 ---------- */
function doRecommend() {
  var food = SELECTED_FOODS.join('·');
  if (!food) { toast('먼저 음식을 골라주세요'); return; }
  runRecommend(food, 'foodArea');
}

/**
 * 안주 없이 그냥 오늘 마시기 좋은 와인 추천 — 이제 음식 고르기와는 별개의 카드라서
 * 결과를 그 카드 전용 영역(noFoodArea)에 따로 보여주고, 위에서 고르고 있던 음식
 * 선택은 건드리지 않는다.
 */
function doRecommendNoFood() {
  runRecommend('', 'noFoodArea');
}

function runRecommend(food, areaId) {
  var area = document.getElementById(areaId);
  area.innerHTML = '<div class="loading">🍷 고르는 중…</div>';
  callAPI(function () { return API.recommendByFood(food); }).then(function (res) {
    if (!res || res.error) {
      area.innerHTML = '<div class="empty"><span class="big">😵</span>' + esc(res && res.error) + '</div>';
      return;
    }
    var picks = res.picks || [];
    // 베스트품종·일반스타일은 셀러에 잘 맞는 와인이 있든 없든 항상 보여준다 — 내 와인과 별개로 참고할 정보라서.
    var bestGrapeHtml = res.bestGrape
      ? '<div class="best-grape"><span class="best-grape-t">🏆 이 음식엔 이 품종이 최고예요</span><span class="best-grape-v">' + esc(res.bestGrape) + '</span></div>'
      : '';
    var styleHtml = res.style
      ? '<div class="style-guide"><div class="style-guide-t">🍇 보통 이런 스타일이 잘 어울려요</div>' + esc(res.style) + '</div>'
      : '';
    var picksHtml = picks.length
      ? picks.map(function (x) {
        var w = x.wine || x;
        var badge = x.matched ? '<div class="match-badge">🍷 이 와인 페어링 정보에 있어요</div>' : '';
        var stars = x['별점'] ? '<span class="stars">' + starsHtml(x['별점']) + '</span> ' : '';
        var reason = (stars || x.reason) ? '<div class="reason">' + stars + esc(x.reason || '') + '</div>' : '';
        return cardHtml(w, badge + reason);
      }).join('')
      : '<div class="empty"><span class="big">🤔</span>지금 셀러에서<br>딱 맞는 걸 찾지 못했어요</div>';
    area.innerHTML = bestGrapeHtml + styleHtml + picksHtml;
  });
}

/* ---------- 기록 ---------- */
/**
 * 기록(통계)은 getWines가 이미 내려준 것과 같은 데이터로 계산할 수 있어서
 * 캐시가 있으면 서버를 또 부르지 않고 그 자리에서 바로 계산한다.
 * (그래서 서버에는 통계용 엔드포인트를 따로 두지 않는다.)
 */
function loadStats() {
  var area = document.getElementById('statArea');
  if (!WINES_LOADED) {
    area.innerHTML = '<div class="loading">불러오는 중…</div>';
    callAPI(function () { return API.getWines(); }).then(function (d) {
      if (!d || d.error) {
        area.innerHTML = '<div class="empty"><span class="big">😵</span>' + esc(d && d.error) + '</div>';
        return;
      }
      ALL_WINES = d.wines; WINES_LOADED = true;
      renderStats();
    });
    return;
  }
  renderStats();
}

/**
 * "품종" 필드에서 개별 품종 이름만 뽑아낸다(블렌드는 각 품종에 1씩).
 * 예: "카베르네 소비뇽 60%·메를로 40%" → ["카베르네 소비뇽", "메를로"]
 */
function parseGrapesClient(raw) {
  return String(raw || '')
    .split(/[·,、]/)
    .map(function (s) { return s.replace(/\d+(\.\d+)?\s*%/g, '').replace(/[()]/g, '').trim(); })
    .filter(Boolean);
}

/** 가격대 구간 — 파이 조각과 범례를 싼 것부터 비싼 것 순으로 늘어놓는 기준이기도 하다 */
var PRICE_BRACKETS = ['3만원 미만', '3~7만원', '7~15만원', '15만원 이상', '가격정보없음'];

/**
 * 항목별로 "몇 병"만 세지 않고 그 항목에 들어간 와인 목록까지 같이 모아 둔다.
 * (통계 수치를 누르면 해당 와인들을 보여주기 위해서)
 */
function computeStats(wines) {
  var drunk = wines.filter(function (w) { return w['상태'] === '마심'; });
  var byMonth = {}, byType = {}, byGrape = {}, byPrice = {};
  function add(obj, k, w) { (obj[k] = obj[k] || []).push(w); }
  drunk.forEach(function (w) {
    var month = (w['마신날짜'] || '').slice(0, 7);
    if (month) add(byMonth, month, w);

    add(byType, w['종류'] || '기타', w);

    var grapes = parseGrapesClient(w['품종']);
    if (!grapes.length) grapes = ['품종 미상'];
    // 같은 품종이 한 와인에 두 번 적혀 있어도 그 와인은 한 번만 센다
    grapes.filter(function (g, i) { return grapes.indexOf(g) === i; })
      .forEach(function (g) { add(byGrape, g, w); });

    var priceMatch = String(w['평균가격(국내·원)'] || '').match(/[\d,]+/);
    var priceNum = priceMatch ? parseInt(priceMatch[0].replace(/,/g, ''), 10) : 0;
    var bracket = !priceNum ? '가격정보없음'
      : priceNum < 30000 ? PRICE_BRACKETS[0]
      : priceNum < 70000 ? PRICE_BRACKETS[1]
      : priceNum < 150000 ? PRICE_BRACKETS[2]
      : PRICE_BRACKETS[3];
    add(byPrice, bracket, w);
  });
  return { totalDrunk: drunk.length, byMonth: byMonth, byType: byType, byGrape: byGrape, byPrice: byPrice };
}

/**
 * 같은 와인(이름 기준)을 두 번 이상 마셨으면(재구매) 마실 때마다의 평점을 시간순으로 모은다.
 * 한 병씩 마실 때마다 새 행으로 기록되니, 이름이 같은 "마심" 행이 여럿이면 재구매로 본다.
 */
function computeRepeatHistory(wines) {
  var groups = {};
  wines.forEach(function (w) {
    if (w['상태'] !== '마심') return;
    var name = String(w['와인명'] || '').trim();
    if (!name) return;
    (groups[name] = groups[name] || []).push(w);
  });
  return Object.keys(groups)
    .map(function (name) { return { name: name, entries: groups[name] }; })
    .filter(function (g) { return g.entries.length >= 2; })
    .map(function (g) {
      g.entries.sort(function (a, b) { return String(a['마신날짜'] || '').localeCompare(String(b['마신날짜'] || '')); });
      return g;
    })
    .sort(function (a, b) { return b.entries.length - a.entries.length; });
}

/** 재구매 이력을 마신 날짜별 평점 그래프(막대)로 그린다. */
function repeatHistoryHtml(groups) {
  if (!groups.length) return '';
  return '<div class="sect">🔁 두 번 이상 마신 와인</div>' + groups.map(function (g) {
    var rows = g.entries.map(function (w) {
      var rating = parseInt(w['평점'], 10) || 0;
      return '<div class="bar-row"><div class="k">' + esc(w['마신날짜'] || '날짜 미상') + '</div>' +
        '<div class="row2"><div class="bar-wrap"><div class="bar" style="--c:var(--gold);width:' + (rating / 5 * 100) + '%"></div></div>' +
        '<div class="n stars">' + starsHtml(rating) + '</div></div></div>';
    }).join('');
    return '<div class="repeat-group"><div class="repeat-name">' + esc(g.name) +
      '<span class="repeat-count">' + g.entries.length + '번</span></div>' + rows + '</div>';
  }).join('');
}

/**
 * 통계 항목을 눌렀을 때 보여줄 와인 목록. onclick 속성에 품종 이름 같은 문자열을
 * 그대로 넣으면 따옴표 이스케이프가 까다로워서, 목록은 여기 모아 두고 번호로만 가리킨다.
 */
var STAT_LISTS = [];
function statListRef(title, wines) {
  STAT_LISTS.push({ title: title, wines: wines });
  return STAT_LISTS.length - 1;
}

function openStatList(i) {
  var item = STAT_LISTS[i];
  if (!item) return;
  var wines = item.wines.slice().sort(function (a, b) {
    return String(b['마신날짜'] || '').localeCompare(String(a['마신날짜'] || ''));
  });
  document.getElementById('statListBody').innerHTML =
    '<h3>' + esc(item.title) + '</h3>' +
    '<div class="stat-list-sub">' + wines.length + '병 · 최근에 마신 순</div>' +
    wines.map(function (w) { return cardHtml(w); }).join('') +
    '<button class="more-toggle" onclick="cm(\'statListModal\')">닫기</button>';
  om('statListModal');
  document.querySelector('#statListModal .modal').scrollTop = 0;
}

/** 막대그래프 — 항목 수가 많은(품종) 데이터용 */
function statBarsHtml(label, entries, color) {
  var max = entries.reduce(function (m, e) { return Math.max(m, e[1].length); }, 1);
  return entries.map(function (e) {
    var ref = statListRef(label + ' · ' + e[0], e[1]);
    return '<div class="bar-row tap" onclick="openStatList(' + ref + ')"><div class="k">' + esc(e[0]) + '</div>' +
      '<div class="row2"><div class="bar-wrap"><div class="bar" style="--c:' + color + ';width:' + (e[1].length / max * 100) + '%"></div></div>' +
      '<div class="n">' + e[1].length + '</div><span class="chev">›</span></div></div>';
  }).join('');
}

/** "2025-03" → "25.3" (달력 눈금 라벨용, 짧게) */
function fmtMonthShort(ym) {
  var m = String(ym).match(/^(\d{4})-(\d{2})$/);
  return m ? m[1].slice(2) + '.' + parseInt(m[2], 10) : ym;
}

/**
 * 꺾은선(추세) 그래프 — 월별처럼 시간 순서를 따라 늘고 주는 흐름이 중요한 데이터용.
 * entries는 오래된 달 → 최근 달 순으로 와야 왼쪽에서 오른쪽으로 흘러가듯 읽힌다.
 * 달 수가 많아지면 그래프가 옆으로 길어지므로 감싸는 div가 가로 스크롤을 한다.
 */
function statTrendHtml(label, entries, color) {
  if (!entries.length) return '';
  var max = entries.reduce(function (m, e) { return Math.max(m, e[1].length); }, 1);
  var stepX = 48, padX = 24, padTop = 22, padBottom = 34, h = 130;
  var innerH = h - padTop - padBottom;
  var refs = entries.map(function (e) { return statListRef(label + ' · ' + e[0], e[1]); });
  var pts = entries.map(function (e, i) {
    return { x: padX + stepX * i, y: padTop + innerH - (e[1].length / max * innerH), count: e[1].length, key: e[0] };
  });
  var w = padX * 2 + stepX * Math.max(entries.length - 1, 0);
  var linePath = pts.length > 1
    ? pts.map(function (p, i) { return (i ? 'L' : 'M') + p.x.toFixed(1) + ',' + p.y.toFixed(1); }).join(' ')
    : '';
  var areaPath = linePath && (linePath +
    ' L' + pts[pts.length - 1].x.toFixed(1) + ',' + (h - padBottom) +
    ' L' + pts[0].x.toFixed(1) + ',' + (h - padBottom) + ' Z');
  var dots = pts.map(function (p, i) {
    return '<g class="trend-pt" onclick="openStatList(' + refs[i] + ')">' +
      '<circle cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="14" fill="transparent"/>' +
      '<circle class="trend-dot" cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="4" fill="' + color + '"/>' +
      '<text class="trend-count" x="' + p.x.toFixed(1) + '" y="' + (p.y - 10).toFixed(1) + '">' + p.count + '</text>' +
      '<text class="trend-label" x="' + p.x.toFixed(1) + '" y="' + (h - padBottom + 18) + '">' + esc(fmtMonthShort(p.key)) + '</text>' +
      '<title>' + esc(p.key) + ' · ' + p.count + '병</title></g>';
  }).join('');
  return '<div class="trend-scroll"><svg class="trend-svg" viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '" role="img" aria-label="' + esc(label) + ' 추세 그래프">' +
    (areaPath ? '<path class="trend-area" d="' + areaPath + '" fill="' + color + '" stroke="none"/>' : '') +
    (linePath ? '<path class="trend-line" d="' + linePath + '" fill="none" stroke="' + color + '"/>' : '') +
    dots + '</svg></div>';
}

/**
 * 원형(도넛)그래프 — 한 와인이 딱 한 칸에만 들어가서 조각을 다 더하면 전체가 되는
 * 데이터(종류, 가격대)용. 조각마다 circle 하나를 stroke-dasharray로 잘라 그려서
 * 조각 자체도 누를 수 있다. 조각이 작으면 누르기 어려우니 옆 범례도 똑같이 눌린다.
 */
function statPieHtml(label, entries, colorOf) {
  var total = entries.reduce(function (s, e) { return s + e[1].length; }, 0);
  var R = 15.9155; // 둘레가 100이 되는 반지름 → dasharray를 퍼센트로 바로 쓸 수 있다
  var gap = entries.length > 1 ? 0.6 : 0;
  var acc = 0;
  var refs = entries.map(function (e) { return statListRef(label + ' · ' + e[0], e[1]); });
  var slices = entries.map(function (e, i) {
    var pct = e[1].length / total * 100;
    var len = Math.max(pct - gap, 0.01);
    // 12시 방향부터 시계방향으로 쌓는다
    var html = '<circle class="pie-slice" r="' + R + '" cx="21" cy="21" fill="none" stroke="' + colorOf(e[0], i) + '"' +
      ' stroke-width="7.5" stroke-dasharray="' + len.toFixed(3) + ' ' + (100 - len).toFixed(3) + '"' +
      ' stroke-dashoffset="' + (25 - acc - gap / 2).toFixed(3) + '" onclick="openStatList(' + refs[i] + ')">' +
      '<title>' + esc(e[0]) + ' ' + e[1].length + '병</title></circle>';
    acc += pct;
    return html;
  }).join('');
  var legend = entries.map(function (e, i) {
    var pct = Math.round(e[1].length / total * 100);
    return '<div class="pie-leg tap" onclick="openStatList(' + refs[i] + ')">' +
      '<span class="sw" style="background:' + colorOf(e[0], i) + '"></span>' +
      '<span class="k">' + esc(e[0]) + '</span>' +
      '<span class="n">' + e[1].length + '<small>병 · ' + pct + '%</small></span><span class="chev">›</span></div>';
  }).join('');
  return '<div class="pie-box">' +
    '<svg class="pie" viewBox="0 0 42 42" role="img" aria-label="' + esc(label) + ' 원형그래프">' + slices +
    '<text x="21" y="21" class="pie-total">' + total + '</text>' +
    '<text x="21" y="26.5" class="pie-unit">병</text></svg>' +
    '<div class="pie-legend">' + legend + '</div></div>';
}

function sortedEntries(obj) {
  return Object.keys(obj).map(function (k) { return [k, obj[k]]; })
    .sort(function (a, b) { return b[1].length - a[1].length; });
}

// 가격대는 싼 것 → 비싼 것 순서라서, 색도 옅은 와인색 → 진한 와인색으로 한 계열로 칠한다
var PRICE_COLORS = { '3만원 미만':'#E3A3B0', '3~7만원':'#C45C73', '7~15만원':'#8C1D33', '15만원 이상':'#4E0F1D', '가격정보없음':'#C9BEB2' };

function renderStats() {
  var area = document.getElementById('statArea');
  var s = computeStats(ALL_WINES);
  if (!s.totalDrunk) {
    area.innerHTML = '<div class="empty"><span class="big">📊</span>마신 와인이 쌓이면<br>여기에 기록이 보여요</div>';
    return;
  }
  STAT_LISTS = [];
  var priceEntries = PRICE_BRACKETS.filter(function (k) { return s.byPrice[k]; })
    .map(function (k) { return [k, s.byPrice[k]]; });
  // 월별은 추세 그래프라서 오래된 달 → 최근 달 순으로, 왼쪽에서 오른쪽으로 흘러가듯 보여준다
  var monthEntries = Object.keys(s.byMonth).sort()
    .map(function (k) { return [k, s.byMonth[k]]; });
  area.innerHTML =
    '<div class="hero"><div class="n">' + s.totalDrunk + '</div><div class="l">지금까지 마신 와인</div></div>' +
    '<div class="stat-hint">숫자나 그래프를 누르면 해당 와인 목록을 볼 수 있어요</div>' +
    '<div class="sect">종류별</div>' + statPieHtml('종류별', sortedEntries(s.byType), function (k) { return typeStyle(k).c; }) +
    '<div class="sect">가격대별</div>' + statPieHtml('가격대별', priceEntries, function (k) { return PRICE_COLORS[k]; }) +
    '<div class="sect">월별</div>' + statTrendHtml('월별', monthEntries, 'var(--wine)') +
    '<div class="sect">품종별 <span class="sect-note">블렌드는 품종마다 한 번씩 세요</span></div>' +
    statBarsHtml('품종별', sortedEntries(s.byGrape), 'var(--wine)') +
    repeatHistoryHtml(computeRepeatHistory(ALL_WINES)) +
    '<div style="text-align:center;margin:26px 0 6px;font-size:12.5px;color:var(--sub)">' +
    '🍷 ' + esc(ME) + ' 셀러</div>';
}

renderTypeChips();
renderQuickFoods();
renderInstallHowto();
bootstrap();

// 안드로이드 크롬이 홈 화면 아이콘을 manifest.json대로 제대로 그리려면
// 서비스 워커가 등록돼 있어야 한다(없으면 기본 아이콘으로 대체됨).
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(function () { /* 등록 실패해도 앱 자체는 그대로 동작 */ });
}
