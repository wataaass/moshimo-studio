// 自販機の動画の音（BGM と効果音）。場面の時刻は jihanki.js と合わせる
import { createMix, tone, noise, master, noteFreq } from '../src/synth.js';
import { rng } from '../src/util.js';

const DURATION = 32;
const T_COL = 6.2, T_FALL = 16.3, T_BREAK = 17.7, T_CUBE = 20.5, T_END = 28, T_SPACE = 12.7;
const BEAT = 0.5, BAR = 2; // 120 BPM
// 1小節ごとのコード（C → Am → F → G）
const CHORDS = [
  { bass: 36, tones: [60, 64, 67, 72] },
  { bass: 33, tones: [57, 60, 64, 69] },
  { bass: 29, tones: [53, 57, 60, 65] },
  { bass: 31, tones: [55, 59, 62, 67] },
];
const PENTA = [60, 62, 64, 67, 69, 72, 74, 76];

export function buildAudio() {
  const mix = createMix(DURATION);
  const r = rng(2026);
  const chordAt = (t) => CHORDS[Math.floor(t / BAR) % 4];
  const playing = (t) => t < T_FALL - 0.05 || t >= T_CUBE; // 倒れる場面では BGM を止める

  // ---------- BGM ----------
  for (let step = 0; step < DURATION / (BEAT / 4); step++) {
    const t = step * (BEAT / 4);
    if (!playing(t) || t > 31.2) continue;
    const c = chordAt(t), s16 = step % 16, onBeat = step % 4 === 0, on8 = step % 2 === 0;
    const intro = t < T_COL, climb = t >= T_COL && t < T_FALL, space = climb && t >= T_SPACE, finale = t >= T_CUBE;
    const lift = climb ? (t - T_COL) / (T_FALL - T_COL) : 0;

    // ドラム
    if (onBeat && !(space && s16 % 8 !== 0)) tone(mix, { t, f: 130, f1: 44, dur: 0.16, gain: intro ? 0.3 : 0.5, decay: 5 });
    if (on8 && !onBeat) noise(mix, r, { t, dur: 0.04, gain: space ? 0.04 : 0.08, lp: 0.5, hp: true, decay: 6, pan: 0.2 });
    if ((s16 === 4 || s16 === 12) && !intro && !space) noise(mix, r, { t, dur: 0.12, gain: 0.2, lp: 0.6, decay: 7 });
    // ベース
    if (on8) tone(mix, { t, f: noteFreq(c.bass + (onBeat ? 0 : 12)), dur: 0.22, type: 'tri', gain: intro ? 0.2 : 0.28, decay: 3 });
    // アルペジオ（上がるほど高く、細かく）
    if (intro ? on8 : climb ? true : on8) {
      const up = climb ? 12 * Math.floor(lift * 2.4) : 0;
      const n = c.tones[(intro ? step / 2 : step) % 4 | 0] + up;
      tone(mix, { t, f: noteFreq(n), dur: space ? 0.3 : 0.16, type: space ? 'sine' : 'square', gain: space ? 0.07 : 0.05 + 0.03 * lift, decay: 5, pan: (step % 4) / 3 - 0.5 });
    }
    // 宇宙ではふわっとした和音を足す
    if (space && s16 === 0) c.tones.forEach((n, i) => tone(mix, { t, f: noteFreq(n), dur: Math.min(2, T_FALL - t), type: 'sine', gain: 0.035, attack: 0.3, decay: 1.5, vib: 0.003, pan: i / 1.5 - 1 }));
    // メロディ（後半）
    if (finale && on8 && r() < 0.72) {
      const pool = PENTA.filter((n) => c.tones.includes(n) || r() < 0.4);
      tone(mix, { t, f: noteFreq(pool[Math.floor(r() * pool.length)] + 12), dur: 0.24, type: 'tri', gain: 0.13, decay: 4, pan: -0.15 });
    }
  }
  // しめの和音
  [48, 60, 64, 67, 72].forEach((n, i) => tone(mix, { t: 31.25, f: noteFreq(n), dur: 0.7, type: i ? 'tri' : 'sine', gain: 0.14, decay: 3 }));

  // ---------- 効果音 ----------
  // 出だしの「ポン」
  tone(mix, { t: 0.15, f: 520, f1: 1040, dur: 0.18, gain: 0.2, decay: 4 });
  // 自販機が降って積み上がる音（映像と同じ式で着地の時刻を出し、詰まりすぎないよう間引く）
  let last = 0;
  for (let n = 1; n < 285; n++) {
    const t = 2.5 + 3.3 * Math.pow(n / 284, 0.8) + 0.5;
    if (t - last < 0.05) continue;
    last = t;
    const f = 260 + r() * 520;
    tone(mix, { t, f, f1: f * 0.6, dur: 0.07, type: 'tri', gain: 0.16, decay: 6, pan: r() - 0.5 });
  }
  // 場面転換の「シュッ」
  for (const t of [T_COL, T_FALL, T_CUBE]) noise(mix, r, { t: t - 0.25, dur: 0.5, gain: 0.3, lp: 0.05, lp1: 0.7, swell: true });
  // 目印を通過するたびのチャイム（だんだん高く）
  [[7.8, 84], [9.0, 88], [10.7, 91], [12.7, 96]].forEach(([t, n]) => {
    tone(mix, { t, f: noteFreq(n), dur: 0.6, gain: 0.16, decay: 5 });
    tone(mix, { t: t + 0.08, f: noteFreq(n + 7), dur: 0.5, gain: 0.1, decay: 5, pan: 0.3 });
  });
  // てっぺんに着いたときのきらめき
  for (let i = 0; i < 9; i++) tone(mix, { t: 14.8 + i * 0.06, f: noteFreq(84 + [0, 4, 7, 12, 16, 19, 24, 19, 24][i]), dur: 0.5, gain: 0.1, decay: 5, pan: i / 4 - 1 });
  // ぐらつく音 → 倒れる音
  tone(mix, { t: T_FALL + 0.2, f: 420, f1: 300, dur: T_BREAK - T_FALL - 0.2, type: 'sine', gain: 0.2, attack: 0.3, decay: 0.2, vib: 0.07, vibHz: 2.6 });
  noise(mix, r, { t: T_BREAK, dur: 1.1, gain: 0.55, lp: 0.5, lp1: 0.04, decay: 4 });
  tone(mix, { t: T_BREAK, f: 90, f1: 38, dur: 0.7, gain: 0.5, decay: 3 });
  for (let i = 0; i < 24; i++) {
    const t = T_BREAK + 0.25 + r() * 1.3;
    noise(mix, r, { t, dur: 0.09, gain: 0.22, lp: 0.35, decay: 6, pan: r() - 0.5 });
    tone(mix, { t, f: 700 + r() * 1500, dur: 0.06, type: 'square', gain: 0.05, decay: 7, pan: r() - 0.5 });
  }
  // しょんぼりした下降音
  [[19.0, 67], [19.35, 64], [19.7, 60]].forEach(([t, n]) => tone(mix, { t, f: noteFreq(n), f1: noteFreq(n - 1), dur: 0.36, type: 'tri', gain: 0.16, decay: 2, vib: 0.01 }));
  // サイコロが下から積み上がる音 → 完成の「ジャン」
  for (let i = 0; i < 14; i++) {
    const t = 20.9 + 2.3 * (1 - Math.pow(1 - i / 14, 1.6));
    tone(mix, { t, f: 180 + i * 28, f1: 120 + i * 28, dur: 0.09, type: 'tri', gain: 0.2, decay: 5 });
  }
  [72, 76, 79, 84].forEach((n, i) => tone(mix, { t: 23.4 + i * 0.03, f: noteFreq(n), dur: 0.7, type: 'saw', gain: 0.07, decay: 5, pan: i / 1.5 - 1 }));
  // まとめの合図
  tone(mix, { t: T_END + 0.1, f: noteFreq(84), dur: 0.5, gain: 0.14, decay: 5 });

  return master(mix);
}
