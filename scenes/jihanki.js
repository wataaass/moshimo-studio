// もしも日本中の自販機をぜんぶ積み上げたら？（本編・32秒）
// 数字は jihanki.facts.js、出典は jihanki.md
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { gradientTexture, createCaptions, createTags } from '../src/engine.js';
import { clamp, lerp, prog, easeInOut, easeOut, rng, pyramidLayout } from '../src/util.js';
import { FACTS, derive } from './jihanki.facts.js';

export const duration = 32;

const D = derive();
const MW = 1.0, MH = 1.83, MD = 0.75; // 近景で使う自販機モデルの大きさ（m）
const LAYERS = 9;
// 場面の切り替わり
const T_COL = 6.2;   // 縦に積む
const T_FALL = 16.3; // 倒れる
const T_CUBE = 20.5; // まとめて積む
const T_END = 28;    // まとめ
const CUTS = [T_COL, T_FALL, T_CUBE];

const BODIES = [
  { body: '#e8433a', accent: '#ffffff' },
  { body: '#2f7fe0', accent: '#ffffff' },
  { body: '#f7f7f2', accent: '#e8433a' },
  { body: '#2fae6b', accent: '#fff4c2' },
];
const DRINKS = ['#ff6b5e', '#ffd93b', '#58c4f6', '#7bd66f', '#ff9f43', '#b98cf5', '#ffffff', '#3a3a48'];

function frontCanvas({ body, accent }, seed) {
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
  return c;
}
const canvasTex = (c) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };

function beam(a, b, thick, mat) {
  const d = new THREE.Vector3().subVectors(b, a);
  const m = new THREE.Mesh(new THREE.BoxGeometry(thick, d.length(), thick), mat);
  m.position.copy(a).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  m.castShadow = true;
  return m;
}

/** 東京タワー。高さ 333（1単位 = 1m） */
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
  shaft(254, FACTS.tower, 4, 0.8, 4);
  return g;
}

const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, ...extra });

export function build({ scene, camera, overlay, flash }) {
  const sky = gradientTexture([[0, '#4aa8ff'], [0.55, '#a9dcff'], [1, '#fff2d8']]);
  const fog = new THREE.Fog('#dff0ff', 60, 400);
  scene.add(new THREE.HemisphereLight('#e6f4ff', '#b7d79a', 1.25));
  const sun = new THREE.DirectionalLight('#fff1d0', 2.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.04;
  scene.add(sun, sun.target);
  const setSun = (x, y, z, size, far, tx = 0, ty = 0) => {
    sun.position.set(x, y, z);
    sun.target.position.set(tx, ty, 0);
    Object.assign(sun.shadow.camera, { left: -size, right: size, top: size, bottom: -size, near: 1, far });
    sun.shadow.camera.updateProjectionMatrix();
  };

  const fronts = BODIES.map((b, v) => frontCanvas(b, 100 + v));
  const machineMats = BODIES.map((b, v) => {
    const side = std(b.body, { roughness: 0.5 });
    const front = new THREE.MeshStandardMaterial({ map: canvasTex(fronts[v]), roughness: 0.45 });
    return [side, side, side, side, front, side];
  });
  const machineGeo = new RoundedBoxGeometry(MW, MH, MD, 3, 0.06);
  const dummy = new THREE.Object3D();
  const grassMat = std('#b9e08f', { roughness: 1 });
  const padMat = std('#ece6d6', { roughness: 1 });
  const disc = (r, mat, y = 0) => { const m = new THREE.Mesh(new THREE.CircleGeometry(r, 48), mat); m.rotation.x = -Math.PI / 2; m.position.y = y; m.receiveShadow = true; return m; };

  // ========== 1. 近景：1台 → どんどん増える ==========
  const near = new THREE.Group();
  scene.add(near);
  near.add(disc(600, grassMat), disc(13, padMat, 0.02));
  const slots = pyramidLayout(LAYERS, { w: MW, h: MH, d: MD, gap: 0.06 });
  const r = rng(7);
  const first = slots.findIndex((s) => s.layer === 0 && Math.abs(s.x) < 0.01 && s.z > 3);
  const order = slots.map((s, i) => ({ i, key: i === first ? -1 : s.layer + r() * 0.9 })).sort((a, b) => a.key - b.key).map((o) => o.i);
  const N = slots.length;
  const items = order.map((si, n) => ({
    ...slots[si],
    yaw: (r() - 0.5) * 0.1,
    variant: n === 0 ? 0 : Math.floor(r() * BODIES.length),
    t0: n === 0 ? -1 : 2.5 + 3.3 * Math.pow(n / (N - 1), 0.8),
  }));
  const meshes = machineMats.map((mats, v) => {
    const m = new THREE.InstancedMesh(machineGeo, mats, items.filter((it) => it.variant === v).length);
    m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false;
    near.add(m);
    return m;
  });
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

  // ========== 2. 縦に積む：地上から宇宙まで（高さは対数のものさし） ==========
  // 実際の比率では塔が細すぎて見えないので、高さ h(m) を y = 40·log10(h) に置き換えて描く
  const yOf = (h) => 40 * Math.log10(h);
  const Y_TOP = yOf(D.stack);
  const col = new THREE.Group();
  col.visible = false;
  scene.add(col);
  const COLX = -3;
  // 地球
  const ec = document.createElement('canvas');
  ec.width = 1024; ec.height = 512;
  const eg = ec.getContext('2d');
  eg.fillStyle = '#3f93e6'; eg.fillRect(0, 0, 1024, 512);
  const er = rng(21);
  eg.fillStyle = '#8fd07a';
  for (let i = 0; i < 70; i++) { eg.beginPath(); eg.ellipse(er() * 1024, 40 + er() * 430, 20 + er() * 70, 10 + er() * 34, er() * 3, 0, 7); eg.fill(); }
  eg.fillRect(0, 0, 1024, 46);
  const earth = new THREE.Mesh(new THREE.SphereGeometry(500, 64, 48), new THREE.MeshStandardMaterial({ map: canvasTex(ec), roughness: 0.9 }));
  earth.position.set(COLX, -500, 0);
  const halo = new THREE.Mesh(new THREE.SphereGeometry(512, 48, 32), new THREE.MeshBasicMaterial({ color: '#8fd0ff', transparent: true, opacity: 0.22, side: THREE.BackSide }));
  halo.position.copy(earth.position);
  col.add(earth, halo);
  // 自販機の塔（4色を縦に並べた模様をくり返す）
  const stackC = document.createElement('canvas');
  stackC.width = 280; stackC.height = 2048;
  const sg = stackC.getContext('2d');
  [0, 1, 3, 2].forEach((v, i) => sg.drawImage(fronts[v], 0, i * 512));
  const stackTex = canvasTex(stackC);
  stackTex.wrapT = THREE.RepeatWrapping;
  const CW = 2.2, CH = CW * (FACTS.h / FACTS.w);
  stackTex.repeat.set(1, Y_TOP / (CH * 4));
  const colSide = std('#d9dde6', { roughness: 0.5 });
  const column = new THREE.Mesh(new THREE.BoxGeometry(CW, Y_TOP, 1.6), [colSide, colSide, colSide, colSide, new THREE.MeshStandardMaterial({ map: stackTex, roughness: 0.45 }), colSide]);
  column.position.set(COLX, Y_TOP / 2, 0);
  col.add(column);
  // 目印（雲に乗った小さな模型）
  const cloudMat = std('#ffffff', { roughness: 1 });
  const puff = (x, y, z, s) => { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), cloudMat); m.position.set(x, y, z); m.scale.set(s * 1.6, s * 0.55, s); return m; };
  const IX = 3.6;
  const stand = (obj, topY, height) => {
    const g = new THREE.Group();
    obj.position.y = topY - height;
    g.add(obj, puff(0, topY - height - 0.3, 0, 2.3), puff(1.9, topY - height - 0.1, 0.3, 1.5), puff(-1.9, topY - height - 0.2, -0.2, 1.6));
    g.position.x = IX;
    col.add(g);
  };
  const tw = tokyoTower(); tw.scale.setScalar(8 / FACTS.tower); tw.rotation.y = 0.5;
  stand(tw, yOf(FACTS.tower), 8);
  const st = new THREE.Group();
  const stMat = std('#e6eef6', { roughness: 0.4 });
  const stBody = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.95, 6.6, 12), stMat); stBody.position.y = 3.3;
  const stD1 = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.55, 0.7, 16), std('#9fb6d6')); stD1.position.y = 5.2;
  const stD2 = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.4, 0.5, 16), std('#9fb6d6')); stD2.position.y = 6.3;
  const stTop = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.18, 2.2, 8), stMat); stTop.position.y = 7.7;
  st.add(stBody, stD1, stD2, stTop);
  stand(st, yOf(FACTS.skytree), 8.8);
  const fj = new THREE.Group();
  const fjBody = new THREE.Mesh(new THREE.ConeGeometry(4.6, 5.4, 24, 1, true), std('#5b7fd1', { side: THREE.DoubleSide })); fjBody.position.y = 2.7;
  const fjCap = new THREE.Mesh(new THREE.ConeGeometry(1.75, 2.05, 24), std('#ffffff')); fjCap.position.y = 4.42;
  fj.add(fjBody, fjCap);
  stand(fj, yOf(FACTS.fuji), 5.45);
  // ISS
  const iss = new THREE.Group();
  const issBody = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 4.4, 16), std('#e9edf3', { roughness: 0.35 })); issBody.rotation.z = Math.PI / 2;
  const issNode = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 2.6, 16), std('#cfd6e0', { roughness: 0.35 })); issNode.rotation.x = Math.PI / 2;
  const truss = new THREE.Mesh(new THREE.BoxGeometry(9.5, 0.22, 0.22), std('#9aa6b8')); truss.position.y = 0.9;
  iss.add(issBody, issNode, truss);
  for (const sx of [-4.1, -2.6, 2.6, 4.1]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(1.1, 3.6, 0.06), std('#2b56c9', { roughness: 0.3, emissive: '#10214f' }));
    p.position.set(sx, 0.9, 0); iss.add(p);
  }
  const Y_ISS = yOf(FACTS.iss);
  iss.scale.setScalar(0.62); iss.rotation.set(0.25, -0.5, 0.12);
  col.add(iss);
  // 雲と星
  const cr0 = rng(5);
  for (let i = 0; i < 16; i++) col.add(puff((cr0() - 0.5) * 34, 118 + cr0() * 40, -8 - cr0() * 30, 1.6 + cr0() * 2.4));
  const starPos = [];
  const sr = rng(9);
  for (let i = 0; i < 700; i++) {
    const a = sr() * Math.PI * 2, b = Math.acos(sr() * 2 - 1);
    starPos.push(900 * Math.sin(b) * Math.cos(a), 250 + 900 * Math.cos(b), 900 * Math.sin(b) * Math.sin(a));
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: '#ffffff', size: 3.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false }));
  col.add(stars);
  const SKY = [[0, '#7cc3ff'], [120, '#5aa9f5'], [150, '#3566c9'], [190, '#0c1a4a'], [226, '#03050f']].map(([y, c]) => [y, new THREE.Color(c)]);
  const skyCol = new THREE.Color();
  const skyAt = (y) => {
    for (let i = 0; i < SKY.length - 1; i++) if (y <= SKY[i + 1][0]) return skyCol.copy(SKY[i][1]).lerp(SKY[i + 1][1], clamp((y - SKY[i][0]) / (SKY[i + 1][0] - SKY[i][0])));
    return skyCol.copy(SKY.at(-1)[1]);
  };
  // カメラの高さ：目印ごとに止まりながら上がる
  const OFF = 6; // カメラの高さ + OFF を「いまの高さ」として表示する
  const stop = (h) => yOf(h) - OFF;
  const KEYS = [[T_COL, 4], [7.8, stop(FACTS.tower)], [8.3, stop(FACTS.tower)], [9.0, stop(FACTS.skytree)], [9.7, stop(FACTS.skytree)], [10.7, stop(FACTS.fuji)], [11.4, stop(FACTS.fuji)], [12.7, stop(FACTS.iss)], [13.8, stop(FACTS.iss)], [14.8, Y_TOP - OFF]];
  const camY = (t) => {
    for (let i = 0; i < KEYS.length - 1; i++) if (t <= KEYS[i + 1][0]) return lerp(KEYS[i][1], KEYS[i + 1][1], easeInOut(prog(t, KEYS[i][0], KEYS[i + 1][0])));
    return KEYS.at(-1)[1];
  };

  // ========== 3. 倒れる ==========
  const fall = new THREE.Group();
  fall.visible = false;
  scene.add(fall);
  fall.add(disc(900, grassMat), disc(16, padMat, 0.02));
  const FN = 24, FH = FN * MH, T_BREAK = T_FALL + 1.4, G = 60, W_OMEGA = Math.PI * 2 * 1.3;
  const fr = rng(31);
  const wobble = (y0, t) => 3.5 * Math.pow(prog(t, T_FALL, T_BREAK), 2) * Math.pow(y0 / FH, 2) * Math.sin(W_OMEGA * (t - T_FALL));
  const DIR = Math.sign(Math.sin(W_OMEGA * (T_BREAK - T_FALL))) || 1;
  const boxes = Array.from({ length: FN }, (_, i) => {
    const y0 = (i + 0.5) * MH;
    const mesh = new THREE.Mesh(machineGeo, machineMats[Math.floor(fr() * BODIES.length)]);
    mesh.castShadow = true; mesh.receiveShadow = true;
    fall.add(mesh);
    const vx = DIR * (0.2 * y0 + fr() * 3), vy = fr() * 8, vz = (fr() - 0.5) * 9;
    const tl = (vy + Math.sqrt(vy * vy + 2 * G * (y0 - MW / 2))) / G; // 着地までの時間
    return { mesh, y0, vx, vy, vz, tl, turns: 1 + 2 * Math.floor(fr() * 3), yaw: (fr() - 0.5) * 1.2 };
  });
  function placeFall(t) {
    for (const b of boxes) {
      if (t < T_BREAK) {
        const wx = wobble(b.y0, t);
        b.mesh.position.set(wx, b.y0, 0);
        b.mesh.rotation.set(0, 0, (-wx / (b.y0 + 4)) * 1.6);
      } else {
        const tau = Math.min(t - T_BREAK, b.tl), k = tau / b.tl;
        b.mesh.position.set(wobble(b.y0, T_BREAK) + b.vx * tau, Math.max(MW / 2, b.y0 + b.vy * tau - 0.5 * G * tau * tau), b.vz * tau);
        b.mesh.rotation.set(0, b.yaw * k, -DIR * (Math.PI / 2) * b.turns * k);
      }
    }
  }

  // ========== 4. まとめて積む：東京タワーと比べる（1単位 = 1m、同じ奥行きに置く） ==========
  const far = new THREE.Group();
  far.visible = false;
  scene.add(far);
  far.add(disc(5000, std('#cfe3b4', { roughness: 1 })));
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
  const mt = canvasTex(mosaic);
  mt.wrapS = mt.wrapT = THREE.RepeatWrapping; mt.repeat.set(4, 4.7);
  const CUBE = D.cube, CUBEX = -95, TOWERX = 105;
  const cube = new THREE.Mesh(new THREE.BoxGeometry(CUBE, CUBE, CUBE), new THREE.MeshStandardMaterial({ map: mt, roughness: 0.6 }));
  cube.position.x = CUBEX; cube.rotation.y = 0.5; cube.castShadow = true;
  far.add(cube);
  const tower = tokyoTower();
  tower.position.x = TOWERX; tower.rotation.y = 0.5;
  far.add(tower);
  const cr = rng(11);
  const cityCols = ['#fbf8f1', '#eef2f6', '#dde7f0', '#f8e9d9', '#e6eef5'];
  const city = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), std('#ffffff', { roughness: 0.8 }), 900);
  city.castShadow = true; city.receiveShadow = true;
  for (let i = 0, n = 0; n < 900 && i < 20000; i++) {
    const x = (cr() - 0.5) * 4200, z = -2600 + cr() * 2500;
    if (Math.hypot(x - CUBEX, z) < 190 || Math.hypot(x - TOWERX, z) < 120) continue;
    if (z > -120 && Math.abs(x) < 520) continue;            // 比べる2つの手前は空けておく
    const h = 8 + Math.pow(cr(), 4) * 70, w = 22 + cr() * 36, d = 22 + cr() * 36;
    dummy.position.set(x, h / 2, z); dummy.rotation.set(0, cr() * 0.4, 0); dummy.scale.set(w, h, d); dummy.updateMatrix();
    city.setMatrixAt(n, dummy.matrix);
    city.setColorAt(n, new THREE.Color(cityCols[Math.floor(cr() * cityCols.length)]));
    n++;
  }
  far.add(city);

  // ========== 字幕とラベル ==========
  const END = duration - 0.05;
  const caps = createCaptions(overlay, [
    { from: 0.15, to: 2.5, top: 196, size: 78, html: 'もしも<b>日本中の自販機</b>を<br>ぜんぶ積み上げたら？' },
    { from: 2.7, to: T_COL, top: 180, size: 150, html: '<b>1</b>台' },
    { from: 3.3, to: T_COL, top: 1330, size: 84, html: '飲み物の自販機は<br>全国に<b>約195万台</b>' },
    { from: 3.3, to: T_COL, top: 1570, size: 36, cls: 'note', html: '※2025年末の速報値（飲料総研調べ）' },

    { from: T_COL + 0.2, to: T_FALL, top: 190, size: 112, html: '高さ <b>0m</b>' },
    { from: T_COL + 0.2, to: 7.9, top: 1340, size: 92, html: 'まっすぐ<b>縦</b>に積むと…' },
    { from: 12.8, to: 14.2, top: 1340, size: 96, html: '<b>宇宙ステーション</b>も<br>通りこして…' },
    { from: 14.9, to: T_FALL, top: 1340, size: 96, html: '宇宙ステーションの<br><b>約9倍</b>の高さ！' },
    { from: 14.9, to: T_FALL, top: 1590, size: 36, cls: 'note', html: '※1台の高さ1.83m × 195万台で計算' },

    { from: T_FALL + 0.2, to: T_BREAK + 0.1, top: 200, size: 130, html: 'でも…' },
    { from: T_BREAK + 0.2, to: T_CUBE, top: 200, size: 108, html: 'もちろん<b>倒れます</b>' },

    { from: T_CUBE + 0.2, to: 23.3, top: 196, size: 92, html: 'じゃあ<b>ぎっしり</b><br>まとめて積むと？' },
    { from: 23.4, to: T_END, top: 196, size: 96, html: '一辺<b>約138m</b>の<br>サイコロ形に！' },
    { from: 24.8, to: T_END, top: 1340, size: 88, html: '東京タワーの<br><b>半分にも届かない</b>' },

    { from: T_END + 0.1, to: END, top: 196, size: 84, html: '縦なら<b>宇宙</b>まで届くのに<br>まとめると<b>意外と小さい</b>' },
    { from: T_END + 0.9, to: END, top: 1340, size: 76, html: '体積は<br><b>東京ドーム約2杯分</b>' },
    { from: T_END + 0.9, to: END, top: 1560, size: 32, cls: 'note', html: '※飲料自販機195万台、1台を<br>幅1.03×奥行0.72×高さ1.83mとして計算' },
  ]);
  const counter = caps.els[1].querySelector('b');
  const meter = caps.els[4].querySelector('b');
  const V = (x, y, z = 0) => new THREE.Vector3(x, y, z);
  const tagUnder = (h, drop) => V(IX, yOf(h) - drop, 0);
  const issTagPos = V(0, 0, 0);
  const tags = createTags(overlay, [
    { from: 7.3, to: 9.4, pos: tagUnder(FACTS.tower, 10.2), html: '東京タワー <b>333m</b>' },
    { from: 8.7, to: 10.2, pos: V(IX, yOf(FACTS.skytree) + 2.2), html: 'スカイツリー <b>634m</b>' },
    { from: 10.2, to: 12.0, pos: tagUnder(FACTS.fuji, 8.6), html: '富士山 <b>3,776m</b>' },
    { from: 12.2, to: 14.4, pos: issTagPos, html: '国際宇宙ステーション<br><b>約400km</b>' },
    { from: 23.4, to: T_END, pos: V(CUBEX, CUBE / 2), html: '自販機<br><b>約138m</b>' },
    { from: 23.4, to: T_END, pos: V(TOWERX, 205), html: '東京タワー<br><b>333m</b>' },
  ]);
  const fmtCount = (n) => (n >= 10000 ? Math.round(n / 10000) + '万' : n.toLocaleString('en-US'));
  const fmtHeight = (h) => {
    if (h < 1000) return Math.round(h) + 'm';
    const km = h / 1000;
    return (km < 10 ? km.toFixed(1) : Math.round(km >= 1000 ? km / 10 : km) * (km >= 1000 ? 10 : 1)).toLocaleString('en-US') + 'km';
  };

  const eye = new THREE.Vector3(), look = new THREE.Vector3();
  return (t) => {
    const phase = t < T_COL ? 0 : t < T_FALL ? 1 : t < T_CUBE ? 2 : 3;
    near.visible = phase === 0; col.visible = phase === 1; fall.visible = phase === 2; far.visible = phase === 3;
    scene.fog = phase === 1 ? null : fog;
    scene.background = phase === 1 ? skyCol : sky;

    if (phase === 0) {
      const landed = placeMachines(t);
      const p = prog(t, 2.5, 6.0);
      counter.textContent = fmtCount(p >= 1 ? FACTS.count : Math.max(1, Math.round(Math.exp(Math.log(FACTS.count) * Math.pow(p, 0.8))), landed));
      const k = easeInOut(prog(t, 2.2, 5.4));
      const a = prog(t, 0, 2.6);
      eye.set(lerp(2.1 + a * 0.5, 15, k), lerp(1.3 + a * 0.2, 13, k), lerp(9.6 + a * 0.8, 38, k));
      look.set(0, lerp(1.55, 8.2, k), lerp(3.2, 0, k));
      fog.near = 60; fog.far = 420;
      setSun(18, 34, 26, 22, 120, 0, 6);
    } else if (phase === 1) {
      const y = camY(t);
      const k = easeInOut(prog(t, 14.8, T_FALL - 0.1)); // 最後に引いて地球を見せる
      eye.set(lerp(0.6, 44, k), lerp(y + 1, 286, k), lerp(34, 165, k));
      look.set(lerp(0.6, 4, k), lerp(y + 3, 176, k), 0);
      skyAt(y);
      stars.material.opacity = prog(y, 165, 215);
      halo.material.opacity = 0.1 + 0.25 * prog(y, 150, 220);
      iss.position.set(IX + 0.4 + (t - 13.2) * 0.5, Y_ISS + 0.5, -1);
      issTagPos.set(iss.position.x - 0.6, Y_ISS - 3.6, 0);
      meter.textContent = fmtHeight(t >= 14.8 ? D.stack : Math.min(D.stack, Math.pow(10, (y + OFF) / 40)));
      setSun(60, y + 80, 90, 60, 400, 0, y);
    } else if (phase === 2) {
      placeFall(t);
      const pan = easeOut(prog(t, T_BREAK, T_BREAK + 0.9));
      const shake = Math.sin(t * 70) * 0.5 * (1 - prog(t, T_BREAK + 0.5, T_BREAK + 1.5)) * (t > T_BREAK + 0.5 ? 1 : 0);
      eye.set(DIR * 7 * pan + 10, 12 + shake, 96);
      look.set(DIR * 7 * pan, lerp(24, 13, pan) + shake, 0);
      fog.near = 300; fog.far = 1500;
      setSun(40, 80, 60, 55, 300, 0, 20);
    } else {
      const g = easeOut(prog(t, T_CUBE + 0.4, 23.2)); // 下から積み上がる
      cube.scale.y = Math.max(0.001, g);
      cube.position.y = (CUBE * g) / 2;
      const k = easeInOut(prog(t, T_CUBE, 24.4));
      const d = (t - T_END) * (t > T_END ? 1 : 0);
      eye.set(lerp(-95, 5, k) + d * 5, lerp(60, 136, k), lerp(430, 1200, k) + d * 8);
      look.set(lerp(-95, 5, k), lerp(70, 136, k), 0);
      fog.near = 1200; fog.far = 5200;
      setSun(520, 760, 600, 620, 3000, 40, 0);
    }
    camera.position.copy(eye);
    camera.lookAt(look);
    caps(t);
    tags(t, camera);
    flash.style.opacity = Math.max(...CUTS.map((c) => clamp(1 - Math.abs(t - c) / 0.18)));
  };
}
