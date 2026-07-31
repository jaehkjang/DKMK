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
 * 2) 이 파일의 setup 함수를 에디터에서 한 번 실행
 *    (시트에 새 컬럼 추가 + 홈 화면 아이콘을 드라이브에 올려 등록)
 * 3) 배포 → 웹 앱. 코드를 고친 뒤에는 [배포 관리] → 연필(수정) → 버전: 새 버전 → 배포
 *    (이렇게 해야 주소가 그대로 유지됩니다. [새 배포]를 누르면 주소가 바뀝니다)
 */

var NEW_COLUMNS = ['어울리는잔', '서빙방법', '와인배경', '평점', '한줄평', '함께한음식', '라벨사진'];
var PHOTO_FOLDER_NAME = '와인라벨사진';
var APP_TITLE = '와인 딸까 말까';
var ICON_FILE_NAME = '와인앱아이콘.png';
/* 홈 화면 아이콘(512px 와인잔). setupIcon이 드라이브에 올려 공개 주소로 만든다. */
var ICON_PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAgAAAAIACAIAAAB7GkOtAAAQAElEQVR4nOzdebTedZ3Y8e+z3P0mN/dmIztJIMiSQAiLhMRBsCK0dupx5szUGdvR1jqnjoM67Zx6Rm2rU0fnUHHcOKXikdM5DGoBFwgVQcIe4oQYEkI2yEr25d6s997cpb8kTEju80RkCUl+n9fr5A/v5z/5fZ/n/due369887gZCYB4ygmAkAQAICgBAAhKAACCEgCAoAQAICgBAAhKAACCEgCAoAQAICgBAAhKAACCEgCAoAQAICgBAAhKAACCEgCAoAQAICgBAAhKAACCEgCAoAQAICgBAAhKAACCEgCAoAQAICgBAAhKAACCEgCAoAQAICgBAAhKAACCEgCAoAQAICgBAAhKAACCEgCAoAQAICgBAAhKAACCEgCAoAQAICgBAAhKAACCEgCAoAQAICgBAAhKAACCEgCAoAQAICgBAAhKAACCEgCAoAQAICgBAAhKAACCEgCAoAQAICgBAAhKAACCEgCAoAQAICgBAAhKAACCEgCAoAQAICgBAAhKAACCEgCAoAQAICgBAAhKAACCEgCAoAQAICgBAAhKAACCEgCAoAQAICgBAAhKAACCEgCAoAQAICgBAAhKAACCEgCAoAQAICgByK2zf+eqD/6fbyZ4c+7+4z9b89i8RB4JAEBQAgAQlAAABCUAAEEJAEBQAgAQlAAABCUAAEEJAEBQAgAQlAAABCUAAEEJAEBQAgAQlAAABCUAAEEJAEBQAgAQlAAABCUAAEEJAEBQAgAQlAAABCUAAEEJAEBQAgAQlAAABCUAAEEJAEBQAgAQlAAABCUAAEEJAEBQAgAQlAAABCUAAEEJAEBQAgAQlAAABCUAAEEJAEBQAgAQlAAABCUAAEEJAEBQAgAQlAAABCUAAEEJAEBQAgAQlADE0tfZ3T73mQTVDLnmymJ9bSIMAQimt/fglh0JqurrTUQiAABBCQBAUAIAEJQAAAQlAABBCQBAUAIAEJQAAAQlAABBCQBAUAIAEJQAAAQlAABBCUAwhUKCE7I8YhGA3Ort6q4yLfqEc0KFUrFy2Nt9MJFTAhBLoVhMcCLVlkdPV1cipwQgt6p+bqvu4sERVZdHT9VDSXJBAHKr+ufWEQC/QbXl0SsA+SUAuVX9c+siMCdSKlUdOwWUY/YHc6tz956q80Kdt35TRbGupurcKaAcE4Dc6tq9p+q+W1EAqKbqwujtPtjZ3pHIKQHIrewUUPfuvZVzAaCqqgujq2N338GeRE4JQJ5VPQskAFRV9dzgiU4kkg8CkGf7t+2oHBbrBYAqivV1lcOuageR5IYA5FnH+k2Vw2JTY4IKpeYqC2PnqjWJ/HIbaJ7t3rCxclgeJABUUR7UVDmsuoTIDQHIs45qn95Sc1OCClWPADoEINcEIM92VzsFVPVzDqWqRwDVlhC54RpAnrWv3VA5LDY1JE8E4niFutpCbZUfgjkCyDdfBHm2Z9OWqndxlIcMTnCMmtYqS2L/th27NzgCyDMByLmdL66pHFb9tBNZua2lclh18ZAnApBzW59fXjksCwDHq7okdrgHNO9cBM65bUtXVA7LrS0JjlFTbUlUXTzkiQDk3MZnF1cOa4a1JjiqUKh6Cqjq4iFPnALKuW0vrOzp7BwwLNSUSy3NCQ6rGd5a+aKIA7vas8WTyDUByLv+/s2/fr5yXDt8aILDaqothi3PvZAtnkSuCUD+rX96QeWwZkRbgsNqqy2GTc7/BOAaQP5tXPBc5bBmuADwiqp7A1X3G8gZRwD5t37egsr3A5eHDPJcaNIrK2Hgg6CzBbPx2ecSeScA+dfbfXDTwiqH87WjRyTCqx09snKYLZhs2STyTgBCWD336cphnQCQLYMxVZZB1QVD/ghACKvnPlU5rB0zMhFcsVh71rDKcdUFQ/4IQAjblq44sLN9wDA78+upcMEd+vYvDvwS2LNpi98AByEAUbxw7wOVw/qzRycCq59QZQGsnPPLRAwCEMWyn/68clg/cWwirEK2BzCmclx1qZBLAhDFpoVL9m3dPmBYGtxcahmUCKl21IjKl8C0r1mfLZVEDAIQyPKf/aJy2DBxTCKkqrv/K+Y8nAhDAAJZ8qOfVQ7rJ49PBFQsVr0CtOynDybCEIBAti1dUXl3R6m50XOBAsou/xZqBp7/qbpCyDEBiKXqQUDDORMSwTScW2WjL/r7uxORCEAsL9z7wMH9BwYMD90LVLISAik21NWOGj5gmC2M5+++PxGJj30sB3a2r7h/4FW+QrnU4H7QSBrPm1Q5zBZGz4HORCQCEM6v7/hh5Ys+Gs+fnAiiWGg8vyIA/f0L7/hBIhgBCGfzc0vXPDZvwLDc1lL1mTDkT8Pk8ZW3/2dL4tArwAhGACJa8N07K4eNF56TCKDponMrh/O//f1EPAIQ0ZpHn67c3asbe5Y3xefeoa08eOBW3rRwyfp53v8VkQAENe8bt1cOm6dOSeRa07Qqm9juf1gCENSqB+duXbJswLB+0rhiU0Mip2pHDa98F/S2pSuyxZAISQDievrr3x04KhSaL35HIqeap59fOXzqa7clohKAuKoeBDScM77YUJfIndqzhtn9ZwABCO2xv/nmwFF2EHDphYncaZ5RZbPO/dIticAEILS1jz+zvOLpj9lBQLmtJZEj9RPH1gxrHTDMNv26J3+VCEwAonv0y9/o7eoeMBz8zosTuVEsDrr8ogGzbKM/+j/+LhGbAES3Z+PmBbcP/F1YdrK4bvyoRC40TT232FA/YDj/O9/fs2lLIjYBID31tf+188U1A4aDr5iW7TkmznDFxvrKn3fsWr1u3re+lwjPJ5zU233woc/+zYBhsamh+eLzEme4lqsvTaXSgOGD//lLfQd7EuEJAIesn7fg+R/dN2DYdNGUUnNj4oyVncerHT1iwDDb0BvmL0wgABw190u3HNjVftyoWBic7T9yhioVB185bcAs28Ru/eQoAeAVne0dv/gvXx4wrD1rWNV3B3L6G3TZ1GLjwAd7PPiXf51t6ASHCQCvWvnALyvfCjvoimkeEHTGyc78NL5j4oBhtnFX/Xxugn8iABwnOz+wffmqYyeFcmnIuy5PnDkKtTUtsy8bMNyx/MW5X3Tyh+MIAMfpOdA5588/P+DdsDUj2pqmnps4Q7TMnF6srz12km3Qn33isz2dXvnLcQSAgba9sPKhz31lwLB5+gWeD3FGaJhydt2E0QOG2QbdseKlBMcTAKp4/kf3DbwrtFAY8u4rC+Vy4jRWahl06Bd8x6uyNeEwAaC6h/7qKztWrj52UmpubJk9I3HaKpVar3tnKh33od6yeFm2KRNUIwBUl50v/vFHPz3glwF140c1nDcxcVpqmXlJaVDTsZOu3Xt/8rH/5NQ/JyIAnFD72g33fuTTA74+Bl85LbsmnDjNNF54bv2kccdOsg1394f/bM/GzQlOQAD4TTY9u3jOTV/o7+t7dVQotF53lUdEnFZqRw0fdNlx73vJNtn9n/zcpoVLEpxY6b0toxOc2M5Vq3u7D06YdcXRSaFUqhs78sCqtamvP3GqlVqa266fXTj+0a1zv/g1F355TQLAa3v5V78u19WOufySo5NiXW3NiKGdq9cnCTilio0NQ298V7Y5jh0+fctt879zR4LXIgD8VtY9Mb9uUPPoS6cenWRngWqGDulcsyFxihQb6tpufFfp+Ad1ZN/+T91yW4LfggDw21rz6NMDGlAe3Jz961q7MfG2K9TWZPv+A277mf+d7z95860JfjsCwOuQNaCmvu7Yc0Hl1sHZHmjXereavK0KNeW2980uDxl87HDBd+98zGt+eT0EgNdn7RPzCymNu+rVX4RlJ4KK9bXdL3vB7Nvk0Lf/9bPKQ4ccO8zO/Dz+1W8leD0EgNdt/bwF/T29469+9RGhNcNaNeDtUSiXDu37H//t//hXvjXvm7cneJ0EgDdiw/yFB3a2T7r26qOTQw2oq+l+eWvipMn2/Vuvn5X9p3511N//0Oe++uztdyZ4/QSAN2jzouc3LXhuyg3XFmteeUJczfC2cktz17pNiZOg2FA39MbfKbe++kzW7j177/nIp1fc94sEb4gA8Ma1r92w5tGnJl03q7b5lXtRsmvCtcPbOte+nO2ZJt46pcHNh+75aX71np+9W7bd9cGPZRlO8EYJAG/Kvq3bl//0wXHvnNE8cviRSWlQU93oEZ1rN6bevsRbITu0arthVrG+7uhk65JlP/iDj+9e7wZc3hQB4M3q3rd/6T0PtIwdNfz8V94aVmpsqD97TNeGLf3dBxNvTt34Ua3vuerYNzFkxb3nT27q3r03wZsjALwF+np6Vv6/R7o6dp89+8ojD6Up1tU2TBrXvWVH3/4DiTeq6aJzB8+cngqFI3/29/Y++tdfz/4d93g+eKMEgLfMpoVLNi9aOmH2lTWNhx5OUCiXGs6d0Nuxp6d9T+L1y776swAc/fPArvZ7P/qZZT/5eYK3iADwVmpfs37p3fdn54KGTBh7ZJKdC8qOBro3uj30dSg21re9b3bd2JFHJ+uemP/DP/xT7/XlrSUAvMUO7j/wwj1zDu7bP/6qywqHX09YM7y1bszIrg2b+3t6E6+ldtTwtutnHX3IT9/Bnsf/9tu/+OyXew54sRdvMQHgpNi44Lk1c58afenUxmGHXh+WXRZuPGdCT8eeXpcuf6PmGRcOvuqS7OzZkT871m74v3/0iZVzHk5wEggAJ8veLdsW/8OPO9s7xl4xvVRTk32p1U8cWx7U2L1pW3INs0K5dXDbDbPrxo068md2IPXEV7593yf/at/W7QlODgHgJOrv68uuDL9w7wNDp0w6clWg3NbSMGlcz67dvXv3J/5J07TzhlxzxdH3uqx5bN49H/7k6rlPJTiZCjePm5Hg5Bs/64p3/9fPDDvvnCN/dq55ec+vFvftj35eu2bk0JaZ00uDm4/8uX35qkf++9eyS74JTj4B4G1UKFz4wX8+6y//Y/NZI7K/smvC+xYt2/f8qpjPjSg2NQy+fGrdhFcOwfdu3vrEzbceepGvp2jwdhEA3m7lurrpH/mDKz7xJ/Uth95nkl0W3j1v0aELA3GUik0XTWmeOiUdvkuqs2P3/O/csfB7d/V0dSV4GwkAp0Zdy6CZn/oPF3/490q1NdmfXRu27Jn/XO+efSnv6s8eM+jyi4qHfyvX09n57Pfumn/rHV0dfivHKSAAnEqDRo2c8bE/mvahDxz58fD+F17au2hZf1d3yqPas4Y1T7+gZsSh+2L7enqW/OCnT339tn1b3OTDKSMAnHrZ0cCMj/7r7LxQ/ZCW1Nu7f9nqvYtX5CkDNSOGNk8/PwtA9r872zsWfv+HC26/014/p5wAcLoo19ef/6/ed8m//f0RF56XXR8+sHLN/qUvnul3i9aNH9X4jkm1ow49K7tj3cv/eNvfL/nhz7IzPwlOAwLAaWf4BVMu+Te/f/7vXl/T1Ni1fvP+pau6N59h50kK5XLDueObLjynmP1f2L33lCsUGwAAB61JREFUhXvnPPcPP962dEWC04kAcJrKLg5PvObqKf/iPZPfM7vUnw6sWnfgxXV9+073h0tnO/sNk8fVTRhzsLPzpYcfX37fQ6sfebLXexE4LQkAZ4Bzrr9m0nWzJl83u9zb37nm5a51G/sOnF53TNYMb8vO9jRMHt/T2+N7nzOFAHAmaZt89oTZV06YdcVZUyb3t+/tfnnLwe270ilSqK3JruvWTxhdaGne8OzitY8/s+axebteWpvgDCEAnKlaJowddfGFo6dfNHLyxMFDWg5u2dG9befJfhFxqbmxZsTQ0tCW3bvaNy9buWnhkk2Lnu9YuyHBGUgAyIns0vFZF18wbtpFrcOGlvv6UtfB7ILBm38DQbGhvjSoMdXVdqX+HZs3b1z0/OZFS13OJR8EgNxqHNbWOn5M65hRLaNGDmpraxjUXFdXXyoWiv2p0N/fnx0rFAr9Xd3Fupr+Urm/kLJ/Pamv60Dn/o49e7bv2LVx8871L+/dvHX/9p0J8qicIKeyL+62SROu//aX0xt11+/9e9/+5JgAAAQlAABBCQBAUAIAEJQAAAQlAABBCQBAUAIAEJQAAAQlAABBCQBAUAIAEJQAAAQlAABBCQBAUAIAEJQAAAQlAABBCQBAUAIAEJQAAAQlAABBCQBAUAIAEJQAAAQlAABBCQBAUAIAEJQAAAQlAABBCQBAUAIAEJQAAAQlAABBCQBAUAIAEJQAAAQlAABBCQBAUAIAEJQAAAQlAABBCQBAUAIAEJQAAAQlAABBCQBAUAIAEJQAAAQlAABBCQBAUAIAEJQAAAQlAABBCQBAUAIAEJQAAAQlAABBCQBAUAIAEJQAAAQlAABBCQBAUAIAEJQAAAQlAABBCQBAUAIAEJQAAAQlAABBCQBAUAIAEJQAAAQlAABBCQBAUAIAEJQAAAQlAABBCQBAUAIAEJQAAAQlAABBCQBAUAIAEJQAAAQlAABBCQBAUAIAEJQAAAQlAABBCQBAUAIAEJQAAAQlAABBCQBAUAIAEJQAAAQlAABBCQBAUAIAEJQAAAQlAABBCQBAUAIAEJQAAAQlAABBCQBAUAIAEJQAAAQlAABBCQBAUAIAEJQAAAQlAABBCQBAUAIAEJQAAAQlAABBCQBAUAIAEJQAAAQlAABBCQBAUAIAEJQAAAQlAABBCQBAUAIAEJQAAAQlAABBCQBAUAIAEFTh5nEzEhxv7JWXTnz3zNEzpjWfNaJpWFtNU2PiTHNw3/5923fu3bx144LnVv/yyQ3zFyY4ngDwqkKpdPGHPnDln/+75pHDE/myd8u2p7/+vxff9ZP+3t4EhwkAhxUK73j/e2f+xcdbJ45P5Neul9Y+cfOtK+5/OPX3J8IrvbdldCK8897/z973P7/QNHxoItcaWodMvnbW9uUv7npxbSI8ASCde8O177/1q8WyOwJCKNaU3/Evr9+x4qUdK19KxFZMxDbq0qk3/t0XE8HccMt/G37BlERsAhBaoVi8/m8/X66vTwSTbfQs/NkCSARm84c27UMfGDplUiKkYeedky2ARGACEFdNU+PVf/GnicBmfubjtc1NiagEIK4pN17bMLQ1EVjjsLZzb3h3IioBiGvcOy9LhGcZRObOv7hGXOgmEFLbOWcnohKAuPzsi2QZxCYAQRVKpfrWlkR4AhCZawBBFYqF/j5PgyHbFShmewOJkAQgqL6DPV0duxPhde7q8HzQsAQgrn3bdiTCswwiE4C4Nj67OBGeZRCZAMS16udzE+FZBpEJQFxrn5jfvmZ9IrCOtRvWPv5MIioBiCu79Dfvm7cnAnv6G9/t7+tLRCUAoS295wEHAWFlu/9L756TCEwAQssOAuZ86gs9nZ2JYLKNfv9Nn7f7H5wARLfp2cVzbvpCIphso29y/0943glM2rlqdfvqdROvmVms8WiQ/Mv2/efc9PkV9z+cCE8AOGT7slWrH3ly/MzLGlqHJPJr10tr7/7jT6578lcJUircPG5GgsMKpdLUP/zdqz71seaRwxP5snfLtme+cfuiO+/14AeOEgCqGHvF9InXXj3uqstGTb8ocSbbtHDJ+qf/cfUjT2145tkExxMAXsPQ8yY3Oi90Btq7dXt2wifBibnox2vYsfxFTwuDXBIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACAoAQAISgAAghIAgKAEACCo/w8AAP//6FCw1gAAAAZJREFUAwB7xrhGLN1mFAAAAABJRU5ErkJggg==';

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
  var raw = HtmlService.createHtmlOutputFromFile('Index').getContent();

  // 주소에 ?k=PIN 이 붙어 있으면 잠금 화면을 건너뛴다.
  // Apps Script는 화면을 매번 다른 googleusercontent 주소로 서빙해서 브라우저
  // 저장소가 남지 않는다. 그래서 "로그인 기억"은 주소가 담당한다.
  var pin = prop_('WINE_PIN');
  var key = (e && e.parameter) ? e.parameter.k : '';
  if (pin && key && String(key) === String(pin)) {
    raw = raw.replace('/*UNLOCKED*/false', 'true');
  }

  var out = HtmlService.createHtmlOutput(raw)
    .setTitle(APP_TITLE)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);

  // 홈 화면 아이콘은 이 바깥 페이지의 파비콘에서 가져간다.
  // 우리 HTML 안의 <link rel="icon">은 iframe 안이라 폰이 보지 못한다.
  var icon = prop_('ICON_URL');
  if (icon) out.setFaviconUrl(icon);
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
 * 아이콘을 드라이브에 올려 공개 URL을 만들고 ICON_URL 속성에 저장한다.
 * setFaviconUrl은 데이터 URI가 아니라 실제 주소를 요구하므로 호스팅이 필요하다.
 */
function setupIcon() {
  var folders = DriveApp.getFoldersByName(PHOTO_FOLDER_NAME);
  var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(PHOTO_FOLDER_NAME);

  // 다시 실행해도 파일이 쌓이지 않도록 이전 것은 정리
  var old = folder.getFilesByName(ICON_FILE_NAME);
  while (old.hasNext()) old.next().setTrashed(true);

  var blob = Utilities.newBlob(Utilities.base64Decode(ICON_PNG_B64), 'image/png', ICON_FILE_NAME);
  var file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  var url = 'https://lh3.googleusercontent.com/d/' + file.getId() + '=s512';
  PropertiesService.getScriptProperties().setProperty('ICON_URL', url);
  return url;
}

/**
 * 설정이 제대로 됐는지 점검한다. 에디터에서 실행하고 실행 로그를 보면 된다.
 * 아이콘이 안 바뀔 때 어디가 문제인지 확인하는 용도.
 */
function checkSetup() {
  var lines = [];
  var pin = prop_('WINE_PIN');
  var sheetId = prop_('SHEET_ID');
  var gem = prop_('GEMINI_API_KEY');
  var icon = prop_('ICON_URL');

  lines.push('WINE_PIN        : ' + (pin ? '설정됨 (' + String(pin).length + '자리)' : '❌ 없음'));
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

  lines.push('ICON_URL        : ' + (icon ? icon : '❌ 없음 → setup(또는 setupIcon) 실행 필요'));
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
