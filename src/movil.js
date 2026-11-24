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
import { Stage, ANCHORS, CAD, FSR, OLED, BUZZER, LDR, EX, exK, defaultState } from './scene.js';
import { makeWave } from './fx.js';
import { buildDetails, doorGrids } from './detail.js';
import { makeBus } from './bus.js';

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
  cap: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11.5V16c2 2 10 2 12 0v-4.5"/>',
  hand: '<path d="M12 12V4.5a1.5 1.5 0 0 1 3 0V11"/><path d="M15 11V7.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-1a6 6 0 0 1-5-2.7L3.6 14a1.5 1.5 0 0 1 2.5-1.6L8 15V6.500a1.5 1.5 0 0 1 3 0V11"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/><path d="M3 17.500l9 5 9-5"/>',
  x: '<path d="M6 6l12 12"/><path d="M18 6L6 18"/>',
  play: '<path d="M8 5.6v12.8a.6.6 0 0 0 .9.5l10.3-6.4a.6.6 0 0 0 0-1L8.9 5.1a.6.6 0 0 0-.9.5z" fill="currentColor"/>',
  explode: '<rect x="9" y="9" width="6" height="6" rx="1"/><path d="M6.500 6.500L3 3"/><path d="M3 6.500V3h3.500"/><path d="M17.500 6.500L21 3"/><path d="M17.500 3H21v3.500"/><path d="M6.500 17.500L3 21"/><path d="M3 17.500V21h3.500"/><path d="M17.500 17.500L21 21"/><path d="M21 17.500V21h-3.500"/>',
  chart: '<path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M3 20h18"/>',
};
const ic = (k, s = 22) => `<svg aria-hidden="true" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${I[k]}</svg>`;

/* ---------- contenido ---------- */
const STOPS = [['inicio', 'Inicio'], ['nodos', 'Nodos'], ['equipo', 'Equipo']];
const TILES = [['night', 'moon', 'Noche'], ['lamp', 'bulb', 'Luz'], ['sos', 'bell', 'SOS'], ['door', 'door', 'Puerta'], ['bus', 'bus', 'Camión'], ['bars', 'bars', 'Barrotes']];
const FLOW = ['Sensor', 'NodeMCU', 'API Flask', 'MySQL', 'Looker'];

// rutas del nodo 4: el sensor clasifica seis colores (Arduino_Reto_Josue.ino) y cada color es una ruta de la tabla rutas
const LC = { 1: '#ff6a5e', 2: '#4d94ff', 3: '#3fca84' };
// las que llegan a la parada, en el orden en que las trae el mosaico Camión. rgb: lectura de ejemplo del sensor; hex y dark: franjas del camión.
// to (destino) solo donde el proyecto ya lo tenía; sign: letrero del camión
const ROUTES = [
  { n: 2, line: 'azul', word: 'AZUL', to: 'Rancho IoT', sign: '2  RANCHO IOT', rgb: [24, 96, 231], hex: 0x267dc0, dark: 0x162660 },
  { n: 1, line: 'roja', word: 'ROJO', to: '', sign: '1  ROJA', rgb: [231, 52, 40], hex: 0xd63a2e, dark: 0x8a1f17 },
];
const bul = (x, y, n) => `<circle cx="${x}" cy="${y}" r="10" fill="${LC[n]}"/><text class="num" x="${x}" y="${y + 4}">${n}</text>`;
const stn = (x, y, n) => `<circle cx="${x}" cy="${y}" r="5" fill="#0b1433" stroke="${LC[n]}" stroke-width="3"/>`;
// plano tipo metro: tres líneas que pasan por SafeWait; la que llegó va resaltada y encima. Cada línea va en un grupo con sus círculos, así la transparencia no marca el empalme
const MAP = `<svg viewBox="0 0 346 168" role="img">
  <g data-line="3" class="dim"><path class="ln" stroke="${LC[3]}" stroke-width="7" d="M70 150V118L98 90H250L286 126V156"/>${bul(70, 150, 3)}</g>
  <g data-line="1" class="dim"><path class="ln" stroke="${LC[1]}" stroke-width="7" d="M22 34H104L140 70H206L246 110H326"/>${stn(104, 34, 1)}${stn(246, 110, 1)}${bul(22, 34, 1)}${bul(326, 110, 1)}</g>
  <g data-line="2" class="dim"><path class="ln" stroke="${LC[2]}" stroke-width="7" d="M22 126H88L134 80H232L266 46H322"/>${stn(88, 126, 2)}${stn(232, 80, 2)}${bul(22, 126, 2)}${bul(322, 46, 2)}</g>
  <rect x="164" y="60" width="18" height="40" rx="9" fill="#fff"/>
  <text class="lbl" x="173" y="52">SafeWait</text>
  <text class="sub" data-line="2" x="322" y="26">Rancho IoT</text>
</svg>`;

const app = document.createElement('div');
app.id = 'app';
app.innerHTML = `
<a class="skip" href="#nodos">Saltar al contenido</a>
<nav class="bar glass glass-d" aria-label="Secciones">
  <a class="bar-logo" href="#inicio" aria-label="SafeWait, ir al inicio"><img src="/safewait-logo.svg" alt="" width="28" height="28"></a>
  <div class="stops"><span class="lens" aria-hidden="true"></span>${STOPS.map(([id, t]) => `<a href="#${id}" data-stop="${id}">${t}</a>`).join('')}</div>
</nav>

<main>
  <section class="scr hero" id="inicio" data-section="inicio">
    <div class="glow" aria-hidden="true"></div>
    <div class="view" id="v-hero" role="img" aria-label="Maqueta del paradero de noche, con la luz de la caseta encendida"><canvas></canvas></div>
    <header class="hero-head">
      <h1><img src="/safewait-logo.svg" alt="" width="48" height="48">SafeWait</h1>
      <p>Esperar ya no es un riesgo.</p>
    </header>
    <div class="card glass">
      <p>Un paradero inteligente, seguro y funcional.</p>
      <a class="btn btn-w" href="#nodos">${ic('play', 18)}Simulador</a>
    </div>
  </section>

  <section class="scr ctl" id="nodos" data-section="nodos">
    <div class="glow" aria-hidden="true"></div>
    <div class="view" id="v-ctl" role="img" aria-label="Maqueta 3D del paradero. Desliza a los lados para girarla."><canvas></canvas><div class="parts" id="parts" inert><svg aria-hidden="true"></svg></div></div>
    <div class="tools">
      <button type="button" class="round glass glass-d ex" id="exBtn" aria-pressed="false">${ic('explode', 20)}<span>Vista explotada</span></button>
      <button type="button" class="round glass glass-d" id="roofBtn" aria-pressed="false" aria-label="Quitar techo">${ic('roof', 20)}</button>
      <button type="button" class="round glass glass-d" id="realBtn" aria-pressed="false" aria-label="Materiales reales">${ic('layers', 20)}</button>
    </div>
    <section class="panel glass glass-d" aria-label="Centro de control">
      <div class="status" id="status" aria-live="polite"></div>
      <button type="button" class="map" id="map" aria-label="Cerrar el mapa de rutas" tabindex="-1">
        <span class="map-head"><span class="map-n"></span><span><b></b><i></i></span><span class="map-x">${ic('x', 18)}</span></span>
        ${MAP}
      </button>
      <div class="tiles">${TILES.map(([k, icon, t]) => `<button type="button" class="tile" data-tile="${k}" aria-pressed="false"><span class="tile-ic">${ic(icon)}</span><span><b>${t}</b><i></i></span></button>`).join('')}</div>
    </section>
  </section>

  <section class="scr team" id="equipo" data-section="equipo">
    <span class="dawn" aria-hidden="true"></span>
    <h2 class="team-title">Equipo</h2>
    <ul class="people glass-l">
      ${TEAM.map((p, i) => `<li><span class="n">${i + 1}</span><span><b>${p.name}</b><i><strong>${p.extra}</strong>, ${p.area}</i></span></li>`).join('')}
      <li><span class="n n-b">${ic('cap', 18)}</span><span><b>${TEACHERS}</b><i>Profesoras</i></span></li>
    </ul>
    <h2 class="flow-title">Del sensor al dashboard</h2>
    <div class="flow glass-l"><ol>${FLOW.map(t => `<li><span></span>${t}</li>`).join('')}</ol></div>
    ${CONFIG.lookerUrl ? `<div class="links"><a class="btn glass-l" href="${CONFIG.lookerUrl}" target="_blank" rel="noopener">${ic('chart', 18)}Ver dashboard</a></div>` : ''}
  </section>
</main>`;
[...document.body.children].forEach(n => { if (!/^(SCRIPT|STYLE|LINK)$/.test(n.tagName)) n.remove(); });
document.body.prepend(app);
const themeMeta = $('meta[name="theme-color"]');
const setTheme = light => {
  document.documentElement.dataset.tema = light ? 'claro' : 'noche';
  if (themeMeta) themeMeta.content = light ? '#f4f8fc' : '#0b1433';
};
setTheme(false);

// Mientras llega el modelo no hay rueda de espera: el resplandor de la caseta late donde va a aparecer.
// Cuando el 3D está listo (o si no hay 3D), sube desde donde iba hasta su brillo normal.
const heroGlowEl = $('.hero .glow');
let breath = !reduceMotion && heroGlowEl.animate ? heroGlowEl.animate([{ opacity: .2 }, { opacity: .62 }, { opacity: .2 }], { duration: 2600, iterations: Infinity, easing: 'ease-in-out' }) : null;
function glowReady() {
  if (!breath) return;
  const from = getComputedStyle(heroGlowEl).opacity;
  breath.cancel(); breath = null;
  heroGlowEl.animate([{ opacity: from }, { opacity: 1 }], { duration: 900, easing: 'ease-out' });
}

/* ---------- barra de paradas ---------- */
const stopLinks = $$('.stops a'), lens = $('.lens');
let stopNow = -1;
function placeLens() {
  const a = stopLinks[stopNow]; if (!a) return;
  lens.style.width = a.offsetWidth + 'px';
  lens.style.transform = `translateX(${a.offsetLeft}px)`;
}
function setStop(i) {
  if (i === stopNow) return;
  stopNow = i;
  stopLinks.forEach((a, k) => {
    a.classList.toggle('on', k === i);
    if (k === i) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
  });
  placeLens();
}
new ResizeObserver(placeLens).observe($('.stops'));
if (document.fonts) document.fonts.ready.then(placeLens);
setStop(0);
const sections = $$('main > section');
const stopIO = new IntersectionObserver(es => {
  for (const e of es) if (e.isIntersecting) setStop(sections.indexOf(e.target));
}, { rootMargin: '-45% 0px -45% 0px' });
sections.forEach(x => stopIO.observe(x));
// la barra pasa a vidrio claro cuando la parte ya clara de Equipo llega arriba (no antes: el amanecer empieza oscuro)
new IntersectionObserver(es => setTheme(es[0].isIntersecting), { rootMargin: '-60px 0px -88% 0px' }).observe($('.team .dawn'));
// anclas: scroll nativo (suave salvo con movimiento reducido)
const goTo = id => $('#' + id).scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
app.addEventListener('click', e => {
  const a = e.target.closest('a[href^="#"]'); if (!a) return;
  e.preventDefault();
  goTo(a.getAttribute('href').slice(1));
});

/* ---------- escena ---------- */
let stage = null, details = null;
const gl = document.createElement('canvas');
try { stage = new Stage(gl, { mobile: true, reduceMotion, offscreen: true, dpr: Math.min(window.devicePixelRatio || 1, 2), intro: 'explode' }); } catch (err) { console.error(err); }
function no3D() { stage = null; document.documentElement.classList.add('no-3d'); glowReady(); }
if (!stage) no3D();

// maqueta de los videos: azul claro de un solo tono, puertas con retícula, keypad de membrana, banca y pinitos
const TONE = { wall: 0x6ab2f2, frame: 0x7cbdf5, floor: 0x58a5ea, base: 0x5aa8ec, grass: 0x4c98df, corner: 0x3d88d2, door: 0xf2f8fe, pcb: 0x1a4c80, fsr: 0x162660, bars: 0x6ab2f2, keypad: 0x58a5ea, pulley: 0x4c98df, guide: 0x58a5ea };
const EDGE = new THREE.Color(0x3f86c9);
let doorMat = null, doorMatR = null, bus = null, realNow = false, swapReal = () => {}, spread = () => {}, sosFx = () => {}, drawOled = () => {};
let SOS_AT = V(FSR.x, 21.36, CAD.backInnerZ + 2.4), exNow = 0, exNight = 0;
const EDGE_X = new THREE.Color(0x17407f), EDGE_XN = new THREE.Color(0x8fc2ff);
const EDGE_R = new THREE.Color(0x6b4a2a);
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
  { // materiales reales, como la maqueta física: madera clara y puerta de papel
    const R = stage.M.real;
    R.keypad = R.floor; R.wall.color.setHex(0xf2e2c8); R.frame.color.setHex(0xeedcc0);
    doorMatR = R.door; doorMatR.color.setHex(0xf3ebdb); doorMatR.roughness = .92; doorMatR.emissive.set(0xfff0d0); doorMatR.emissiveIntensity = 0;
  }
  const doorSync = doorGrids(stage, 0x162660);
  // sensor del SOS: sale horizontal por la ranura del muro del fondo y descansa en una repisa
  const SOS_P = SOS_AT;
  for (const m of stage.meshes) {
    const g = m.geometry.parameters || {};
    if (m.userData.cls !== 'fsr') continue;
    if (g.radiusTop === 0.9) { m.rotation.set(0, 0, 0); m.position.copy(SOS_P); }
    else if (g.width === 0.5 && g.depth === 0.04) {
      m.geometry.dispose(); m.geometry = new THREE.BoxGeometry(0.5, 0.04, 1.7);
      m.position.set(FSR.x, SOS_P.y - 0.01, CAD.backInnerZ + 0.06 + 0.85);
    }
  }
  { // pantalla OLED: los tres renglones que dibuja el nodo (mostrar() en Arduino_Reto_Josue.ino), solo texto y en un tono, como la pantalla real
    const c = stage.oledTex.image, K = 2, w = c.width, h = c.height;
    c.width = w * K; c.height = h * K;   // al doble: la cámara se le acerca mucho
    const SANS = '"Inter Variable", Inter, system-ui, sans-serif', HEAD = '"Inter Tight Variable", "Inter Tight", system-ui, sans-serif';
    drawOled = r => {
      const g = c.getContext('2d');
      g.setTransform(K, 0, 0, K, 0, 0);
      g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
      g.textBaseline = 'alphabetic'; g.textAlign = 'left';
      g.fillStyle = '#9fd0f5'; g.font = `500 17px ${SANS}`; g.fillText('Color detectado:', 12, 27);
      g.fillStyle = '#eaf6ff'; g.font = `700 54px ${HEAD}`; g.fillText(r.word, 10, 82);
      g.fillStyle = '#9fd0f5'; g.font = `500 17px ${SANS}`; g.fillText(`R:${r.rgb[0]}  G:${r.rgb[1]}  B:${r.rgb[2]}`, 12, 113);
      stage.oledTex.needsUpdate = true;
    };
    drawOled(ROUTES[0]);
  }
  details = buildDetails(stage);
  const detailsR = buildDetails(stage, { tone: 0xd8bf96, leaf: 0x4f8a3c, trunk: 0x7a5a3a, real: true });
  const upd = details.update.bind(details);
  details.update = (t, k) => { upd(t, k); detailsR.update(t, k); };
  const shelf = new THREE.MeshStandardMaterial({ color: TONE.floor, roughness: .9 });
  // cada vista elige su juego de detalles justo antes de dibujarse
  swapReal = real => {
    realNow = real;
    // se fija sin mirar el valor anterior: si dos vistas se dibujan en el mismo cuadro, la primera no le apaga las piezas a la segunda
    for (const p of details.pieces) p.group.visible = !real || !!p.group.userData.both;   // la repisa del SOS va en las dos versiones
    for (const p of detailsR.pieces) p.group.visible = real;
    shelf.color.setHex(real ? 0xd8bf96 : TONE.floor);
    for (const m of doorSync.mats) m.color.setHex(real ? 0x2b2320 : 0x162660);
  };
  // camión del video: llega por la derecha, hacia −x; la toma de la ruta deja los bordes de la maqueta fuera de cuadro
  bus = makeBus({ clipX: 1e5, mirror: true, route: ROUTES[0].sign });
  bus.group.position.set(0, CAD.baseTop, CAD.streetZ);
  bus.group.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  stage.root.add(bus.group);
  bus.setX(null);
  { // repisa bajo el sensor del SOS
    const g = new THREE.Group(), geo = new THREE.BoxGeometry(2.5, 0.3, 3.6); g.userData.both = true;
    geo.translate(SOS_P.x, SOS_P.y - 0.19, CAD.backInnerZ + 1.8);
    const m = new THREE.Mesh(geo, shelf); m.castShadow = m.receiveShadow = true; g.add(m);
    details.piece(g, 1.25);
  }
  { // vista explotada: los detalles siguen a su capa (banca con el piso, pinitos con la banqueta, keypad sobre su tapa, repisa con el muro)
    const moves = [[details.pieces[0], detailsR.pieces[0], [0, EX.floor, 0]], [details.pieces[1], detailsR.pieces[1], [0, EX.walk, 0]], [details.pieces[2], detailsR.pieces[2], [0, EX.lid + 4, 0]], [details.pieces[3], null, [0, EX.wall, -3]]];
    spread = (e, night = 0) => {
      exNow = e; exNight = night;
      for (const [a, b, [x, y, z]] of moves) {
        const k = e > 0 ? exK(e, Math.hypot(x, y, z)) : 0;
        a.group.position.set(x * k, y * k, z * k); if (b) b.group.position.copy(a.group.position);
      }
      bus.group.position.y = CAD.baseTop + (e > 0 ? exK(e, EX.top) * EX.top : 0);
    };
  }
  { // ondas del SOS: un toque en el sensor de fuerza y, desde el buzzer, anillos tipo sonar que crecen y se apagan
    const RED = 0xff5a4e, LIFE = 1.7, GAP = LIFE / 3;
    const waves = [0, 1, 2].map(() => makeWave(stage.root, { color: RED, size: 13 }));
    const core = makeWave(stage.root, { color: RED, size: 2.4 }), touch = makeWave(stage.root, { color: 0xffffff, size: 4 });
    const all = [...waves, core, touch];
    all.forEach(w => { w.mesh.material.depthTest = false; w.mesh.renderOrder = 6; });
    // t: reloj de las ondas (negativo = nada); until: el buzzer deja de emitir en ese instante; e: vista explotada
    sosFx = (t, until = Infinity, e = 0) => {
      if (t < 0) { all.forEach(w => { w.mesh.visible = false; }); return; }
      const up = e > 0 ? exK(e, EX.part) * EX.part : 0, upW = e > 0 ? exK(e, EX.wall) * EX.wall : 0;
      waves.forEach((w, i) => {
        const tt = t - i * GAP, born = Math.floor(tt / LIFE) * LIFE + i * GAP;
        w.mesh.position.set(BUZZER.x, BUZZER.y + 0.5 + up, BUZZER.z);
        if (reduceMotion) { w.glow(i ? 0 : t < until ? .7 : 0, 5.5, .12, .1); return; }
        w.play(tt < 0 || born >= until ? -1 : (tt % LIFE) / LIFE, { r0: .8, r1: 12.5, w: .5, a: 1, fill: .22 });
      });
      core.mesh.position.set(BUZZER.x, BUZZER.y + 0.52 + up, BUZZER.z);
      core.glow(t < until ? .55 + .3 * Math.sin(t * Math.PI * 2 / GAP) : 0, 1.0, .9, .18);
      touch.mesh.position.set(SOS_AT.x, SOS_AT.y + 0.12 + upW, SOS_AT.z - (e > 0 ? exK(e, EX.wall) * 3 : 0));
      touch.play(reduceMotion ? -1 : t / .9, { r0: .3, r1: 3.6, w: .14, a: .95, fill: .25 });
    };
    sosFx.life = LIFE;
  }
  const edgeObjs = [];
  stage.scene.onBeforeRender = () => {
    doorSync();
    if (!edgeObjs.length) for (const m of stage.meshes) if (m.userData.edges) edgeObjs.push(m.userData.edges);
    const ec = realNow ? EDGE_R : EDGE;
    stage.edgeMat.color.copy(ec);
    for (const e of edgeObjs) if (e.userData.clipMat) e.userData.clipMat.color.copy(ec);
    if (exNow > 0) { // vista explotada: aristas marcadas, como en un plano, para que cada pieza se distinga de día y de noche
      const m = stage.edgeMat;
      m.color.lerp(exNight > .5 ? EDGE_XN : realNow ? EDGE_R : EDGE_X, exNow);
      m.opacity += ((exNight > .5 ? .5 : .95) - m.opacity) * exNow;
    }
  };
}

/* ---------- vistas: lienzo 2D + cámara + estado ---------- */
const views = [];
function makeView(id) {
  const el = $(id), canvas = $('canvas', el);
  const v = stage ? stage.addView(el) : { el, camera: new THREE.PerspectiveCamera(30, 1, 1, 1500), state: defaultState() };
  Object.assign(v, { canvas, w: 0, h: 0, shown: false, dirty: true, pre: false, update: null });
  // margen de −2 px: una vista que apenas toca el borde de la pantalla (Inicio, con la página detenida justo en Nodos) no se dibuja
  new IntersectionObserver(es => { v.shown = es[0].isIntersecting; if (v.shown) kick(); }, { rootMargin: '-2px 0px' }).observe(el);
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
  details.update(99, 1);   // la entrada junta la maqueta ya dibujada: los detalles no se revelan con plano de corte
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
  if (doorMat) { doorMat.emissive.setHex(0xcfe6ff); doorMat.emissiveIntensity = .5; }
  swapReal(false); if (bus) bus.setX(null); spread(stage.asm.ex); sosFx(-1);
  if (!heroGlow) { heroGlow = true; glowAt(v, heroSec); }
};
hero.update = dt => {
  if (reduceMotion) return false;
  heroT += dt; heroAcc += dt;
  if (heroAcc >= 1 / 31) { heroAcc = 0; hero.dirty = true; } // mecerse despacio no pide más de 30 cuadros por segundo
  return true;
};

/* ---------- Nodos: centro de control ---------- */
const ctlSec = $('#nodos'), ctl = makeView('#v-ctl');
const status = $('#status'), tiles = Object.fromEntries($$('.tile').map(b => [b.dataset.tile, b]));
// cámara en órbita: objetivo, giro, elevación y radio de lo que debe caber
const HOME = { tgt: V(-2, 15, -3), az: 0.55, el: 0.4, r: 43 };
const SHOTS = {
  light: { tgt: V(-5, 23, -12), az: 0.42, el: 0.3, r: 30 },
  sos: { tgt: V(5, 22, -17), az: 0.62, el: 0.5, r: 27 },
  door: { tgt: V(-7, 23, -12), az: 0.22, el: 0.2, r: 19 },
  route: { tgt: V(4, 20, -3), az: 0.12, el: 0.36, r: 22 },
  oled: { tgt: V(-21.9, 27.3, -20.39), az: 1.36, el: 0.22, r: 2.3 },
  bars: { tgt: V(-5, 24, -12), az: -0.24, el: 0.26, r: 31 },
};
const cam = { tgt: HOME.tgt.clone(), az: HOME.az - .5, el: HOME.el, r: HOME.r, goal: HOME, vel: 0, drag: false, k: 0, dur: 1.8, from: { tgt: HOME.tgt.clone(), az: HOME.az - .5, el: HOME.el, r: HOME.r } };
const inOut = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
function fitDist(c, r) {
  const v = THREE.MathUtils.degToRad(c.fov) / 2, h = Math.atan(Math.tan(v) * c.aspect);
  return r / Math.sin(Math.min(v, h));
}
// viaje de cámara: de donde está al encuadre, con arranque y llegada suaves (el acercamiento va en escala logarítmica)
function shoot(shot, dur = 1.5) {
  cam.goal = { ...shot, tgt: shot.tgt.clone() };
  cam.from = { tgt: cam.tgt.clone(), az: cam.az, el: cam.el, r: cam.r };
  cam.k = 0; cam.dur = dur; cam.vel = 0; invalidate(ctl);
}
function holdCam() { cam.k = 1; cam.goal = { tgt: cam.tgt.clone(), az: cam.az, el: cam.el, r: cam.r }; }

const EXPLODED = { tgt: V(-1, 37, -2), az: 0.6, el: 0.3, r: 49 };
const C = { night: 1, lamp: 1, door: 0, bars: 0, roof: 0, explode: 0 };     // metas (0 o 1)
let waveT = -1, waveEnd = Infinity;   // reloj de las ondas del SOS: siguen un momento después de que la alerta termina
let sosT = -1, busT = -1, busPhase = '', busMark = 0, busX = null, roofTmp = 0, mapClose = false;
// el mapa se queda poco tiempo: mientras está abierto tapa los mosaicos
const SOS_DUR = 6, BUS = { in: 2.2, zoom: 1.7, map: 3.4, out: 2, far: 82, stop: 15 };
const SOS_RED = 0xff2a1f, SOS_BLUE = 0x1436ff;   // azul eléctrico: la maqueta ya es azul claro y el de siempre no se distinguía
let routeI = -1, route = ROUTES[0];
const mapEl = $('#map'), panel = $('.panel');
function showMap(on) { panel.classList.toggle('mapping', on); mapEl.tabIndex = on ? 0 : -1; }
// ruta que llega: letrero y franjas del camión, pantalla OLED y línea resaltada en el mapa
function setRoute(i) {
  routeI = i; route = ROUTES[i];
  if (bus) bus.setRoute(route.sign, route.hex, route.dark);
  drawOled(route);
  const svg = $('svg[role="img"]', mapEl), on = $(`g[data-line="${route.n}"]`, svg);
  $$('g[data-line]', svg).forEach(g => g.classList.toggle('dim', g !== on));
  svg.insertBefore(on, $('rect', svg));   // la línea que llegó se dibuja encima de las otras
  $$('.sub', svg).forEach(t => { t.style.display = t.dataset.line === String(route.n) ? '' : 'none'; });
  svg.setAttribute('aria-label', `Mapa simulado de rutas; la Ruta ${route.n}, ${route.line}, es la que llegó a SafeWait`);
  mapEl.style.setProperty('--rc', LC[route.n]);
  $('.map-n', mapEl).textContent = route.n;
  $('.map-head b', mapEl).textContent = `Llegó la Ruta ${route.n}`;
  $('.map-head i', mapEl).textContent = `Línea ${route.line}${route.to ? `, a ${route.to}` : ''}`;
}
setRoute(0); routeI = -1;   // el primer camión es el de la Ruta 2, azul
mapEl.addEventListener('click', () => { mapClose = true; invalidate(ctl); });
Object.assign(ctl.state, { night: 1, lamp: 1, dark: 1 });
ctl.onFrame = v => {
  const c = v.camera;
  c.clearViewOffset(); c.updateProjectionMatrix();
  orbit(c, cam.tgt, cam.az, cam.el, fitDist(c, cam.r));
  // las puertas de papel dejan pasar la luz de adentro; en una alerta toman su color, también de día
  const led = v.state.led, glow = led != null ? Math.min(1.1, .45 + v.state.lamp * .3) : v.state.lamp * v.state.night * .5;
  if (doorMat) { doorMat.emissive.setHex(led ?? 0xcfe6ff); doorMat.emissiveIntensity = glow; }
  if (doorMatR) { doorMatR.emissive.setHex(led ?? 0xfff0d0); doorMatR.emissiveIntensity = glow; }
  swapReal(v.state.real); if (bus) bus.setX(busX);
  spread(stage.exOf(v.state), v.state.night); sosFx(waveT, waveEnd, v.state.explode);
  placeParts(v);
};

/* vista explotada: cada componente con su etiqueta; al tocarla, el panel dice qué hace */
const partsEl = $('#parts'), partsSvg = $('svg', partsEl);
const PARTS = [
  [1, 'Tira LED', ANCHORS.light, [0, EX.wall, -3], 'Tira LED WS2812B: ilumina la caseta cuando oscurece.'],
  [4, 'Pantalla OLED', V(OLED.x, OLED.y, OLED.z), [-3, EX.wall, 0], 'Pantalla OLED: muestra la ruta que acaba de llegar.'],
  [2, 'Sensor de fuerza', SOS_AT, [0, EX.wall, -3], 'Sensor de fuerza FSR: al presionarlo se pide auxilio.'],
  [3, 'Puerta', ANCHORS.door, [0, EX.wall, EX.out + 9], 'Puerta: un lector NFC valida la tarjeta y un servo la abre.'],
  [5, 'Barrotes', V(-17.2, 9, -10.1), [0, 0, 0], 'Barrotes: un motor a pasos los sube frente a las ventanas.'],
  [2, 'Buzzer', V(BUZZER.x, BUZZER.y + .3, BUZZER.z), [0, EX.part, 0], 'Buzzer: suena la alarma cuando alguien pide auxilio.'],
  [1, 'Fotorresistencia', V(LDR.x, LDR.y + .2, LDR.z), [0, EX.part, 0], 'Fotorresistencia: mide la luz ambiente desde el módulo.'],
  [5, 'Keypad', V(19.2, 19.4, -16.1), [0, EX.lid + 4, 0], 'Keypad: con el código correcto suben los barrotes.'],
  [4, 'Sensor de color', V(ANCHORS.route.x, 16, ANCHORS.route.z), [0, 13, 0], 'Sensor de color TCS34725: lee la franja bajo el camión.'],
].map(([n, name, at, ex, text]) => {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'part'; b.innerHTML = `<b>${n}</b>${name}`;
  b.setAttribute('aria-label', `${name}, nodo ${n}`);
  const dot = document.createElement('i'); dot.className = 'part-dot';
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  partsSvg.append(line); partsEl.append(dot, b);
  const part = { n, at, ex: V(...ex), len: Math.hypot(...ex), side: '', b, dot, line, w: 0, x: 0, y: 0, px: 0, py: 0 };
  b.addEventListener('click', () => {
    PARTS.forEach(q => q.b.classList.toggle('on', q === part));
    say(n, text);
  });
  return part;
});
const PART_H = 26, barEl = $('.bar'), exBtnEl = $('#exBtn');
function placeParts(v) {
  const e = v.state.explode, a = ramp(e, .72, 1);
  partsEl.style.opacity = a.toFixed(3);
  partsEl.style.visibility = a > 0 ? 'visible' : 'hidden';
  if (a <= 0 || !v.w) return;
  // el punto va sobre el componente; las etiquetas se acomodan en dos columnas, a los lados de la maqueta, sin encimarse
  const y0 = v.el.getBoundingClientRect().top;
  const top = Math.max(8, barEl.getBoundingClientRect().bottom - y0 + 10), topR = Math.max(top, exBtnEl.getBoundingClientRect().bottom - y0 + 10);   // con la maqueta explotada solo queda ese botón
  const bottom = panel.getBoundingClientRect().top - y0 - PART_H - 10;
  for (const p of PARTS) {
    if (!p.w) p.w = p.b.offsetWidth;
    tmp.copy(p.at).addScaledVector(p.ex, exK(e, p.len)).project(v.camera);
    p.x = (tmp.x * .5 + .5) * v.w; p.y = (-tmp.y * .5 + .5) * v.h;
  }
  // mitad de las etiquetas a cada lado: el corte es la mediana; una etiqueta cambia de lado solo si lo cruza con margen
  const mid = [...PARTS].sort((q, r) => q.x - r.x)[(PARTS.length + 1) >> 1].x - 1;
  for (const p of PARTS) if (!p.side || (p.side === 'l' ? p.x > mid + 22 : p.x < mid - 22)) p.side = p.x < mid ? 'l' : 'r';
  for (const side of ['l', 'r']) {
    const col = PARTS.filter(p => p.side === side).sort((q, r) => q.y - r.y);
    // en pantallas bajas la columna derecha no cabe bajo los botones: se recorre a su lado
    const tight = side === 'r' && bottom - topR < (col.length - 1) * (PART_H + 8), lo = side === 'r' && !tight ? topR : top;
    col.forEach((p, i) => { p.py = Math.max(clamp(p.y - PART_H / 2, lo, bottom), i ? col[i - 1].py + PART_H + 8 : lo); });
    for (let i = col.length - 1; i >= 0; i--) col[i].py = Math.min(col[i].py, i < col.length - 1 ? col[i + 1].py - PART_H - 8 : bottom);
    for (const p of col) {
      p.px = side === 'l' ? 8 : v.w - p.w - (tight ? 62 : 8);
      p.b.style.transform = `translate(${p.px.toFixed(1)}px, ${p.py.toFixed(1)}px)`;
      p.dot.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`;
      p.line.setAttribute('x1', p.x.toFixed(1)); p.line.setAttribute('y1', p.y.toFixed(1));
      p.line.setAttribute('x2', (side === 'l' ? p.px + p.w : p.px).toFixed(1)); p.line.setAttribute('y2', (p.py + PART_H / 2).toFixed(1));
    }
  }
}
const approach = (cur, tgt, rate, dt) => {
  if (reduceMotion) return tgt;
  const n = cur + (tgt - cur) * Math.min(1, dt * rate);
  return Math.abs(tgt - n) < .002 ? tgt : n;
};
ctl.update = (dt, now) => {
  const s = ctl.state;
  let moving = false;
  const prev = [s.night, s.lamp, s.door, s.bars, s.roof, cam.az, cam.el, cam.r, cam.tgt.x, cam.tgt.y, cam.tgt.z, busX, waveT, s.oled, s.led, s.explode];
  // cámara
  if (!cam.drag) {
    if (cam.k < 1) {
      cam.k = reduceMotion ? 1 : Math.min(1, cam.k + dt / cam.dur);
      const e = inOut(cam.k), f = cam.from, g = cam.goal;
      cam.az = f.az + (g.az - f.az) * e; cam.el = f.el + (g.el - f.el) * e;
      cam.r = Math.exp(Math.log(f.r) + (Math.log(g.r) - Math.log(f.r)) * e);
      cam.tgt.lerpVectors(f.tgt, g.tgt, e);
    } else if (Math.abs(cam.vel) > .02) { cam.goal.az += cam.vel * dt; cam.az = cam.goal.az; cam.vel *= Math.exp(-4 * dt); }
    else cam.vel = 0;
  }
  // piezas
  s.night = approach(s.night, C.night, 2.2, dt); s.dark = s.night;
  s.door = approach(s.door, C.door, 3, dt);
  s.bars = approach(s.bars, C.bars, 1.5, dt);
  s.roof = approach(s.roof, Math.max(C.roof, roofTmp), 3.5, dt);
  // vista explotada: avanza parejo y cada pieza suaviza su tramo. El pedestal se vuelve translúcido y deja ver los barrotes
  s.explode = reduceMotion ? C.explode : clamp(s.explode + (C.explode ? dt : -dt) / 1.25);
  s.xray = smooth(ramp(s.explode, .18, 1)) * .5;   // empieza cuando las capas ya se separaron y llega suave
  // SOS: ondas desde el buzzer y la tira LED alternando rojo y azul
  let lamp = C.lamp, led = null;
  if (waveT >= 0) { waveT += dt; moving = true; if (waveT > waveEnd + sosFx.life) waveT = -1; }
  if (sosT >= 0) {
    sosT += dt;
    // el azul va más intenso que el rojo para que se note igual sobre la maqueta azul
    const blue = Math.floor(sosT / .28) % 2;
    led = blue ? SOS_BLUE : SOS_RED; lamp = blue ? 2.2 : 1;
    if (sosT >= SOS_DUR) { sosT = -1; waveEnd = waveT; say(2, 'Alerta terminada. En la maqueta dura 10 segundos.'); paint(); }
    moving = true;
  } else {
    if (C.bars) { // barrotes arriba: destellos rojos
      led = SOS_RED; lamp = Math.floor(now / .32) % 2 ? 1 : .12;
      moving = true;
    }
  }
  s.led = led;
  s.lamp = led ? lamp : approach(s.lamp, lamp, 2.6, dt);
  // camión: llega por la derecha, se detiene sobre el sensor de color, la cámara va a la pantalla y aparece el mapa
  s.busX = null;
  if (busT >= 0) {
    busT += dt;
    const stop = BUS.stop;
    if (busPhase === 'in') {
      busX = BUS.far + (stop - BUS.far) * easeOut(clamp(busT / BUS.in));
      if (busT >= BUS.in) { busPhase = 'oled'; busMark = busT; roofTmp = 1; shoot(SHOTS.oled, 1.6); say(4, `El sensor leyó su color: ${route.word.toLowerCase()}.`); paint(); }
    } else if (busPhase === 'oled') {
      busX = stop;
      if (busT - busMark >= BUS.zoom) { busPhase = 'map'; busMark = busT; mapClose = false; showMap(true); say(4, `Ruta ${route.n}: la pantalla de la caseta avisa cuál llegó.`); paint(); }
    } else if (busPhase === 'map') {
      busX = stop;
      if (mapClose || busT - busMark >= BUS.map) { busPhase = 'out'; busMark = busT; showMap(false); roofTmp = 0; shoot(SHOTS.route, 1.6); paint(); }
    } else {
      const k = clamp((busT - busMark) / BUS.out);
      busX = stop + (-BUS.far - stop) * easeIn(k);
      if (k >= 1) { busT = -1; busX = null; busPhase = ''; paint(); }
    }
    s.oled = approach(s.oled, busPhase === 'oled' || busPhase === 'map' ? 1 : 0, 6, dt);
    moving = true;
  } else { busX = null; s.oled = approach(s.oled, 0, 6, dt); }

  const cur = [s.night, s.lamp, s.door, s.bars, s.roof, cam.az, cam.el, cam.r, cam.tgt.x, cam.tgt.y, cam.tgt.z, busX, waveT, s.oled, s.led, s.explode];
  if (cur[11] !== prev[11]) stage.shadowKey = ''; // el camión se movió: su sombra también
  if (cur.some((x, i) => x !== prev[i])) { ctl.dirty = true; moving = true; }
  return moving || cam.drag;
};

const NODE_IC = ['hand', 'bulb', 'bell', 'door', 'bus', 'bars'];
function say(n, text, tone = '') {
  const node = NODES[n - 1];
  status.className = 'status' + (tone ? ' ' + tone : '');
  status.innerHTML = `<span class="st-ic">${ic(NODE_IC[n] || 'hand', 20)}</span><span class="st-tx"><i>${node ? `Nodo ${n}: ${node.name}` : 'Centro de control'}</i><p>${text}</p></span>`;
  void status.offsetWidth; status.classList.add('pop');
}
say(0, 'Toca un mosaico y mira la maqueta.');
function paint() {
  const st = {
    night: [C.night, C.night ? 'Activada' : 'Desactivada'],
    lamp: [C.lamp, C.lamp ? 'Encendida' : 'Apagada'],
    sos: [sosT >= 0, sosT >= 0 ? 'Alerta activa' : 'Pedir ayuda'],
    door: [C.door, C.bars ? 'Bloqueada' : C.door ? 'Abierta' : 'Usar tarjeta'],
    bus: [busT >= 0, busT < 0 ? 'Llamar ruta' : busPhase === 'in' ? 'En camino' : busPhase === 'out' ? 'Se va' : `Ruta ${route.n} llegó`],
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
    if (C.night) { // de noche la fotorresistencia manda: la luz no se puede apagar
      C.lamp = 1;
      say(1, 'De noche la luz no se apaga: la enciende la fotorresistencia.');
      tiles.lamp.classList.remove('deny'); void tiles.lamp.offsetWidth; tiles.lamp.classList.add('deny');
      shoot(SHOTS.light);
      return;
    }
    C.lamp = C.lamp ? 0 : 1;
    say(1, C.lamp ? 'Tira LED encendida dentro de la caseta.' : 'Tira LED apagada.');
    shoot(SHOTS.light);
  },
  sos() {
    if (sosT >= 0) { sosT = -1; waveEnd = waveT; say(2, 'Alerta cancelada.'); return; }
    sosT = 0; waveT = 0; waveEnd = Infinity;
    say(2, 'Auxilio: suena el buzzer y la tira LED alterna rojo y azul.', 'alert ping');
    shoot(SHOTS.sos);
  },
  door() {
    if (C.bars) {
      say(3, 'Acceso denegado: con los barrotes arriba la puerta no abre.', 'alert');
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
    if (busT >= 0) { if (busPhase === 'map') mapClose = true; return; }
    setRoute((routeI + 1) % ROUTES.length);   // cada llamada trae la ruta siguiente: azul, roja, azul…
    busT = 0; busPhase = 'in'; busX = BUS.far;
    say(4, 'Llega un camión a la parada.');
    shoot(SHOTS.route);
  },
  bars() {
    C.bars = C.bars ? 0 : 1;
    if (C.bars) C.door = 0;
    say(5, C.bars ? 'Barrotes arriba: la puerta se bloquea y la tira LED da la alerta.' : 'Barrotes abajo: la puerta vuelve a abrir con tarjeta.', C.bars ? 'alert' : '');
    shoot(SHOTS.bars);
  },
};
// vista explotada: la maqueta se separa por capas y la cámara se aleja para que quepa
const exBtn = $('#exBtn');
// encuadre de la vista explotada: a lo ancho cabe con r 49; en pantallas bajas manda el alto libre entre la barra y el panel
function explodedShot() {
  const c = ctl.camera, vh = THREE.MathUtils.degToRad(c.fov) / 2, half = Math.min(vh, Math.atan(Math.tan(vh) * c.aspect));
  const free = panel.offsetTop - barEl.getBoundingClientRect().bottom;
  const tall = ctl.h && free > 40 ? 50.5 / Math.tan(vh * .96 * Math.min(1, free / ctl.h)) : 0;
  return { ...EXPLODED, r: Math.max(EXPLODED.r, tall * Math.sin(half)) };
}
function setExplode(on, fly = true) {
  if (!!C.explode === !!on) return;
  C.explode = on ? 1 : 0;
  exBtn.setAttribute('aria-pressed', !!on);
  if (on) exBtn.setAttribute('aria-label', 'Armar maqueta'); else exBtn.removeAttribute('aria-label');   // explotada: solo el icono
  exBtn.classList.add('used');   // ya la probaron: deja de latir
  partsEl.inert = !on;
  // los otros botones se esconden mientras está explotada: dejan su lugar a las etiquetas
  ctlSec.classList.toggle('exploded', !!on); roofBtn.disabled = realBtn.disabled = !!on;
  PARTS.forEach(p => p.b.classList.remove('on'));
  if (on && busT >= 0) { busT = -1; busX = null; busPhase = ''; roofTmp = 0; showMap(false); paint(); }   // el camión no espera a que la armen
  if (fly) shoot(on ? explodedShot() : HOME, 1.7);
  invalidate(ctl);
}
exBtn.addEventListener('click', () => {
  if (!stage || !stage.ready) return;
  setExplode(!C.explode);
  say(0, C.explode ? 'Vista explotada: toca una etiqueta para ver cada componente.' : 'Maqueta armada de nuevo.');
});
$$('.tile').forEach(b => b.addEventListener('click', () => {
  if (!stage || !stage.ready) return;
  setExplode(false, false);
  ACT[b.dataset.tile](); paint(); invalidate(ctl);
}));
const roofBtn = $('#roofBtn');
roofBtn.addEventListener('click', () => {
  C.roof = C.roof ? 0 : 1;
  roofBtn.setAttribute('aria-pressed', !!C.roof);
  roofBtn.setAttribute('aria-label', C.roof ? 'Poner techo' : 'Quitar techo');
  if (C.roof && !C.explode) shoot({ ...HOME, el: 0.72 });
  invalidate(ctl);
});
const realBtn = $('#realBtn');
realBtn.addEventListener('click', () => {
  const on = ctl.state.real = !ctl.state.real;
  realBtn.setAttribute('aria-pressed', on);
  say(0, on ? 'Materiales reales: madera, como la maqueta física.' : 'Maqueta en azul SafeWait.');
  invalidate(ctl);
});
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
      d.on = true; cam.drag = true; holdCam(); d.x = e.clientX; d.az = cam.az; d.lx = e.clientX; d.lt = performance.now();
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
    // mientras llega el modelo, el resplandor ya late donde va a quedar la caseta (al dibujarse, glowAt lo afina)
    heroSec.style.setProperty('--gx', (hero.w / 2).toFixed(0) + 'px'); heroSec.style.setProperty('--gy', ((a + b) / 2 - 8).toFixed(0) + 'px');
  }
  heroGlow = false;
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
  // window.__swModel: el GLB ya descargado, para alojamientos que no sirven archivos .glb (la copia de revisión)
  Promise.resolve(window.__swModel || '/models/safewait.glb').then(m => stage.load(m)).then(async () => {
    await Promise.race([fonts, new Promise(r => setTimeout(r, 1200))]);
    stage.drawLogos(logoImg.complete && logoImg.naturalWidth ? logoImg : null);
    { const i = routeI; setRoute(Math.max(0, i)); routeI = i; }   // letrero del camión y pantalla OLED, ya con las fuentes de la página
    stage.assemble();
    glowReady();
    document.documentElement.classList.add('model-ready');
    layout(); invalidate();
  }).catch(err => { console.error(err); no3D(); });
}

/* ---------- modo stand: vuelve al inicio tras inactividad ---------- */
if (params.has('stand')) {
  let idle;
  const restart = () => {
    setExplode(false, false);
    Object.assign(C, { night: 1, lamp: 1, door: 0, bars: 0, roof: 0 }); sosT = busT = waveT = -1; busX = null; busPhase = ''; roofTmp = 0; showMap(false); routeI = -1;
    ctl.state.real = false; realBtn.setAttribute('aria-pressed', 'false');
    roofBtn.setAttribute('aria-pressed', 'false');
    say(0, 'Toca un mosaico y mira la maqueta.'); paint(); shoot(HOME);
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    setTimeout(() => { if (stage && stage.ready) { stage.assemble(); heroT = 0; invalidate(); } arm(); }, reduceMotion ? 0 : 1500);
  };
  const arm = () => { clearTimeout(idle); idle = setTimeout(restart, (parseFloat(params.get('stand')) || CONFIG.standIdleSeconds) * 1000); };
  ['pointerdown', 'keydown', 'touchstart', 'scroll'].forEach(ev => window.addEventListener(ev, arm, { passive: true }));
  arm();
}

if (import.meta.env.DEV) window.__sw = { stage, views, cam, C, invalidate };
