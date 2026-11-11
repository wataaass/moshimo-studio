#!/usr/bin/env node
// 音を耳で聞けない環境のための点検。使い方: node tools/audio-report.js <scene>
// 系統ごとの音量、帯域のバランス、指定した時刻で音が立ち上がっているかを数字で出す
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { SR, biquad } from '../src/synth.js';

const scene = process.argv[2] || 'jihanki';
const root = path.resolve(import.meta.dirname, '..');
const { buildAudio } = await import(pathToFileURL(path.join(root, 'scenes', `${scene}.audio.js`)));
const { left, right, stats } = buildAudio();
const n = left.length;
const mono = Float32Array.from(left, (v, i) => (v + right[i]) / 2);
const db = (buf, a = 0, b = buf.length) => { let e = 0; for (let i = a; i < b; i++) e += buf[i] * buf[i]; return 10 * Math.log10(e / Math.max(1, b - a) + 1e-12); };
const f1 = (x) => x.toFixed(1).padStart(6);

console.log('系統ごとの音量（dB、相対値）');
for (const [k, v] of Object.entries(stats)) console.log(`  ${k.padEnd(7)}${f1(v)}`);

console.log('帯域のバランス（全体に対する dB）');
const total = db(mono);
for (const [name, lo, hi] of [['低域 〜120Hz', 0, 120], ['中低域 120〜500', 120, 500], ['中域 500〜2k', 500, 2000], ['中高域 2k〜8k', 2000, 8000], ['高域 8k〜', 8000, 0]]) {
  const b = Float32Array.from(mono);
  if (lo) { biquad(b, { type: 'highpass', f: lo }); biquad(b, { type: 'highpass', f: lo }); }
  if (hi) { biquad(b, { type: 'lowpass', f: hi }); biquad(b, { type: 'lowpass', f: hi }); }
  console.log(`  ${name.padEnd(16)}${f1(db(b) - total)}`);
}

console.log('2秒ごとの音量（dB）');
let line = '  ';
for (let t = 0; t < n / SR; t += 2) line += `${t}s:${db(mono, t * SR, Math.min(n, (t + 2) * SR)).toFixed(0)}  `;
console.log(line);

const { T } = await import(pathToFileURL(path.join(root, 'scenes', `${scene}.timing.js`))).catch(() => ({ T: null }));
if (T) {
  console.log('時刻ごとの立ち上がり（直後0.1秒 − 直前0.1秒、dB。大きいほどその瞬間に音が当たっている）');
  for (const [k, t] of Object.entries(T)) {
    const i = Math.round(t * SR), w = Math.round(0.1 * SR);
    console.log(`  ${k.padEnd(11)}${String(t).padStart(5)}s ${f1(db(mono, i, i + w) - db(mono, i - w, i))}`);
  }
}
