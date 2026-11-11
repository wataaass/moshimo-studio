// 音をコードで合成するための小さな道具。外部の素材は使わない
export const SR = 44100;
export const noteFreq = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

export function createMix(seconds) {
  const n = Math.round(seconds * SR);
  return { left: new Float32Array(n), right: new Float32Array(n), n };
}

const WAVES = {
  sine: (p) => Math.sin(2 * Math.PI * p),
  tri: (p) => 1 - 4 * Math.abs((p % 1) - 0.5),
  square: (p) => Math.tanh(4 * Math.sin(2 * Math.PI * p)),
  saw: (p) => 2 * (p % 1) - 1,
};

/** 音程のある音。f1 を渡すと f から f1 へ滑らかに変わる。decay は減衰の速さ（大きいほど短い） */
export function tone(mix, { t, f, f1 = f, dur, type = 'sine', gain = 0.2, pan = 0, attack = 0.005, decay = 4, vib = 0, vibHz = 6 }) {
  const i0 = Math.round(t * SR), len = Math.round(dur * SR);
  const gl = gain * Math.min(1, 1 - pan), gr = gain * Math.min(1, 1 + pan);
  const wave = WAVES[type];
  let phase = 0;
  for (let i = 0; i < len; i++) {
    const idx = i0 + i;
    if (idx < 0) continue;
    if (idx >= mix.n) break;
    const x = i / len, s = i / SR;
    const freq = f * Math.pow(f1 / f, x) * (1 + vib * Math.sin(2 * Math.PI * vibHz * s));
    phase += freq / SR;
    const env = Math.min(1, s / attack) * Math.exp(-decay * x) * Math.min(1, (len - i) / (0.004 * SR));
    const v = wave(phase) * env;
    mix.left[idx] += v * gl;
    mix.right[idx] += v * gr;
  }
}

/** ノイズ。lp は低域通過の強さ（0〜1、小さいほどこもる）、hp を true にすると高域だけ残す */
export function noise(mix, rand, { t, dur, gain = 0.2, pan = 0, lp = 1, lp1 = lp, hp = false, attack = 0.002, decay = 5, swell = false }) {
  const i0 = Math.round(t * SR), len = Math.round(dur * SR);
  const gl = gain * Math.min(1, 1 - pan), gr = gain * Math.min(1, 1 + pan);
  let y = 0;
  for (let i = 0; i < len; i++) {
    const idx = i0 + i;
    const x = i / len, s = i / SR;
    const w = rand() * 2 - 1;
    y += (lp + (lp1 - lp) * x) * (w - y);
    if (idx < 0) continue;
    if (idx >= mix.n) break;
    const env = swell ? Math.sin(Math.PI * x) ** 2 : Math.min(1, s / attack) * Math.exp(-decay * x);
    const v = (hp ? w - y : y) * env;
    mix.left[idx] += v * gl;
    mix.right[idx] += v * gr;
  }
}

/** 全体にやまびこを足し、音割れしないように整えて、最後を少しだけフェードアウトする */
export function master(mix, { delay = 0.25, feedback = 0.28, wet = 0.18, fade = 0.4 } = {}) {
  const d = Math.round(delay * SR);
  for (const ch of [mix.left, mix.right]) {
    const echo = new Float32Array(mix.n);
    for (let i = d; i < mix.n; i++) echo[i] = ch[i - d] + echo[i - d] * feedback;
    for (let i = 0; i < mix.n; i++) ch[i] += echo[i] * wet;
  }
  let peak = 0;
  for (const ch of [mix.left, mix.right]) for (let i = 0; i < mix.n; i++) { ch[i] = Math.tanh(ch[i] * 1.2); peak = Math.max(peak, Math.abs(ch[i])); }
  const k = peak > 0 ? 0.89 / peak : 1, f = Math.round(fade * SR);
  for (const ch of [mix.left, mix.right]) for (let i = 0; i < mix.n; i++) ch[i] *= k * Math.min(1, (mix.n - i) / f);
  return mix;
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
