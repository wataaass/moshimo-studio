// もしも日本中の自販機を1か所に積み上げたら？（試作・10秒）
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { gradientTexture, createCaptions } from '../src/engine.js';
import { clamp, lerp, prog, easeInOut, easeOut, rng, pyramidLayout } from '../src/util.js';

export const duration = 10;

const MW = 1.0, MH = 1.83, MD = 0.75; // 自販機1台の大きさ（m）
const LAYERS = 9;
const CUT = 6.5;                      // 遠景に切り替わる時刻
const PILE_H = 156, TOWER_H = 333;    // 試算の山の高さ / 東京タワー（m）

const BODIES = [
  { body: '#e8433a', accent: '#ffffff' },
  { body: '#2f7fe0', accent: '#ffffff' },
  { body: '#f7f7f2', accent: '#e8433a' },
  { body: '#2fae6b', accent: '#fff4c2' },
];
const DRINKS = ['#ff6b5e', '#ffd93b', '#58c4f6', '#7bd66f', '#ff9f43', '#b98cf5', '#ffffff', '#3a3a48'];

function frontTexture({ body, accent }, seed) {
  const r = rng(seed);
  const c = document.createElement('canvas');
  c.width = 280; c.height = 512;
  const g = c.getContext('2d');
  const rr = (x, y, w, h, rad, fill) => { g.fillStyle = fill; g.beginPath(); g.roundRect(x, y, w, h, rad); g.fill(); };
  g.fillStyle = body; g.fillRect(0, 0, 280, 512);
  rr(18, 14, 244, 30, 8, accent);                 // 上の帯
  rr(18, 54, 244, 250, 10, '#16233d');            // 商品の窓
  rr(24, 60, 232, 238, 6, '#dff3ff');
  for (let row = 0; row < 3; row++) {
    rr(24, 60 + row * 80 + 62, 232, 16, 0, '#f2f2f2');   // 値札の段
    for (let i = 0; i < 6; i++) {
      const col = DRINKS[Math.floor(r() * DRINKS.length)];
      rr(32 + i * 37, 60 + row * 80 + 8, 26, 52, 7, col);
      rr(32 + i * 37, 60 + row * 80 + 8, 26, 10, 5, 'rgba(255,255,255,.55)');
      rr(38 + i * 37, 60 + row * 80 + 66, 14, 8, 3, r() < 0.5 ? '#3d7bff' : '#ff4d4d'); // ボタン
    }
  }
  rr(184, 318, 78, 70, 8, '#2a2f3a');             // 支払いパネル
  rr(194, 328, 58, 18, 4, '#9be37d');
  rr(194, 354, 24, 24, 12, '#c9ccd4');
  rr(18, 318, 150, 70, 8, accent);                // 広告面
  rr(28, 330, 130, 12, 4, body); rr(28, 350, 90, 12, 4, body);
  rr(40, 410, 200, 60, 10, '#16233d');            // 取り出し口
  rr(48, 418, 184, 44, 6, '#3b4760');
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function beam(a, b, thick, mat) {
  const d = new THREE.Vector3().subVectors(b, a);
  const m = new THREE.Mesh(new THREE.BoxGeometry(thick, d.length(), thick), mat);
  m.position.copy(a).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  m.castShadow = true;
  return m;
}

function tokyoTower() {
  const g = new THREE.Group();
  const orange = new THREE.MeshStandardMaterial({ color: '#f2552c', roughness: 0.6 });
  const white = new THREE.MeshStandardMaterial({ color: '#f6f3ea', roughness: 0.6 });
  const corner = (r, y, i) => new THREE.Vector3(i & 1 ? r : -r, y, i & 2 ? r : -r);
  const rAt = (y) => lerp(46, 12, Math.pow(y / 150, 0.75));   // 脚の反り
  const ys = [0, 22, 45, 70, 96, 122, 150];
  for (let s = 0; s < ys.length - 1; s++) {
    const mat = s % 2 ? white : orange;
    for (let i = 0; i < 4; i++) g.add(beam(corner(rAt(ys[s]), ys[s], i), corner(rAt(ys[s + 1]), ys[s + 1], i), 6.5, mat));
    const order = [0, 1, 3, 2];
    for (let i = 0; i < 4; i++) {
      const a = order[i], b = order[(i + 1) % 4], y = ys[s + 1], y0 = ys[s];
      g.add(beam(corner(rAt(y), y, a), corner(rAt(y), y, b), 3, mat));
      if (s > 0) g.add(beam(corner(rAt(y0), y0, a), corner(rAt(y), y, b), 2, mat));
    }
  }
  const deck = (y, w, h) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), white); m.position.y = y; m.castShadow = true; g.add(m); };
  deck(150, 34, 14);
  const shaft = (y0, y1, r0, r1, n) => {
    for (let i = 0; i < n; i++) {
      const a = y0 + ((y1 - y0) * i) / n, b = y0 + ((y1 - y0) * (i + 1)) / n;
      const m = new THREE.Mesh(new THREE.CylinderGeometry(lerp(r0, r1, (i + 1) / n), lerp(r0, r1, i / n), b - a, 4), i % 2 ? white : orange);
      m.position.y = (a + b) / 2; m.rotation.y = Math.PI / 4; m.castShadow = true; g.add(m);
    }
  };
  shaft(157, 250, 15, 6, 5);
  deck(250, 15, 9);
  shaft(254, TOWER_H, 4, 0.8, 4);
  return g;
}

export function build({ scene, camera, overlay, flash }) {
  const sky = gradientTexture([[0, '#4aa8ff'], [0.55, '#a9dcff'], [1, '#fff2d8']]);
  scene.background = sky;
  scene.fog = new THREE.Fog('#dff0ff', 60, 400);
  scene.add(new THREE.HemisphereLight('#e6f4ff', '#b7d79a', 1.25));
  const sun = new THREE.DirectionalLight('#fff1d0', 2.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.04;
  scene.add(sun, sun.target);
  const setSun = (pos, size, far) => {
    sun.position.copy(pos);
    Object.assign(sun.shadow.camera, { left: -size, right: size, top: size, bottom: -size, near: 1, far });
    sun.shadow.camera.updateProjectionMatrix();
  };

  // ---------- 近景：自販機が積み上がる ----------
  const near = new THREE.Group();
  scene.add(near);
  const grass = new THREE.Mesh(new THREE.CircleGeometry(600, 48), new THREE.MeshStandardMaterial({ color: '#b9e08f', roughness: 1 }));
  grass.rotation.x = -Math.PI / 2; grass.receiveShadow = true;
  const pad = new THREE.Mesh(new THREE.CircleGeometry(13, 48), new THREE.MeshStandardMaterial({ color: '#ece6d6', roughness: 1 }));
  pad.rotation.x = -Math.PI / 2; pad.position.y = 0.02; pad.receiveShadow = true;
  near.add(grass, pad);

  const geo = new RoundedBoxGeometry(MW, MH, MD, 3, 0.06);
  const slots = pyramidLayout(LAYERS, { w: MW, h: MH, d: MD, gap: 0.06 });
  const r = rng(7);
  // 落とす順番：下の段から。段の中ではランダム。最初の1台は手前中央に固定
  const first = slots.findIndex((s) => s.layer === 0 && Math.abs(s.x) < 0.01 && s.z > 3);
  const order = slots.map((s, i) => ({ i, key: i === first ? -1 : s.layer + r() * 0.9 })).sort((a, b) => a.key - b.key).map((o) => o.i);
  const N = slots.length;
  const items = order.map((si, n) => ({
    ...slots[si],
    yaw: (r() - 0.5) * 0.1,
    variant: n === 0 ? 0 : Math.floor(r() * BODIES.length),
    t0: n === 0 ? -1 : 2.5 + 3.5 * Math.pow(n / (N - 1), 0.8),
  }));
  const meshes = BODIES.map((b, v) => {
    const side = new THREE.MeshStandardMaterial({ color: b.body, roughness: 0.5 });
    const front = new THREE.MeshStandardMaterial({ map: frontTexture(b, 100 + v), roughness: 0.45 });
    const m = new THREE.InstancedMesh(geo, [side, side, side, side, front, side], items.filter((it) => it.variant === v).length);
    m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false;
    near.add(m);
    return m;
  });
  const dummy = new THREE.Object3D();
  const FALL = 0.5, DROP = 24;
  function placeMachines(t) {
    const count = BODIES.map(() => 0);
    let landed = 0;
    for (const it of items) {
      const td = t - it.t0;
      const idx = count[it.variant]++;
      if (td < 0) { dummy.scale.setScalar(0); dummy.updateMatrix(); meshes[it.variant].setMatrixAt(idx, dummy.matrix); continue; }
      const p = clamp(td / FALL);
      const q = clamp((td - FALL) / 0.28);
      const sy = it.t0 < 0 ? 1 : 1 - 0.14 * Math.sin(Math.PI * q) * (1 - q);
      if (p >= 1) landed++;
      dummy.position.set(it.x, it.y + DROP * (1 - p * p) - ((1 - sy) * MH) / 2, it.z);
      dummy.rotation.set(0, it.yaw + (1 - p) * 0.6, (1 - p) * 0.25);
      dummy.scale.set(1 + (1 - sy) * 0.5, sy, 1 + (1 - sy) * 0.5);
      dummy.updateMatrix();
      meshes[it.variant].setMatrixAt(idx, dummy.matrix);
    }
    meshes.forEach((m) => { m.instanceMatrix.needsUpdate = true; });
    return landed;
  }

  // ---------- 遠景：東京タワーと比べる ----------
  const far = new THREE.Group();
  far.visible = false;
  scene.add(far);
  const land = new THREE.Mesh(new THREE.CircleGeometry(5000, 48), new THREE.MeshStandardMaterial({ color: '#cfe3b4', roughness: 1 }));
  land.rotation.x = -Math.PI / 2; land.receiveShadow = true;
  far.add(land);
  // 山：自販機の色のモザイク
  const mosaic = document.createElement('canvas');
  mosaic.width = mosaic.height = 256;
  const mg = mosaic.getContext('2d');
  const mr = rng(3);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 32; x++) {
    mg.fillStyle = BODIES[Math.floor(mr() * BODIES.length)].body;
    mg.fillRect(x * 8, y * 16, 8, 16);
    mg.fillStyle = 'rgba(20,30,60,.35)'; mg.fillRect(x * 8 + 1, y * 16 + 2, 6, 7);
    mg.fillStyle = 'rgba(20,30,60,.18)'; mg.fillRect(x * 8, y * 16, 8, 1); mg.fillRect(x * 8, y * 16, 1, 16);
  }
  const mt = new THREE.CanvasTexture(mosaic);
  mt.colorSpace = THREE.SRGBColorSpace; mt.wrapS = mt.wrapT = THREE.RepeatWrapping; mt.repeat.set(14, 5); mt.anisotropy = 8;
  const pile = new THREE.Mesh(new THREE.ConeGeometry(PILE_H * Math.SQRT2, PILE_H, 4, 1), new THREE.MeshStandardMaterial({ map: mt, roughness: 0.6, flatShading: true }));
  pile.position.set(-105, PILE_H / 2, 0); pile.rotation.y = Math.PI / 4 + 0.25; pile.castShadow = true;
  far.add(pile);
  const tower = tokyoTower();
  tower.position.set(140, 0, 120); tower.rotation.y = 0.5;
  far.add(tower);
  // 街並み
  const cr = rng(11);
  const cityCols = ['#fbf8f1', '#eef2f6', '#dde7f0', '#f8e9d9', '#e6eef5'];
  const city = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.8 }), 900);
  city.castShadow = true; city.receiveShadow = true;
  for (let i = 0, n = 0; n < 900 && i < 20000; i++) {
    const x = (cr() - 0.5) * 4200, z = -2600 + cr() * 2900;
    if (Math.hypot(x + 105, z) < 300 || Math.hypot(x - 140, z - 120) < 110) continue;
    if (z > 120 && Math.abs(x) < 520) continue;            // カメラの手前は空けておく
    const h = 8 + Math.pow(cr(), 4) * 70, w = 22 + cr() * 36, d = 22 + cr() * 36;
    dummy.position.set(x, h / 2, z); dummy.rotation.set(0, cr() * 0.4, 0); dummy.scale.set(w, h, d); dummy.updateMatrix();
    city.setMatrixAt(n, dummy.matrix);
    city.setColorAt(n, new THREE.Color(cityCols[Math.floor(cr() * cityCols.length)]));
    n++;
  }
  far.add(city);

  // ---------- 字幕 ----------
  const caps = createCaptions(overlay, [
    { from: 0.15, to: 2.5, top: 200, size: 80, html: 'もしも<b>日本中の自販機</b>を<br>1か所に積み上げたら？' },
    { from: 2.7, to: CUT, top: 200, size: 170, html: '<b>0</b>台' },
    { from: 3.4, to: CUT, top: 1330, size: 100, html: 'どんどん積む！' },
    { from: CUT + 0.3, to: 9.95, top: 210, size: 120, html: '高さは<b>約150m</b>' },
    { from: CUT + 1.3, to: 9.95, top: 1340, size: 104, html: '東京タワーの<br><b>半分</b>くらい！' },
    { from: CUT + 0.3, to: 9.95, top: 1610, size: 38, cls: 'note', html: '※試作版：台数と高さは概算です' },
  ]);
  const counter = caps.els[1].querySelector('b');

  const eye = new THREE.Vector3(), look = new THREE.Vector3();
  return (t) => {
    const isFar = t >= CUT;
    near.visible = !isFar; far.visible = isFar;
    if (!isFar) {
      const landed = placeMachines(t);
      counter.textContent = String(Math.max(1, landed));
      const k = easeInOut(prog(t, 2.2, 5.4));
      const a = prog(t, 0, 2.6);
      eye.set(lerp(2.1 + a * 0.5, 15, k), lerp(1.3 + a * 0.2, 13, k), lerp(9.6 + a * 0.8, 38, k));
      look.set(0, lerp(1.55, 8.2, k), lerp(3.2, 0, k));
      scene.fog.near = 60; scene.fog.far = 420;
      setSun(new THREE.Vector3(18, 34, 26), 22, 120);
      sun.target.position.set(0, 6, 0);
    } else {
      const k = easeOut(prog(t, CUT, 9.6));
      eye.set(lerp(-90, 30, k), lerp(26, 110, k), lerp(520, 1500, k));
      look.set(lerp(-105, -42, k), lerp(80, 165, k), 0);
      scene.fog.near = 1200; scene.fog.far = 5200;
      setSun(new THREE.Vector3(520, 760, 600), 620, 3000);
      sun.target.position.set(40, 0, 0);
    }
    camera.position.copy(eye);
    camera.lookAt(look);
    caps(t);
    flash.style.opacity = clamp(1 - Math.abs(t - CUT) / 0.18);
  };
}
