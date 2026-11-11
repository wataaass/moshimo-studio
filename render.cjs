#!/usr/bin/env node
// 使い方: node render.cjs <scene> [--scale 0.5] [--stills 1,5,9] [--out out/x.mp4]
// シーンを1コマずつ描いて ffmpeg で mp4 にする。--stills を付けると指定秒の静止画だけ出す。
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright');

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const scene = args[0] && !args[0].startsWith('--') ? args[0] : 'jihanki';
const scale = parseFloat(opt('scale', '1'));
const stills = opt('stills', null);
const out = opt('out', `out/${scene}.mp4`);
const FPS = 30;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.woff': 'font/woff', '.json': 'application/json' };

const server = http.createServer((req, res) => {
  const file = path.join(__dirname, decodeURIComponent(req.url.split('?')[0]).replace(/^\/$/, '/index.html'));
  if (!file.startsWith(__dirname) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

(async () => {
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
    }
    if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
  }
  await browser.close();
  server.close();
})();
