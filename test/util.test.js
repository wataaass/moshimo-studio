import test from 'node:test';
import assert from 'node:assert/strict';
import { clamp, prog, easeInOut, easeOut, rng, pyramidLayout, pyramidHeight } from '../src/util.js';

test('clamp と prog は範囲からはみ出さない', () => {
  assert.equal(clamp(-1), 0);
  assert.equal(clamp(2), 1);
  assert.equal(prog(5, 2, 4), 1);
  assert.equal(prog(1, 2, 4), 0);
  assert.equal(prog(3, 2, 4), 0.5);
});

test('イージングは 0 で始まり 1 で終わる', () => {
  for (const f of [easeInOut, easeOut]) {
    assert.equal(f(0), 0);
    assert.equal(f(1), 1);
  }
});

test('rng は同じ種なら同じ列を返す', () => {
  const a = rng(42), b = rng(42);
  for (let i = 0; i < 5; i++) {
    const v = a();
    assert.equal(v, b());
    assert.ok(v >= 0 && v < 1);
  }
});

test('pyramidLayout は段ごとに n×n 個を下から並べる', () => {
  const slots = pyramidLayout(9, { w: 1, h: 1.83, d: 0.75 });
  assert.equal(slots.length, 285); // 9² + 8² + … + 1²
  assert.equal(slots.filter((s) => s.layer === 0).length, 81);
  assert.equal(slots.at(-1).layer, 8);
  assert.ok(Math.abs(slots.at(-1).x) < 1e-9); // 頂上は中央
  assert.ok(Math.abs(slots[0].y - 0.915) < 1e-9);
});

test('pyramidHeight は体積から高さを逆算する', () => {
  const h = pyramidHeight(5.1e6);
  assert.ok(Math.abs((4 * h ** 3) / 3 - 5.1e6) < 1);
  assert.ok(h > 150 && h < 160);
});
