// 映像と音で共有する時刻表。120BPM（1拍0.5秒）の拍に合わせてある
import { rng } from '../src/util.js';

export const DURATION = 32;
export const T = {
  DROP: 2.5,    // 自販機が降りはじめる
  COL: 6,       // 縦に積む場面へ
  TOWER: 8, TOWER_GO: 8.4,
  SKYTREE: 9, SKYTREE_GO: 9.5,
  FUJI: 10.5, FUJI_GO: 11,
  ISS: 12.5, ISS_GO: 13.5,
  TOP: 14.5,    // てっぺんに着く
  FALL: 16,     // ぐらつきはじめる
  BREAK: 17.5,  // 崩れる
  LINE: 18,     // 「もちろん倒れます」
  CUBE: 20,     // まとめて積む場面へ
  GROW: 20.4,   // サイコロが積み上がりはじめる
  REVEAL: 22,   // サイコロ完成
  HALF: 24,     // 「半分にも届かない」
  END: 28,      // まとめ
  DOME: 29,     // 「東京ドーム約2杯分」
};

/** n 台目（1〜total-1）の自販機が降りはじめる時刻。着地はその 0.5 秒後 */
export const DROP_FALL = 0.5;
export const dropStart = (n, total) => T.DROP + 2.9 * Math.pow(n / (total - 1), 0.8);

// 倒れる塔。映像と音で同じ箱の動きを使うので、ここで決める
export const FALL = { count: 24, boxH: 1.83, boxW: 1.0, gravity: 60, wobbleHz: 1.5 };
export function fallPlan() {
  const r = rng(31);
  const { count, boxH, boxW, gravity: g } = FALL;
  return Array.from({ length: count }, (_, i) => {
    const y0 = (i + 0.5) * boxH;
    const variant = Math.floor(r() * 4);
    const vx = 0.2 * y0 + r() * 3, vy = r() * 8, vz = (r() - 0.5) * 9;
    const land = (vy + Math.sqrt(vy * vy + 2 * g * (y0 - boxW / 2))) / g; // 崩れてから着地までの秒数
    return { y0, variant, vx, vy, vz, land, turns: 1 + 2 * Math.floor(r() * 3), yaw: (r() - 0.5) * 1.2 };
  });
}
