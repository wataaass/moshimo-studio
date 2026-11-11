import { createStage, FPS } from './engine.js';

const name = new URLSearchParams(location.search).get('scene') || 'jihanki';
const mod = await import(`/scenes/${name}.js`);
const stage = createStage();
const update = mod.build(stage);
await document.fonts.ready;

const frame = (i) => {
  update(i / FPS);
  stage.renderer.render(stage.scene, stage.camera);
};
window.__frames = Math.round(mod.duration * FPS);
window.__renderFrame = frame;
frame(0);
window.__ready = true;

// ブラウザで直接開いたときは再生する（?t=秒 で静止）
const q = new URLSearchParams(location.search);
if (q.has('t')) frame(Math.round(parseFloat(q.get('t')) * FPS));
else if (!navigator.webdriver) {
  const t0 = performance.now();
  const loop = () => { frame(Math.floor(((performance.now() - t0) / 1000) * FPS) % window.__frames); requestAnimationFrame(loop); };
  loop();
}
