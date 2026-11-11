import * as THREE from 'three';
import { prog, lerp, easeOutBack } from './util.js';

export const W = 1080, H = 1920, FPS = 30;

export function createStage() {
  const canvas = document.getElementById('c');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(W, H, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, W / H, 0.1, 6000);
  return { renderer, scene, camera, overlay: document.getElementById('overlay'), flash: document.getElementById('flash') };
}

/** 縦のグラデーションを背景用テクスチャにする */
export function gradientTexture(stops) {
  const c = document.createElement('canvas');
  c.width = 4; c.height = 512;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 512);
  stops.forEach(([p, col]) => grad.addColorStop(p, col));
  g.fillStyle = grad; g.fillRect(0, 0, 4, 512);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * 字幕。list: [{ from, to, html, top, size, cls }]
 * 返り値の関数に時刻を渡すと、その時刻の見た目になる（CSS アニメは使わない）
 */
export function createCaptions(root, list) {
  const els = list.map((c) => {
    const el = document.createElement('div');
    el.className = 'cap ' + (c.cls || '');
    el.innerHTML = c.html;
    el.style.top = c.top + 'px';
    el.style.fontSize = (c.size || 96) + 'px';
    root.appendChild(el);
    return el;
  });
  const update = (t) => list.forEach((c, i) => {
    const el = els[i];
    const a = prog(t, c.from, c.from + 0.3);
    const out = 1 - prog(t, c.to - 0.15, c.to);
    el.style.opacity = t >= c.from && t < c.to ? Math.min(a * 3, 1) * out : 0;
    el.style.transform = `scale(${lerp(0.6, 1, easeOutBack(a))})`;
  });
  update.els = els;
  return update;
}
