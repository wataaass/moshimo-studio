#!/usr/bin/env node
// 使い方: node render.cjs <scene> [--scale 0.5] [--stills 1,5,9] [--out out/x.mp4] [--audio-only]
// シーンを1コマずつ描いて ffmpeg で mp4 にする。--stills を付けると指定秒の静止画だけ出す。
// scenes/<scene>.audio.js があれば音を合成して付ける。--audio-only は書き出し済みの mp4 の音だけ付け直す。
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { pathToFileURL } = require('url');
const { chromium } = require('playwright');

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const scene = args[0] && !args[0].startsWith('--') ? args[0] : 'jihanki';
const scale = parseFloat(opt('scale', '1'));
const stills = opt('stills', null);
const out = opt('out', `out/${scene}.mp4`);
const FPS = 30;
const audioOnly = args.includes('--audio-only');

/** scenes/<scene>.audio.js があれば、音を合成して mp4 に付ける */
async function addAudio() {
  const src = path.join(__dirname, 'scenes', `${scene}.audio.js`);
  if (!fs.existsSync(src)) return;
  const { buildAudio } = await import(pathToFileURL(src));
  const { wavBytes } = await import(pathToFileURL(path.join(__dirname, 'src', 'synth.js')));
  const { left, right } = buildAudio();
  const wav = out.replace(/\.mp4$/, '.wav'), tmp = out.replace(/\.mp4$/, '.tmp.mp4');
  fs.writeFileSync(wav, wavBytes(left, right));
  const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', out, '-i', wav, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', tmp], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error('音を付けられませんでした');
  fs.renameSync(tmp, out);
  console.log(`音を付けました: ${out}`);
}
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.woff': 'font/woff', '.json': 'application/json' };

const server = http.createServer((req, res) => {
  const file = path.join(__dirname, decodeURIComponent(req.url.split('?')[0]).replace(/^\/$/, '/index.html'));
  if (!file.startsWith(__dirname) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

(async () => {
  if (audioOnly) {
    if (!fs.existsSync(out)) { console.error(`${out} がありません。先に動画を書き出してください`); process.exitCode = 1; return; }
    return addAudio();
  }
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: scale });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`http://127.0.0.1:${server.address().port}/?scene=${scene}`);
  await page.waitForFunction('window.__ready === true', null, { timeout: 60000 }).catch(() => {});
  if (errors.length || !(await page.evaluate('window.__ready === true'))) {
    console.error('シーンを読み込めませんでした:\n' + errors.join('\n'));
    process.exitCode = 1;
  } else {
    const total = await page.evaluate('window.__frames');
    const shot = () => page.screenshot({ type: 'jpeg', quality: 95 });
    fs.mkdirSync(path.dirname(out), { recursive: true });
    if (stills) {
      for (const s of stills.split(',')) {
        await page.evaluate((i) => window.__renderFrame(i), Math.min(total - 1, Math.round(parseFloat(s) * FPS)));
        const f = `out/${scene}-${s}s.jpg`;
        fs.writeFileSync(f, await shot());
        console.log(f);
      }
    } else {
      const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
        '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
      const t0 = Date.now();
      for (let i = 0; i < total; i++) {
        await page.evaluate((n) => window.__renderFrame(n), i);
        if (!ff.stdin.write(await shot())) await new Promise((r) => ff.stdin.once('drain', r));
        if (i % 30 === 0) process.stdout.write(`\r${i}/${total}`);
      }
      ff.stdin.end();
      await new Promise((r) => ff.on('close', r));
      console.log(`\r${out} (${total}コマ, ${((Date.now() - t0) / 1000).toFixed(0)}秒)`);
      await addAudio();
    }
    if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
  }
  await browser.close();
  server.close();
})();
