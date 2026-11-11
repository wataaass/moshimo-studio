// 「自販機を積み上げたら」で使う数字。出典は scenes/jihanki.md にまとめてある
export const FACTS = {
  count: 1_950_000, // 清涼飲料自販機の設置台数（2025年末・速報値、飲料総研）
  w: 1.03, d: 0.72, h: 1.83, // 1台の外形寸法 m（SDRS CVA-PN6330ND）
  iss: 400_000,     // ISS の高度 m（JAXA）
  tower: 333,       // 東京タワー m
  skytree: 634,     // 東京スカイツリー m
  fuji: 3776,       // 富士山 m
  dome: 1_240_000,  // 東京ドームの容積 m³
};

export function derive(f = FACTS) {
  const stack = f.count * f.h;                 // 縦1列に積んだ高さ m
  const volume = f.count * f.w * f.d * f.h;    // すき間なく並べた体積 m³
  const cube = Math.cbrt(volume);              // 同じ体積の立方体の一辺 m
  return { stack, volume, cube, issRatio: stack / f.iss, domes: volume / f.dome, towerRatio: cube / f.tower };
}
