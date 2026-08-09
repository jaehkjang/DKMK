// ============================================================
// app.js — 두뇌 방
// 로그인, 화면 전환, 렌더링, 서버 호출 결과 처리 등 모든 로직이 여기 있습니다.
// 서버와 주고받는 코드 자체는 api.js에만 있습니다.
// ============================================================

var ALL_WINES = [], SEG = '보유', PENDING_ROW = null, CURRENT_RATING = 5;
var PHOTO_DATAURL = null, PHOTO_UPLOADED_URL = null, PICKS = [], PICK_ON = {}, SELECTED_TYPE = '';
var TOKEN = '', ME = '', EDIT_ROW = null, DETAIL_ROW = null;
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
 * 음식 빠른 선택. 종류가 많은 카테고리는 하위 메뉴로 세분화한다.
 * children이 없으면 그 자체가 바로 선택되는 음식이고, 있으면 하위 칩을 펼친다.
 * 칩은 여러 개 골라도 되는 다중 선택이라(SELECTED_FOODS), 오늘 먹는 음식이 여럿이면
 * 다 같이 어울리는 와인을 찾아준다.
 */
var FOOD_MENU = [
  { label: '삼겹살' },
  { label: '스테이크' },
  { label: '회' },
  { label: '햄버거', children: ['치즈버거', '불고기버거', '베이컨버거', '더블패티버거'] },
  { label: '치킨', children: ['후라이드', '양념치킨', '간장치킨', '마늘치킨', '핫윙', '순살치킨'] },
  { label: '파스타', children: ['토마토파스타', '오일파스타', '버터베이스파스타', '크림파스타', '로제파스타', '봉골레파스타', '해산물파스타', '버섯파스타', '미트소스파스타'] },
  { label: '치즈', children: ['브리치즈', '까망베르', '체다치즈', '블루치즈', '고다치즈', '파르미지아노'] },
  { label: '중식', children: ['짜장면', '짬뽕', '탕수육', '마파두부', '깐풍기', '양장피'] },
  { label: '분식·야식', children: ['떡볶이', '순대', '튀김', '김밥', '오뎅', '라면'] },
  { label: '족발·보쌈', children: ['족발', '보쌈', '냉채족발', '매운족발'] },
  { label: '한식 찜·탕', children: ['갈비찜', '찜닭', '감자탕', '삼계탕', '육개장', '설렁탕'] },
  { label: '일식', children: ['초밥', '라멘', '우동', '돈카츠', '야키토리', '규동', '숙성회'] }
];
var OPEN_FOOD_CAT = null;
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
    TOKEN = res.token; ME = res.name;
    document.getElementById('pinScreen').style.display = 'none';
    if (res.moved) toast('기존 와인 ' + res.moved + '병을 가져왔어요');
    else if (res.created) toast(res.name + ' 셀러를 만들었어요 🍾');
    load();
  });
}

function openSettings() {
  document.getElementById('pwOld').value = '';
  document.getElementById('pwNew').value = '';
  document.getElementById('pwErr').textContent = '';
  loadGlasses();
  om('settingsModal');
}

/* ---------- 내 잔 관리 ---------- */
var MY_GLASSES = [];

function loadGlasses() {
  document.getElementById('glassChips').innerHTML = '<div class="loading" style="padding:8px 0">불러오는 중…</div>';
  callAPI(function () { return API.getGlasses(); }).then(function (list) {
    MY_GLASSES = (list && !list.error) ? list : [];
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
    loadGlasses();
  });
}

function removeGlass(rowIndex) {
  var g = MY_GLASSES.filter(function (x) { return x.rowIndex === rowIndex; })[0];
  if (!g || !confirm(g['이름'] + ' 잔을 삭제할까요?')) return;
  callAPI(function () { return API.deleteGlass(rowIndex); }).then(function (res) {
    if (!res || res.error) { toast('실패: ' + ((res && res.error) || '')); return; }
    loadGlasses();
  });
}

function submitChangePw(e) {
  e.preventDefault();
  var oldPw = document.getElementById('pwOld').value;
  var newPw = document.getElementById('pwNew').value;
  var err = document.getElementById('pwErr');
  err.textContent = '';
  if (!/^\d{4}$/.test(oldPw) || !/^\d{4}$/.test(newPw)) {
    err.textContent = '비밀번호는 4자리 숫자로 입력해주세요';
    return;
  }
  callAPI(function () { return API.changePassword(oldPw, newPw); }).then(function (res) {
    if (!res || res.error) { err.textContent = (res && res.error) || '문제가 생겼어요'; return; }
    document.getElementById('pwOld').value = '';
    document.getElementById('pwNew').value = '';
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

/** 주소에는 로그인 정보가 없으니(로그인은 localStorage에만 있음) 이 페이지 주소만 보낸다. */
function shareApp() {
  var url = location.origin + location.pathname;
  var howto = '📱 아이폰: 사파리로 열기 → 공유 버튼 → 홈 화면에 추가\n' +
    '🤖 안드로이드: 크롬으로 열기 → ⋮ 메뉴 → 홈 화면에 추가';
  var data = {
    title: '와인 딸까 말까',
    text: '우리집 와인 셀러 앱이에요 🍷\n홈 화면에 추가하면 앱처럼 쓸 수 있어요\n\n' + howto,
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
 * 저장된 토큰이 아직 유효한지 확인하고 앱을 연다. 확인이 끝나기 전엔
 * 로그인 입력창 대신 "불러오는 중…"만 보여준다 — 어차피 자동 로그인될
 * 화면에서 아이디/비번 입력창이 잠깐 번쩍이는 게 지저분해서.
 */
function bootstrap() {
  TOKEN = API.loadToken();
  if (!TOKEN) { showAuthForm(); return; }
  callAPI(function () { return API.checkToken(); }).then(function (res) {
    if (res && res.ok) {
      ME = res.name;
      document.getElementById('pinScreen').style.display = 'none';
      load();
    } else {
      API.setToken(''); TOKEN = '';
      document.getElementById('pinErr').textContent = '다시 들어와주세요';
      showAuthForm();
    }
  });
}

function showAuthForm() {
  document.getElementById('authLoading').style.display = 'none';
  document.getElementById('authForm').style.display = '';
}

/* ---------- 화면 전환 ---------- */
var TITLES = { Cellar:'셀러', Food:'페어링 추천', Add:'와인 추가', Stat:'기록' };
function showPage(p) {
  ['Cellar', 'Food', 'Add', 'Stat'].forEach(function (n) {
    document.getElementById('pg' + n).classList.toggle('on', n === p);
  });
  document.querySelectorAll('#tabbar div').forEach(function (t) { t.classList.toggle('on', t.dataset.p === p); });
  document.getElementById('pgTitle').textContent = TITLES[p];
  document.getElementById('pgCount').textContent = '';
  // 이미 한 번 불러온 목록이 있으면 탭을 다시 눌러도 서버를 다시 안 부르고
  // 캐시로 즉시 그린다 — 매번 왕복하느라 느려지는 걸 막는다. 실제로 데이터가
  // 바뀌는 동작(추가/수정/삭제/마시기 등)은 각자 끝나고 load()를 다시 부른다.
  if (p === 'Cellar') { if (WINES_LOADED) renderList(); else load(); }
  if (p === 'Stat') loadStats();
  if (p === 'Food') renderCellarPairingChips();
  window.scrollTo(0, 0);
}

function load() {
  callAPI(function () { return API.getWines(); }).then(function (d) {
    if (!d || d.error) {
      document.getElementById('listArea').innerHTML = '<div class="empty"><span class="big">😵</span>불러오지 못했어요<br>' + esc(d && d.error) + '</div>';
      return;
    }
    ALL_WINES = d.wines; WINES_LOADED = true; renderList();
  });
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
  DETAIL_ROW = r;
  // 아래 중 하나라도 비어 있으면 AI로 한 번에 보충한다. 응답이 와도 결과만 반영하고
  // (품종/생산지처럼 AI도 끝내 못 알아낼 수 있는 필드가 있으니) 다시 조회하지 않는다 —
  // 그렇지 않으면 계속 비어 있는 채로 매번 재호출되는 무한 루프가 될 수 있다.
  var needSuggest = !w['서빙온도'] || !w['완벽한잔'] || !w['추천 페어링'] || !w['품종'] || !w['생산지/국가'];
  var photo = w['라벨사진'] ? '<img src="' + esc(w['라벨사진']) + '" style="width:100%;border-radius:14px;margin:14px 0 4px;">' : '';
  var t = typeStyle(w['종류']);
  document.getElementById('detailBody').innerHTML =
    '<h3>' + esc(w['와인명']) + '</h3>' +
    '<div class="line" style="margin-top:8px"><span class="tag" style="--c:' + t.c + ';--c-soft:' + t.s + '">' + esc(t.n) + '</span></div>' +
    photo +
    '<div class="facts" id="detailFacts">' + detailFactsHtml(w) + '</div>' +
    '<div id="servingBox">' + (servingFactsHtml(w) || (needSuggest ? '<div class="note" id="servingSuggest" style="margin-top:12px">🍷 부족한 정보 AI로 채우는 중…</div>' : '')) + '</div>' +
    '<div class="act-row" style="margin-top:14px">' +
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
        '내잔추천', '내잔추천별점', '추천 페어링', '추천페어링별점'].forEach(function (k) {
        if (res[k]) w[k] = res[k];
      });
      var factsEl = document.getElementById('detailFacts');
      if (factsEl) factsEl.innerHTML = detailFactsHtml(w);
      var servingEl = document.getElementById('servingBox');
      if (servingEl) servingEl.innerHTML = servingFactsHtml(w);
    });
  }
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
 * 추천 페어링을 각각 따로 보여준다. 잔 두 종류와 추천 페어링에는 5점 만점
 * 별점이 함께 붙는다(완벽할 때만 5개).
 */
function servingFactsHtml(w) {
  var rows = [];
  if (w['서빙온도']) rows.push(['🌡️ 서빙 온도', w['서빙온도']]);
  if (w['에어링시간']) rows.push(['⏱ 에어링 시간', w['에어링시간']]);
  if (w['완벽한잔']) rows.push(['🥂 완벽한 잔', w['완벽한잔'] + ' ' + starsHtml(w['완벽한잔별점'])]);
  if (w['내잔추천']) rows.push(['🍷 내 잔 추천', w['내잔추천'] + ' ' + starsHtml(w['내잔추천별점'])]);
  if (w['추천 페어링']) rows.push(['🍽 추천 음식', w['추천 페어링'] + (w['추천페어링별점'] ? ' ' + starsHtml(w['추천페어링별점']) : '')]);
  if (!rows.length) return '';
  return '<div class="facts" style="margin-top:0">' + rows.map(function (f) {
    return '<div class="fact"><div class="k">' + f[0] + '</div><div class="v">' + esc(f[1]) + '</div></div>';
  }).join('') + '</div>';
}

/** 실수로 등록한 와인 삭제 (되돌리기 불가라 한 번 더 확인) */
function deleteWineConfirm(r) {
  var w = findWine(r); if (!w) return;
  if (!confirm((w['와인명'] || '이 와인') + '을(를) 삭제할까요? 되돌릴 수 없어요.')) return;
  callAPI(function () { return API.deleteWine(r); }).then(function (res) {
    if (!res || res.error) { toast('실패: ' + ((res && res.error) || '')); return; }
    cm('detailModal');
    toast('삭제했어요');
    load();
  });
}

/** 잘못 입력된 정보를 고치러 "추가" 화면으로 이동 (같은 폼을 재사용) */
function startEdit(r) {
  var w = findWine(r); if (!w) return;
  EDIT_ROW = r;
  cm('detailModal');

  var fields = ['와인명', '품종', '빈티지', '생산지/국가', '평균가격(국내·원)', '평균가격(글로벌·USD)', '추천 페어링', '어울리는잔', '서빙방법', '와인배경', '메모'];
  fields.forEach(function (f) {
    var el = document.getElementById('f_' + f);
    if (el) el.value = w[f] || '';
  });
  SELECTED_TYPE = typeStyle(w['종류']).n;
  document.querySelectorAll('#typeChips button').forEach(function (x) { x.classList.toggle('on', x.dataset.t === SELECTED_TYPE); });

  document.getElementById('moreFields').classList.add('on');
  document.getElementById('moreLabel').textContent = '− 접기';
  document.getElementById('similarHint').innerHTML = '';
  PHOTO_DATAURL = null; PHOTO_UPLOADED_URL = null;
  document.getElementById('photoPreview').innerHTML = w['라벨사진'] ? '<img src="' + esc(w['라벨사진']) + '">' : '';
  document.getElementById('photoNote').innerHTML = '<div class="note">사진을 새로 찍으면 라벨 사진이 교체돼요. 그대로 두면 기존 사진이 유지돼요</div>';
  document.getElementById('addForm').style.display = '';
  document.getElementById('pickArea').style.display = 'none';
  document.getElementById('addBtn').textContent = '수정하기';

  showPage('Add');
  document.getElementById('pgTitle').textContent = '와인 수정';
}

/** 탭에서 "추가"를 직접 눌렀을 때 — 혹시 수정 모드가 남아있으면 새 등록으로 초기화 */
function goAddFresh() {
  if (EDIT_ROW !== null) resetAddForm();
  showPage('Add');
}

function resetAddForm() {
  EDIT_ROW = null;
  document.querySelectorAll('#addForm input, #addForm textarea').forEach(function (el) { el.value = ''; });
  document.querySelectorAll('#typeChips button').forEach(function (x) { x.classList.remove('on'); });
  SELECTED_TYPE = ''; PHOTO_DATAURL = null; PHOTO_UPLOADED_URL = null;
  document.getElementById('similarHint').innerHTML = '';
  document.getElementById('photoPreview').innerHTML = '';
  document.getElementById('photoNote').innerHTML = '';
  document.getElementById('addBtn').textContent = '셀러에 넣기';
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
function renderRepurchaseChips() {
  var el = document.getElementById('repurchaseChips');
  el.innerHTML = REPURCHASE_OPTIONS.map(function (o) {
    return '<button type="button" class="' + (CURRENT_REPURCHASE === o ? 'on' : '') + '" style="--c:var(--wine);--c-soft:var(--wine-soft)">' + esc(o) + '</button>';
  }).join('');
  el.querySelectorAll('button').forEach(function (b, i) {
    b.onclick = function () {
      CURRENT_REPURCHASE = (CURRENT_REPURCHASE === REPURCHASE_OPTIONS[i]) ? '' : REPURCHASE_OPTIONS[i];
      renderRepurchaseChips();
    };
  });
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
 * 음식 칩은 여러 개 골라도 되는 다중 선택이다. 고를 때마다 선택된 것들을
 * "·"로 이어 입력창에 채우고 바로 검색한다. 다시 누르면 선택 해제.
 */
function toggleFoodSelection(label) {
  var i = SELECTED_FOODS.indexOf(label);
  if (i === -1) SELECTED_FOODS.push(label); else SELECTED_FOODS.splice(i, 1);
  document.getElementById('foodInput').value = SELECTED_FOODS.join('·');
  renderQuickFoods();
  renderCellarPairingChips();
  if (SELECTED_FOODS.length) doRecommend();
  else document.getElementById('foodArea').innerHTML = '';
}

function renderQuickFoods() {
  var el = document.getElementById('foodQuick');
  el.innerHTML = FOOD_MENU.map(function (item) {
    var hasKids = item.children && item.children.length;
    var isOpen = OPEN_FOOD_CAT === item.label;
    var isSelected = !hasKids && SELECTED_FOODS.indexOf(item.label) !== -1;
    var arrow = hasKids ? (isOpen ? ' ▲' : ' ▼') : '';
    return '<button type="button" class="' + (isOpen || isSelected ? 'on' : '') + '" data-cat="' + esc(item.label) + '" style="--c:var(--wine);--c-soft:var(--wine-soft)">' + esc(item.label) + arrow + '</button>';
  }).join('');
  el.querySelectorAll('button').forEach(function (b) {
    var item = FOOD_MENU.filter(function (f) { return f.label === b.dataset.cat; })[0];
    b.onclick = function () {
      if (item.children && item.children.length) {
        OPEN_FOOD_CAT = (OPEN_FOOD_CAT === item.label) ? null : item.label;
        renderQuickFoods();
      } else {
        toggleFoodSelection(item.label);
      }
    };
  });

  var sub = document.getElementById('foodSub');
  var open = FOOD_MENU.filter(function (f) { return f.label === OPEN_FOOD_CAT; })[0];
  if (!open) { sub.innerHTML = ''; return; }
  sub.innerHTML = open.children.map(function (c) {
    var isSelected = SELECTED_FOODS.indexOf(c) !== -1;
    return '<button type="button" class="' + (isSelected ? 'on' : '') + '" style="--c:var(--wine);--c-soft:var(--wine-soft)">' + esc(c) + '</button>';
  }).join('');
  sub.querySelectorAll('button').forEach(function (b) {
    b.onclick = function () { toggleFoodSelection(b.textContent); };
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
    var text = String(w['추천 페어링'] || '').replace(/베스트\s*:/g, '').replace(/한국\s*:/g, '');
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
function toggleMore() {
  var m = document.getElementById('moreFields');
  m.classList.toggle('on');
  document.getElementById('moreLabel').textContent = m.classList.contains('on') ? '− 접기' : '＋ 자세히 입력';
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
    cancelPick(); goCellarOwned();
  });
}

/* ---------- 중복 힌트 ---------- */
var simTimer = null;
function checkSimilar() {
  clearTimeout(simTimer);
  var kw = document.getElementById('f_품종').value || SELECTED_TYPE;
  simTimer = setTimeout(function () {
    var box = document.getElementById('similarHint');
    if (!kw || kw.trim().length < 2) { box.innerHTML = ''; return; }
    callAPI(function () { return API.getDrunkMatches(kw); }).then(function (ms) {
      box.innerHTML = (ms && ms.length && !ms.error)
        ? '<div class="note">💡 비슷한 걸 ' + ms.length + '번 마셔봤어요: ' + ms.map(function (m) { return esc(m['와인명']); }).join(', ') + '</div>'
        : '';
    });
  }, 400);
}

/* ---------- 추가 / 수정 저장 ---------- */
function submitAdd(e) {
  e.preventDefault();
  var fields = ['와인명', '품종', '빈티지', '생산지/국가', '평균가격(국내·원)', '평균가격(글로벌·USD)', '추천 페어링', '어울리는잔', '서빙방법', '와인배경', '메모'];
  var data = { '종류': SELECTED_TYPE };
  fields.forEach(function (f) {
    var el = document.getElementById('f_' + f);
    if (el) data[f] = el.value;
  });
  if (!data['와인명']) { toast('와인 이름을 적어주세요'); return; }

  var editing = EDIT_ROW !== null;
  // 인식할 때 사진을 이미 올려뒀으면(PHOTO_UPLOADED_URL) 그 주소를 그대로 쓰고,
  // 아니면(직접입력·인식 실패 등) 원본 데이터를 지금 올린다.
  var photo = PHOTO_UPLOADED_URL || PHOTO_DATAURL;
  var btn = document.getElementById('addBtn');
  btn.disabled = true; btn.textContent = editing ? '수정하는 중…' : '담는 중…';
  callAPI(function () {
    return editing ? API.updateWine(EDIT_ROW, data, photo) : API.addWine(data, photo);
  }).then(function (res) {
    if (!res || res.error) {
      toast('실패: ' + ((res && res.error) || ''));
      btn.disabled = false; btn.textContent = editing ? '수정하기' : '셀러에 넣기';
      return;
    }
    toast(editing ? '수정했어요' : '셀러에 담았어요 🍾');
    resetAddForm();
    btn.disabled = false;
    goCellarOwned();
  });
}

/* ---------- 추천 ---------- */
function doRecommend() {
  var food = document.getElementById('foodInput').value.trim();
  if (!food) { toast('뭘 드실지 적어주세요'); return; }
  // 입력창을 손으로 고쳤으면(칩으로 고른 것과 달라졌으면) 칩 선택 표시를 지운다
  if (food !== SELECTED_FOODS.join('·')) {
    SELECTED_FOODS = [];
    renderQuickFoods();
    renderCellarPairingChips();
  }
  runRecommend(food);
}

/** 안주 없이 그냥 오늘 마시기 좋은 와인 추천 */
function doRecommendNoFood() {
  document.getElementById('foodInput').value = '';
  SELECTED_FOODS = [];
  renderQuickFoods();
  renderCellarPairingChips();
  runRecommend('');
}

function runRecommend(food) {
  var area = document.getElementById('foodArea');
  area.innerHTML = '<div class="loading">🍷 고르는 중…</div>';
  callAPI(function () { return API.recommendByFood(food); }).then(function (list) {
    if (!list || list.error) {
      area.innerHTML = '<div class="empty"><span class="big">😵</span>' + esc(list && list.error) + '</div>';
      return;
    }
    if (!list.length) {
      area.innerHTML = '<div class="empty"><span class="big">🤔</span>지금 셀러에서<br>딱 맞는 걸 찾지 못했어요</div>';
      return;
    }
    area.innerHTML = list.map(function (x) {
      var w = x.wine || x;
      var badge = x.matched ? '<div class="match-badge">🍷 이 와인 페어링 정보에 있어요</div>' : '';
      var stars = x['별점'] ? '<span class="stars">' + starsHtml(x['별점']) + '</span> ' : '';
      var reason = (stars || x.reason) ? '<div class="reason">' + stars + esc(x.reason || '') + '</div>' : '';
      return cardHtml(w, badge + reason);
    }).join('');
  });
}

/* ---------- 기록 ---------- */
/**
 * 기록(통계)은 getWines가 이미 내려준 것과 같은 데이터로 계산할 수 있어서
 * (서버 getStats도 내부적으로 getWines부터 다시 부른다) 캐시가 있으면
 * 서버를 또 부르지 않고 그 자리에서 바로 계산한다.
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

/** "품종" 필드에서 개별 품종 이름만 뽑아낸다(블렌드는 각 품종에 1씩). Code.gs parseGrapes_와 동일 로직. */
function parseGrapesClient(raw) {
  return String(raw || '')
    .split(/[·,、]/)
    .map(function (s) { return s.replace(/\d+(\.\d+)?\s*%/g, '').replace(/[()]/g, '').trim(); })
    .filter(Boolean);
}

function computeStats(wines) {
  var drunk = wines.filter(function (w) { return w['상태'] === '마심'; });
  var byMonth = {}, byType = {}, byGrape = {}, byPrice = {};
  drunk.forEach(function (w) {
    var month = (w['마신날짜'] || '').slice(0, 7);
    if (month) byMonth[month] = (byMonth[month] || 0) + 1;

    var type = w['종류'] || '기타';
    byType[type] = (byType[type] || 0) + 1;

    var grapes = parseGrapesClient(w['품종']);
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

function renderStats() {
  var area = document.getElementById('statArea');
  var s = computeStats(ALL_WINES);
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
    '🍷 ' + esc(ME) + ' 셀러</div>';
}

renderTypeChips();
renderQuickFoods();
bootstrap();
