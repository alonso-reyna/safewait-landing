// Saca el PDF de la presentación: abre /pitch/?fijo (con el servidor de desarrollo corriendo), toma el cuadro final de cada slide
// y arma un PDF de una página por slide.
//   node pitch/exportar.mjs --out Presentacion_E4.pdf [--url http://localhost:5179] [--ss 2] [--solo 1-12] [--png carpeta]
// Necesita playwright-core (PLAYWRIGHT_CORE=ruta al paquete) y un Chromium (CHROMIUM=ruta al ejecutable), igual que video/render.mjs.
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const W = 1920, H = 1080, ss = +arg('ss', 2), url = arg('url', 'http://localhost:5179'), out = arg('out', 'Presentacion_E4.pdf'), png = arg('png');

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM || undefined,
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl', '--hide-scrollbars', '--force-color-profile=srgb'],
});
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: ss });
page.on('pageerror', e => console.error('pageerror:', e.message));
page.on('console', m => { if (m.type() === 'error') console.error('console:', m.text()); });
await page.goto(`${url}/pitch/?fijo#1`);
await page.waitForFunction('window.listo === true', null, { timeout: 90000 });
await page.evaluate(() => document.fonts.ready);

const total = await page.evaluate('window.total');
const [a, b] = (arg('solo', `1-${total}`)).split('-').map(Number);
if (png) mkdirSync(png, { recursive: true });
const shots = [];
for (let i = a; i <= (b || a); i++) {
  await page.evaluate(n => window.foto(n), i - 1);
  await page.waitForTimeout(250);
  if (png) await page.screenshot({ path: path.join(png, `slide-${String(i).padStart(2, '0')}.png`) });
  shots.push((await page.screenshot({ type: 'jpeg', quality: 93 })).toString('base64'));
  console.log(`slide ${i}/${total}`);
}

// un PDF de 1920x1080 por página, con cada cuadro a sangre
const doc = await browser.newPage();
await doc.setContent(`<style>@page{size:${W}px ${H}px;margin:0}html,body{margin:0}img{display:block;width:${W}px;height:${H}px;page-break-after:always}</style>` +
  shots.map(s => `<img src="data:image/jpeg;base64,${s}">`).join(''), { waitUntil: 'load' });
writeFileSync(out, await doc.pdf({ width: W + 'px', height: H + 'px', printBackground: true, pageRanges: `1-${shots.length}` }));
console.log('listo:', out);
await browser.close();
