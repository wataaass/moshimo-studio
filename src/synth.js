// 音をコードで合成するための道具。外部の素材は使わない。
// 音の作り方の考え方は .claude/skills/moshimo-video/references/sound.md にある
export const SR = 44100;
const TAU = Math.PI * 2;
export const noteFreq = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

// ---------- ミキサー ----------
// drums / music / sfx の3系統に分けて置き、最後に master() でまとめる
export function createSession(seconds) {
  const n = Math.round(seconds * SR);
  const stereo = () => ({ l: new Float32Array(n), r: new Float32Array(n) });
  const names = ['drums', 'music', 'sfx'];
  return {
    n, seconds,
    buses: Object.fromEntries(names.map((k) => [k, stereo()])),
    sends: Object.fromEntries(names.map((k) => [k, stereo()])), // 残響に送る分
    ducks: [],
  };
}

/** モノラルの音 buf を、時刻 t・左右の位置 pan（-1〜1）・残響の量 rev で置く */
export function put(s, bus, t, buf, { gain = 1, pan = 0, rev = 0 } = {}) {
  const i0 = Math.round(t * SR), b = s.buses[bus], v = s.sends[bus];
  const a = ((Math.max(-1, Math.min(1, pan)) + 1) * Math.PI) / 4;
  const gl = gain * Math.cos(a) * Math.SQRT2, gr = gain * Math.sin(a) * Math.SQRT2;
  for (let i = 0; i < buf.length; i++) {
    const idx = i0 + i;
    if (idx < 0) continue;
    if (idx >= s.n) break;
    const x = buf[i];
    b.l[idx] += x * gl; b.r[idx] += x * gr;
    if (rev) { v.l[idx] += x * gl * rev; v.r[idx] += x * gr * rev; }
  }
}

/** 時刻 t から BGM（target: 'music'）または BGM とドラム（'all'）の音量を一時的に下げる */
export function duck(s, { t, depth, attack = 0.01, hold = 0, release = 0.3, target = 'music' }) {
  s.ducks.push({ t, depth, attack, hold, release, target });
}

// ---------- 音色 ----------
const WAVES = {
  sine: (p) => Math.sin(TAU * p),
  tri: (p) => 1 - 4 * Math.abs((((p % 1) + 1) % 1) - 0.5),
  saw: (p) => 2 * (((p % 1) + 1) % 1) - 1,
  square: (p) => Math.tanh(3 * Math.sin(TAU * p)),
};
const tail = (i, len) => Math.min(1, (len - i) / (0.008 * SR)); // 終わりのプチッという音を防ぐ

/** 基本の発振音。f から f1 へ音程を変えられる（curve < 1 で最初に速く変わる） */
export function osc({ f, f1 = f, dur, type = 'sine', attack = 0.004, decay = 4, vib = 0, vibHz = 6, curve = 1 }) {
  const len = Math.round(dur * SR), out = new Float32Array(len), wave = WAVES[type];
  let ph = 0;
  for (let i = 0; i < len; i++) {
    const x = i / len, sec = i / SR;
    ph += (f * Math.pow(f1 / f, Math.pow(x, curve)) * (1 + vib * Math.sin(TAU * vibHz * sec))) / SR;
    out[i] = wave(ph) * Math.min(1, sec / attack) * Math.exp(-decay * x) * tail(i, len);
  }
  return out;
}

/** たたいて鳴らす楽器。marimba は木のあたたかい音、glock は金属のきらきらした音 */
export function mallet({ f, dur = 0.6, kind = 'marimba' }) {
  const parts = kind === 'glock'
    ? [[1, 1, 1], [2.756, 0.42, 1.7], [5.404, 0.2, 2.8], [8.933, 0.08, 4.5]]
    : [[1, 1, 1], [3.98, 0.28, 5], [10.1, 0.07, 12]];
  const len = Math.round(dur * SR), out = new Float32Array(len), rate = (kind === 'glock' ? 4.5 : 6) / dur;
  for (const [ratio, amp, fast] of parts) {
    const pf = f * ratio;
    if (pf > 15000) continue;
    for (let i = 0; i < len; i++) { const sec = i / SR; out[i] += amp * Math.sin(TAU * pf * sec) * Math.exp(-sec * rate * fast); }
  }
  for (let i = 0; i < len; i++) out[i] *= Math.min(1, i / (0.0015 * SR)) * tail(i, len) * 0.7;
  return out;
}

/** FM 音源。ratio と index で金属的な音や電子ピアノのような音を作る */
export function fm({ f, dur, ratio = 1, index = 2, indexDecay = 6, attack = 0.004, decay = 4 }) {
  const len = Math.round(dur * SR), out = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    const x = i / len, sec = i / SR;
    out[i] = Math.sin(TAU * f * sec + index * Math.exp(-indexDecay * x) * Math.sin(TAU * f * ratio * sec)) * Math.min(1, sec / attack) * Math.exp(-decay * x) * tail(i, len);
  }
  return out;
}

/** 弦をはじく音（Karplus-Strong）。ウクレレやギターのような自然な減衰になる */
export function pluck(rand, { f, dur = 0.8, bright = 0.6, sustain = 0.996 }) {
  const len = Math.round(dur * SR), out = new Float32Array(len);
  const delay = SR / f - 0.5, size = Math.ceil(delay) + 2, line = new Float32Array(size);
  let lp = 0;
  for (let i = 0; i < size; i++) { lp += bright * (rand() * 2 - 1 - lp); line[i] = lp; }
  let w = 0, prev = 0;
  for (let i = 0; i < len; i++) {
    const pos = (w - delay + size * 4) % size, i0 = Math.floor(pos), fr = pos - i0;
    const y = line[i0 % size] * (1 - fr) + line[(i0 + 1) % size] * fr;
    line[w] = 0.5 * (y + prev) * sustain;
    prev = y;
    out[i] = y * tail(i, len);
    w = (w + 1) % size;
  }
  return out;
}

/** ノイズ。swell を true にすると、だんだん大きくなって消える形になる */
export function noise(rand, { dur, attack = 0.002, decay = 5, swell = false, peak = 0.5 }) {
  const len = Math.round(dur * SR), out = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    const x = i / len;
    const env = swell ? (x < peak ? Math.pow(x / peak, 2) : Math.pow((1 - x) / (1 - peak), 1.5)) : Math.min(1, i / (attack * SR)) * Math.exp(-decay * x);
    out[i] = (rand() * 2 - 1) * env * tail(i, len);
  }
  return out;
}

/** フィルター（低域通過・高域通過・帯域通過）。f から f1 へ動かせる。buf を書き換えて返す */
export function biquad(buf, { type = 'lowpass', f, f1 = f, q = 0.707 }) {
  let b0 = 0, b1 = 0, b2 = 0, a1 = 0, a2 = 0, x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  const len = buf.length;
  for (let i = 0; i < len; i++) {
    if (i % 32 === 0) {
      const fc = Math.max(20, Math.min(SR * 0.45, f * Math.pow(f1 / f, i / len)));
      const w0 = (TAU * fc) / SR, cos = Math.cos(w0), alpha = Math.sin(w0) / (2 * q), a0 = 1 + alpha;
      if (type === 'lowpass') { b0 = (1 - cos) / 2 / a0; b1 = (1 - cos) / a0; b2 = b0; }
      else if (type === 'highpass') { b0 = (1 + cos) / 2 / a0; b1 = -(1 + cos) / a0; b2 = b0; }
      else { b0 = alpha / a0; b1 = 0; b2 = -alpha / a0; }
      a1 = (-2 * cos) / a0; a2 = (1 - alpha) / a0;
    }
    const x = buf[i], y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    buf[i] = y;
  }
  return buf;
}

/** いくつかの音を重ねて1つにする。[buf, gain, 遅らせる秒数] の並びを渡す */
export function layer(...parts) {
  const len = Math.max(...parts.map(([b, , d = 0]) => b.length + Math.round(d * SR)));
  const out = new Float32Array(len);
  for (const [b, g = 1, d = 0] of parts) { const o = Math.round(d * SR); for (let i = 0; i < b.length; i++) out[o + i] += b[i] * g; }
  return out;
}

// ---------- ドラム ----------
// キック：150Hz から 38Hz へ一気に下がるサイン波 + 出だしの「カチッ」
export const kick = (rand) => layer(
  [osc({ f: 150, f1: 38, dur: 0.22, decay: 6, curve: 0.3, attack: 0.001 }), 1],
  [biquad(noise(rand, { dur: 0.012, decay: 4 }), { type: 'highpass', f: 2500 }), 0.45],
);
// スネア：胴の音 + 1kHz より上のノイズ
export const snare = (rand) => layer(
  [osc({ f: 200, f1: 140, dur: 0.12, decay: 6, attack: 0.001 }), 0.6],
  [biquad(noise(rand, { dur: 0.17, decay: 6 }), { type: 'highpass', f: 1100 }), 0.7],
);
// クラップ：短いノイズを3回 + 余韻
export const clap = (rand) => {
  const hit = () => biquad(noise(rand, { dur: 0.012, decay: 3 }), { type: 'bandpass', f: 1500, q: 1.2 });
  return layer([hit(), 1], [hit(), 0.9, 0.011], [hit(), 0.8, 0.022], [biquad(noise(rand, { dur: 0.14, decay: 7 }), { type: 'bandpass', f: 1400, q: 0.9 }), 0.9, 0.03]);
};
// ハイハット：7kHz より上のノイズ。open で長く伸ばす
export const hat = (rand, open = false) => biquad(noise(rand, { dur: open ? 0.2 : 0.045, decay: open ? 5 : 6 }), { type: 'highpass', f: 7000 });
export const shaker = (rand) => biquad(noise(rand, { dur: 0.06, attack: 0.012, decay: 5 }), { type: 'bandpass', f: 6000, q: 0.8 });
export const crash = (rand, dur = 1.6) => biquad(noise(rand, { dur, decay: 6 }), { type: 'highpass', f: 4500 });

// ---------- 残響（Freeverb 型） ----------
function reverbChannel(input, spread) {
  const n = input.length, out = new Float32Array(n);
  for (const tune of [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617]) {
    const size = tune + spread, line = new Float32Array(size);
    let p = 0, store = 0;
    for (let i = 0; i < n; i++) {
      const y = line[p];
      store = y * 0.8 + store * 0.2;      // 高い音ほど早く消える
      line[p] = input[i] + store * 0.84;  // 部屋の広さ
      out[i] += y;
      p = (p + 1) % size;
    }
  }
  for (const tune of [556, 441, 341, 225]) {
    const size = tune + spread, line = new Float32Array(size);
    let p = 0;
    for (let i = 0; i < n; i++) {
      const b = line[p], x = out[i];
      out[i] = b - x;
      line[p] = x + b * 0.5;
      p = (p + 1) % size;
    }
  }
  return out;
}

// ---------- 仕上げ ----------
/** 3系統をまとめ、残響を足し、音割れしないように整える。stats に系統ごとの音量を入れて返す */
export function master(s, { wet = 1, fade = 0.25 } = {}) {
  const { n } = s;
  const gM = new Float32Array(n).fill(1), gD = new Float32Array(n).fill(1);
  for (const d of s.ducks) {
    const i0 = Math.round(d.t * SR), a = Math.round(d.attack * SR), h = Math.round(d.hold * SR), len = a + h + Math.round(d.release * 5 * SR);
    for (let i = 0; i < len; i++) {
      const idx = i0 + i;
      if (idx < 0) continue;
      if (idx >= n) break;
      const shape = i < a ? i / a : i < a + h ? 1 : Math.exp(-(i - a - h) / (d.release * SR));
      const g = 1 - d.depth * shape;
      gM[idx] *= g;
      if (d.target === 'all') gD[idx] *= g;
    }
  }
  const rms = (a, b) => { let e = 0; for (let i = 0; i < n; i++) e += a[i] * a[i] + b[i] * b[i]; return 10 * Math.log10(e / (2 * n) + 1e-12); };
  const stats = {};
  const left = new Float32Array(n), right = new Float32Array(n), send = new Float32Array(n);
  for (const [name, gain] of [['drums', gD], ['music', gM], ['sfx', null]]) {
    const b = s.buses[name], v = s.sends[name];
    for (let i = 0; i < n; i++) {
      const g = gain ? gain[i] : 1;
      b.l[i] *= g; b.r[i] *= g;
      left[i] += b.l[i]; right[i] += b.r[i];
      send[i] += (v.l[i] + v.r[i]) * 0.5 * g * 0.015;
    }
    stats[name] = rms(b.l, b.r);
  }
  const wl = reverbChannel(send, 0), wr = reverbChannel(send, 23);
  stats.reverb = rms(wl, wr) + 20 * Math.log10(wet);
  for (let i = 0; i < n; i++) { left[i] += wl[i] * wet; right[i] += wr[i] * wet; }
  biquad(left, { type: 'highpass', f: 28 }); biquad(right, { type: 'highpass', f: 28 });
  let peak = 0;
  for (const ch of [left, right]) for (let i = 0; i < n; i++) { ch[i] = Math.tanh(ch[i] * 1.35); peak = Math.max(peak, Math.abs(ch[i])); }
  const k = peak > 0 ? 0.89 / peak : 1, f = Math.round(fade * SR);
  for (const ch of [left, right]) for (let i = 0; i < n; i++) ch[i] *= k * Math.min(1, (n - i) / f);
  stats.mix = rms(left, right);
  return { left, right, stats };
}

/** 16bit ステレオの WAV にする */
export function wavBytes(left, right) {
  const n = left.length, buf = Buffer.alloc(44 + n * 4);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 4, 40);
  const q = (v) => Math.round(Math.max(-1, Math.min(1, v)) * 32767);
  for (let i = 0; i < n; i++) { buf.writeInt16LE(q(left[i]), 44 + i * 4); buf.writeInt16LE(q(right[i]), 46 + i * 4); }
  return buf;
}
