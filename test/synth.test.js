import test from 'node:test';
import assert from 'node:assert/strict';
import { SR, noteFreq, createSession, put, duck, master, osc, pluck, biquad, wavBytes } from '../src/synth.js';
import { rng } from '../src/util.js';
import { buildAudio } from '../scenes/jihanki.audio.js';
import { T, DURATION, fallPlan, dropStart, DROP_FALL } from '../scenes/jihanki.timing.js';

const rmsDb = (buf, a = 0, b = buf.length) => { let e = 0; for (let i = a; i < b; i++) e += buf[i] * buf[i]; return 10 * Math.log10(e / (b - a) + 1e-12); };

test('noteFreq はラ（69）で 440Hz、1オクターブ上で2倍', () => {
  assert.equal(noteFreq(69), 440);
  assert.ok(Math.abs(noteFreq(81) - 880) < 1e-9);
});

test('put は範囲外の時刻でも落ちない（はみ出した分は捨てる）', () => {
  const s = createSession(1);
  put(s, 'sfx', -0.1, osc({ f: 440, dur: 0.3 }));
  put(s, 'sfx', 0.9, osc({ f: 440, dur: 0.5 }));
  assert.ok(s.buses.sfx.l.some((v) => v !== 0));
  assert.ok(s.buses.sfx.l.every(Number.isFinite));
});

test('pluck は指定した音程で鳴る（440Hz なら1秒に約440回の波）', () => {
  const buf = pluck(rng(1), { f: 440, dur: 1, bright: 0.3 });
  biquad(buf, { type: 'lowpass', f: 600 });
  let cross = 0;
  for (let i = 1; i < buf.length; i++) if (buf[i - 1] < 0 && buf[i] >= 0) cross++;
  assert.ok(Math.abs(cross - 440) < 6, `波の数=${cross}`);
});

test('lowpass フィルターは高い音を削り、低い音は残す', () => {
  const hi = biquad(osc({ f: 8000, dur: 0.3, decay: 0 }), { type: 'lowpass', f: 500 });
  const lo = biquad(osc({ f: 100, dur: 0.3, decay: 0 }), { type: 'lowpass', f: 500 });
  assert.ok(rmsDb(hi) < -40 && rmsDb(lo) > -6);
});

test('duck は BGM だけを下げ、効果音は下げない', () => {
  const s = createSession(1);
  const one = new Float32Array(SR).fill(0.5);
  put(s, 'music', 0, one);
  duck(s, { t: -0.1, depth: 1, attack: 0.001, hold: 1.2, release: 0.01 });
  const quiet = master(s).stats.music;
  const s2 = createSession(1);
  put(s2, 'sfx', 0, one);
  duck(s2, { t: 0, depth: 1, attack: 0.001, hold: 1, release: 0.01 });
  assert.ok(quiet < -60 && master(s2).stats.sfx > -10);
});

test('wavBytes はヘッダ44バイト + 1サンプル4バイト', () => {
  const m = master(createSession(0.5));
  const wav = wavBytes(m.left, m.right);
  assert.equal(wav.length, 44 + Math.round(0.5 * SR) * 4);
  assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
});

test('場面の時刻はすべて拍（0.5秒きざみ）の上にあり、順番に並ぶ', () => {
  const beats = ['DROP', 'COL', 'TOWER', 'SKYTREE', 'FUJI', 'ISS', 'TOP', 'FALL', 'BREAK', 'LINE', 'CUBE', 'REVEAL', 'HALF', 'END', 'DOME'];
  for (const k of beats) assert.equal((T[k] * 2) % 1, 0, k);
  for (let i = 1; i < beats.length; i++) assert.ok(T[beats[i]] > T[beats[i - 1]], beats[i]);
  assert.ok(dropStart(284, 285) + DROP_FALL < T.COL);
  assert.ok(fallPlan().every((b) => T.BREAK + b.land < T.CUBE));
});

test('自販機の音：長さ・音割れ・再現性・場面ごとの鳴り方', () => {
  const a = buildAudio(), b = buildAudio();
  assert.equal(a.left.length, DURATION * SR);
  let peak = 0;
  for (let i = 0; i < a.left.length; i++) peak = Math.max(peak, Math.abs(a.left[i]), Math.abs(a.right[i]));
  assert.ok(peak > 0.5 && peak <= 0.9, `peak=${peak}`);
  assert.deepEqual(a.left.subarray(0, 50000), b.left.subarray(0, 50000));
  const at = (t0, t1) => rmsDb(a.left, Math.round(t0 * SR), Math.round(t1 * SR));
  // 倒れる前の「でも…」は BGM が止まって静かになる
  assert.ok(at(T.FALL + 0.05, T.FALL + 0.3) < at(T.COL + 2, T.COL + 6) - 10);
  // 崩れる瞬間と完成の瞬間は、直前より大きく鳴る
  assert.ok(at(T.BREAK, T.BREAK + 0.2) > at(T.BREAK - 1.2, T.BREAK - 0.6) + 6);
  assert.ok(at(T.REVEAL, T.REVEAL + 0.2) > at(T.REVEAL - 1.5, T.REVEAL - 1) + 3);
  // 最後の「ジャン」のあとは余韻だけになる
  assert.ok(at(31.8, 31.99) < at(31, 31.2) - 12);
});
