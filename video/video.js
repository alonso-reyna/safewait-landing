// Video promocional en loop de la maqueta SafeWait.
// Todo depende solo del tiempo t (s): frame(t) dibuja ese cuadro, así render.mjs lo captura cuadro por cuadro.
// Vista en vivo: /video/  |  cuadro fijo: /video/?t=12.5  |  captura: /video/?capture
import '@fontsource-variable/inter';
import '@fontsource-variable/inter-tight';
import * as THREE from 'three';
import { Stage, ANCHORS, CAD, FSR, BUZZER, BLUE } from '../src/scene.js';
import { NODES } from '../src/content.js';
import { makeBus } from '../src/bus.js';
import { buildDetails, doorGrids, KEYPAD_TOP } from '../src/detail.js';
import { makeWave } from '../src/fx.js';
import { DUR, T, CODE, LABELS, MOVES } from './guion.js';

const params = new URLSearchParams(location.search);
const MADERA = params.get('look') === 'madera';   // look del póster: madera y materiales de la maqueta física
// look del video: la maqueta de un solo color (azul claro) sobre fondo claro, con la pinta limpia del primer render
const TONE = {
  wall: 0x6ab2f2, frame: 0x7cbdf5, floor: 0x58a5ea, base: 0x5aa8ec, grass: 0x4c98df, corner: 0x3d88d2,
  door: 0xf2f8fe, pcb: 0x1a4c80, fsr: 0x162660, bars: 0x6ab2f2, keypad: 0x58a5ea,
};
const HI = new THREE.Color(0x267dc0);            // tono de los resaltados: el azul de marca, siempre mezclado poco a poco
const EDGE = new THREE.Color(MADERA ? 0x6b4a2a : 0x3f86c9);
const BG = MADERA ? 'radial-gradient(120% 95% at 50% 40%, #ffffff 0%, #f8f5f0 45%, #ebe4d9 100%)' : 'radial-gradient(120% 95% at 50% 40%, #ffffff 0%, #f6f8fb 45%, #e4e9f1 100%)';

const $ = s => document.querySelector(s);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const smooth = t => t * t * (3 - 2 * t);
const expo = t => t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
const ramp = (t, a, b) => clamp((t - a) / (b - a));
const sm = (t, a, b) => smooth(ramp(t, a, b));
const hold = (t, a, b, c, d) => sm(t, a, b) * (1 - sm(t, c, d));   // sube a→b, se queda, baja c→d
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const mix = (a, b, k) => a.map((v, i) => Math.round(v + (b[i] - v) * k));
const rgb = c => `rgb(${c[0]},${c[1]},${c[2]})`;


/* ---------- escena ---------- */
await Promise.all([
  document.fonts.load('600 100px "Inter Tight Variable"'), document.fonts.load('700 52px "Inter Tight Variable"'),
  document.fonts.load('500 40px "Inter Variable"'), document.fonts.load('600 30px "Inter Variable"'),
]).catch(() => null);

const stage = new Stage($('#gl'), {});
stage.asm.dur = 3.25;
const view = stage.addView($('#view'));
// en la presentación, la maqueta de madera se muestra completa, con su base (como la maqueta física)
const CON_BASE = params.has('pitch') && MADERA;
view.state.plinth = CON_BASE;
view.state.real = MADERA;
{ // maqueta azul: se cambian los colores del juego de materiales "blanco" de la escena
  const W = stage.M.white;
  for (const k in TONE) if (W[k]) W[k].color.setHex(TONE[k]);
  W.keypad = W.floor;                              // la tapa del módulo es del mismo material que el módulo
  W.door.roughness = .92; W.door.emissive.set(0xcfe6ff); W.door.emissiveIntensity = 0;
  stage.M.glass.color.setHex(0xe3f1fd); stage.M.glass.opacity = .3;
}
if (MADERA) { const R = stage.M.real; R.keypad = R.floor; R.wall.color.setHex(0xf2e2c8); R.frame.color.setHex(0xeedcc0); R.door.color.setHex(0xf3ebdb); R.door.roughness = .92; R.door.emissive.set(0xfff0d0); R.door.emissiveIntensity = 0; }
const doorSync = doorGrids(stage, MADERA ? 0x2b2320 : 0x162660);
// sensor del SOS: sale horizontal por la ranura del muro del fondo y descansa en una repisa (antes colgaba pegado al muro)
const SOS_P = V(FSR.x, 21.36, CAD.backInnerZ + 2.4);
let fsrPad = null;
for (const m of stage.meshes) {
  const g = m.geometry.parameters || {};
  if (m.userData.cls !== 'fsr') continue;
  if (g.radiusTop === 0.9) { fsrPad = m; m.rotation.set(0, 0, 0); m.position.copy(SOS_P); }
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
await stage.load('/models/safewait.glb');
const details = buildDetails(stage, MADERA ? { tone: 0xd8bf96, leaf: 0x4f8a3c, trunk: 0x7a5a3a, real: true } : {});
{ // repisa bajo el sensor del SOS
  const g = new THREE.Group(), geo = new THREE.BoxGeometry(2.5, 0.3, 3.6);
  geo.translate(SOS_P.x, SOS_P.y - 0.19, CAD.backInnerZ + 1.8);
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: MADERA ? 0xd8bf96 : TONE.floor, roughness: .9 })); m.castShadow = m.receiveShadow = true; g.add(m);
  details.piece(g, 1.25);
}
const presses = CODE.map(ch => details.press(ch));

const SCALE = stage.asm.dur / 2.5;
// el techo no se barre: baja desde arriba, se posa, y se levanta igual cuando hay que ver adentro
const roofSet = new Set(stage.roof), roofG = new THREE.Group(), ROOF_UP = 120;
stage.root.add(roofG);
for (const o of stage.roof) { roofG.attach(o); o.userData.y0 = o.position.y; }
stage.pieces.forEach(p => { p.t0o = roofSet.has(p.obj) ? -99 : p.t0; });
// las hojas de la puerta entran abiertas junto con el muro del frente y luego se cierran deslizando
const wallT0 = Math.min(...stage.pieces.filter(p => /^frontOuter/.test(p.obj.name || '')).map(p => p.t0o), 1.1);
for (const leaf of [stage.doorL, stage.doorR]) { const p = stage.pieces.find(q => q.obj === leaf); p.t0o = wallT0; p.d1 -= 1.7; p.d2 += 1.7; }
const TOTAL = Math.max(...stage.pieces.map(p => p.t0o)) * SCALE + 1;
// resaltados: las piezas de cada nodo llevan material propio, y su tono se mezcla poco a poco hacia HI (nunca cambia de golpe)
const HLK = {};
for (const m of stage.meshes) {
  const key = m.userData.hl; if (!key || key === 'route') continue;
  const cls = 'hl_' + key + '_' + m.userData.cls;
  if (!stage.M.white[cls]) {
    const c = stage.M.white[cls] = stage.M.white[m.userData.cls].clone();
    (HLK[key] ||= []).push({ mat: c, base: c.color.clone() });
  }
  m.userData.cls = cls;
}
for (const k in stage.M.white) if (k.startsWith('hl_')) stage.M.real[k] = stage.M.real[k.split('_')[2]];   // en madera no hay resaltados
const doorMat = (MADERA ? stage.M.real : stage.M.white).hl_door_door, barMat = (MADERA ? stage.M.real : stage.M.white).hl_bars_bars;
// barrotes: siempre a la vista, pero solo lo que asoma sobre la calle (abajo no hay pedestal); en reposo se ven las puntas en sus hoyos
const overTop = new THREE.Plane(V(0, 1, 0), -(CAD.baseTop + 0.02));
if (!CON_BASE) { barMat.clippingPlanes = [overTop]; barMat.clipShadows = true; }
if (!CON_BASE) stage.bars.forEach(o => {
  if (o.userData.edges) o.userData.edges.visible = false;
  const c = barMat.clone(); c.clippingPlanes = [o.userData.clip, overTop]; c.clipShadows = true;
  o.userData.clipMats = { [barMat.uuid]: c };
});
if (!CON_BASE) stage.plinth = stage.plinth.filter(o => !stage.bars.includes(o));
// aristas en azul claro (la escena las repinta en gris en cada cuadro, así que se corrigen justo antes de dibujar)
const edgeObjs = stage.meshes.map(m => m.userData.edges).filter(Boolean);
stage.scene.onBeforeRender = () => {
  doorSync();
  stage.edgeMat.color.copy(EDGE);
  for (const e of edgeObjs) if (e.userData.clipMat) e.userData.clipMat.color.copy(EDGE);
};

// camión detallado (el de la escena se queda apagado)
// llega rodando desde fuera de cuadro y se sube a la maqueta (nada de aparecer en el borde)
const bus = makeBus({ clipX: 1e5, mirror: true, route: '2  RANCHO IOT' });
bus.group.position.set(0, CAD.baseTop, CAD.streetZ);
stage.root.add(bus.group);
const BUS_STOP = 33.0 - bus.length / 2, BUS_A = 150, BUS_B = -130;   // entra por la derecha (donde la calle hace esquina) y sale por la izquierda
const AXF = bus.length / 2 - 5.2, AXR = -bus.length / 2 + 4.7, DROP = CAD.baseTop - 15.06;
const roadY = x => -DROP * sm(Math.abs(x), 33.5 - 0.5, 33.5 + 1.3);
{ // la sombra del sol cubre también el tramo fuera de la maqueta
  const sh = stage.sun.shadow;
  // near 40: cuando el techo sube lo suficiente sale del volumen de sombra, así su sombra no se queda flotando en el piso
  Object.assign(sh.camera, { left: -150, right: 150, top: 80, bottom: -80, near: 40 }); sh.camera.updateProjectionMatrix();
  sh.mapSize.set(4096, 4096); if (sh.map) { sh.map.dispose(); sh.map = null; }
}

// SOS: el sensor se hunde con un halo, suelta una onda corta, y la alarma sale del buzzer en ondas largas
const sosFx = T.sos.map(t0 => {
  const at = (w, p, dy) => { w.mesh.position.set(p.x, p.y + dy, p.z); return w; };
  return {
    t0,
    glow: at(makeWave(stage.root, { color: 0x267dc0, size: 2 }), SOS_P, 0.06),
    ripples: [0, 1].map(() => at(makeWave(stage.root, { color: 0x162660, size: 3 }), SOS_P, 0.07)),
    alarm: [0, 1, 2].map(() => at(makeWave(stage.root, { color: 0x162660, size: 8 }), BUZZER, 0.5)),
  };
});

/* ---------- cámara ---------- */
const HERO_TGT = V(0, 21, -8), HERO_FRONT = 0.32;
const HERO_PTS = [];
[-33.5, 33.5].forEach(x => [-32.71, 17.29].forEach(z => HERO_PTS.push(V(x, 15.07, z))));
[-22.6, 8.4].forEach(x => [-23.9, -10.9].forEach(z => HERO_PTS.push(V(x, 35.5, z))));
const probe = new THREE.PerspectiveCamera(30, 1, 1, 1500), tmp = V(0, 0, 0);
function orbit(c, angle, el, d) {
  c.position.set(HERO_TGT.x + Math.sin(angle) * Math.cos(el) * d, HERO_TGT.y + Math.sin(el) * d, HERO_TGT.z + Math.cos(angle) * Math.cos(el) * d);
  c.lookAt(HERO_TGT); c.updateMatrixWorld();
}
function bounds(c, W, H) {
  let x1 = Infinity, x2 = -Infinity, y1 = Infinity, y2 = -Infinity;
  for (const p of HERO_PTS) {
    tmp.copy(p).project(c);
    const x = (tmp.x * .5 + .5) * W, y = (-tmp.y * .5 + .5) * H;
    x1 = Math.min(x1, x); x2 = Math.max(x2, x); y1 = Math.min(y1, y); y2 = Math.max(y2, y);
  }
  return { w: x2 - x1, h: y2 - y1, cx: (x1 + x2) / 2, cy: (y1 + y2) / 2 };
}
// vista general: la maqueta completa cabe en la caja (px) que se le pide
function fit(box, W, H, el = 0.5) {
  probe.aspect = W / H; probe.clearViewOffset(); probe.updateProjectionMatrix();
  orbit(probe, HERO_FRONT, el, 260);
  let m = bounds(probe, W, H);
  const d = 260 * Math.max(m.w / box.w, m.h / box.h);
  orbit(probe, HERO_FRONT, el, d);
  m = bounds(probe, W, H);
  return { tgt: HERO_TGT.clone(), off: probe.position.clone().sub(HERO_TGT), vo: [m.cx - box.cx, m.cy - box.cy] };
}

let cam = null, camKey = '';
function buildCam(W, H) {
  const portrait = H > W, a = W / H;
  const mob = a < 1.1 ? 1.1 / Math.pow(a, 0.75) : 1;
  const node = (tgt, off, k = 1, vo = [0, 0]) => ({ tgt, off: off.multiplyScalar(mob * k), vo: [vo[0] * W, vo[1] * H] });
  const P = {
    hero: fit(portrait ? { cx: W * .5, cy: H * .5, w: W * 1.04, h: H * .5 } : { cx: W * .5, cy: H * .5, w: W * .62, h: H * .72 }, W, H),
    end: fit(portrait ? { cx: W * .5, cy: H * .58, w: W * 1.04, h: H * .5 } : { cx: W * .69, cy: H * .5, w: W * .58, h: H * .74 }, W, H),
    light: node(V(-7, 27, -18), V(26, 50, 72), portrait ? .8 : .95, portrait ? [0, -.09] : [0, -.04]),
    sos: node(V(0, 20, -16), V(17, 120, 42), portrait ? .78 : 1.0, portrait ? [0, -.09] : [0, -.03]),
    door: node(V(-6, 23, -11), V(18, 14, 84), portrait ? .8 : .95, portrait ? [0, -.09] : [0, -.03]),
    route: node(V(9, 19, 0), V(34, 46, 92), portrait ? .8 : .9, portrait ? [0, -.09] : [0, -.03]),
    oled: node(V(-21.9, 27.2, -20.39), V(22, 13, 7), portrait ? .5 : .84),
    keypad: node(V(19.2, 19.4, -15.4), V(9, 30, 27), portrait ? .56 : .7, portrait ? [0, -.15] : [0, 0]),
    bars: node(V(-4, 23, -11), V(30, 20, 92), portrait ? .8 : .95, portrait ? [0, -.09] : [0, -.03]),
  };
  // [inicio del viaje, duración, encuadre, giro lento (rad/s)]
  return [
    [0, 0, P.hero, .03],
    [4.4, 1.5, P.light, .022],
    [10.2, 1.5, P.sos, .018],
    [17.4, 1.5, P.door, .022],
    [23.6, 1.5, P.route, .016],
    [27.6, 1.3, P.oled, .012],
    [30.4, 1.3, P.route, .016],
    [33.2, 1.6, P.keypad, .012],
    [37.0, 1.7, P.bars, .02],
    [40.9, 1.7, P.end, .03],
  ];
}
const A = { pos: V(0, 0, 0), tgt: V(0, 0, 0), vo: [0, 0] }, B = { pos: V(0, 0, 0), tgt: V(0, 0, 0), vo: [0, 0] };
const UP = V(0, 1, 0);
function evalEntry(i, t, out) {
  const [t0, d, p, rate] = cam[i];
  const tEnd = i + 1 < cam.length ? cam[i + 1][0] + cam[i + 1][1] : DUR;
  const c = (t0 + d + (i + 1 < cam.length ? cam[i + 1][0] : DUR)) / 2;       // centro de la pausa
  const dt = clamp(t, t0, tEnd) - c;
  out.pos.copy(p.off).applyAxisAngle(UP, rate * dt).multiplyScalar(1 - 0.006 * dt).add(p.tgt);
  out.tgt.copy(p.tgt); out.vo = p.vo;
}
function setCamera(t, W, H) {
  let i = 0; while (i + 1 < cam.length && t >= cam[i + 1][0]) i++;
  evalEntry(i, t, B);
  const d = cam[i][1], e = d ? ease(ramp(t, cam[i][0], cam[i][0] + d)) : 1;
  if (e < 1 && i > 0) {
    evalEntry(i - 1, t, A);
    B.pos.lerpVectors(A.pos, B.pos, e); B.tgt.lerpVectors(A.tgt, B.tgt, e);
    B.vo = [A.vo[0] + (B.vo[0] - A.vo[0]) * e, A.vo[1] + (B.vo[1] - A.vo[1]) * e];
  }
  const c = view.camera;
  c.aspect = W / H;
  c.setViewOffset(W, H, B.vo[0], B.vo[1], W, H);
  c.position.copy(B.pos); c.lookAt(B.tgt); c.updateMatrixWorld();
}

/* ---------- un cuadro ---------- */
const el = { bg: $('#bg'), night: $('#night'), glow: $('#glow'), label: $('#label'), num: $('#label .num'), name: $('#label .name'), meta: $('#label .meta'), rule: $('#label .rule'), ticksBox: $('#ticks'), ticks: [...document.querySelectorAll('#ticks b')], code: $('#code'), dots: [...document.querySelectorAll('#code i')], end: $('#end') };
el.bg.style.background = BG;
const NAVY = [22, 38, 96], WHITE = [255, 255, 255], NIGHT = [11, 20, 51], BLUE_C = [38, 125, 192], BLUE_N = [143, 196, 255];
const GLOW = V(ANCHORS.light.x, ANCHORS.light.y - 5, ANCHORS.light.z + 6);
let shown = -1;

function frame(time) {
  const t = ((time % DUR) + DUR) % DUR;
  const W = document.documentElement.clientWidth, H = window.innerHeight;
  if (camKey !== W + 'x' + H) { camKey = W + 'x' + H; stage.resize(); cam = buildCam(W, H); }

  // armado, y al final el mismo barrido en reversa
  const asmT = t < T.dis[0] ? clamp(t - T.asm, 0, TOTAL) : TOTAL * (1 - sm(t, T.dis[0], T.dis[1]));
  stage.pieces.forEach(p => { p.t0 = p.t0o; });
  stage.asm.t = asmT; stage.asm.done = false;
  // techo: 1 = arriba y fuera de cuadro, 0 = puesto
  const lift = Math.max(t < 5 ? 1 - sm(t, ...T.roofIn) : 0, T.roofOff.reduce((a, r) => a + hold(t, ...r), 0), sm(t, ...T.roofOut));
  roofG.position.y = ROOF_UP * lift; roofG.visible = lift < .998;
  details.update(asmT, SCALE);

  const s = view.state;
  const nk = hold(t, ...T.night);
  s.night = .92 * nk; s.dark = nk; s.lamp = hold(t, ...T.lamp);
  s.door = Math.max(hold(t, ...T.door), t < 5 ? 1 - sm(t, ...T.doorIn) : 0);
  s.bars = hold(t, ...T.bars);
  s.oled = hold(t, ...T.oled);
  s.roof = 0; s.sos = 0; s.busX = null;
  s.hl = null;                                   // sin resaltados de golpe: cada nodo se entiende por lo que se mueve
  for (const k in HLK) { const a = hold(t, ...T.hl[k]) * (k === 'door' ? .45 : .8); for (const h of HLK[k]) h.mat.color.copy(h.base).lerp(HI, a); }
  doorMat.emissiveIntensity = s.lamp * nk * .5;   // de noche el papel de la puerta deja pasar la luz
  presses.forEach((p, i) => details.setPress(p, t - (T.keys + i * T.keyStep)));

  // camión: llega, se detiene sobre el sensor, se va
  let bx = null;
  if (t >= T.busIn[0] && t < T.busOut[1]) {
    const a = ramp(t, ...T.busIn), b = ramp(t, ...T.busOut);
    bx = BUS_A + (BUS_STOP - BUS_A) * (1 - Math.pow(1 - a, 2.2)) + (BUS_B - BUS_STOP) * Math.pow(b, 2.2);
  }
  bus.setX(bx);
  if (bx != null) {
    const yF = roadY(bx - AXF), yR = roadY(bx - AXR);   // va hacia −x: el eje delantero queda del lado izquierdo
    bus.group.position.y = CAD.baseTop + yF + (yR - yF) * (AXF / (AXF - AXR));
    bus.group.rotation.z = -Math.atan2(yF - yR, AXF - AXR);
  }

  // SOS
  let padK = 0;
  for (const f of sosFx) {
    const dt = t - f.t0, k = sm(dt, -.12, .04) * (1 - sm(dt, .22, .62));
    padK = Math.max(padK, k);
    f.glow.glow(k * .5, 1.3, .8, .12);
    f.ripples.forEach((w, i) => w.play((dt - .04 - i * .17) / 1.0, { r0: .9, r1: 3.3, w: .085, a: .8 }));
    f.alarm.forEach((w, i) => w.play((dt - .3 - i * .2) / 1.5, { r0: .56, r1: 7.2, w: .13, a: .8, fill: .14 }));
  }
  fsrPad.position.y = SOS_P.y - .09 * padK;

  setCamera(t, W, H);
  stage.render(t, 0);

  // fondo: blanco, de noche solo en el nodo de luz
  el.night.style.opacity = nk.toFixed(3);
  const g = tmp.copy(GLOW).project(view.camera);
  el.glow.style.setProperty('--cx', ((g.x * .5 + .5) * 100).toFixed(2) + '%');
  el.glow.style.setProperty('--cy', ((-g.y * .5 + .5) * 100).toFixed(2) + '%');
  el.glow.style.opacity = (s.lamp * nk).toFixed(3);

  // rótulo del nodo: el nombre sube detrás de una máscara, la regla se estira y el segmento activo se va llenando
  const li = LABELS.findIndex(l => t >= l[0] && t < l[1]);
  if (li >= 0) {
    if (li !== shown) { shown = li; el.num.textContent = '0' + NODES[li].n; el.name.textContent = NODES[li].name; }
    const [a, b] = LABELS[li], out = sm(t, b - .55, b), u = x => `calc(${x.toFixed(2)} * var(--u))`;
    el.label.style.opacity = 1;
    el.name.style.transform = `translateY(${((1 - expo(ramp(t, a + .08, a + 1.0))) * 108 - out * 108).toFixed(2)}%)`;
    el.meta.style.opacity = (sm(t, a, a + .5) * (1 - out)).toFixed(3);
    el.meta.style.transform = `translateY(${u((1 - expo(ramp(t, a, a + .8))) * 10)})`;
    el.rule.style.transform = `scaleX(${expo(ramp(t, a + .1, a + 1.0)).toFixed(4)})`;
    el.ticksBox.style.opacity = (sm(t, a + .25, a + .85) * (1 - out)).toFixed(3);
    el.ticks.forEach((x, i) => {
      x.style.transform = `scaleX(${(i < li ? 1 : i > li ? 0 : ramp(t, a + .3, b - .5)).toFixed(4)})`;
      x.style.opacity = i < li ? .4 : 1;
    });
  } else el.label.style.opacity = 0;
  el.label.style.setProperty('--ink', rgb(mix(NAVY, WHITE, nk)));
  el.label.style.setProperty('--accent', rgb(mix(BLUE_C, [207, 228, 248], nk)));

  // clave del keypad: seis puntos que se van llenando sobre el módulo y confirman en azul al completarse
  const tOk = T.keys + (CODE.length - 1) * T.keyStep + .34;
  const ck = sm(t, T.keys - .55, T.keys - .1) * (1 - sm(t, T.bars[0] + .2, T.bars[0] + .8));
  el.code.style.opacity = ck.toFixed(3);
  if (ck > 0) {
    // horizontal: flota a un lado del keypad; vertical: fijo abajo, donde no tapa nada
    const q = W > H ? tmp.copy(KEYPAD_TOP).project(view.camera) : tmp.set(0, -.62, 0), ok = sm(t, tOk, tOk + .28);
    const pop = 1 + .07 * Math.sin(Math.PI * ramp(t, tOk, tOk + .4));
    el.code.style.transform = `translate(${((q.x * .5 + .5) * W).toFixed(1)}px, ${((-q.y * .5 + .5) * H).toFixed(1)}px) translate(-50%, -50%) scale(${pop.toFixed(4)})`;
    el.dots.forEach((dEl, i) => {
      const on = expo(ramp(t, T.keys + i * T.keyStep, T.keys + i * T.keyStep + .3));
      dEl.style.background = `rgba(${mix(NAVY, BLUE_C, ok).join(',')},${(.14 + .86 * on).toFixed(3)})`;
      dEl.style.transform = `scale(${(.72 + .28 * on).toFixed(3)})`;
    });
  }

  // cierre
  const ek = hold(t, ...T.end);
  el.end.style.opacity = ek.toFixed(3);
}

/* ---------- reproducción ---------- */
const raf = () => new Promise(r => requestAnimationFrame(r));
window.DUR = DUR; window.stage = stage; window.view = view;
window.seek = async t => { frame(t); await raf(); await raf(); };
if (params.has('pitch')) {
  // presentación (/pitch/): la página de afuera decide qué se dibuja en cada slide
  const { setupPitch } = await import('../pitch/escena.js');
  setupPitch({ stage, view, bus, roofG, ROOF_UP, details, presses, sosFx, HLK, HI, doorMat, fsrPad, SOS_P, TOTAL, SCALE, el, buildCam, fit, roadY, CON_BASE, BUS: { stop: BUS_STOP, a: BUS_A, b: BUS_B, axf: AXF, axr: AXR }, GLOW, params });
} else if (params.has('poster')) {
  const { setupPoster } = await import('./poster.js');
  await setupPoster({ stage, view, frame, bus, roofG, ROOF_UP, roofSet, el, params, MADERA, TONE });
} else if (params.has('capture')) frame(0);
else if (params.has('t')) { const t = +params.get('t'); frame(t); window.addEventListener('resize', () => frame(t)); }
else {
  const t0 = performance.now() - (+params.get('from') || 0) * 1000;
  const loop = () => { frame((performance.now() - t0) / 1000); requestAnimationFrame(loop); };
  loop();
}
window.ready = true;
