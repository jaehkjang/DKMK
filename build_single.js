/**
 * Code.gs + Index.html → AllInOne.gs 한 파일로 합친다.
 *
 * Apps Script 편집기에서 HTML 파일을 따로 만들지 않아도 되도록,
 * Index.html 전체를 템플릿 리터럴 문자열로 Code.gs 안에 넣는다.
 *
 * 사용법: node build_single.js
 */
const fs = require('fs');
const path = require('path');

const DIR = __dirname;

/** 템플릿 리터럴 안에서 원문 그대로 살아남도록 이스케이프 */
function escapeForTemplateLiteral(s) {
  return s
    .replace(/\\/g, '\\\\')   // 역슬래시가 먼저 (뒤 규칙이 만든 것까지 건드리지 않도록)
    .replace(/`/g, '\\`')
    .replace(/\$\{/g, '\\${');
}

const code = fs.readFileSync(path.join(DIR, 'Code.gs'), 'utf8');
const html = fs.readFileSync(path.join(DIR, 'Index.html'), 'utf8');

const FROM = "HtmlService.createHtmlOutputFromFile('Index')";
const TO = 'HtmlService.createHtmlOutput(INDEX_HTML)';
if (code.indexOf(FROM) === -1) {
  throw new Error('Code.gs에서 ' + FROM + ' 를 찾지 못했습니다. doGet이 바뀌었는지 확인하세요.');
}

const header = [
  '/**',
  ' * ⚠️ 이 파일은 build_single.js가 자동으로 만든 것입니다. 직접 고치지 마세요.',
  ' *    고칠 때는 Code.gs / Index.html 을 고치고 `node build_single.js` 를 다시 실행하세요.',
  ' *',
  ' * [이 파일을 쓰는 이유]',
  ' * Apps Script에서 HTML 파일을 따로 만들지 않아도 되도록 화면(Index.html)까지',
  ' * 이 파일 하나에 담았습니다. Apps Script 새 프로젝트에 이 파일 내용만',
  ' * 통째로 붙여넣으면 끝입니다.',
  ' */',
  ''
].join('\n');

const out =
  header +
  code.replace(FROM, TO) +
  '\n\n/* ===================== 화면(Index.html) ===================== */\n\n' +
  'var INDEX_HTML = `' + escapeForTemplateLiteral(html) + '`;\n';

fs.writeFileSync(path.join(DIR, 'AllInOne.gs'), out);
console.log('AllInOne.gs 생성 완료 (' + out.length + ' bytes)');
