// ============================================================
// app.js — 두뇌 방
// 로그인, 화면 전환, 렌더링, 서버 호출 결과 처리 등 모든 로직이 여기 있습니다.
// 서버와 주고받는 코드 자체는 api.js에만 있습니다.
// ============================================================

var ALL_WINES = [], SEG = '보유', PENDING_ROW = null, CURRENT_RATING = 5;
var PHOTO_DATAURL = null, PICKS = [], PICK_ON = {}, SELECTED_TYPE = '';
var TOKEN = '', ME = '', EDIT_ROW = null;

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
  { label: '치킨', children: ['후라이드', '양념치킨', '간장치킨', '마늘치킨', '핫윙', '순살치킨'] },
  { label: '파스타', children: ['토마토파스타', '크림파스타', '오일파스타', '로제파스타', '봉골레파스타', '미트소스파스타'] },
  { label: '치즈', children: ['브리치즈', '까망베르', '체다치즈', '블루치즈', '고다치즈', '파르미지아노'] },
  { label: '중식', children: ['짜장면', '짬뽕', '탕수육', '마파두부', '깐풍기', '양장피'] },
  { label: '분식·야식', children: ['떡볶이', '순대', '튀김', '김밥', '오뎅', '라면'] },
  { label: '족발·보쌈', children: ['족발', '보쌈', '냉채족발', '매운족발'] },
  { label: '한식 찜·탕', children: ['갈비찜', '찜닭', '감자탕', '삼계탕', '육개장', '설렁탕'] },
  { label: '일식', children: ['초밥', '라멘', '우동', '돈카츠', '야키토리', '규동'] }
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
  om('settingsModal');
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

/** 저장된 토큰이 아직 유효한지 확인하고 앱을 연다 */
function bootstrap() {
  TOKEN = API.loadToken();
  if (!TOKEN) return;
  callAPI(function () { return API.checkToken(); }).then(function (res) {
    if (res && res.ok) {
      ME = res.name;
      document.getElementById('pinScreen').style.display = 'none';
      load();
    } else {
      API.setToken(''); TOKEN = '';
      document.getElementById('pinErr').textContent = '다시 들어와주세요';
    }
  });
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
  if (p === 'Cellar') { load(); }
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
    ALL_WINES = d.wines; renderList();
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
    '<div class="act-row" style="margin-top:14px">' +
    '<button class="act" onclick="startEdit(' + r + ')"><span class="ic">✏️</span>수정</button>' +
    '<button class="act" onclick="deleteWineConfirm(' + r + ')"><span class="ic">🗑</span>삭제</button>' +
    '</div>' +
    '<button class="more-toggle" onclick="cm(\'detailModal\')">닫기</button>';
  om('detailModal');
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
  PHOTO_DATAURL = null;
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
  SELECTED_TYPE = ''; PHOTO_DATAURL = null;
  document.getElementById('similarHint').innerHTML = '';
  document.getElementById('photoPreview').innerHTML = '';
  document.getElementById('photoNote').innerHTML = '';
  document.getElementById('addBtn').textContent = '셀러에 넣기';
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
  var info = {
    '평점': CURRENT_RATING,
    '한줄평': document.getElementById('drinkComment').value,
    '함께한음식': document.getElementById('drinkFood').value
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
  callAPI(function () { return API.recognizeLabel(PHOTO_DATAURL); }).then(function (g) {
    if (!g || g.error) {
      note.innerHTML = '<div class="note warn">읽지 못했어요. 직접 입력해주세요<br><small>' + esc(g && g.error) + '</small></div>';
      return;
    }
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
  var btn = document.getElementById('addBtn');
  btn.disabled = true; btn.textContent = editing ? '수정하는 중…' : '담는 중…';
  callAPI(function () {
    return editing ? API.updateWine(EDIT_ROW, data, PHOTO_DATAURL) : API.addWine(data, PHOTO_DATAURL);
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
      var reason = x.reason ? '<div class="reason">' + esc(x.reason) + '</div>' : '';
      return cardHtml(w, badge + reason);
    }).join('');
  });
}

/* ---------- 기록 ---------- */
function loadStats() {
  var area = document.getElementById('statArea');
  area.innerHTML = '<div class="loading">불러오는 중…</div>';
  callAPI(function () { return API.getStats(); }).then(function (s) {
    if (!s || s.error) {
      area.innerHTML = '<div class="empty"><span class="big">😵</span>' + esc(s && s.error) + '</div>';
      return;
    }
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
  });
}

renderTypeChips();
renderQuickFoods();
bootstrap();
