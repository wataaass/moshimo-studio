import test from 'node:test';
import assert from 'node:assert/strict';
import { FACTS, derive } from '../scenes/jihanki.facts.js';

// 字幕に出している数字が、元の数字からの計算と合っているかを確かめる
test('縦に積むと約3,570km、ISSの約9倍', () => {
  const d = derive();
  assert.equal(Math.round(d.stack / 10_000) * 10, 3570);
  assert.equal(Math.round(d.issRatio), 9);
});

test('まとめると一辺約138m、東京ドーム約2杯分、東京タワーの半分未満', () => {
  const d = derive();
  assert.equal(Math.round(d.cube), 138);
  assert.equal(Math.round(d.domes), 2);
  assert.ok(d.towerRatio < 0.5);
});

test('台数が変われば結果も変わる（0台なら全部0）', () => {
  const d = derive({ ...FACTS, count: 0 });
  assert.equal(d.stack, 0);
  assert.equal(d.cube, 0);
});
