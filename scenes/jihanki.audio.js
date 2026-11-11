// 自販機の動画の音。時刻は jihanki.timing.js で映像と共有している。
// 120BPM・1小節2秒。場面の切り替わりはすべて拍の上にある
import { createSession, put, duck, master, noteFreq as hz, osc, mallet, fm, pluck, noise, biquad, layer, kick, snare, clap, hat, shaker, crash } from '../src/synth.js';
import { rng } from '../src/util.js';
import { DURATION, T, DROP_FALL, dropStart, fallPlan } from './jihanki.timing.js';

const BEAT = 0.5, BAR = 2, S16 = BEAT / 4;

// 王道進行（F → G → Em → Am）。ベースの音と、ウクレレで弾く和音
const CH = {
  F: { bass: 41, uke: [65, 69, 72, 76] },   // Fmaj7
  G: { bass: 43, uke: [67, 71, 74, 77] },   // G7
  Em: { bass: 40, uke: [64, 67, 71, 74] },  // Em7
  Am: { bass: 45, uke: [64, 69, 72, 76] },  // Am
  C: { bass: 36, uke: [64, 67, 72, 76] },   // C
};
// 小節ごとのコード（null は BGM なし）
const BARS = ['F', 'G', 'Em', 'Am', 'F', 'G', 'Em', 'F', null, null, 'F', 'G', 'Em', 'Am', 'FG', 'C'];
const chordAt = (t) => {
  const name = BARS[Math.floor(t / BAR)];
  return name === 'FG' ? CH[t % BAR < 1 ? 'F' : 'G'] : name ? CH[name] : null;
};

// メロディ（8分音符ごと、0 は休み）
const THEME = {
  0: [69, 72, 0, 69, 72, 0, 77, 76],   // 導入：問いかけ
  1: [74, 0, 71, 74, 0, 79, 0, 0],
  2: [79, 0, 76, 79, 0, 83, 0, 0],
  11: [74, 0, 71, 74, 0, 79, 0, 0],    // サイコロ完成から
  12: [79, 0, 76, 79, 0, 71, 0, 76],
  13: [72, 0, 76, 0, 81, 0, 79, 76],
  14: [77, 81, 0, 84, 83, 0, 79, 74],  // しめへ向かう
  15: [84, 0, 0, 0, 0, 0, 0, 0],
};
const PENTA = [60, 62, 64, 67, 69];
const penta = (i) => PENTA[i % 5] + 12 * Math.floor(i / 5);

export function buildAudio() {
  const s = createSession(DURATION);
  const r = rng(2026);
  const D = (t, buf, o) => put(s, 'drums', t, buf, o);
  const M = (t, buf, o) => put(s, 'music', t, buf, o);
  const X = (t, buf, o) => put(s, 'sfx', t, buf, o);

  // ================= BGM =================
  // 場面ごとの厚み： intro（静か）→ build（数える）→ climb（上昇）→ space（宇宙）→ 無音 → think（考える）→ full（結論）
  const section = (t) => (t < T.DROP ? 'intro' : t < T.COL ? 'build' : t < T.ISS ? 'climb' : t < T.TOP ? 'space' : t < T.FALL ? 'hold' : t < T.CUBE ? 'silent' : t < T.REVEAL ? 'think' : t < 31 ? 'full' : 'end');

  for (let step = 0; step < DURATION / S16; step++) {
    const t = step * S16, sec = section(t), c = chordAt(t);
    if (!c || sec === 'silent' || sec === 'hold' || sec === 'end') continue;
    const s16 = step % 16, beat = s16 % 4 === 0, off8 = s16 % 4 === 2;

    // --- ドラム ---
    const kickOn = { intro: false, build: beat, climb: beat, space: s16 === 0 || s16 === 8, think: beat, full: beat }[sec];
    if (kickOn) {
      D(t, kick(r), { gain: sec === 'build' || sec === 'think' ? 0.45 : 0.6 });
      duck(s, { t, depth: 0.22, attack: 0.004, release: 0.16 }); // キックの瞬間だけ伴奏を引っこめる
    }
    if ((sec === 'climb' || sec === 'full') && (s16 === 4 || s16 === 12)) D(t, clap(r), { gain: 0.5, rev: 0.25 });
    if (off8 && sec !== 'intro') D(t, hat(r, s16 === 14 && (sec === 'climb' || sec === 'full')), { gain: sec === 'space' ? 0.1 : 0.2, pan: 0.25 });
    if (sec !== 'space') D(t, shaker(r), { gain: (s16 % 4 === 2 ? 0.1 : 0.05) * (sec === 'intro' ? 0.8 : 1), pan: -0.3 });

    // --- ベース（1拍目と3拍目、裏で合いの手） ---
    const bassPat = { 0: 0, 6: 0, 8: 12, 14: 7 }[s16];
    if (sec !== 'intro' && (sec === 'space' ? s16 === 0 : bassPat !== undefined)) {
      const f = hz(c.bass + (sec === 'space' ? 0 : bassPat));
      const dur = sec === 'space' ? 1.8 : 0.3;
      // 低い音はスマホのスピーカーでは鳴らないので、倍音（2倍・3倍の高さ）を足して聞こえるようにする
      M(t, layer([osc({ f, dur, decay: sec === 'space' ? 1.5 : 3 }), 0.7], [osc({ f: f * 2, dur, type: 'tri', decay: 4 }), 0.6], [osc({ f: f * 3, dur, decay: 6 }), 0.25]), { gain: 0.3 });
    }

    // --- ウクレレ（裏拍でチャッ。最初の小節の頭だけジャラーン） ---
    const strum = t === 0 || (off8 && (sec === 'intro' || sec === 'build' || sec === 'climb' || sec === 'think' || sec === 'full'));
    if (strum) {
      const notes = step % 8 === 2 ? c.uke : [...c.uke].reverse();
      notes.forEach((n, i) => M(t + i * (t === 0 ? 0.03 : 0.011), pluck(r, { f: hz(n), dur: t === 0 ? 1.4 : sec === 'think' ? 0.16 : 0.42, bright: 0.55 }), { gain: sec === 'think' ? 0.2 : 0.3, pan: 0.35 - i * 0.08, rev: 0.2 }));
    }

    // --- 上昇の場面：和音を下から上へなぞり、小節ごとに高くなる ---
    if (sec === 'climb' && s16 % 2 === 0) {
      const lift = 12 * Math.min(1, Math.floor((t - T.COL) / 4));
      const n = c.uke[[0, 1, 2, 3, 2, 1, 2, 3][(step / 2) % 8]] + lift;
      M(t, fm({ f: hz(n), dur: 0.3, ratio: 1, index: 1.4, indexDecay: 5, decay: 4 }), { gain: 0.2, pan: -0.35, rev: 0.3 });
    }
    // --- 宇宙：ゆっくりしたきらめきと、やわらかい和音 ---
    if (sec === 'space') {
      if (s16 % 4 === 0) M(t, mallet({ f: hz(c.uke[(step / 4) % 4] + 12), dur: 1.2, kind: 'glock' }), { gain: 0.2, pan: ((step / 4) % 2) * 0.8 - 0.4, rev: 0.7 });
      if (t === T.ISS) c.uke.forEach((n, i) => M(t, biquad(layer([osc({ f: hz(n), dur: 2, type: 'saw', attack: 0.4, decay: 1.2 }), 1], [osc({ f: hz(n) * 1.006, dur: 2, type: 'saw', attack: 0.4, decay: 1.2 }), 1]), { type: 'lowpass', f: 1400 }), { gain: 0.06, pan: i * 0.5 - 0.75, rev: 0.6 }));
    }

    // --- メロディ（マリンバ + 1オクターブ上のグロッケン） ---
    const bar = Math.floor(t / BAR), line = THEME[bar];
    if (line && s16 % 2 === 0 && line[s16 / 2]) {
      const n = line[s16 / 2], soft = bar < 3, long = bar === 15;
      M(t, mallet({ f: hz(n), dur: long ? 1.6 : 0.5 }), { gain: soft ? 0.55 : 0.8, pan: -0.1, rev: 0.3 });
      M(t, mallet({ f: hz(n + 12), dur: long ? 1.8 : 0.7, kind: 'glock' }), { gain: soft ? 0.1 : 0.17, pan: 0.2, rev: 0.45 });
    }
  }

  // 盛り上げ：場面が変わる前のスネア連打（だんだん強く）
  const roll = (from, to) => { for (let t = from; t < to - 1e-6; t += S16) D(t, snare(r), { gain: 0.12 + 0.3 * ((t - from) / (to - from)), rev: 0.2 }); };
  roll(T.COL - 0.5, T.COL);
  roll(T.REVEAL - 0.5, T.REVEAL);

  // てっぺん到着：Fadd9 の大きな和音をのばす（解決しないまま「でも…」へ）
  [41, 53, 60, 65, 69, 72, 79].forEach((n, i) => M(T.TOP, biquad(layer([osc({ f: hz(n), dur: 1.5, type: 'saw', attack: 0.02, decay: 2.2 }), 1], [osc({ f: hz(n) * 1.005, dur: 1.5, type: 'saw', attack: 0.02, decay: 2.2 }), 1]), { type: 'lowpass', f: 3200, f1: 900 }), { gain: 0.08, pan: i / 3 - 1, rev: 0.5 }));
  // しめ：31秒ちょうどに C の和音で「ジャン」
  D(31, kick(r), { gain: 0.6 });
  D(31, crash(r, 0.5), { gain: 0.2, rev: 0.3 });
  [36, 48, 60, 64, 67, 72].forEach((n, i) => M(31 + (i > 1 ? (i - 2) * 0.012 : 0), i < 2 ? osc({ f: hz(n), dur: 0.7, decay: 3 }) : pluck(r, { f: hz(n), dur: 0.8 }), { gain: i < 2 ? 0.25 : 0.35, rev: 0.3 }));
  M(31, mallet({ f: hz(84), dur: 0.9, kind: 'glock' }), { gain: 0.12, rev: 0.5 });

  // 倒れる場面では BGM を残響ごと止める（静けさがオチの前ふりになる）
  duck(s, { t: T.FALL - 0.02, depth: 1, attack: 0.02, hold: T.CUBE - T.FALL - 0.02, release: 0.03, target: 'all' });

  // ================= 効果音 =================
  // --- 部品 ---
  const pop = (f = 520) => layer([osc({ f, f1: f * 2.1, dur: 0.07, decay: 4, attack: 0.001 }), 1], [biquad(noise(r, { dur: 0.006, decay: 3 }), { type: 'highpass', f: 3000 }), 0.3]);
  // 「シュッ」：帯域を下から上へ動かしたノイズ。切り替えの手前から鳴らし、切り替えの瞬間に終わる
  const whoosh = (dur, f0 = 350, f1 = 5000) => biquad(noise(r, { dur, swell: true, peak: 0.8 }), { type: 'bandpass', f: f0, f1, q: 1.3 });
  // 「ドン」：低い胴 + こもったノイズ（重さを出す）
  const impact = () => layer([osc({ f: 95, f1: 36, dur: 0.6, decay: 4.5, curve: 0.4, attack: 0.001 }), 1], [biquad(noise(r, { dur: 0.25, decay: 6 }), { type: 'lowpass', f: 500 }), 0.6]);
  const ding = (n) => layer([mallet({ f: hz(n), dur: 1.1, kind: 'glock' }), 1], [mallet({ f: hz(n + 4), dur: 1.1, kind: 'glock' }), 0.7, 0.035]);
  const whistle = (f, f1, dur, vib = 0.012) => osc({ f, f1, dur, attack: 0.03, decay: 0.8, vib, vibHz: 7 });
  // 金属が当たる「ガシャ」：FM の濁った音 + 低い「ドス」
  const clank = () => layer([fm({ f: 420 + r() * 900, dur: 0.22, ratio: 2.41, index: 3.2, indexDecay: 7, decay: 6, attack: 0.001 }), 0.5], [biquad(noise(r, { dur: 0.1, decay: 6 }), { type: 'lowpass', f: 380 }), 1]);
  const brass = (n, dur) => biquad(layer([osc({ f: hz(n), dur, type: 'saw', attack: 0.015, decay: 2.5 }), 1], [osc({ f: hz(n) * 1.007, dur, type: 'saw', attack: 0.015, decay: 2.5 }), 0.8]), { type: 'lowpass', f: 900, f1: 3600, q: 1.1 });

  // --- 0秒：タイトルが出る ---
  X(0.15, pop(), { gain: 0.3 });

  // --- 自販機が積み上がる：16分音符の拍にそろえ、音階を上がっていく（数が増える感じ） ---
  const slots = new Map();
  for (let n = 1; n < 285; n++) {
    const q = Math.round((dropStart(n, 285) + DROP_FALL) / S16);
    slots.set(q, (slots.get(q) || 0) + 1);
  }
  const firstQ = Math.min(...slots.keys()), lastQ = Math.max(...slots.keys());
  for (const [q, count] of slots) {
    const t = q * S16, p = (q - firstQ) / (lastQ - firstQ);
    X(t, mallet({ f: hz(penta(Math.round(p * 10))), dur: 0.3 }), { gain: 0.2 + 0.06 * Math.min(3, count / 6), pan: (q % 2) * 0.5 - 0.25, rev: 0.2 });
    X(t, osc({ f: 240, f1: 140, dur: 0.07, type: 'tri', decay: 5 }), { gain: 0.1 });
  }

  // --- 場面転換：手前から「シュッ」、切り替えの瞬間に「ドン」 ---
  for (const t of [T.COL, T.CUBE]) {
    X(t - 0.4, whoosh(0.45), { gain: 0.45, rev: 0.2 });
    X(t, impact(), { gain: 0.5 });
    D(t, crash(r, 1.3), { gain: 0.2, rev: 0.4 });
    duck(s, { t, depth: 0.3, release: 0.35 });
  }
  X(T.END - 0.3, whoosh(0.35, 500, 3500), { gain: 0.25, rev: 0.2 });
  [84, 88, 91].forEach((n, i) => X(T.END + i * 0.07, mallet({ f: hz(n), dur: 0.8, kind: 'glock' }), { gain: 0.11, pan: i * 0.4 - 0.4, rev: 0.5 }));

  // --- 上昇：移動中は上がっていく風の音、目印に着いたらチャイム（着くたびに高くなる） ---
  [[T.COL + 0.2, T.TOWER], [T.TOWER_GO, T.SKYTREE], [T.SKYTREE_GO, T.FUJI], [T.FUJI_GO, T.ISS], [T.ISS_GO, T.TOP]].forEach(([a, b], i) => {
    X(a, whoosh(b - a, 250 + i * 120, 1800 + i * 900), { gain: 0.16 + i * 0.02, pan: -0.2, rev: 0.25 });
    X(a, osc({ f: 220 * (1 + i * 0.25), f1: 440 * (1 + i * 0.25), dur: b - a, attack: 0.1, decay: 0.6, type: 'tri' }), { gain: 0.04, rev: 0.3 });
  });
  [[T.TOWER, 84], [T.SKYTREE, 86], [T.FUJI, 88], [T.ISS, 91]].forEach(([t, n]) => X(t, ding(n), { gain: 0.34, pan: 0.3, rev: 0.5 }));
  // 宇宙ステーションの「ピピッ」
  [0.1, 0.22].forEach((d) => X(T.ISS + d, osc({ f: 1760, dur: 0.05, decay: 1, attack: 0.002 }), { gain: 0.07, pan: 0.4, rev: 0.4 }));
  // てっぺん：ドン + シンバル + かけ上がるきらめき
  X(T.TOP, impact(), { gain: 0.5 });
  D(T.TOP, crash(r, 1.6), { gain: 0.22, rev: 0.5 });
  [84, 88, 91, 96, 100, 103, 108].forEach((n, i) => X(T.TOP + 0.05 + i * 0.05, mallet({ f: hz(n), dur: 0.9, kind: 'glock' }), { gain: 0.1, pan: i / 3 - 1, rev: 0.6 }));
  duck(s, { t: T.TOP, depth: 0.25, release: 0.3 });

  // --- 「でも…」：BGM が止まり、音程の下がる音で空気を変える ---
  X(T.FALL - 0.28, osc({ f: 520, f1: 70, dur: 0.4, type: 'saw', decay: 1.5, curve: 1.6 }), { gain: 0.12 });
  X(T.FALL + 0.2, pop(380), { gain: 0.22 });
  // ぐらつき：揺れの往復に合わせた「ギィ」（だんだん大きく）+ ひょろひょろ上がる笛
  for (let i = 0; i < 4; i++) {
    const t = T.FALL + 0.33 + i * (1 / 3), up = i % 2 === 0;
    X(t, biquad(osc({ f: up ? 85 : 120, f1: up ? 130 : 80, dur: 0.26, type: 'saw', attack: 0.03, decay: 1.5 }), { type: 'bandpass', f: 850, f1: 1300, q: 5 }), { gain: 0.5 + i * 0.25, pan: up ? -0.3 : 0.3, rev: 0.15 });
  }
  X(T.FALL + 0.3, whistle(620, 1150, T.BREAK - T.FALL - 0.3, 0.03), { gain: 0.09, rev: 0.25 });
  // 崩れる直前のタム連打
  for (let t = T.BREAK - 0.5; t < T.BREAK - 1e-6; t += S16 / 2) X(t, osc({ f: 130, f1: 95, dur: 0.07, decay: 4, attack: 0.001 }), { gain: 0.08 + 0.5 * ((t - T.BREAK + 0.5) / 0.5) });
  // 崩れる：ドン（低い胴）+ ガシャーン（広い帯域のノイズ）+ 箱ごとの着地音（映像と同じ時刻）
  X(T.BREAK, layer([osc({ f: 100, f1: 30, dur: 1, decay: 4, curve: 0.4, attack: 0.001 }), 1], [biquad(noise(r, { dur: 1.2, decay: 5 }), { type: 'lowpass', f: 7000, f1: 350 }), 1]), { gain: 0.75, rev: 0.25 });
  X(T.BREAK, crash(r, 1.4), { gain: 0.3, rev: 0.4 });
  const boxes = fallPlan();
  boxes.forEach((b, i) => X(T.BREAK + b.land, clank(), { gain: 0.34, pan: 0.15 + 0.6 * (i / boxes.length), rev: 0.3 }));
  // オチの「チーン」
  X(T.LINE, pop(440), { gain: 0.2 });
  X(19, layer([osc({ f: 1318.5, dur: 1.4, decay: 4 }), 1], [osc({ f: 1324, dur: 1.4, decay: 4 }), 0.8], [osc({ f: 1318.5 * 2.76, dur: 0.8, decay: 7 }), 0.25]), { gain: 0.2, rev: 0.7 });

  // --- サイコロが積み上がる：拍にそろえた木の音が上がっていき、「ジャジャーン」で完成 ---
  const steps = Math.round((T.REVEAL - T.GROW) / S16);
  for (let i = 0; i < steps; i++) {
    const t = T.GROW + i * S16;
    X(t, mallet({ f: hz(penta(Math.round((i / (steps - 1)) * 10))), dur: 0.25 }), { gain: 0.24, pan: (i % 2) * 0.4 - 0.2, rev: 0.2 });
    X(t, osc({ f: 220, f1: 140, dur: 0.07, type: 'tri', decay: 5 }), { gain: 0.1 });
  }
  X(T.REVEAL - 1, whoosh(1, 300, 6000), { gain: 0.2, rev: 0.3 });
  [65, 69, 72].forEach((n) => X(T.REVEAL - 0.25, brass(n, 0.2), { gain: 0.1, rev: 0.25 }));
  [55, 67, 71, 74, 79].forEach((n, i) => X(T.REVEAL, brass(n, 1), { gain: 0.16, pan: i / 2 - 1, rev: 0.4 }));
  X(T.REVEAL, impact(), { gain: 0.5 });
  D(T.REVEAL, crash(r, 1.6), { gain: 0.24, rev: 0.5 });
  duck(s, { t: T.REVEAL, depth: 0.25, release: 0.3 });
  // 「半分にも届かない」：ひゅ〜んと下がる笛
  X(T.HALF, whistle(1250, 480, 0.4), { gain: 0.13, rev: 0.3 });
  // 字幕が出るときの小さな「ポッ」
  for (const t of [3, T.COL + 0.2, T.ISS + 0.1, T.CUBE + 0.2, T.END + 0.1, T.DOME]) X(t, pop(), { gain: 0.16, pan: -0.2 });

  return master(s, { wet: 3 });
}
