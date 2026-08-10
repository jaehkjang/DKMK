// ============================================================
// sw.js — 서비스 워커
// 안드로이드 크롬이 "설치 및 바로가기 만들기"를 진짜 PWA 설치로 인식하려면
// (그래서 manifest.json의 아이콘을 써서 홈 화면 아이콘을 그리려면) 서비스
// 워커가 등록되어 있어야 한다. 이게 없으면 크롬이 그냥 단순 북마크 바로가기로
// 취급해서 앱 아이콘 대신 기본 아이콘(페이지 파비콘 추정 아이콘)을 보여준다.
//
// 캐싱은 하지 않는다 — 이 앱은 자주 업데이트되는데 캐시를 쓰면 새 버전이
// 안 보이는 문제가 더 크다. 그냥 네트워크로 그대로 흘려보내기만 한다.
// ============================================================

self.addEventListener('install', function (e) {
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', function (e) {
  e.respondWith(fetch(e.request));
});
