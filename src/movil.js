/*
  SafeWait en celular: cuatro paradas (Inicio, Por qué, Nodos, Equipo) con interfaz de vidrio.
  El 3D no usa un lienzo fijo: cada parada tiene su propio lienzo 2D dentro de la sección, así se mueve con el
  scroll nativo. Un solo renderer WebGL (fuera de pantalla) dibuja la vista que cambió y la copia a su lienzo;
  si nada cambia, no se dibuja nada.
*/
import '@fontsource-variable/inter';
import '@fontsource-variable/inter-tight';
import './movil.css';
import * as THREE from 'three';
import { CONFIG, NODES, TEAM, TEACHERS } from './content.js';
import { Stage, ANCHORS, COLOR, CAD, FSR, defaultState } from './scene.js';
import { buildDetails, doorGrids } from './detail.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smooth = t => t * t * (3 - 2 * t);
const ramp = (t, a, b) => clamp((t - a) / (b - a));
const easeOut = t => 1 - Math.pow(1 - t, 3);
const easeIn = t => t * t * t;
const V = (x, y, z) => new THREE.Vector3(x, y, z);

const params = new URLSearchParams(location.search);
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches || params.has('quieto');
document.documentElement.classList.toggle('reduce-motion', reduceMotion);

/* ---------- iconos (trazo, 24 × 24) ---------- */
const I = {
  bulb: '<path d="M12 3a6 6 0 0 0-4 10.5c.8.8 1.3 1.6 1.5 2.5h5c.2-.9.7-1.7 1.5-2.5A6 6 0 0 0 12 3z" class="fill"/><path d="M9 18h6"/><path d="M10 21h4"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  bell: '<path d="M6 16v-5a6 6 0 1 1 12 0v5l2 2H4l2-2z"/><path d="M10 21h4"/>',
  door: '<path d="M6 21V4h12v17"/><path d="M3 21h18"/><path d="M14.5 12.5h.01"/>',
  lock: '<path d="M6 11h12v9H6z"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  bus: '<path d="M5 17V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v11z"/><path d="M5 11h14"/><path d="M8 17v3"/><path d="M16 17v3"/>',
  bars: '<path d="M3 4h18"/><path d="M6 4v16"/><path d="M10 4v16"/><path d="M14 4v16"/><path d="M18 4v16"/>',
  roof: '<path d="M3 11l9-7 9 7"/><path d="M6 14v6h12v-6"/>',
  reset: '<path d="M4 5v5h5"/><path d="M5 10a8 8 0 1 1 2 7"/>',
  ext: '<path d="M14 5h5v5"/><path d="M19 5l-8 8"/><path d="M12 7H6v11h11v-6"/>',
  nodes: '<path d="M4 12h16"/><circle cx="4" cy="12" r="2.2" fill="currentColor"/><circle cx="12" cy="12" r="2.2" fill="currentColor"/><circle cx="20" cy="12" r="2.2" fill="currentColor"/>',
  chev: '<path d="M6 6l6 6-6 6"/><path d="M13 6l6 6-6 6"/>',
  cap: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11.5V16c2 2 10 2 12 0v-4.5"/>',
  hand: '<path d="M12 12V4.5a1.5 1.5 0 0 1 3 0V11"/><path d="M15 11V7.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-1a6 6 0 0 1-5-2.7L3.6 14a1.5 1.5 0 0 1 2.5-1.6L8 15V6.500a1.5 1.5 0 0 1 3 0V11"/>',
  chart: '<path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M3 20h18"/>',
};
const ic = (k, s = 22) => `<svg aria-hidden="true" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${I[k]}</svg>`;

/* ---------- contenido ---------- */
const STOPS = [['inicio', 'Inicio'], ['porque', 'Por qué'], ['nodos', 'Nodos'], ['equipo', 'Equipo']];
// datos del problema como tiras de LED: [encendidas, total, cifra, texto destacado, resto]
const FACTS = [
  [5.59, 10, '55.9', 'Casi 6 de cada 10', 'personas dicen que en su ciudad falta alumbrado público.'],
  [2, 3, '66.6', '2 de cada 3 mujeres', 'se sienten inseguras en el transporte público.'],
  [1, 5, '22.1', '1 de cada 5', 'sufrió acoso o violencia sexual en un lugar público en seis meses.'],
];
const DOES = [['light', 'bulb', 'Luz que se enciende sola'], ['sos', 'bell', 'Botón de auxilio'], ['door', 'door', 'Puerta con tarjeta'], ['route', 'bus', 'Aviso de la ruta que llega'], ['bars', 'bars', 'Barrotes de emergencia']];
const TILES = [['night', 'moon', 'Noche'], ['lamp', 'bulb', 'Luz'], ['sos', 'bell', 'SOS'], ['door', 'door', 'Puerta'], ['bus', 'bus', 'Camión'], ['bars', 'bars', 'Barrotes']];
const FLOW = ['Sensor', 'NodeMCU', 'API Flask', 'MySQL', 'Looker'];
const SOURCE = 'https://www.inegi.org.mx/contenidos/saladeprensa/boletines/2026/ensu/ENSU2026_10_RR.pdf';

const strip = ([on, total, pct]) => {
  let h = '';
  for (let i = 0; i < total; i++) {
    const k = clamp(on - i);
    h += k > 0 ? `<i class="on" style="--k:${k < 1 ? .55 : 1}"></i>` : '<i></i>';
  }
  return `<div class="leds" role="img" aria-label="${pct} por ciento">${h}<span>${pct}&nbsp;%</span></div>`;
};

const app = document.createElement('div');
app.id = 'app';
app.innerHTML = `
<a class="skip" href="#porque">Saltar al contenido</a>
<nav class="bar glass" aria-label="Secciones">
  <a class="bar-logo" href="#inicio" aria-label="SafeWait, ir al inicio"><img src="/safewait-logo.svg" alt="" width="28" height="28"></a>
  <div class="stops">${STOPS.map(([id, t], i) => `${i ? '<span class="seg" aria-hidden="true"></span>' : ''}<a href="#${id}" data-stop="${id}"><i></i>${t}</a>`).join('')}</div>
</nav>

<main>
  <section class="scr hero" id="inicio" data-section="inicio">
    <div class="glow" aria-hidden="true"></div>
    <div class="view" id="v-hero" role="img" aria-label="Maqueta del paradero de noche, con la luz de la caseta encendida"><canvas></canvas><span class="loading" aria-hidden="true"></span></div>
    <header class="hero-head">
      <h1><img src="/safewait-logo.svg" alt="" width="48" height="48">SafeWait</h1>
      <p>Esperar ya no es un riesgo.</p>
    </header>
    <div class="card glass">
      <p>Un paradero inteligente, seguro y funcional.</p>
      <div class="card-row">
        <a class="btn btn-w" href="#nodos">${ic('nodes', 20)}Ver los 5 nodos</a>
        <a class="btn glass" href="#porque">${ic('moon', 18)}El problema</a>
      </div>
    </div>
  </section>

  <section class="scr why" id="porque" data-section="porque">
    <div class="glow" aria-hidden="true"></div>
    <div class="view" id="v-why" role="img" aria-label="Maqueta del paradero a oscuras"><canvas></canvas></div>
    <div class="why-body">
      <div class="pane pane-dark">
        <h2>Esperar el camión de noche da miedo.</h2>
        <ul class="facts">${FACTS.map(f => `<li>${strip(f)}<p><b>${f[3]}</b> ${f[4]}</p></li>`).join('')}</ul>
        <a class="pill glass" href="${SOURCE}" target="_blank" rel="noopener">${ic('ext', 16)}Fuente: INEGI, ENSU 2026</a>
      </div>
      <div class="pane pane-lit" inert>
        <h2>Un paradero que cuida a quien espera.</h2>
        <ul class="does">${DOES.map(([k, icon, t]) => `<li><a href="#nodos" data-node="${k}"><span class="ico">${ic(icon, 18)}</span>${t}</a></li>`).join('')}</ul>
      </div>
    </div>
    <div class="slide glass" id="slide">
      <span class="slide-fill" aria-hidden="true"></span>
      <span class="slide-label slide-off" aria-hidden="true">Desliza para encender la luz</span>
      <span class="slide-label slide-on" aria-hidden="true">Luz encendida</span>
      <span class="slide-chev" aria-hidden="true">${ic('chev', 24)}</span>
      <button type="button" class="knob" id="knob" role="switch" aria-checked="false" aria-label="Encender la luz">${ic('bulb', 24)}</button>
    </div>
  </section>

  <section class="scr ctl" id="nodos" data-section="nodos">
    <div class="glow" aria-hidden="true"></div>
    <div class="view" id="v-ctl" role="img" aria-label="Maqueta 3D del paradero. Desliza a los lados para girarla."><canvas></canvas></div>
    <div class="tools">
      <button type="button" class="round glass" id="roofBtn" aria-pressed="false" aria-label="Quitar techo">${ic('roof', 20)}</button>
      <button type="button" class="round glass" id="homeBtn" aria-label="Vista inicial">${ic('reset', 20)}</button>
    </div>
    <section class="panel glass" aria-label="Centro de control">
      <div class="status" id="status" aria-live="polite"><span class="num num-i">${ic('hand', 16)}</span><p>Toca un mosaico y mira la maqueta.</p></div>
      <div class="tiles">${TILES.map(([k, icon, t]) => `<button type="button" class="tile" data-tile="${k}" aria-pressed="false"><span class="tile-ic">${ic(icon)}</span><span><b>${t}</b><i></i></span></button>`).join('')}</div>
    </section>
  </section>

  <section class="scr team" id="equipo" data-section="equipo">
    <h2 class="team-title">Equipo</h2>
    <ul class="people glass-l">
      ${TEAM.map((p, i) => `<li><span class="n">${i + 1}</span><span><b>${p.name}</b><i>${p.area}, ${p.extra}</i></span></li>`).join('')}
      <li><span class="n n-b">${ic('cap', 18)}</span><span><b>${TEACHERS}</b><i>Profesoras</i></span></li>
    </ul>
    <h2 class="flow-title">Del sensor al dashboard</h2>
    <div class="flow glass-l"><ol>${FLOW.map(t => `<li><span></span>${t}</li>`).join('')}</ol></div>
    <div class="links">
      ${CONFIG.lookerUrl ? `<a class="btn glass-l" href="${CONFIG.lookerUrl}" target="_blank" rel="noopener">${ic('chart', 18)}Ver dashboard</a>` : ''}
      <a class="btn glass-l" href="https://github.com/alonso-reyna/safewait-landing" target="_blank" rel="noopener">${ic('ext', 18)}Código en GitHub</a>
    </div>
  </section>
</main>`;
[...document.body.children].forEach(n => { if (n.tagName !== 'SCRIPT') n.remove(); });
document.body.prepend(app);
const themeMeta = $('meta[name="theme-color"]');
const setTheme = light => {
  document.documentElement.dataset.tema = light ? 'claro' : 'noche';
  if (themeMeta) themeMeta.content = light ? '#f4f8fc' : '#0b1433';
};
setTheme(false);

/* ---------- barra de paradas ---------- */
const stopLinks = $$('.stops a'), segs = $$('.stops .seg');
let stopNow = -1;
function setStop(i) {
  if (i === stopNow) return;
  stopNow = i;
  stopLinks.forEach((a, k) => {
    a.classList.toggle('on', k === i); a.classList.toggle('past', k < i);
    if (k === i) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
  });
  segs.forEach((s, k) => s.classList.toggle('past', k < i));
}
setStop(0);
const sections = $$('main > section');
const stopIO = new IntersectionObserver(es => {
  for (const e of es) if (e.isIntersecting) setStop(sections.indexOf(e.target));
}, { rootMargin: '-45% 0px -45% 0px' });
sections.forEach(x => stopIO.observe(x));
// la barra pasa a vidrio claro cuando Equipo llega arriba
new IntersectionObserver(es => setTheme(es[0].isIntersecting), { rootMargin: '-60px 0px -88% 0px' }).observe($('#equipo'));
// anclas: scroll nativo (suave salvo con movimiento reducido)
const goTo = id => $('#' + id).scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
app.addEventListener('click', e => {
  const a = e.target.closest('a[href^="#"]'); if (!a) return;
  e.preventDefault();
  goTo(a.getAttribute('href').slice(1));
  if (a.dataset.node) focusNode(a.dataset.node);
});

/* ---------- escena ---------- */
let stage = null, details = null;
const gl = document.createElement('canvas');
try { stage = new Stage(gl, { mobile: true, reduceMotion, offscreen: true, dpr: Math.min(window.devicePixelRatio || 1, 2) }); } catch (err) { console.error(err); }
function no3D() { stage = null; document.documentElement.classList.add('no-3d'); }
if (!stage) no3D();

// maqueta de los videos: azul claro de un solo tono, puertas con retícula, keypad de membrana, banca y pinitos
const TONE = { wall: 0x6ab2f2, frame: 0x7cbdf5, floor: 0x58a5ea, base: 0x5aa8ec, grass: 0x4c98df, corner: 0x3d88d2, door: 0xf2f8fe, pcb: 0x1a4c80, fsr: 0x162660, bars: 0x6ab2f2, keypad: 0x58a5ea, pulley: 0x4c98df, guide: 0x58a5ea };
const EDGE = new THREE.Color(0x3f86c9);
let doorMat = null;
if (stage) {
  const W = stage.M.white;
  for (const k in TONE) if (W[k]) W[k].color.setHex(TONE[k]);
  W.keypad = W.floor;
  doorMat = W.door; doorMat.roughness = .92; doorMat.emissive.set(0xcfe6ff); doorMat.emissiveIntensity = 0;
  stage.M.glass.color.setHex(0xe3f1fd); stage.M.glass.opacity = .3;
  // el logo del pedestal, en azul sobre azul
  const logoDraw = stage.drawLogos.bind(stage);
  stage.drawLogos = img => {
    logoDraw(img);
    const c = stage.logoW.image, g = c.getContext('2d'), Wd = c.width, H = c.height;
    g.fillStyle = '#5aa8ec'; g.fillRect(0, 0, Wd, H);
    g.globalAlpha = .9; if (img) g.drawImage(img, 70, 50, 566, 566); g.globalAlpha = 1;
    g.fillStyle = '#f2f8fe'; g.textBaseline = 'alphabetic'; g.textAlign = 'left';
    g.font = '600 270px "Inter Tight Variable", "Inter Tight", system-ui, sans-serif';
    g.fillText('SafeWait', 700, H / 2 + 95);
    g.font = '500 40px "Inter Variable", Inter, system-ui, sans-serif'; g.textAlign = 'right';
    g.fillText('Implementación de IoT, grupo 4', 1990, H - 70);
    stage.logoW.needsUpdate = true;
  };
  stage.drawLogos();
  const doorSync = doorGrids(stage, 0x162660);
  // sensor del SOS: sale horizontal por la ranura del muro del fondo y descansa en una repisa
  const SOS_P = V(FSR.x, 21.36, CAD.backInnerZ + 2.4);
  for (const m of stage.meshes) {
    const g = m.geometry.parameters || {};
    if (m.userData.cls !== 'fsr') continue;
    if (g.radiusTop === 0.9) { m.rotation.set(0, 0, 0); m.position.copy(SOS_P); }
    else if (g.width === 0.5 && g.depth === 0.04) {
      m.geometry.dispose(); m.geometry = new THREE.BoxGeometry(0.5, 0.04, 1.7);
      m.position.set(FSR.x, SOS_P.y - 0.01, CAD.backInnerZ + 0.06 + 0.85);
    }
  }
  { // pantalla OLED: ruta y destino
    const c = stage.oledTex.image, g = c.getContext('2d'), w = c.width, h = c.height;
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#8fd0ff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '700 52px "Inter Tight Variable", "Inter Tight", system-ui, sans-serif'; g.fillText('RUTA 2', w / 2, h * 0.36);
    g.font = '600 28px "Inter Variable", Inter, system-ui, sans-serif'; g.fillText('Rancho IoT', w / 2, h * 0.76);
    stage.oledTex.needsUpdate = true;
  }
  details = buildDetails(stage);
  { // repisa bajo el sensor del SOS
    const g = new THREE.Group(), geo = new THREE.BoxGeometry(2.5, 0.3, 3.6);
    geo.translate(SOS_P.x, SOS_P.y - 0.19, CAD.backInnerZ + 1.8);
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: TONE.floor, roughness: .9 })); m.castShadow = m.receiveShadow = true; g.add(m);
    details.piece(g, 1.25);
  }
  const edgeObjs = [];
  stage.scene.onBeforeRender = () => {
    doorSync();
    if (!edgeObjs.length) for (const m of stage.meshes) if (m.userData.edges) edgeObjs.push(m.userData.edges);
    stage.edgeMat.color.copy(EDGE);
    for (const e of edgeObjs) if (e.userData.clipMat) e.userData.clipMat.color.copy(EDGE);
  };
}

/* ---------- vistas: lienzo 2D + cámara + estado ---------- */
const views = [];
function makeView(id) {
  const el = $(id), canvas = $('canvas', el);
  const v = stage ? stage.addView(el) : { el, camera: new THREE.PerspectiveCamera(30, 1, 1, 1500), state: defaultState() };
  Object.assign(v, { canvas, w: 0, h: 0, shown: false, dirty: true, pre: false, update: null });
  new IntersectionObserver(es => { v.shown = es[0].isIntersecting; if (v.shown) kick(); }).observe(el);
  // solo cuenta el tamaño CSS del bloque: las secciones miden en svh, así que la barra de URL no lo cambia
  new ResizeObserver(() => {
    const w = el.clientWidth, h = el.clientHeight;
    if (w === v.w && h === v.h) return;
    v.w = w; v.h = h; layout(); invalidate(v);
  }).observe(el);
  views.push(v);
  return v;
}
let raf = 0, last = 0;
function kick() { if (!raf) raf = requestAnimationFrame(frame); }
function invalidate(v) { if (v) v.dirty = true; else views.forEach(x => { x.dirty = true; }); kick(); }
function frame(now) {
  raf = 0;
  const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
  last = now;
  if (!stage || !stage.ready) { last = 0; return; }
  let again = false;
  if (!stage.asm.done) { stage.step(dt); again = true; views.forEach(v => { v.dirty = true; }); }
  details.update(stage.asm.t < 0 ? 99 : stage.asm.t, 1);
  let pre = false;
  for (const v of views) {
    if (!v.shown) {
      // fuera de pantalla solo se dibuja una vez, ya armada, para que al llegar el lienzo no esté vacío (una vista por cuadro)
      if (stage.asm.done && !v.pre && v.w && !pre) { pre = v.pre = true; v.dirty = false; stage.draw(v, v.canvas, v.w, v.h, now / 1000, 0); again = true; }
      continue;
    }
    if (v.update && v.update(dt, now / 1000)) again = true;
    if (v.dirty) { v.dirty = false; v.pre = stage.asm.done; stage.draw(v, v.canvas, v.w, v.h, now / 1000, dt); }
  }
  if (again) kick(); else last = 0;
}
document.addEventListener('visibilitychange', () => { last = 0; if (!document.hidden) invalidate(); });

// encuadre: la maqueta (sin pedestal) cabe en la caja box (px de la vista), vista desde angle y el
const TGT = V(0, 21, -8);
const PTS = [];
[-33.5, 33.5].forEach(x => [-32.71, 17.29].forEach(z => PTS.push(V(x, 15.07, z))));
[-22.6, 8.4].forEach(x => [-23.9, -10.9].forEach(z => PTS.push(V(x, 35.5, z))));
const tmp = V(0, 0, 0);
function orbit(c, tgt, az, el, d) {
  c.position.set(tgt.x + Math.sin(az) * Math.cos(el) * d, tgt.y + Math.sin(el) * d, tgt.z + Math.cos(az) * Math.cos(el) * d);
  c.lookAt(tgt); c.updateMatrixWorld();
}
function bounds(c, W, H) {
  let x1 = Infinity, x2 = -Infinity, y1 = Infinity, y2 = -Infinity;
  for (const p of PTS) {
    tmp.copy(p).project(c);
    const x = (tmp.x * .5 + .5) * W, y = (-tmp.y * .5 + .5) * H;
    x1 = Math.min(x1, x); x2 = Math.max(x2, x); y1 = Math.min(y1, y); y2 = Math.max(y2, y);
  }
  return { w: x2 - x1, h: y2 - y1, cx: (x1 + x2) / 2, cy: (y1 + y2) / 2 };
}
function fitBox(c, W, H, box, front, angle, el) {
  c.clearViewOffset(); c.updateProjectionMatrix();
  orbit(c, TGT, front, el, 260);
  let m = bounds(c, W, H);
  const d = 260 * Math.max(m.w / box.w, m.h / box.h);
  orbit(c, TGT, front, el, d);
  m = bounds(c, W, H);
  c.setViewOffset(W, H, m.cx - box.cx, m.cy - box.cy, W, H); c.updateProjectionMatrix();
  orbit(c, TGT, angle, el, d);
}
const LAMP = V(ANCHORS.light.x, ANCHORS.light.y - 5, ANCHORS.light.z + 6); // centro de la caseta: de ahí sale el resplandor
function glowAt(v, sec) {
  if (!v.w) return;
  tmp.copy(LAMP).project(v.camera);
  const r = v.el.getBoundingClientRect(), s = sec.getBoundingClientRect();
  sec.style.setProperty('--gx', (r.left - s.left + (tmp.x * .5 + .5) * v.w).toFixed(0) + 'px');
  sec.style.setProperty('--gy', (r.top - s.top + (-tmp.y * .5 + .5) * v.h).toFixed(0) + 'px');
}

/* ---------- Inicio: la maqueta de noche con su luz, meciéndose despacio ---------- */
const heroSec = $('#inicio'), hero = makeView('#v-hero');
Object.assign(hero.state, { plinth: false, night: 1, lamp: 1, dark: 1 });
const HERO_FRONT = 0.32;
let heroT = 0, heroAcc = 0, heroBox = null, heroGlow = false;
hero.onFrame = v => {
  const box = heroBox || { cx: v.w / 2, cy: v.h / 2, w: v.w * 1.2, h: v.h * .5 };
  const a = HERO_FRONT + Math.sin(heroT * Math.PI * 2 / 50) * 0.14;
  fitBox(v.camera, v.w, v.h, box, HERO_FRONT, a, 0.5);
  if (doorMat) doorMat.emissiveIntensity = .5;
  if (!heroGlow) { heroGlow = true; glowAt(v, heroSec); }
};
hero.update = dt => {
  if (reduceMotion) return false;
  heroT += dt; heroAcc += dt;
  if (heroAcc >= 1 / 31) { heroAcc = 0; hero.dirty = true; } // mecerse despacio no pide más de 30 cuadros por segundo
  return true;
};

/* ---------- Por qué: a oscuras; el control deslizable enciende la luz de la caseta ---------- */
const whySec = $('#porque'), why = makeView('#v-why');
Object.assign(why.state, { plinth: false, night: 1, lamp: 0, dark: .35 });
let luz = 0, luzGoal = null, whyGlow = false;
why.onFrame = v => {
  fitBox(v.camera, v.w, v.h, { cx: v.w / 2, cy: v.h * .5, w: v.w * .94, h: v.h * .78 }, 0.46, 0.46 - luz * .1, 0.3);
  v.state.lamp = luz;
  if (doorMat) doorMat.emissiveIntensity = luz * .5;
  if (!whyGlow) { whyGlow = true; glowAt(v, whySec); }
};
const knob = $('#knob'), slide = $('#slide'), paneDark = $('.pane-dark'), paneLit = $('.pane-lit');
let lit = false, travel = 0;
new ResizeObserver(() => { travel = Math.max(0, slide.clientWidth - knob.offsetWidth - 12); setLuz(luz); }).observe(slide);
function setLuz(p) {
  luz = clamp(p);
  whySec.style.setProperty('--luz', luz.toFixed(3));
  knob.style.transform = `translateX(${(luz * travel).toFixed(1)}px)`;
  whySec.style.setProperty('--a', (1 - ramp(luz, .3, .6)).toFixed(3));
  whySec.style.setProperty('--b', ramp(luz, .55, .9).toFixed(3));
  const on = luz > .6;
  if (on !== lit) {
    lit = on;
    whySec.classList.toggle('lit', on);
    paneDark.inert = on; paneLit.inert = !on;
    knob.setAttribute('aria-checked', on);
    knob.setAttribute('aria-label', on ? 'Apagar la luz' : 'Encender la luz');
    $('#v-why').setAttribute('aria-label', on ? 'Maqueta del paradero con la luz de la caseta encendida' : 'Maqueta del paradero a oscuras');
  }
  invalidate(why);
}
why.update = dt => {
  if (luzGoal == null) return false;
  if (reduceMotion) { setLuz(luzGoal); luzGoal = null; return false; }
  const next = luz + Math.sign(luzGoal - luz) * dt * 2.4;
  if ((luzGoal - luz) * (luzGoal - next) <= 0) { setLuz(luzGoal); luzGoal = null; return false; }
  setLuz(next);
  return true;
};
const luzTo = g => { luzGoal = g; invalidate(why); };
{
  let drag = null;
  knob.addEventListener('pointerdown', e => {
    drag = { x: e.clientX, p0: luz, moved: false };
    luzGoal = null;
    knob.setPointerCapture(e.pointerId);
  });
  knob.addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    if (Math.abs(dx) > 4) drag.moved = true;
    if (drag.moved) setLuz(drag.p0 + dx / Math.max(1, travel));
  });
  const end = () => {
    if (!drag) return;
    const moved = drag.moved; drag = null;
    if (moved) { luzTo(luz > .5 ? 1 : 0); knob.dataset.skip = '1'; setTimeout(() => { delete knob.dataset.skip; }, 0); }
  };
  knob.addEventListener('pointerup', end);
  knob.addEventListener('pointercancel', end);
  // toque o teclado: alterna
  knob.addEventListener('click', () => { if (!knob.dataset.skip) luzTo(luz > .5 ? 0 : 1); });
}
setLuz(0);

/* ---------- Nodos: centro de control ---------- */
const ctlSec = $('#nodos'), ctl = makeView('#v-ctl');
const status = $('#status'), tiles = Object.fromEntries($$('.tile').map(b => [b.dataset.tile, b]));
// cámara en órbita: objetivo, giro, elevación y radio de lo que debe caber
const HOME = { tgt: V(-2, 15, -3), az: 0.55, el: 0.4, r: 43 };
const SHOTS = {
  light: { tgt: V(-5, 23, -12), az: 0.42, el: 0.3, r: 30 },
  sos: { tgt: V(5, 22, -17), az: 0.62, el: 0.5, r: 27 },
  door: { tgt: V(-7, 23, -12), az: 0.22, el: 0.2, r: 19 },
  route: { tgt: V(6, 19, -3), az: 0.45, el: 0.42, r: 36 },
  bars: { tgt: V(-5, 24, -12), az: -0.24, el: 0.26, r: 31 },
};
const cam = { tgt: HOME.tgt.clone(), az: HOME.az - .5, el: HOME.el, r: HOME.r, goal: HOME, vel: 0, drag: false };
function fitDist(c, r) {
  const v = THREE.MathUtils.degToRad(c.fov) / 2, h = Math.atan(Math.tan(v) * c.aspect);
  return r / Math.sin(Math.min(v, h));
}
function shoot(shot) { cam.goal = { ...shot, tgt: shot.tgt.clone() }; cam.vel = 0; invalidate(ctl); }

const C = { night: 1, lamp: 1, door: 0, bars: 0, roof: 0 };     // metas (0 o 1)
let sosT = -1, busT = -1, ledPhase = '', denyT = 0;
const SOS_DUR = 6, BUS = { in: 1.7, wait: 2.8, out: 1.5 };
Object.assign(ctl.state, { night: 1, lamp: 1, dark: 1 });
ctl.onFrame = v => {
  const c = v.camera;
  c.clearViewOffset(); c.updateProjectionMatrix();
  orbit(c, cam.tgt, cam.az, cam.el, fitDist(c, cam.r));
  if (doorMat) doorMat.emissiveIntensity = v.state.lamp * v.state.night * .5;
};
const approach = (cur, tgt, rate, dt) => {
  if (reduceMotion) return tgt;
  const n = cur + (tgt - cur) * Math.min(1, dt * rate);
  return Math.abs(tgt - n) < .002 ? tgt : n;
};
ctl.update = (dt, now) => {
  const s = ctl.state;
  let moving = false;
  const prev = [s.night, s.lamp, s.door, s.bars, s.roof, cam.az, cam.el, cam.r, cam.tgt.x, cam.tgt.y, cam.tgt.z, s.busX, s.sos, s.oled, s.led];
  // cámara
  if (!cam.drag) {
    if (Math.abs(cam.vel) > .02) { cam.goal.az += cam.vel * dt; cam.az = cam.goal.az; cam.vel *= Math.exp(-4 * dt); }
    else {
      cam.vel = 0;
      cam.az = approach(cam.az, cam.goal.az, 4.5, dt);
    }
    cam.el = approach(cam.el, cam.goal.el, 4.5, dt);
    cam.r = approach(cam.r, cam.goal.r, 4.5, dt);
    if (reduceMotion) cam.tgt.copy(cam.goal.tgt); else cam.tgt.lerp(cam.goal.tgt, Math.min(1, dt * 4.5));
    if (cam.tgt.distanceTo(cam.goal.tgt) < .02) cam.tgt.copy(cam.goal.tgt);
  }
  // piezas
  s.night = approach(s.night, C.night, 2.2, dt); s.dark = s.night;
  s.door = approach(s.door, C.door, 3, dt);
  s.bars = approach(s.bars, C.bars, 1.5, dt);
  s.roof = approach(s.roof, C.roof, 3.5, dt);
  // SOS: ondas desde el buzzer y la tira LED alternando rojo y azul
  let lamp = C.lamp, led = null;
  if (sosT >= 0) {
    sosT += dt;
    s.sos = (sosT % 1.1) / 1.1;
    led = Math.floor(sosT / .28) % 2 ? 0x2f6bff : 0xff2a1f; lamp = 1;
    if (sosT >= SOS_DUR) { sosT = -1; s.sos = 0; say(2, 'Alerta terminada. En la maqueta dura 30 segundos.'); paint(); }
    moving = true;
  } else {
    s.sos = 0;
    if (C.bars) { // barrotes arriba: destellos rojos
      led = 0xff2a1f; lamp = Math.floor(now / .32) % 2 ? 1 : .12;
      moving = true;
    }
  }
  s.led = led;
  s.lamp = led ? lamp : approach(s.lamp, lamp, 2.6, dt);
  // camión: entra, se detiene sobre el sensor de color y se va
  if (busT >= 0) {
    busT += dt;
    const stop = COLOR.x - 1.2, a = busT;
    if (a < BUS.in) s.busX = -70 + (stop + 70) * easeOut(a / BUS.in);
    else if (a < BUS.in + BUS.wait) s.busX = stop;
    else s.busX = stop + (80 - stop) * easeIn((a - BUS.in - BUS.wait) / BUS.out);
    const arrived = a >= BUS.in && a < BUS.in + BUS.wait;
    s.oled = approach(s.oled, arrived ? 1 : 0, 6, dt);
    if (arrived && ledPhase !== 'bus') { ledPhase = 'bus'; say(4, 'Ruta 2: el sensor leyó su color y la pantalla avisa cuál llegó.'); paint(); }
    if (a >= BUS.in + BUS.wait + BUS.out) { busT = -1; s.busX = null; s.oled = 0; ledPhase = ''; paint(); }
    moving = true;
  } else { s.busX = null; s.oled = 0; }

  const cur = [s.night, s.lamp, s.door, s.bars, s.roof, cam.az, cam.el, cam.r, cam.tgt.x, cam.tgt.y, cam.tgt.z, s.busX, s.sos, s.oled, s.led];
  if (cur.some((x, i) => x !== prev[i])) { ctl.dirty = true; moving = true; }
  return moving || cam.drag;
};

function say(n, text) {
  status.innerHTML = `<span class="num${n ? '' : ' num-i'}">${n || ic('hand', 16)}</span><p>${text}</p>`;
  status.classList.remove('pop'); void status.offsetWidth; status.classList.add('pop');
}
function paint() {
  const st = {
    night: [C.night, C.night ? 'Activada' : 'Desactivada'],
    lamp: [C.lamp, C.lamp ? 'Encendida' : 'Apagada'],
    sos: [sosT >= 0, sosT >= 0 ? 'Alerta activa' : 'Pedir ayuda'],
    door: [C.door, C.bars ? 'Bloqueada' : C.door ? 'Abierta' : 'Usar tarjeta'],
    bus: [busT >= 0, busT < 0 ? 'Llamar ruta' : ledPhase === 'bus' ? 'Ruta 2 llegó' : 'En camino'],
    bars: [C.bars, C.bars ? 'Arriba' : 'Abajo'],
  };
  for (const k in st) {
    const b = tiles[k], [on, sub] = st[k];
    b.classList.toggle('act', !!on); b.setAttribute('aria-pressed', !!on);
    $('i', b).textContent = sub;
  }
  tiles.sos.classList.toggle('alert', sosT >= 0);
  const blocked = !!C.bars;
  tiles.door.classList.toggle('blocked', blocked);
  $('.tile-ic', tiles.door).innerHTML = ic(blocked ? 'lock' : 'door');
  ctlSec.classList.toggle('day', !C.night);
  ctlSec.classList.toggle('glow-on', !!C.lamp && !!C.night);
}
const ACT = {
  night() {
    C.night = C.night ? 0 : 1; C.lamp = C.night;   // la fotorresistencia decide: de noche, la luz se enciende sola
    say(1, C.night ? 'Oscurece: la fotorresistencia lo detecta y la luz se enciende sola.' : 'Amanece: la luz se apaga sola.');
    shoot(HOME);
  },
  lamp() {
    C.lamp = C.lamp ? 0 : 1;
    say(1, C.lamp ? 'Tira LED encendida dentro de la caseta.' : 'Tira LED apagada.');
    shoot(SHOTS.light);
  },
  sos() {
    if (sosT >= 0) { sosT = -1; say(2, 'Alerta cancelada.'); return; }
    sosT = 0;
    say(2, 'Auxilio: suena el buzzer y la tira LED alterna rojo y azul.');
    shoot(SHOTS.sos);
  },
  door() {
    if (C.bars) {
      say(3, 'Acceso denegado: con los barrotes arriba la puerta no abre.');
      tiles.door.classList.remove('deny'); void tiles.door.offsetWidth; tiles.door.classList.add('deny');
      if (navigator.vibrate) navigator.vibrate(60);
      shoot(SHOTS.door);
      return;
    }
    C.door = C.door ? 0 : 1;
    say(3, C.door ? 'Tarjeta válida: el servomotor abre la puerta.' : 'Puerta cerrada.');
    shoot(SHOTS.door);
  },
  bus() {
    if (busT >= 0) return;
    busT = 0; ledPhase = '';
    say(4, 'Llega un camión a la parada.');
    shoot(SHOTS.route);
  },
  bars() {
    C.bars = C.bars ? 0 : 1;
    if (C.bars) C.door = 0;
    say(5, C.bars ? 'Barrotes arriba: la puerta se bloquea y la tira LED da la alerta.' : 'Barrotes abajo: la puerta vuelve a abrir con tarjeta.');
    shoot(SHOTS.bars);
  },
};
$$('.tile').forEach(b => b.addEventListener('click', () => {
  if (!stage || !stage.ready) return;
  ACT[b.dataset.tile](); paint(); invalidate(ctl);
}));
const roofBtn = $('#roofBtn');
roofBtn.addEventListener('click', () => {
  C.roof = C.roof ? 0 : 1;
  roofBtn.setAttribute('aria-pressed', !!C.roof);
  roofBtn.setAttribute('aria-label', C.roof ? 'Poner techo' : 'Quitar techo');
  if (C.roof) shoot({ ...HOME, el: 0.72 });
  invalidate(ctl);
});
$('#homeBtn').addEventListener('click', () => shoot(HOME));
// desde "Por qué": muestra el nodo elegido en la maqueta y resalta su mosaico
const NODE_TILE = { light: 'lamp', sos: 'sos', door: 'door', route: 'bus', bars: 'bars' };
function focusNode(key) {
  const n = NODES.find(x => x.key === key); if (!n) return;
  say(n.n, n.title);
  shoot(SHOTS[key]);
  const b = tiles[NODE_TILE[key]];
  b.classList.remove('hint'); void b.offsetWidth; b.classList.add('hint');
}
paint();
{ // girar: arrastre horizontal (el vertical sigue siendo el scroll de la página)
  const el = ctl.el;
  let d = null;
  el.addEventListener('pointerdown', e => { d = { x: e.clientX, t: performance.now(), az: cam.az, id: e.pointerId, on: false }; });
  el.addEventListener('pointermove', e => {
    if (!d || e.pointerId !== d.id) return;
    const dx = e.clientX - d.x;
    if (!d.on) {
      if (Math.abs(dx) < 6) return;
      d.on = true; cam.drag = true; d.x = e.clientX; d.az = cam.az; d.lx = e.clientX; d.lt = performance.now();
      try { el.setPointerCapture(e.pointerId); } catch { /* sin captura también funciona */ }
      return;
    }
    const now = performance.now();
    cam.az = cam.goal.az = d.az - (e.clientX - d.x) * (2.6 / Math.max(280, ctl.w));
    if (now > d.lt) { const vInst = -(e.clientX - d.lx) * (2.6 / Math.max(280, ctl.w)) / ((now - d.lt) / 1000); cam.vel = cam.vel * .5 + vInst * .5; }
    d.lx = e.clientX; d.lt = now;
    invalidate(ctl);
  });
  const end = e => {
    if (!d || (e.pointerId !== undefined && e.pointerId !== d.id)) return;
    if (d.on && performance.now() - d.lt > 90) cam.vel = 0;
    if (!d.on) cam.vel = 0;
    cam.vel = clamp(cam.vel, -6, 6);
    d = null; cam.drag = false; invalidate(ctl);
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
}

/* ---------- medidas ---------- */
function layout() {
  // Inicio: la maqueta ocupa el hueco entre el título y la tarjeta
  if (hero.w) {
    const s = heroSec.getBoundingClientRect(), a = $('.hero-head').getBoundingClientRect().bottom - s.top, b = $('.hero .card').getBoundingClientRect().top - s.top;
    heroBox = { cx: hero.w / 2, cy: (a + b) / 2 + 6, w: Math.min(hero.w * 1.32, 620), h: (b - a) * 1.02 };
  }
  heroGlow = whyGlow = false;
}
window.addEventListener('orientationchange', () => setTimeout(() => { layout(); invalidate(); }, 250));

/* ---------- cargar el modelo ---------- */
if (stage) {
  const logoImg = new Image();
  logoImg.src = '/safewait-logo.svg';
  const fonts = Promise.all([
    logoImg.decode().catch(() => null),
    document.fonts ? Promise.all([document.fonts.load('600 100px "Inter Tight Variable"'), document.fonts.load('500 40px "Inter Variable"')]).catch(() => null) : null,
  ]);
  stage.load('/models/safewait.glb').then(async () => {
    await Promise.race([fonts, new Promise(r => setTimeout(r, 1200))]);
    stage.drawLogos(logoImg.complete && logoImg.naturalWidth ? logoImg : null);
    stage.assemble();
    document.documentElement.classList.add('model-ready');
    layout(); invalidate();
    if (!reduceMotion) cam.az = HOME.az - .5; // al llegar a Nodos la maqueta termina de girar: se nota que se puede mover
  }).catch(err => { console.error(err); no3D(); });
}

/* ---------- modo stand: vuelve al inicio tras inactividad ---------- */
if (params.has('stand')) {
  let idle;
  const restart = () => {
    Object.assign(C, { night: 1, lamp: 1, door: 0, bars: 0, roof: 0 }); sosT = busT = -1;
    roofBtn.setAttribute('aria-pressed', 'false');
    say(0, 'Toca un mosaico y mira la maqueta.'); paint(); shoot(HOME);
    luzTo(0);
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    setTimeout(() => { if (stage && stage.ready) { stage.assemble(); heroT = 0; invalidate(); } arm(); }, reduceMotion ? 0 : 1500);
  };
  const arm = () => { clearTimeout(idle); idle = setTimeout(restart, (parseFloat(params.get('stand')) || CONFIG.standIdleSeconds) * 1000); };
  ['pointerdown', 'keydown', 'touchstart', 'scroll'].forEach(ev => window.addEventListener(ev, arm, { passive: true }));
  arm();
}

if (import.meta.env.DEV) window.__sw = { stage, views, cam, C };
