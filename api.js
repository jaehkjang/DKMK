// ============================================================
// api.js — 통신 방
// 서버(Apps Script)와 주고받는 모든 코드가 여기에만 있습니다.
// 화면/상태 코드는 app.js, 모양은 style.css.
//
// 패턴은 온그린(jaehkjang/ongreen) api.js와 동일합니다.
//  - GET: 쿼리스트링으로 보내는 단순 요청이라 브라우저가 프리플라이트(OPTIONS)를 안 붙인다.
//  - POST: Content-Type을 text/plain으로 보내야 "단순 요청"으로 취급돼 프리플라이트가 안 붙는다.
//    (application/json으로 보내면 Apps Script가 OPTIONS 프리플라이트에 응답을 못 해서 막힌다.)
//    서버는 본문을 text로 받아 JSON.parse 해서 쓴다.
// ============================================================

const API = {
  // ▼▼▼ Apps Script를 웹 앱으로 배포한 뒤 나오는 실행 URL을 여기에 붙여넣으세요 ▼▼▼
  URL: 'https://script.google.com/macros/s/AKfycbx_zKyPeA714VYu1m-i1XBYRAO23xWn_V5AH6BkyLfAnLxW8Y5Taoe_XuQDkGhXIObl/exec',

  // 로그인 후 받은 토큰만 보관 — 비밀번호는 저장하지 않음.
  // GitHub Pages는 주소가 고정이라(Apps Script HtmlService의 iframe과 달리) localStorage가 정상적으로 남는다.
  token: '',
  loadToken() {
    try { this.token = localStorage.getItem('dkmk_token') || ''; } catch (e) { this.token = ''; }
    return this.token;
  },
  setToken(t) {
    this.token = t || '';
    try {
      if (this.token) localStorage.setItem('dkmk_token', this.token);
      else localStorage.removeItem('dkmk_token');
    } catch (e) { /* 저장소를 못 쓰는 환경이면 이번 세션 동안만 로그인 유지 */ }
  },

  async _get(action, extra) {
    const p = new URLSearchParams(Object.assign({ action, token: this.token, _: String(Date.now()) }, extra || {}));
    const res = await fetch(this.URL + '?' + p.toString(), { method: 'GET', mode: 'cors', cache: 'no-store' });
    return res.json();
  },
  async _post(action, data) {
    const res = await fetch(this.URL, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(Object.assign({ action, token: this.token }, data || {})),
    });
    return res.json();
  },

  // ── 셀러(계정) ──
  enter(name, pw)          { return this._post('enter', { name, pw }); },
  checkToken()             { return this._get('checkToken'); },
  changePassword(newPw)    { return this._post('changePassword', { newPw }); },

  // ── 목록 ──
  getWines()               { return this._get('getWines'); },
  addWine(data, photo)     { return this._post('addWine', { data, photo }); },
  addWines(list)           { return this._post('addWines', { list }); },
  updateWine(row, data, photo) { return this._post('updateWine', { row, data, photo }); },
  deleteWine(row)          { return this._post('deleteWine', { row }); },
  markDrunk(row, info)     { return this._post('markDrunk', { row, info }); },
  unmarkDrunk(row)         { return this._post('unmarkDrunk', { row }); },

  // ── 사진 인식 ──
  recognizeLabel(photo)    { return this._post('recognizeLabel', { photo }); },
  recognizeCellar(photo)   { return this._post('recognizeCellar', { photo }); },

  // ── 추천 / 통계 ──
  recommendByFood(food)    { return this._get('recommendByFood', { food }); },
  getAdminOverview()       { return this._get('getAdminOverview'); },
  deleteUserAccount(id)    { return this._post('deleteUserAccount', { id }); },

  // ── 내 잔 ──
  getGlasses()              { return this._get('getGlasses'); },
  addGlass(name)            { return this._post('addGlass', { name }); },
  deleteGlass(row)          { return this._post('deleteGlass', { row }); },
  suggestWineInfo(row)      { return this._post('suggestWineInfo', { row }); },
};

// 네트워크 자체가 끊긴 경우를 잡아주는 안전 래퍼. 서버가 돌려준 {error} 는 그대로 통과시킨다.
async function callAPI(promiseFactory) {
  try {
    const res = await promiseFactory();
    return res;
  } catch (e) {
    return { error: '인터넷 연결을 확인해주세요' };
  }
}
