// Captura el video cuadro por cuadro desde /video/?capture (con el servidor de desarrollo corriendo) y lo codifica con ffmpeg.
//   node video/render.mjs --size 1920x1080 --out salida.mp4 [--fps 30] [--ss 2] [--url http://localhost:5179]
//   node video/render.mjs --size 1080x1920 --stills 2,8,14 --dir carpeta     (cuadros sueltos para revisar)
//   --audio sfx.wav le pone la pista de sonido (se genera con: node video/sonido.mjs sfx.wav)
// Necesita playwright-core (PLAYWRIGHT_CORE=ruta al paquete) y un Chromium (CHROMIUM=ruta al ejecutable).
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const [W, H] = arg('size', '1920x1080').split('x').map(Number);
const fps = +arg('fps', 30), ss = +arg('ss', 1), url = arg('url', 'http://localhost:5179');
const look = arg('look', ''), audio = arg('audio', ''), stills = arg('stills'), out = arg('out', `safewait-${W}x${H}.mp4`), dir = arg('dir', '.');

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM || undefined,
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl', '--hide-scrollbars', '--force-color-profile=srgb'],
});
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: ss });
page.on('pageerror', e => console.error('pageerror:', e.message));
page.on('console', m => { if (m.type() === 'error') console.error('console:', m.text()); });
await page.goto(`${url}/video/?capture${look ? '&look=' + look : ''}`);
await page.waitForFunction('window.ready === true', null, { timeout: 60000 });
const DUR = await page.evaluate('window.DUR');
console.log('GPU:', await page.evaluate(() => { const g = document.createElement('canvas').getContext('webgl2'); const e = g.getExtension('WEBGL_debug_renderer_info'); return e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : '?'; }));

if (stills) {
  mkdirSync(dir, { recursive: true });
  for (const t of stills.split(',').map(Number)) {
    await page.evaluate(x => window.seek(x), t);
    await page.screenshot({ path: path.join(dir, `f-${W}x${H}-${t.toFixed(1).padStart(4, '0')}.png`) });
  }
} else {
  const n = Math.round(DUR * fps);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-', ...(audio ? ['-i', audio] : []),
    '-vf', `scale=${W}:${H}:flags=lanczos,format=yuv420p`, '-c:v', 'libx264', '-preset', 'slow', '-crf', '15',
    '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-movflags', '+faststart', ...(audio ? ['-c:a', 'aac', '-b:a', '192k', '-shortest'] : ['-an']), out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => ff.on('close', c => c ? rej(new Error('ffmpeg ' + c)) : res()));
  const t0 = Date.now();
  for (let i = 0; i < n; i++) {
    await page.evaluate(x => window.seek(x), i / fps);
    const buf = await page.screenshot({ type: 'png' });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (i % 150 === 0) console.log(`${i}/${n}  ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  }
  ff.stdin.end(); await done;
  console.log('listo:', out);
}
await browser.close();
