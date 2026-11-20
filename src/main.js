import '@fontsource-variable/inter';
import '@fontsource-variable/inter-tight';
import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import QRCode from 'qrcode';
import { CONFIG, NODES, TEAM } from './content.js';
import { Stage, ANCHORS, COLOR, CAD, defaultState } from './scene.js';
import { Route } from './route.js';

gsap.registerPlugin(ScrollTrigger);

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const easeOut = t => 1 - Math.pow(1 - t, 3);
const easeIn = t => t * t * t;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const tmpA = V(0, 0, 0), tmpB = V(0, 0, 0), tmpT = V(0, 0, 0);

const params = new URLSearchParams(location.search);
// ?quieto fuerza el modo sin animaciones (igual que "reducir movimiento" del sistema)
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches || params.has('quieto');
const mqMobile = window.matchMedia('(max-width: 820px)');
const isMobile = () => mqMobile.matches;
const standMode = params.has('stand');
document.documentElement.classList.toggle('reduce-motion', reduceMotion);

/* ---------- contenido generado ---------- */
$('#howStops').innerHTML = NODES.map(n => `<li data-i="${n.n - 1}"><span class="d"></span><span>${n.short}</span></li>`).join('');
$('#howSteps').innerHTML = NODES.map(n => `
  <article class="how-step" data-i="${n.n - 1}">
    <p class="step-num">Nodo ${n.n}, ${n.name}</p>
    <h3>${n.title}</h3>
    <p>${n.text}</p>
    <p class="step-flow"><span>${n.sensor}</span><span class="arrow" aria-hidden="true">→</span><span>${n.actuator}</span></p>
  </article>`).join('');
$('#nodesTable').innerHTML = NODES.map(n => `<tr><th scope="row"><span class="badge">${n.n}</span>${n.name}</th><td data-l="Sensor">${n.sensor}</td><td data-l="Actuador">${n.actuator}</td><td data-l="Responsable">${n.owner}</td></tr>`).join('');
$('#teamList').innerHTML = TEAM.map(p => `<li><b>${p.name}</b><span>${p.role}</span>${p.extra ? `<span class="extra">${p.extra}</span>` : ''}</li>`).join('');
$('#nodeStops').innerHTML = NODES.map(n => `<li><button type="button" data-node="${n.key}" aria-pressed="false"><span class="d">${n.n}</span><span class="t">${n.name}</span></button></li>`).join('');
if (CONFIG.lookerUrl) { const b = $('#lookerBtn'); b.href = CONFIG.lookerUrl; b.hidden = false; }

/* ---------- scroll suave ---------- */
let lenis = null;
if (!reduceMotion) {
  lenis = new Lenis({ anchors: { offset: -8 }, lerp: 0.11 });
  lenis.on('scroll', ScrollTrigger.update);
} else {
  $$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
    const t = $(a.getAttribute('href')); if (!t) return;
    e.preventDefault(); t.scrollIntoView({ behavior: 'auto' });
  }));
}
const scrollToY = (y, dur = 1.6) => lenis ? lenis.scrollTo(y, { duration: dur }) : window.scrollTo(0, y);

/* ---------- escena ---------- */
// sin WebGL (o si el modelo no carga) la página sigue: textos, navegación, QR y modo stand; se ocultan los visores
let stage = null;
try { stage = new Stage($('#gl'), { mobile: isMobile(), reduceMotion }); } catch (err) { console.error(err); }
function no3D() { document.documentElement.classList.add('no-3d'); $('#loadStatus').hidden = true; ScrollTrigger.refresh(); }
if (!stage) no3D();
// sin escena, las vistas son objetos sueltos para que el resto del código no truene (nunca se dibujan)
const addView = el => stage ? stage.addView(el) : { el, camera: new THREE.PerspectiveCamera(30, 1, 1, 1500), state: defaultState(), rect: el.getBoundingClientRect() };
const heroView = addView($('#view-hero'));
const howView = addView($('#view-how'));
const exView = addView($('#view-explore'));

// distancia para que una esfera de radio r quepa en la vista
function fitDist(cam, r) {
  const v = THREE.MathUtils.degToRad(cam.fov) / 2;
  const h = Math.atan(Math.tan(v) * cam.aspect);
  return r / Math.sin(Math.min(v, h));
}

// corre el centro de la vista hacia la derecha (el texto queda a la izquierda, sin cortar el modelo)
function shiftView(cam, rect, px) {
  const w = rect.width, h = rect.height;
  if (px && w / h > 1.1) cam.setViewOffset(w, h, -px, 0, w, h); else cam.clearViewOffset();
  cam.updateProjectionMatrix();
}

/* Hero: solo la pieza de arriba (sin pedestal), junto al texto; gira despacio y al hacer scroll la cámara sube un poco */
heroView.state.plinth = false;
const HERO_TGT = V(0, 21, -8);
// esquinas de la tapa y del techo: con ellas se mide cuánto ocupa la maqueta en pantalla
const HERO_PTS = [];
[-33.5, 33.5].forEach(x => [-32.71, 17.29].forEach(z => HERO_PTS.push(V(x, 15.07, z))));
[-22.6, 8.4].forEach(x => [-23.9, -10.9].forEach(z => HERO_PTS.push(V(x, 35.5, z))));
let heroAngle = 0.62;
const heroCopy = $$('.hero-copy > *');
function heroOrbit(c, angle, el, d) {
  c.position.set(HERO_TGT.x + Math.sin(angle) * Math.cos(el) * d, HERO_TGT.y + Math.sin(el) * d, HERO_TGT.z + Math.cos(angle) * Math.cos(el) * d);
  c.lookAt(HERO_TGT); c.updateMatrixWorld();
}
function heroBox(c, W, H) {
  let x1 = Infinity, x2 = -Infinity, y1 = Infinity, y2 = -Infinity;
  for (const p of HERO_PTS) {
    tmpA.copy(p).project(c);
    const x = (tmpA.x * .5 + .5) * W, y = (-tmpA.y * .5 + .5) * H;
    x1 = Math.min(x1, x); x2 = Math.max(x2, x); y1 = Math.min(y1, y); y2 = Math.max(y2, y);
  }
  return { w: x2 - x1, h: y2 - y1, cx: (x1 + x2) / 2, cy: (y1 + y2) / 2 };
}
heroView.onFrame = (v, now, dt) => {
  if (!reduceMotion && stage.asm.done !== undefined) heroAngle += dt * 0.07;
  const hero = v.el.parentElement.getBoundingClientRect();
  const p = clamp(-hero.top / hero.height);
  const c = v.camera, W = v.rect.width, H = v.rect.height;
  // espacio para la maqueta: a la derecha del texto en escritorio; el bloque del visor en móvil
  let box;
  if (!isMobile()) {
    const rs = heroCopy.map(e => e.getBoundingClientRect()).filter(r => r.width);
    const right = Math.max(...rs.map(r => r.right)) - v.rect.left;
    const top = Math.min(...rs.map(r => r.top)) - v.rect.top, bottom = Math.max(...rs.map(r => r.bottom)) - v.rect.top;
    const x1 = right + W * 0.04, x2 = W - Math.max(40, W * 0.05);
    box = { cx: (x1 + x2) / 2, cy: (top + bottom) / 2, w: (x2 - x1) * 0.92, h: H * 0.62 };
  } else box = { cx: W / 2, cy: H / 2, w: W * 0.92, h: H * 0.8 };
  // se mide en el ángulo de inicio para que el tamaño no cambie mientras gira
  const el = 0.5 + p * 0.25;
  c.clearViewOffset(); c.updateProjectionMatrix();
  heroOrbit(c, 0.62, el, 260);
  let m = heroBox(c, W, H);
  const d = 260 * Math.max(m.w / box.w, m.h / box.h);
  heroOrbit(c, 0.62, el, d);
  m = heroBox(c, W, H);
  c.setViewOffset(W, H, m.cx - box.cx, m.cy - box.cy, W, H); c.updateProjectionMatrix();
  heroOrbit(c, heroAngle, el, d);
};

/* Cómo funciona: cámara por pasos, una animación por paso, todo atado al scroll */
const howEl = $('#como-funciona');
const KEYS = [ // [objetivo, desplazamiento de cámara]
  [V(-2, 16, -6), V(78, 88, 136)],      // vista general
  [V(-7, 27, -18), V(26, 50, 72)],      // 1 luz (sin techo)
  [V(0, 20, -18), V(22, 110, 62)],      // 2 SOS (sin techo): FSR en el muro del fondo y buzzer en el módulo
  [V(-6, 23, -11), V(18, 14, 84)],      // 3 puerta
  [V(2, 20, -6), V(44, 62, 96)],        // 4 ruta y camión (sin techo, se ve la OLED)
  [V(-7, 23, -11), V(-22, 18, 96)],     // 5 barrotes
];
let howP = 0, howStep = -1;
const busLabel = $('#busLabel');
function howProgress() {
  const r = howEl.getBoundingClientRect();
  return clamp(-r.top / (r.height - window.innerHeight));
}
howView.onFrame = (v) => {
  const p = howP = howProgress();
  const f = p * 5, i = Math.min(4, Math.floor(f)), t = f - i;
  const e = reduceMotion ? 1 : ease(clamp(t / 0.3));
  const a = reduceMotion ? (t > 0.3 ? 1 : 0) : clamp((t - 0.3) / 0.55);
  const back = 1 - e; // la animación del paso anterior se revierte mientras la cámara viaja
  const s = v.state;
  s.night = i === 0 ? a * .9 : i === 1 ? back * .9 : 0;
  s.sos = i === 1 ? a : 0;
  s.door = i === 2 ? a : i === 3 ? back : 0;
  s.bars = i === 4 ? a : 0;
  s.roof = i === 0 ? e : i === 1 ? 1 : i === 2 ? back : i === 3 ? e : i === 4 ? back : 0;
  s.hl = NODES[i].key;
  // camión: entra, se detiene sobre el sensor, se va
  if (i === 3) {
    const stop = COLOR.x - 1.2;
    if (reduceMotion) s.busX = a ? stop : null;
    else if (a < 0.4) s.busX = -70 + (stop + 70) * easeOut(a / 0.4);
    else if (a < 0.7) s.busX = stop;
    else s.busX = stop + (80 - stop) * easeIn((a - 0.7) / 0.3);
    if (t < 0.3 && !reduceMotion) s.busX = -70;
  } else s.busX = null;
  s.oled = i === 3 ? (reduceMotion ? a : clamp((a - 0.3) / 0.08) * clamp((0.8 - a) / 0.08)) : 0;

  // cámara
  shiftView(v.camera, v.rect, v.rect.width * 0.2);
  const k0 = KEYS[i], k1 = KEYS[i + 1];
  const mob = v.camera.aspect < 1.1 ? 1.1 / Math.pow(v.camera.aspect, 0.75) : 1;
  tmpA.copy(k0[1]).multiplyScalar(mob); tmpB.copy(k1[1]).multiplyScalar(mob);
  tmpT.lerpVectors(k0[0], k1[0], e);
  v.camera.position.copy(tmpT).add(tmpA.lerp(tmpB, e));
  v.camera.lookAt(tmpT);

  // etiqueta de ruta junto al paradero
  const showLabel = i === 3 && (reduceMotion ? a === 1 : a > 0.36 && a < 0.74);
  busLabel.classList.toggle('on', showLabel);
  if (showLabel) {
    v.camera.updateMatrixWorld();
    const q = stage.project(v, V(COLOR.x - 1.2, 31, CAD.streetZ));
    busLabel.style.transform = `translate(${q.x}px, ${q.y}px)`;
  }
};
function setHowStep(i) {
  howStep = i;
  $$('.how-step').forEach(el => el.classList.toggle('on', +el.dataset.i === i));
  $$('#howStops li').forEach(el => { const k = +el.dataset.i; el.classList.toggle('on', k === i); el.classList.toggle('past', k < i); });
}
setHowStep(0);
$$('#howStops li').forEach(li => li.addEventListener('click', () => {
  const r = howEl.getBoundingClientRect(), total = r.height - window.innerHeight;
  scrollToY(window.scrollY + r.top + total * ((+li.dataset.i + 0.62) / 5), 1.4);
}));

/* Explóralo tú: visor con OrbitControls */
const ctr = new OrbitControls(exView.camera, exView.el);
ctr.enableDamping = true; ctr.dampingFactor = 0.08;
ctr.minDistance = 22; ctr.maxDistance = 280; ctr.maxPolarAngle = Math.PI * 0.49;
ctr.enablePan = false; ctr.enableZoom = false;
// en pantallas táctiles un dedo baja la página y dos dedos giran y acercan (con el mouse no cambia nada)
exView.el.style.touchAction = 'pan-y';
ctr.touches = { ONE: null, TWO: THREE.TOUCH.DOLLY_ROTATE };
if (window.matchMedia('(pointer: coarse)').matches) $('.explore-hint').textContent = 'Usa dos dedos para girar y acercar.';
// la rueda solo acerca después de tocar el visor, para no atrapar el scroll de la página
exView.el.addEventListener('pointerdown', () => { ctr.enableZoom = true; exView.el.setAttribute('data-lenis-prevent', ''); });
exView.el.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') { ctr.enableZoom = false; exView.el.removeAttribute('data-lenis-prevent'); } });

const EX_HOME = { tgt: V(-2, 15, -3), dir: V(76, 61, 123).normalize() };
const VIEWS = { light: V(18, 35, 50), sos: V(26, 46, 52), door: V(11, 9, 50), route: V(12, 30, 36), bars: V(-10, 26, 58) };
const exTarget = { night: 0, door: 0, bars: 0, roof: 0, xray: 0 };
let fly = null, exHomed = false, selected = null;
function homePose() {
  const d = fitDist(exView.camera, 46);
  return { pos: EX_HOME.tgt.clone().addScaledVector(EX_HOME.dir, d), tgt: EX_HOME.tgt.clone() };
}
function flyTo(pos, tgt) {
  if (reduceMotion) { exView.camera.position.copy(pos); ctr.target.copy(tgt); return; }
  fly = { t0: performance.now(), dur: 950, p0: exView.camera.position.clone(), p1: pos, g0: ctr.target.clone(), g1: tgt };
}
ctr.addEventListener('start', () => { fly = null; });
const hsLayer = $('#hotspots');
NODES.forEach(n => {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'hs'; b.textContent = n.n; b.dataset.node = n.key;
  b.setAttribute('aria-label', `Nodo ${n.n}: ${n.name}`);
  b.addEventListener('click', () => select(n.key));
  hsLayer.appendChild(b); n.hs = b;
});
const approach = (cur, tgt, rate, dt) => reduceMotion ? tgt : cur + (tgt - cur) * Math.min(1, dt * rate);
exView.onFrame = (v, now, dt) => {
  const side = isMobile() ? 0 : ($('.explore-side').getBoundingClientRect().right - v.rect.left) / 2;
  shiftView(v.camera, v.rect, Math.max(0, side));
  if (!exHomed) { const h = homePose(); v.camera.position.copy(h.pos); ctr.target.copy(h.tgt); exHomed = true; }
  const s = v.state;
  s.night = approach(s.night, exTarget.night, 1.6, dt);
  s.door = approach(s.door, exTarget.door, 2.4, dt);
  s.bars = approach(s.bars, exTarget.bars, 1.3, dt);
  s.roof = approach(s.roof, exTarget.roof, 3, dt);
  s.xray = approach(s.xray, exTarget.xray, 3, dt);
  s.hl = null;
  s.oled = approach(s.oled, selected === 'route' ? 1 : 0, 3, dt);
  if (fly) {
    const t = Math.min(1, (now * 1000 - fly.t0) / fly.dur), e = ease(t);
    v.camera.position.lerpVectors(fly.p0, fly.p1, e);
    ctr.target.lerpVectors(fly.g0, fly.g1, e);
    if (t >= 1) fly = null;
  }
  ctr.update();
  v.camera.updateMatrixWorld();
  for (const n of NODES) {
    const q = stage.project(v, ANCHORS[n.key]);
    const vis = !q.behind && q.x > -20 && q.y > -20 && q.x < v.rect.width + 20 && q.y < v.rect.height + 20;
    n.hs.style.display = vis ? '' : 'none';
    if (vis) n.hs.style.transform = `translate(${q.x}px, ${q.y}px)`;
  }
};

const card = $('#nodeCard');
const ACTS = {
  light: [['Probar: modo noche', () => setAct('night', true)]],
  door: [['Probar: abrir puerta', () => setAct('door', true)]],
  bars: [['Probar: subir barrotes', () => setAct('bars', true)], ['Ver mecanismo', () => setAct('xray', true)]],
};
function select(key) {
  selected = selected === key ? null : key;
  $$('[data-node]').forEach(b => { const on = b.dataset.node === selected; b.classList.toggle('on', on); if (b.hasAttribute('aria-pressed')) b.setAttribute('aria-pressed', on); });
  if (!selected) {
    card.innerHTML = '<p class="node-hint">Toca un nodo para ver qué hace.</p>';
    const h = homePose(); flyTo(h.pos, h.tgt); return;
  }
  const n = NODES.find(x => x.key === key);
  card.innerHTML = `
    <p class="step-num">Nodo ${n.n}, ${n.name}</p>
    <h3>${n.title}</h3>
    <p>${n.text}</p>
    <dl><div><dt>Sensor</dt><dd>${n.sensor}</dd></div><div><dt>Actuador</dt><dd>${n.actuator}</dd></div><div><dt>Responsable</dt><dd>${n.owner}</dd></div></dl>
    <div class="acts"></div>`;
  renderActs(key);
  if ((key === 'light' || key === 'sos' || key === 'route') && exTarget.roof === 0) setAct('roof', true);
  const anchor = ANCHORS[key];
  const scale = exView.camera.aspect < 1 ? 1.4 : 1;
  flyTo(anchor.clone().addScaledVector(VIEWS[key], scale), anchor.clone());
}
// botones "Probar" de la ficha; sin 3D (o mientras carga el modelo) no hay nada que probar
function renderActs(key) {
  const box = $('.acts', card); if (!box) return;
  box.innerHTML = '';
  (stage && stage.ready ? ACTS[key] || [] : []).forEach(([label, fn]) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.textContent = label;
    b.addEventListener('click', fn); box.appendChild(b);
  });
}
$$('#nodeStops [data-node]').forEach(b => b.addEventListener('click', () => select(b.dataset.node)));

const LABELS = { night: ['Modo noche', 'Modo día'], door: ['Abrir puerta', 'Cerrar puerta'], bars: ['Subir barrotes', 'Bajar barrotes'], xray: ['Ver mecanismo', 'Ocultar mecanismo'], roof: ['Quitar techo', 'Poner techo'] };
function setAct(k, on) {
  exTarget[k] = on ? 1 : 0;
  const b = $(`.explore-bar [data-act="${k}"]`);
  b.setAttribute('aria-pressed', on); b.textContent = LABELS[k][on ? 1 : 0];
}
$$('.explore-bar [data-act]').forEach(b => b.addEventListener('click', () => {
  const k = b.dataset.act;
  if (k === 'reset') { if (selected) select(selected); else { const h = homePose(); flyTo(h.pos, h.tgt); } return; }
  setAct(k, exTarget[k] === 0);
}));
const realToggle = $('#realToggle');
realToggle.addEventListener('change', () => { exView.state.real = realToggle.checked; });

function resetExplore() {
  Object.keys(LABELS).forEach(k => setAct(k, false));
  if (selected) select(selected);
  realToggle.checked = false; exView.state.real = false;
  exHomed = false; fly = null;
}

/* ---------- cargar modelo ---------- */
const status = $('#loadStatus');
if (stage) stage.load('/models/safewait.glb').then(() => {
  status.hidden = true;
  stage.assemble();
  document.documentElement.classList.add('model-ready');
  route.layout();
  if (selected) renderActs(selected); // la ficha abierta durante la carga recibe sus botones
}).catch(err => {
  console.error(err);
  no3D();
});
// el grabado del panel usa el logo oficial y las fuentes de la página
const logoImg = new Image();
logoImg.src = '/safewait-logo.svg';
Promise.all([
  logoImg.decode().catch(() => null),
  document.fonts ? Promise.all([document.fonts.load('600 100px "Inter Tight Variable"'), document.fonts.load('500 40px "Inter Variable"')]).catch(() => null) : null,
]).then(() => stage && stage.drawLogos(logoImg.complete && logoImg.naturalWidth ? logoImg : null));

/* ---------- línea de ruta ---------- */
const route = new Route($('#route'), { howEl });

/* ---------- ciclo ---------- */
let last = performance.now();
function tick() {
  const now = performance.now();
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (stage) stage.render(now / 1000, dt);
  // el paso de Cómo funciona sale del scroll, no del render (así funciona sin 3D)
  const hs = Math.min(4, Math.floor(howProgress() * 5));
  if (hs !== howStep) setHowStep(hs);
  route.update();
}
if (lenis) {
  gsap.ticker.add(time => { lenis.raf(time * 1000); tick(); });
  gsap.ticker.lagSmoothing(0);
} else gsap.ticker.add(tick);

let rT;
window.addEventListener('resize', () => {
  if (stage) stage.resize();
  clearTimeout(rT); rT = setTimeout(() => { route.layout(); ScrollTrigger.refresh(); }, 120);
});
new ResizeObserver(() => route.layout()).observe(document.body);

/* ---------- encabezado: parada activa ---------- */
const navLinks = $$('.nav a');
$$('main [data-section]').forEach(sec => {
  ScrollTrigger.create({
    trigger: sec, start: 'top 45%', end: 'bottom 45%',
    onToggle: self => {
      if (!self.isActive) return;
      navLinks.forEach(a => a.classList.toggle('on', a.dataset.stop === sec.dataset.section));
      document.body.dataset.section = sec.dataset.section;
    },
  });
});

/* ---------- apariciones y cifras ---------- */
if (!reduceMotion) {
  $$('.reveal, .section h2, .section .intro, .team-list li, .flow-stops li').forEach(el => {
    gsap.from(el, { y: 18, opacity: 0, duration: .7, ease: 'power2.out', scrollTrigger: { trigger: el, start: 'top 88%', once: true } });
  });
  $$('.stat .num').forEach(el => {
    const to = parseFloat(el.dataset.count), o = { v: 0 };
    gsap.to(o, { v: to, duration: 1.4, ease: 'power2.out', scrollTrigger: { trigger: el, start: 'top 85%', once: true },
      onUpdate: () => { el.textContent = o.v.toFixed(1) + ' %'; } });
  });
}
// diagrama de tecnología: la línea se dibuja con el scroll
const flow = $('#flow');
ScrollTrigger.create({
  trigger: flow, start: 'top 80%', end: 'bottom 45%', scrub: reduceMotion ? false : true,
  onUpdate: self => {
    const p = reduceMotion ? 1 : self.progress;
    flow.style.setProperty('--p', p);
    $$('.flow-stops li', flow).forEach((li, i) => li.classList.toggle('on', p >= i / 4 - 0.001));
  },
});
if (reduceMotion) { flow.style.setProperty('--p', 1); $$('.flow-stops li', flow).forEach(li => li.classList.add('on')); }

/* ---------- QR ---------- */
const local = /^(localhost|127\.|0\.0\.0\.0|\[::1\]|192\.168\.|10\.)/.test(location.hostname);
const qrUrl = CONFIG.siteUrl || (!local ? location.origin + '/' : '');
if (qrUrl) {
  QRCode.toString(qrUrl, { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#162660', light: '#ffffff' } })
    .then(svg => { $('#qr').innerHTML = svg; $('#qrUrl').textContent = qrUrl.replace(/^https?:\/\//, '').replace(/\/$/, ''); });
} else {
  $('#qr').innerHTML = '<span class="qr-ph">QR</span>';
  $('#qrUrl').textContent = 'Pendiente: URL de Railway';
}

/* ---------- modo stand: vuelve al inicio tras inactividad ---------- */
if (standMode) {
  document.documentElement.classList.add('stand');
  let idle;
  const arm = () => { clearTimeout(idle); idle = setTimeout(restart, (parseFloat(params.get('stand')) || CONFIG.standIdleSeconds) * 1000); };
  function restart() {
    resetExplore();
    scrollToY(0, 2.4);
    setTimeout(() => { if (stage) stage.assemble(); heroAngle = 0.62; arm(); }, reduceMotion ? 0 : 2500);
  }
  ['pointerdown', 'pointermove', 'wheel', 'keydown', 'touchstart'].forEach(ev => window.addEventListener(ev, arm, { passive: true }));
  arm();
}

if (import.meta.env.DEV) window.__sw = { lenis, stage, howView, exView };
