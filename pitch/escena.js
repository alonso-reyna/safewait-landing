// Escena 3D de la presentación. Corre dentro de /video/?pitch, en un iframe por look (azul y madera).
// La página de afuera (pitch.js) manda: go(id, now) cambia de slide y render(now) dibuja un cuadro.
// Cada slide es una "pose": valores de la maqueta y un encuadre, en función del tiempo que lleva la slide (tau).
import * as THREE from 'three';
import { ANCHORS, CAD, COLOR } from '../src/scene.js';
import { KEYPAD_TOP } from '../src/detail.js';
import { CODE } from '../video/guion.js';

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smooth = t => t * t * (3 - 2 * t);
const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const expo = t => t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
const ramp = (t, a, b) => clamp((t - a) / (b - a));
const sm = (t, a, b) => smooth(ramp(t, a, b));
const hold = (t, a, b, c, d) => sm(t, a, b) * (1 - sm(t, c, d));
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);

const KEY_STEP = .38;                 // segundos entre teclas de la clave
const SOS_0 = 2.0, SOS_EVERY = 2.8;   // primer pulso del SOS y cada cuánto se repite
const TRAVEL = 1.7;                   // lo que dura el viaje entre dos slides

// valores que se mezclan al cambiar de slide
const NUM = ['night', 'lamp', 'door', 'bars', 'oled', 'lift', 'explode', 'xray', 'hlSos', 'hlDoor', 'hlBars', 'sway', 'velo', 'out', 'feo'];
const BASE = { cam: 'lado', cam2: null, camK: 0, ang: 0, zoom: 1, night: 0, lamp: 0, door: 0, bars: 0, oled: 0, lift: 0, explode: 0, xray: 0, hlSos: 0, hlDoor: 0, hlBars: 0, sway: .05, velo: 0, out: 0, feo: 0, girlT: null, busT: null, sosT: null, keysT: null };

// una pose por slide (t = segundos desde que entró la slide)
const POSES = {
  portada: () => ({}),
  // la situación: de noche, una estudiante camina sola a la parada, se detiene y espera viendo el celular (girlT mueve todo)
  // feo: en vez de la caseta de SafeWait se ve la parada de hoy (banca, poste, farol que falla, basura)
  situacion: t => ({ night: 1.09, sway: .012, girlT: t, feo: 1 }),   // night > 1: más oscuro que las demás slides de noche
  // datos y personas: la maqueta se hace a un lado (out) y deja toda la pantalla
  cifras: () => ({ night: 1, out: 1, ang: -.1, feo: 1 }),
  personas: () => ({ night: 1, out: 1, ang: -.1, feo: 1 }),
  // SafeWait se presenta: la maqueta regresa, enciende su luz y, un momento después, amanece
  solucion: t => ({ lamp: sm(t, .7, 2.2), night: 1 - sm(t, 4.2, 6.4), ang: .22 * (1 - sm(t, 0, 5)) }),
  luz: t => ({ cam: 'light', lift: 1, night: sm(t, 1.7, 3.2), lamp: sm(t, 2.8, 4.4) }),
  sos: t => ({ cam: 'sos', lift: 1, hlSos: sm(t, .8, 1.8), sosT: t }),
  acceso: t => { const f = t - 1.6, p = ((f % 6.6) + 6.6) % 6.6; return { cam: 'door', hlDoor: sm(t, .6, 1.6), door: f > 0 ? hold(p, 0, 1.5, 3.3, 4.7) : 0 }; },
  // llega el camión, la cámara se acerca a la pantalla y regresa
  ruta: t => { const k = sm(t, 5.2, 6.5) - sm(t, 9.8, 11.1); return { cam: 'route', cam2: 'oled', camK: k, velo: k, lift: 1, busT: t - .9, oled: sm(t, 4.5, 4.9) }; },
  // la cámara se acerca al teclado, se teclea la clave, y de regreso suben los barrotes
  barrotes: t => { const k = hold(t, 1.0, 2.5, 5.3, 6.9); return { cam: 'bars', cam2: 'keypad', camK: k, velo: k, hlBars: sm(t, .6, 1.6), keysT: t - 2.9, bars: sm(t, 6.1, 8.3) }; },
  registro: () => ({ out: 1, ang: .1 }),
  cierre: () => ({}),
  maqueta: () => ({ ang: -.12 }),
  distribucion: () => ({ cam: 'alto', lift: 1, sway: .03 }),
  oculto: () => ({ cam: 'abierto', explode: 1, sway: .04 }),
  flujo: () => ({ ang: .2 }),
  dashboard: () => ({ ang: .08 }),
  gracias: () => ({ cam: 'chico' }),
};

export function setupPitch(c) {
  const { stage, view, bus, roofG, ROOF_UP, details, presses, sosFx, HLK, HI, doorMat, fsrPad, SOS_P, TOTAL, SCALE, el, BUS, GLOW, params, CON_BASE } = c;
  for (const id of ['label', 'end']) document.getElementById(id).style.display = 'none';
  el.gl = document.getElementById('gl');
  const ARMADO = params.has('armado');           // la maqueta arranca ya armada
  // el video cuelga el techo de un grupo aparte (roofG); la vista explotada guardó sus medidas en el espacio del padre original,
  // así que se recalculan en el de roofG: si no, al explotar el techo sale volando
  { const o0 = roofG.worldToLocal(V(0, 0, 0));
    for (const o of stage.roof) { const x = o.userData.ex; if (!x) continue; x.v = roofG.worldToLocal(V(0, x.len, 0)).sub(o0); x.x0 = o.position.x; x.z0 = o.position.z; } }

  /* ---------- encuadres ---------- */
  let cams = null, camKey = '';
  function buildCams(W, H) {
    const L = c.buildCam(W, H);
    // los encuadres del video van centrados: aquí la maqueta se recorre a la derecha para dejarle la izquierda al texto
    const right = (p, dx, k = 1) => ({ tgt: p.tgt, off: p.off.clone().multiplyScalar(k), vo: [p.vo[0] - dx * W, p.vo[1]] });
    return {
      // con base (madera) la maqueta es más alta: se encuadra más chica y más arriba para que quepa el pedestal
      lado: CON_BASE ? c.fit({ cx: W * .7, cy: H * .39, w: W * .44, h: H * .54 }, W, H) : c.fit({ cx: W * .7, cy: H * .52, w: W * .56, h: H * .72 }, W, H),
      chico: c.fit({ cx: W * .74, cy: H * .46, w: W * .46, h: H * .6 }, W, H),
      alto: CON_BASE ? c.fit({ cx: W * .71, cy: H * .38, w: W * .38, h: H * .5 }, W, H, .8) : c.fit({ cx: W * .7, cy: H * .52, w: W * .54, h: H * .74 }, W, H, .82),
      abierto: CON_BASE ? c.fit({ cx: W * .7, cy: H * .585, w: W * .27, h: H * .29 }, W, H, .42) : c.fit({ cx: W * .7, cy: H * .6, w: W * .44, h: H * .5 }, W, H, .42),
      light: right(L[1][2], .18, 1.22), sos: right(L[2][2], .19, 1.42), door: right(L[3][2], .2, 1.3), route: right(L[4][2], .18, 1.28),
      espera: { tgt: V(-6, 23.5, -9), off: V(14, 6, 64), vo: [-.2 * W, 0] },
      oled: right(L[5][2], .2, 1.1), keypad: right(L[7][2], .2, 1.2), bars: right(L[8][2], .2, 1.3),
    };
  }
  const pA = V(0, 0, 0), pB = V(0, 0, 0);
  // encuadre de una pose, ya en números: { pos, tgt, vo }
  function camOf(p) {
    const a = typeof p.cam === 'string' ? cams[p.cam] : p.cam;
    const pos = pA.copy(a.off).applyAxisAngle(UP, p.ang).multiplyScalar(p.zoom).add(a.tgt).clone(), tgt = a.tgt.clone(), vo = [a.vo[0], a.vo[1]];
    if (p.cam2 && p.camK > 0) {
      const b = cams[p.cam2], k = p.camK;
      pos.lerp(pB.copy(b.off).add(b.tgt), k); tgt.lerp(b.tgt, k);
      vo[0] += (b.vo[0] - vo[0]) * k; vo[1] += (b.vo[1] - vo[1]) * k;
    }
    return { pos, tgt, vo };
  }

  /* ---------- de slide a slide ---------- */
  let cur = 'portada', t0 = 0, dur = 0, from = null, last = null, asm0 = null, W0 = 1920, H0 = 1080;

  /* ---------- la estudiante de la slide de la situación ---------- */
  // llega caminando por la banqueta desde la derecha, se detiene frente a la puerta, voltea hacia la calle y saca el celular
  const G = { x0: 30, x1: -6.5, z: -6.4, t0: 1.0, t1: 7.2, ciclo: 7.4 };
  function girlAt(t) {
    const u = ramp(t, G.t0, G.t1), k = (u + smooth(u)) / 2, x = G.x0 + (G.x1 - G.x0) * k;
    const cel = sm(t, G.t1 + .8, G.t1 + 2.0);
    // cada tanto levanta la vista y voltea a ver si viene el camión, un lado y luego el otro
    const w = t - (G.t1 + 5.5), n = Math.floor(w / 8.5), giro = w > 0 ? (n % 2 ? -.6 : .75) * hold(w - n * 8.5, 0, 1.1, 3.0, 4.2) : 0;
    return {
      x, z: G.z, rot: -Math.PI / 2 + (Math.PI / 2 + .12) * sm(t, G.t1 - .35, G.t1 + .9),
      fase: Math.abs(x - G.x0) / G.ciclo * Math.PI * 2, paso: sm(t, G.t0, G.t0 + .5) * (1 - sm(t, G.t1 - .7, G.t1)), cel, giro,
    };
  }
  let girl = null, fea = null, feoOn = false, ocultos = null;
  const caseta = [];
  { // la caseta se esconde justo al dibujar y se restaura al terminar, para no pelear con lo que la escena decide en cada cuadro
    const antes = stage.scene.onBeforeRender, despues = stage.scene.onAfterRender;
    stage.scene.onBeforeRender = function () { antes.apply(this, arguments); if (feoOn) { for (const o of caseta) { o.userData.vis = o.visible; o.visible = false; } ocultos = caseta; } };
    stage.scene.onAfterRender = function () { if (despues) despues.apply(this, arguments); if (ocultos) { for (const o of ocultos) o.visible = o.userData.vis; ocultos = null; } };
  }
  // la parada de hoy: una banca maltratada, un poste de parada chueco, un farol que parpadea y se apaga, basura y manchas
  function paradaFea(y) {
    const g = new THREE.Group(); g.visible = false;
    let seed = 7; const rnd = (a = 0, b = 1) => { seed = (seed * 16807) % 2147483647; return a + (b - a) * (seed / 2147483647); };
    const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: .95, ...o });
    const M = { madera: mat(0x9a8c7c), metal: mat(0x7f8896, { roughness: .7 }), oxido: mat(0x8a6f5c), papel: mat(0xc9ccd4), lata: mat(0xa5574e), vidrio: mat(0x5f8a72, { roughness: .4 }), hierba: mat(0x5f7d5c) };
    const add = (geo, m, x, yy, z, rx = 0, ry = 0, rz = 0, par = g) => { const o = new THREE.Mesh(geo, m); o.position.set(x, yy, z); o.rotation.set(rx, ry, rz); o.castShadow = o.receiveShadow = true; par.add(o); return o; };
    const box = (w, h, d) => new THREE.BoxGeometry(w, h, d), cyl = (r1, r2, h, n = 10, open = false) => new THREE.CylinderGeometry(r1, r2, h, n, 1, open);
    // banca: dos tablas de asiento, un respaldo entero y el otro colgando de un solo tornillo
    const b = new THREE.Group(); b.position.set(-15.5, y, -10.2); b.rotation.y = .05; g.add(b);
    add(box(13, .42, 1.35), M.madera, 0, 3.0, .75, 0, 0, 0, b); add(box(13, .42, 1.35), M.madera, 0, 2.94, -.8, 0, 0, .012, b);
    add(box(13, .42, 1.3), M.madera, 0, 5.9, -1.75, .2, 0, 0, b);
    add(box(12.4, .42, 1.3), M.madera, -.9, 3.9, -1.9, .2, 0, -.2, b);
    for (const x of [-5.6, 5.6]) { add(box(.45, 3, .45), M.oxido, x, 1.5, 1.1, 0, 0, 0, b); add(box(.45, 6.6, .45), M.oxido, x, 3.3, -1.5, .12, 0, 0, b); add(box(.4, .4, 2.9), M.oxido, x, 2.7, -.2, 0, 0, 0, b); }
    // poste de la parada, inclinado, con su letrero despintado
    const p = new THREE.Group(); p.position.set(-25.5, y, -9.6); p.rotation.set(.03, 0, -.09); g.add(p);
    add(cyl(.22, .22, 15), M.metal, 0, 7.5, 0, 0, 0, 0, p); add(box(3.4, 3.4, .16), M.oxido, 0, 13.2, .25, 0, 0, .06, p); add(box(2.2, .5, .18), M.papel, -.2, 13.7, .28, 0, 0, .06, p);
    // farol viejo: casi no alumbra
    const f = new THREE.Group(); f.position.set(-1.5, y, -12.2); f.rotation.z = .035; g.add(f);
    add(cyl(.26, .36, 21), M.metal, 0, 10.5, 0, 0, 0, 0, f); add(box(.3, .3, 5.2), M.metal, 0, 21, 2.4, 0, 0, 0, f);
    add(box(1.5, .5, 2.4), M.metal, 0, 20.75, 4.6, 0, 0, 0, f);
    const foco = add(box(1.1, .12, 1.9), new THREE.MeshStandardMaterial({ color: 0x2a2620, emissive: 0xffc27a, emissiveIntensity: 0 }), 0, 20.46, 4.6, 0, 0, 0, f);
    const luzF = new THREE.PointLight(0xffb866, 0, 70, 1.6); luzF.position.set(0, 19.6, 4.6); f.add(luzF);
    // bote volteado y basura regada
    add(cyl(1.7, 1.45, 4.4, 12, true), mat(0x6f7a86, { side: THREE.DoubleSide }), -7.6, y + 1.6, -11.3, 0, .5, Math.PI / 2);
    for (let i = 0; i < 16; i++) {
      const x = rnd(-24, 2), z = rnd(-11.6, -4.2), k = Math.floor(rnd(0, 4));
      if (k === 0) add(cyl(.38, .38, 1.1, 8), M.lata, x, y + .38, z, Math.PI / 2, rnd(0, 3), 0);
      else if (k === 1) add(new THREE.IcosahedronGeometry(rnd(.45, .75), 0), M.papel, x, y + .35, z, rnd(0, 3), rnd(0, 3), 0);
      else if (k === 2) add(box(rnd(1, 1.9), .06, rnd(.8, 1.5)), M.papel, x, y + .05, z, 0, rnd(0, 3), 0);
      else add(cyl(.26, .3, 1.5, 8), M.vidrio, x, y + .3, z, Math.PI / 2, rnd(0, 3), 0);
    }
    // manchas en la banqueta, un charco y hierba en las orillas
    for (let i = 0; i < 7; i++) { const o = add(new THREE.CircleGeometry(rnd(1.6, 4.4), 14), new THREE.MeshBasicMaterial({ color: 0x030611, transparent: true, opacity: rnd(.22, .42), depthWrite: false }), rnd(-26, 6), y + .03 + i * .004, rnd(-11.5, -4.5), -Math.PI / 2); o.scale.x = rnd(.6, 1.5); o.castShadow = false; }
    { const o = add(new THREE.CircleGeometry(2.3, 18), new THREE.MeshStandardMaterial({ color: 0x16284c, roughness: .1, metalness: .35, transparent: true, opacity: .6, depthWrite: false }), 4.6, y + .06, -5.6, -Math.PI / 2); o.scale.x = 1.5; o.castShadow = false; }
    for (const [x, z] of [[-25.8, -9.2], [-25.1, -10.1], [-1.9, -12.6], [-1.0, -11.7], [-21.4, -11.4], [-9.8, -11.7], [5.5, -11.2]]) for (let i = 0; i < 4; i++) add(new THREE.ConeGeometry(.22, rnd(1.1, 2.3), 4), M.hierba, x + rnd(-.5, .5), y + .7, z + rnd(-.4, .4), rnd(-.3, .3), 0, rnd(-.3, .3));
    return { g, luzF, foco };
  }
  // el farol titila débil mientras ella camina y se apaga para siempre justo cuando llega
  function farol(t) {
    if (t > 8.7) return 0;
    const n = Math.sin(t * 23.1) * Math.sin(t * 7.3 + 1.3) * Math.sin(t * 41.7 + .4);
    let k = .34 + .2 * Math.sin(t * 3.1) + (n > .22 ? .45 : 0) - (Math.sin(t * 13.7) > .9 ? .5 : 0);
    if (t > 7.5) k *= (Math.sin(t * 39) > -.2 ? 1 : .1) * (1 - sm(t, 7.5, 8.7));
    return clamp(k);
  }
  const listo = CON_BASE ? Promise.resolve() : import('../video/personas.js').then(async m => {
    const p = await m.loadPerson('estudiante', '/pitch-persona/');
    p.visible = false; stage.root.add(p);
    // en la oscuridad se pierde: un poco de luz propia, azulada, para que se distinga sin iluminar la escena
    for (const mt of p.userData.mats) { mt.emissive = new THREE.Color(0x9dbdff); mt.emissiveMap = mt.map; mt.emissiveIntensity = .2; }
    const luz = new THREE.PointLight(0xc4dcff, 0, 20, 2); stage.root.add(luz);
    const tel = new THREE.Mesh(new THREE.BoxGeometry(.44, .82, .06), new THREE.MeshBasicMaterial({ color: 0xdcebff })); tel.visible = false; stage.root.add(tel);
    // altura de la banqueta bajo su camino
    stage.root.updateMatrixWorld(true);
    const ray = new THREE.Raycaster(); ray.set(stage.root.localToWorld(V(12, 60, G.z)), V(0, -1, 0));
    const ys = ray.intersectObjects(stage.meshes, false).map(h => stage.root.worldToLocal(h.point.clone()).y).filter(y => y < 17.5);
    const gy = ys.length ? Math.max(...ys) : CAD.baseTop + .6;
    girl = { p, luz, tel, y: gy, animar: m.animar };
    fea = paradaFea(gy); stage.root.add(fea.g);
    // todo lo que se levanta de la banqueta es SafeWait (caseta, módulo, pinos): se oculta mientras se ve la parada fea
    const techo = stage.root.localToWorld(V(0, gy + 1.2, 0)).y, bb = new THREE.Box3(), aparte = new Set([p, fea.g, bus.group, luz, tel]);
    const dentro = o => { for (let q = o; q; q = q.parent) if (aparte.has(q)) return true; return false; };
    const c = V(0, 0, 0), sz = V(0, 0, 0), sensor = stage.root.localToWorld(V(COLOR.x, CAD.baseTop, COLOR.z));
    stage.root.traverse(o => {
      if (!(o.isMesh || o.isLine) || dentro(o) || bb.setFromObject(o).isEmpty()) return;
      bb.getCenter(c); bb.getSize(sz);
      // también el sensor de color que asoma en la calle
      if (bb.max.y > techo || (Math.hypot(c.x - sensor.x, c.z - sensor.z) < 3.5 && Math.max(sz.x, sz.z) < 7)) caseta.push(o);
    });
  }).catch(e => console.warn('persona:', e));
  const busIn = t => t < 0 ? null : BUS.a + (BUS.stop - BUS.a) * (1 - Math.pow(1 - ramp(t, 0, 3.4), 2.2));

  // estado completo en el instante now: la pose de la slide actual, mezclada con lo que había al cambiar
  function compute(now) {
    const tau = now - t0, to = { ...BASE, ...(POSES[cur] || POSES.portada)(tau) };
    let g = null;
    if (to.girlT != null) { // la cámara la sigue de cerca mientras camina y luego se abre: ella queda chica, sola frente a la caseta apagada
      g = girlAt(to.girlT);
      to.cam = { tgt: V(g.x - 3.5, (girl ? girl.y : 16.3) + 6.2, g.z), off: V(-9, 4, 40), vo: [-.15 * W0, .02 * H0] };
      to.cam2 = 'espera'; to.camK = sm(to.girlT, G.t1 - .4, G.t1 + 2.8);
      to.velo = 1 - to.camK;   // de cerca, el lado del texto se funde con la noche para que se lea
    }
    const e = dur ? ease(clamp(tau / dur)) : 1, cam = camOf(to), P = { busX: null, sosT: to.sosT, keysT: to.keysT };
    for (const k of NUM) P[k] = from && e < 1 ? from[k] + (to[k] - from[k]) * e : to[k];
    if (from && e < 1) {
      cam.pos.lerpVectors(from.pos, cam.pos, e); cam.tgt.lerpVectors(from.tgt, cam.tgt, e);
      cam.vo = [from.vo[0] + (cam.vo[0] - from.vo[0]) * e, from.vo[1] + (cam.vo[1] - from.vo[1]) * e];
    }
    Object.assign(P, cam);
    P.girl = g || (from && e < 1 ? from.girl : null);
    // camión: llega con su slide; al salir de ella no se desvanece, se va rodando hacia la izquierda
    if (to.busT != null) P.busX = busIn(to.busT);
    else if (from && from.busX != null) { const b = ramp(tau, 0, 2.6); P.busX = b < 1 ? from.busX + (BUS.b - from.busX) * Math.pow(b, 2.2) : null; }
    // un pulso del SOS que ya salió termina aunque se cambie de slide
    if (P.sosT == null && from && from.sosT != null) P.sosT = from.sosT + tau;
    if (P.keysT == null && from && from.keysT != null && e < 1) P.keysT = from.keysT + tau;
    return P;
  }

  function go(id, now, instant) {
    from = last && !instant ? compute(now) : null;
    if (from && from.sosT != null) {
      // solo se deja terminar el pulso en curso: no arrancan pulsos nuevos fuera de su slide
      const n = Math.floor((from.sosT - SOS_0) / SOS_EVERY);
      from.sosStop = n < 0 ? -1 : n;
    }
    cur = id; t0 = now; dur = from ? TRAVEL : 0;
  }

  /* ---------- un cuadro ---------- */
  const tmp = V(0, 0, 0), sw = V(0, 0, 0);
  const tOk = (CODE.length - 1) * KEY_STEP + .34;
  function render(now, fijo) {
    const W = document.documentElement.clientWidth, H = window.innerHeight;
    if (!W || !H) return null;
    if (camKey !== W + 'x' + H) { camKey = W + 'x' + H; W0 = W; H0 = H; stage.resize(); cams = buildCams(W, H); from = null; }
    if (asm0 == null) asm0 = now;
    const P = last = compute(now);

    // armado: una sola vez, al abrir la presentación
    const tA = ARMADO || fijo ? 99 : now - asm0;
    const asmT = clamp(tA - .4, 0, TOTAL);
    stage.pieces.forEach(p => { p.t0 = p.t0o; });
    stage.asm.t = asmT; stage.asm.done = false;
    const lift = Math.max(tA < 5 ? 1 - sm(tA, 2.7, 4.1) : 0, P.lift);
    roofG.position.y = ROOF_UP * lift; roofG.visible = lift < .998;
    details.update(asmT, SCALE);

    const s = view.state;
    s.night = Math.min(1, .92 * P.night); s.dark = Math.min(1, P.night); s.lamp = P.lamp;
    s.door = Math.max(P.door, tA < 5 ? 1 - sm(tA, 3.0, 4.1) : 0);
    s.bars = P.bars; s.oled = P.oled; s.explode = P.explode; s.xray = P.xray;
    s.roof = 0; s.sos = 0; s.busX = null; s.hl = null; s.plinth = !!CON_BASE;
    const hl = { sos: P.hlSos, door: P.hlDoor, bars: P.hlBars };
    for (const k in HLK) { const a = (hl[k] || 0) * (k === 'door' ? .45 : .8); for (const h of HLK[k]) h.mat.color.copy(h.base).lerp(HI, a); }
    doorMat.emissiveIntensity = P.lamp * P.night * .5;
    presses.forEach((p, i) => details.setPress(p, P.keysT == null ? -9 : P.keysT - i * KEY_STEP));

    // camión
    bus.setX(P.busX);
    if (P.busX != null) {
      const yF = c.roadY(P.busX - BUS.axf), yR = c.roadY(P.busX - BUS.axr);
      bus.group.position.y = CAD.baseTop + yF + (yR - yF) * (BUS.axf / (BUS.axf - BUS.axr));
      bus.group.rotation.z = -Math.atan2(yF - yR, BUS.axf - BUS.axr);
    }

    // SOS: un pulso cada SOS_EVERY segundos mientras la slide esté abierta
    let padK = 0;
    sosFx.forEach((f, j) => {
      let dt = -9;
      if (P.sosT != null) {
        let n = Math.floor((P.sosT - SOS_0 + .12) / SOS_EVERY);
        if (cur !== 'sos' && from && from.sosStop != null) n = Math.min(n, from.sosStop);
        const m = n - (((n - j) % 3) + 3) % 3;
        if (m >= 0) dt = P.sosT - (SOS_0 + m * SOS_EVERY);
      }
      const k = sm(dt, -.12, .04) * (1 - sm(dt, .22, .62));
      padK = Math.max(padK, k);
      f.glow.glow(k * .5, 1.3, .8, .12);
      f.ripples.forEach((w, i) => w.play((dt - .04 - i * .17) / 1.0, { r0: .9, r1: 3.3, w: .085, a: .8 }));
      f.alarm.forEach((w, i) => w.play((dt - .3 - i * .2) / 1.5, { r0: .56, r1: 7.2, w: .13, a: .8, fill: .14 }));
    });
    fsrPad.position.y = SOS_P.y - .09 * padK;

    // la estudiante: su pose de este cuadro, y el celular con su luz en la mano derecha
    if (girl) {
      const q = fea && P.feo > .5 ? P.girl : null; girl.p.visible = !!q;   // ella solo existe en la parada fea
      if (q) {
        girl.p.position.set(q.x, girl.y, q.z); girl.p.rotation.y = q.rot;
        girl.animar(girl.p, 'anda', q);
        const B = girl.p.userData.bones, hand = stage.root.worldToLocal(B.RHand.getWorldPosition(tmp)).clone(), head = stage.root.worldToLocal(B.Head.getWorldPosition(tmp)).clone();
        girl.tel.position.copy(hand).lerp(head, .16); girl.tel.lookAt(stage.root.localToWorld(head.clone()));
        girl.luz.position.copy(hand).lerp(head, .38);
      }
      girl.tel.visible = !!q && q.cel > .6; girl.luz.intensity = q ? q.cel * 13 : 0;
    }
    // parada fea o caseta de SafeWait: el cambio pasa con la imagen fundida a la noche, así nunca se ve el brinco
    feoOn = !!fea && P.feo > .5;
    if (fea) {
      fea.g.visible = feoOn;
      const k = feoOn && cur === 'situacion' ? farol(now - t0) : 0;
      fea.luzF.intensity = k * 280; fea.foco.material.emissiveIntensity = k * 2.4;
    }
    el.gl.style.opacity = sm(Math.abs(P.feo - .5) * 2, .2, 1).toFixed(3);

    // cámara, con un vaivén muy lento para que la imagen nunca quede congelada
    const cam = view.camera, a = fijo ? 0 : P.sway * Math.sin(now * .42);
    sw.copy(P.pos).sub(P.tgt).applyAxisAngle(UP, a).add(P.tgt);
    cam.aspect = W / H;
    cam.setViewOffset(W, H, P.vo[0] - P.out * W * .66, P.vo[1], W, H);   // out: la maqueta sale de cuadro por la derecha
    cam.position.copy(sw); cam.lookAt(P.tgt); cam.updateMatrixWorld();
    stage.render(now, 0);

    // fondo: de día claro; de noche oscuro, con el resplandor de la caseta
    el.night.style.opacity = P.night.toFixed(3);
    const g = tmp.copy(GLOW).project(cam);
    el.glow.style.setProperty('--cx', ((g.x * .5 + .5) * 100).toFixed(2) + '%');
    el.glow.style.setProperty('--cy', ((-g.y * .5 + .5) * 100).toFixed(2) + '%');
    el.glow.style.opacity = (P.lamp * P.night).toFixed(3);

    // clave del keypad: seis puntos que se llenan junto al módulo
    const kT = P.keysT, ck = kT == null ? 0 : sm(kT, -.55, -.1) * (1 - sm(kT, tOk + .9, tOk + 1.5));
    el.code.style.opacity = ck.toFixed(3);
    if (ck > 0) {
      const q = tmp.copy(KEYPAD_TOP).project(cam), ok = sm(kT, tOk, tOk + .28);
      const pop = 1 + .07 * Math.sin(Math.PI * ramp(kT, tOk, tOk + .4));
      el.code.style.transform = `translate(${((q.x * .5 + .5) * W).toFixed(1)}px, ${((-q.y * .5 + .5) * H).toFixed(1)}px) translate(-50%, -50%) scale(${pop.toFixed(4)})`;
      el.dots.forEach((d, i) => {
        const on = expo(ramp(kT, i * KEY_STEP, i * KEY_STEP + .3));
        d.style.background = `rgba(${[22 + 16 * ok, 38 + 87 * ok, 96 + 96 * ok].map(Math.round).join(',')},${(.14 + .86 * on).toFixed(3)})`;
        d.style.transform = `scale(${(.72 + .28 * on).toFixed(3)})`;
      });
    }
    return { night: Math.min(1, P.night), velo: P.velo };
  }

  // dónde cae en pantalla el ancla de cada nodo (fracciones del ancho y el alto)
  function project(keys) {
    return keys.map(k => { const p = tmp.copy(ANCHORS[k]).project(view.camera); return [p.x * .5 + .5, -p.y * .5 + .5]; });
  }

  window.pitch = { go, render, project, listo };
}
