import test from 'node:test';
import assert from 'node:assert/strict';
import { SR, noteFreq, createMix, tone, master, wavBytes } from '../src/synth.js';
import { buildAudio } from '../scenes/jihanki.audio.js';

test('noteFreq はラ（69）で 440Hz、1オクターブ上で2倍', () => {
  assert.equal(noteFreq(69), 440);
  assert.ok(Math.abs(noteFreq(81) - 880) < 1e-9);
});

test('tone は範囲外の時刻でも落ちない（はみ出した分は捨てる）', () => {
  const mix = createMix(1);
  tone(mix, { t: -0.1, f: 440, dur: 0.3 });
  tone(mix, { t: 0.9, f: 440, dur: 0.5 });
  assert.ok(mix.left.some((v) => v !== 0));
  assert.ok(mix.left.every(Number.isFinite));
});

test('wavBytes はヘッダ44バイト + 1サンプル4バイト', () => {
  const mix = master(createMix(0.5));
  const wav = wavBytes(mix.left, mix.right);
  assert.equal(wav.length, 44 + Math.round(0.5 * SR) * 4);
  assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
});

test('自販機の音は32秒ちょうどで、音割れせず、毎回同じ', () => {
  const a = buildAudio(), b = buildAudio();
  assert.equal(a.left.length, 32 * SR);
  let peak = 0;
  for (let i = 0; i < a.left.length; i++) peak = Math.max(peak, Math.abs(a.left[i]), Math.abs(a.right[i]));
  assert.ok(peak > 0.5 && peak <= 0.9, `peak=${peak}`);
  assert.deepEqual(a.left.subarray(0, 50000), b.left.subarray(0, 50000));
});
