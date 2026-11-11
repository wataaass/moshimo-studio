// 純粋な計算だけを置く（テスト対象）
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
/** t が a→b に進む割合を 0〜1 で返す */
export const prog = (t, a, b) => clamp((t - a) / (b - a));
export const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOut = (t) => 1 - Math.pow(1 - t, 3);
export const easeOutBack = (t) => {
  const c = 1.70158;
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
};

/** 種つき乱数（mulberry32）。同じ種なら毎回同じ動画になる */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 箱をピラミッド状に積むときの各箱の中心座標。下の段から順に返す */
export function pyramidLayout(layers, { w, h, d, gap = 0.05 }) {
  const out = [];
  for (let k = 0; k < layers; k++) {
    const n = layers - k;
    for (let ix = 0; ix < n; ix++) {
      for (let iz = 0; iz < n; iz++) {
        out.push({
          x: (ix - (n - 1) / 2) * (w + gap),
          y: k * h + h / 2,
          z: (iz - (n - 1) / 2) * (d + gap),
          layer: k,
        });
      }
    }
  }
  return out;
}

/** 体積 V の四角錐（斜面45度）の高さ */
export const pyramidHeight = (volume) => Math.cbrt((3 * volume) / 4);
