import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  NEUTRAL,
  clampPercent,
  isNeutral,
  isRestrictedUrl,
  levelOf,
  percentToPosition,
  positionToPercent,
  sameSettings,
  sanitizeSettings,
  snapPercent,
  siteKey,
} from '../src/shared/settings.js';

test('clampPercent keeps values in 0..500 and rounds', () => {
  assert.equal(clampPercent(-5), 0);
  assert.equal(clampPercent(501), 500);
  assert.equal(clampPercent(249.6), 250);
  assert.equal(clampPercent('300'), 300);
  assert.equal(clampPercent('abc'), 100);
  assert.equal(clampPercent(Infinity), 100);
});

test('sanitizeSettings drops unknown and invalid fields', () => {
  assert.deepEqual(sanitizeSettings({ percent: 9999, effect: 'loud', evil: 1 }), { ...NEUTRAL, percent: 500 });
  assert.deepEqual(sanitizeSettings(null), { ...NEUTRAL });
  assert.deepEqual(sanitizeSettings({ effect: 'voice' }, { percent: 300, effect: 'bass' }), { percent: 300, effect: 'voice' });
  assert.deepEqual(sanitizeSettings({ percent: 250 }, { percent: 300, effect: 'bass' }), { percent: 250, effect: 'bass' });
});

test('isNeutral / sameSettings', () => {
  assert.ok(isNeutral(NEUTRAL));
  assert.ok(!isNeutral({ ...NEUTRAL, percent: 101 }));
  assert.ok(!isNeutral({ ...NEUTRAL, effect: 'bass' }));
  assert.ok(sameSettings(NEUTRAL, { percent: 100, effect: 'default' }));
  assert.ok(!sameSettings(NEUTRAL, { percent: 100, effect: 'voice' }));
});

test('siteKey only accepts web pages', () => {
  assert.equal(siteKey('https://www.youtube.com/watch?v=x'), 'www.youtube.com');
  assert.equal(siteKey('http://example.com:8080/a'), 'example.com');
  assert.equal(siteKey('chrome://settings'), null);
  assert.equal(siteKey('file:///tmp/a.mp3'), null);
  assert.equal(siteKey(undefined), null);
});

test('isRestrictedUrl', () => {
  assert.ok(isRestrictedUrl('chrome://extensions'));
  assert.ok(isRestrictedUrl('about:addons'));
  assert.ok(isRestrictedUrl('https://chromewebstore.google.com/detail/x'));
  assert.ok(isRestrictedUrl('https://addons.mozilla.org/en-US/firefox/'));
  assert.ok(!isRestrictedUrl('https://www.youtube.com/'));
  assert.ok(!isRestrictedUrl('file:///home/me/song.mp3'));
  assert.ok(!isRestrictedUrl(undefined));
});

test('levelOf', () => {
  assert.equal(levelOf(0), 'normal');
  assert.equal(levelOf(100), 'normal');
  assert.equal(levelOf(250), 'boost');
  assert.equal(levelOf(500), 'high');
});

test('slider scale: 100% at 40% of the track, ends at 0 and 500', () => {
  assert.equal(percentToPosition(0), 0);
  assert.equal(percentToPosition(100), 0.4);
  assert.equal(percentToPosition(500), 1);
  assert.equal(positionToPercent(0), 0);
  assert.equal(positionToPercent(0.4), 100);
  assert.equal(positionToPercent(1), 500);
  assert.equal(positionToPercent(-1), 0);
  assert.equal(positionToPercent(2), 500);
});

test('slider scale: every whole percent survives a round trip and order is kept', () => {
  for (let p = 0; p <= 500; p++) assert.equal(positionToPercent(percentToPosition(p)), p);
  let previous = -1;
  for (let i = 0; i <= 1000; i++) {
    const p = positionToPercent(i / 1000);
    assert.ok(p >= previous);
    previous = p;
  }
});

test('slider scale: equal distance above 100% adds equal loudness', () => {
  const db = (p) => 20 * Math.log10(p / 100);
  const step = (a, b) => db(positionToPercent(b)) - db(positionToPercent(a));
  assert.ok(Math.abs(step(0.5, 0.6) - step(0.8, 0.9)) < 0.2);
});

test('snapping: strong at 100%, gentle at 200% and 300%, nothing elsewhere', () => {
  const near = (percent) => {
    const hits = [];
    for (let p = percent - 20; p <= percent + 20; p++) if (snapPercent(percentToPosition(p)) === percent) hits.push(p);
    return [hits[0], hits[hits.length - 1]];
  };
  const [low100, high100] = near(100);
  const [low300, high300] = near(300);
  const [low200, high200] = near(200);
  assert.ok(low100 <= 97 && high100 >= 103, `100 zone ${low100}-${high100}`);
  assert.ok(high300 - low300 <= 14 && low300 > 290 && high300 < 310, `300 zone ${low300}-${high300}`);
  assert.ok(high200 - low200 <= 10, `200 zone ${low200}-${high200}`);
  for (const p of [50, 150, 250, 400, 450]) assert.equal(snapPercent(percentToPosition(p)), null, `${p} must not snap`);
});
