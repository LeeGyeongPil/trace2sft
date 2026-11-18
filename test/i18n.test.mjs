import assert from 'node:assert/strict';
import { test } from 'node:test';
import { en } from '../dist/i18n/en.js';
import { ko } from '../dist/i18n/ko.js';
import { resolveLang } from '../dist/i18n/index.js';
import { run, readText, tmp } from './helpers.mjs';

test('key parity', () => {
  assert.deepEqual(Object.keys(en).sort(), Object.keys(ko).sort());
  for (const [k, v] of Object.entries(ko)) assert.ok(v.length > 0, k);
  // placeholders must match between languages
  const ph = (s) => (s.match(/\{\w+\}/g) ?? []).sort().join();
  for (const k of Object.keys(en)) assert.equal(ph(ko[k]), ph(en[k]), k);
});

test('resolution order', () => {
  assert.equal(resolveLang(undefined, {}), 'en');
  assert.equal(resolveLang(undefined, { TRACE2SFT_LANG: 'ko' }), 'ko');
  assert.equal(resolveLang(undefined, { LANG: 'ko_KR.UTF-8' }), 'ko');
  assert.equal(resolveLang(undefined, { LANG: 'fr_FR.UTF-8' }), 'en');
  assert.equal(resolveLang('en', { TRACE2SFT_LANG: 'ko' }), 'en');
  assert.equal(resolveLang('ko', { TRACE2SFT_LANG: 'en', LANG: 'en_US.UTF-8' }), 'ko');
  assert.equal(resolveLang(undefined, { TRACE2SFT_LANG: 'en', LANG: 'ko_KR.UTF-8' }), 'en');
  assert.equal(resolveLang(undefined, { LC_ALL: 'ko_KR.UTF-8', LANG: 'en_US.UTF-8' }), 'ko');
});

test('help in both languages', () => {
  assert.match(run(['--help', '--lang', 'ko']).stdout, /사용법/);
  assert.match(run(['--help', '--lang', 'en']).stdout, /Usage:/);
  assert.match(run(['--help'], { TRACE2SFT_LANG: 'ko' }).stdout, /사용법/);
  assert.match(run(['--help'], { LANG: 'ko_KR.UTF-8' }).stdout, /사용법/);
  assert.match(run(['--help'], { LANG: 'fr_FR.UTF-8' }).stdout, /Usage:/);
  assert.match(run(['--help', '--lang', 'en'], { TRACE2SFT_LANG: 'ko' }).stdout, /Usage:/);

  const ko = tmp();
  const en = tmp();
  run(['demo', '--out', ko, '--lang', 'ko']);
  run(['demo', '--out', en, '--lang', 'en']);
  assert.match(readText(ko, 'report.md'), /^# 변환 보고서/);
  assert.match(readText(en, 'report.md'), /^# Conversion report/);
  assert.match(run(['demo', '--out', tmp()], { TRACE2SFT_LANG: 'ko' }).stdout, /유지 4/);
});

test('errors are localized', () => {
  assert.match(run(['convert', 'fixtures/errors/unknown.json', '--out', tmp(), '--lang', 'ko']).stderr, /오류 \[E_UNKNOWN_DIALECT\]/);
});
