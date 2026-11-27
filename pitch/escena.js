// Escena 3D de la presentación. Corre dentro de /video/?pitch, en un iframe por look (azul y madera).
// La página de afuera (pitch.js) manda: go(id, now) cambia de slide y render(now) dibuja un cuadro.
// Cada slide es una "pose": valores de la maqueta y un encuadre, en función del tiempo que lleva la slide (tau).
import * as THREE from 'three';
import { ANCHORS, CAD } from '../src/scene.js';
import { paradaFea, farol } from './parada.js';
import { G, girlAt } from './chica.js';
import { nodemcu } from './nodemcu.js';
import { KEYPAD_TOP } from '../src/detail.js';
import { CODE } from '../video/guion.js';

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smooth = t => t * t * (3 - 2 * t);
const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const expo = t => t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
const ramp = (t, a, b) => clamp((t - a) / (b - a));
const sm = (t, a, b) => smooth(ramp(t, a, b));
const hold = (t, a, b, c, d) => sm(t, a, b) * (1 - sm(t, c, d));
const ciclo = (t, T) => ((t % T) + T) % T;   // el segundo dentro de un ciclo que se repite cada T
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);

const KEY_STEP = .38;                 // segundos entre teclas de la clave
const SOS_0 = 2.0, SOS_EVERY = 2.8;   // primer pulso del SOS y cada cuánto se repite
const TRAVEL = 1.7;                   // lo que dura el viaje entre dos slides
const EX_0 = .8;                      // qué tan separada aparece la maqueta antes de armarse (1 = vista explotada completa)

// valores que se mezclan al cambiar de slide
const NUM = ['night', 'lamp', 'door', 'bars', 'oled', 'lift', 'explode', 'xray', 'hlSos', 'hlDoor', 'hlBars', 'sway', 'velo', 'out', 'feo', 'ex', 'vis', 'foco', 'mcu'];
const BASE = { cam: 'lado', cam2: null, camK: 0, ang: 0, zoom: 1, night: 0, lamp: 0, door: 0, bars: 0, oled: 0, lift: 0, explode: 0, xray: 0, hlSos: 0, hlDoor: 0, hlBars: 0, sway: .05, velo: 0, out: 0, feo: 0, ex: 0, vis: 1, foco: 0, mcu: 0, busOut: 0, girlT: null, busT: null, sosT: null, keysT: null };

// una pose por slide (t = segundos desde que entró la slide)
const POSES = {
  portada: () => ({}),
  // la situación: de noche, una estudiante camina sola a la parada, se detiene y espera viendo el celular (girlT mueve todo)
  // feo: en vez de la caseta de SafeWait se ve la parada de hoy (banca, poste, farol que falla, basura)
  situacion: t => ({ night: 1.09, sway: .012, girlT: t, feo: 1 }),   // night > 1: más oscuro que las demás slides de noche
  // datos y personas: la maqueta se hace a un lado (out) y deja toda la pantalla
  cifras: () => ({ night: 1, out: 1, ang: -.1, feo: 1 }),
  personas: () => ({ night: 1, out: 1, ang: -.1, feo: 1 }),
  // SafeWait se presenta: amanece sin nada en pantalla y la maqueta aparece separada por capas y se arma (vis, ex)
  solucion: t => ({ night: 1 - sm(t, 0, 1.3), vis: sm(t, 1.2, 1.9), ex: EX_0 * (1 - sm(t, 1.9, 4.4)), ang: .18 * (1 - sm(t, 1.2, 5.5)) }),
  luz: t => ({ cam: 'light', lift: 1, night: sm(t, 1.7, 3.2), lamp: sm(t, 2.8, 4.4) }),
  // de noche, para que se vea la tira LED alternando rojo y azul con cada alerta (como en la landing)
  sos: t => ({ cam: 'sos', lift: 1, hlSos: sm(t, .8, 1.8), sosT: t, night: .86 * sm(t, .2, 1.5) }),
  acceso: t => { const f = t - 1.6, p = ((f % 6.6) + 6.6) % 6.6; return { cam: 'door', hlDoor: sm(t, .6, 1.6), door: f > 0 ? hold(p, 0, 1.5, 3.3, 4.7) : 0 }; },
  // llega el camión, la cámara se acerca a la pantalla y regresa
  ruta: t => { const k = sm(t, 5.2, 6.5) - sm(t, 9.8, 11.1); return { cam: 'route', cam2: 'oled', camK: k, velo: k, lift: 1, busT: t - .9, oled: sm(t, 4.5, 4.9) }; },
  // la cámara se acerca al teclado, se teclea la clave, y de regreso suben los barrotes
  barrotes: t => { const k = hold(t, 1.0, 2.5, 5.3, 6.9); return { cam: 'bars', cam2: 'keypad', camK: k, velo: k, hlBars: sm(t, .6, 1.6), keysT: t - 2.9, bars: sm(t, 6.1, 8.3) }; },
  registro: () => ({ out: 1, ang: .1 }),
  cierre: () => ({}),
  // la maqueta de madera: la cámara parte del encuadre azul (así el cambio de material no brinca) y se aleja para que quepa la base
  escala: t => ({ cam: 'lado', cam2: 'ladoB', camK: sm(t, .2, 2.4), ang: -.12 * sm(t, .2, 2.4) }),
  mdf: () => ({ cam: 'abiertoB', explode: 1, sway: .04 }),
  // las piezas impresas: sigue separada, la cámara se acerca, todo lo demás se desenfoca y pierde el color (foco),
  // y los barrotes suben y bajan
  impresas: t => ({ cam: 'impresas', explode: 1, sway: .03, foco: 1, bars: hold(ciclo(t - 2.2, 7), 0, 2.2, 3.6, 5.8) * sm(t, 2.2, 2.4) }),
  // la base se vuelve translúcida y cinco NodeMCU orbitan la maqueta (mcu)
  oculto: () => ({ cam: 'ladoB', zoom: 1.2, xray: 1, ang: .16, sway: .04, mcu: 1 }),
  distribucion: () => ({ cam: 'altoB', lift: 1, sway: .03 }),
  flujo: () => ({ ang: .2 }),
  dashboard: () => ({ ang: .08 }),
  // en la parte de maqueta cada nodo es el fondo de quien lo presenta: su animación se repite hasta que cambie la slide
  // (SOS y Acceso ya se repiten solos)
  'd-luz': t => { const p = ciclo(t, 10.2); return { cam: 'light', lift: 1, night: hold(p, 1.7, 3.2, 7.6, 9.3), lamp: hold(p, 2.8, 4.4, 7.2, 8.7) }; },
  'd-ruta': t => { const p = ciclo(t, 14.6), k = hold(p, 5.2, 6.5, 9.8, 11.1); return { cam: 'route', cam2: 'oled', camK: k, velo: k, lift: 1, busT: p - .9, busOut: ramp(p, 11.5, 14), oled: hold(p, 4.5, 4.9, 11.2, 11.6) }; },
  'd-barrotes': t => { const p = ciclo(t, 13.6), k = hold(p, 1.0, 2.5, 5.3, 6.9); return { cam: 'bars', cam2: 'keypad', camK: k, velo: k, hlBars: sm(t, .6, 1.6), keysT: p - 2.9, bars: hold(p, 6.1, 8.3, 10.4, 12.7) }; },
  gracias: () => ({ cam: 'chico' }),
};

export function setupPitch(c) {
  const { stage, view, bus, roofG, ROOF_UP, details, presses, sosFx, HLK, HI, doorMat, fsrPad, SOS_P, TOTAL, SCALE, el, BUS, GLOW, params, CON_BASE } = c;
  for (const id of ['label', 'end']) document.getElementById(id).style.display = 'none';
  el.gl = document.getElementById('gl');
  const DOOR_GLOW = doorMat.emissive.getHex();
  // el SOS se ve de noche: la alarma sale en rojo y el toque en blanco, como en la landing (el video las trae en azul marino)
  for (const f of sosFx) { f.glow.mesh.material.uniforms.uC.value.setHex(0xff5a4e); f.alarm.forEach(w => w.mesh.material.uniforms.uC.value.setHex(0xff5a4e)); f.ripples.forEach(w => w.mesh.material.uniforms.uC.value.setHex(0xffffff)); }
  { // pantalla OLED como la del nodo real (y la de la landing): el color que detectó el sensor y sus valores RGB
    const cv = stage.oledTex.image, K = 2, w = cv.width, h = cv.height, g = cv.getContext('2d');
    cv.width = w * K; cv.height = h * K; g.setTransform(K, 0, 0, K, 0, 0);
    const SANS = '"Inter Variable", Inter, system-ui, sans-serif';
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h); g.textBaseline = 'alphabetic'; g.textAlign = 'left';
    g.fillStyle = '#9fd0f5'; g.font = `500 17px ${SANS}`; g.fillText('Color detectado:', 12, 27);
    g.fillStyle = '#eaf6ff'; g.font = '700 54px "Inter Tight Variable", "Inter Tight", system-ui, sans-serif'; g.fillText('AZUL', 10, 82);
    g.fillStyle = '#9fd0f5'; g.font = `500 17px ${SANS}`; g.fillText('R:24  G:96  B:231', 12, 113);
    stage.oledTex.dispose(); stage.oledTex.needsUpdate = true;   // cambió de tamaño: la textura se vuelve a crear
  }
  // entrada de la portada: no hay maqueta hasta que pitch.js llama entrada(); entonces aparece separada por capas y se junta
  // frenando (la "explotada" de la landing). ent: null = esperando; si no, el segundo en que arrancó (con ?armado ya está junta)
  const EX_DUR = 2.5, YA = -1e9;
  let ent = params.has('armado') ? YA : null;
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
      lado: c.fit({ cx: W * .7, cy: H * .52, w: W * .56, h: H * .72 }, W, H),
      chico: c.fit({ cx: W * .74, cy: H * .46, w: W * .46, h: H * .6 }, W, H),
      // con su base (madera) la maqueta es más alta: se encuadra más chica y más arriba para que quepa el pedestal.
      // Los dos iframes calculan los mismos encuadres, así al cambiar de look la cámara coincide en ambos
      ladoB: c.fit({ cx: W * .7, cy: H * .39, w: W * .44, h: H * .54 }, W, H),
      altoB: c.fit({ cx: W * .71, cy: H * .38, w: W * .38, h: H * .5 }, W, H, .8),
      abiertoB: c.fit({ cx: W * .7, cy: H * .6, w: W * .31, h: H * .33 }, W, H, .42),
      impresas: c.fit({ cx: W * .69, cy: H * .6, w: W * .36, h: H * .36 }, W, H, .34),
      light: right(L[1][2], .18, 1.22), sos: right(L[2][2], .19, 1.42), door: right(L[3][2], .2, 1.3), route: right(L[4][2], .18, 1.28),
      espera: { tgt: V(G.x1 + 1, 22.2, -9), off: V(11, 4.5, 50), vo: [-.25 * W, 0] },
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
  let cur = 'portada', t0 = 0, dur = 0, from = null, W0 = 1920, H0 = 1080;

  /* ---------- la slide de la situación: la estudiante (chica.js) en la parada de hoy (parada.js) ---------- */
  let girl = null, fea = null, feoOn = false, ocultos = null, soloImp = false;
  const caseta = [];
  // piezas impresas en 3D (barrotes con su cremallera, esquinas del techo y polea) y todo lo que no lo es
  const IMPRESA = new Set(['corner', 'hl_bars_bars', 'pulley']), noImp = [];
  { const es = o => { for (let q = o; q; q = q.parent) if (q.userData && IMPRESA.has(q.userData.cls)) return true; return false; };
    stage.root.traverse(o => { if ((o.isMesh || o.isLine) && !es(o)) noImp.push(o); }); }
  // su copia nítida va en un lienzo aparte, encima del de la escena (que se desenfoca)
  const fc = document.createElement('canvas'), fg = fc.getContext('2d');
  fc.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;opacity:0';
  el.gl.after(fc);
  // cinco NodeMCU en órbita alrededor de la base (slide "Bajo la plataforma")
  const orbita = new THREE.Group(); orbita.visible = false; stage.root.add(orbita);
  const placas = [0, 1, 2, 3, 4].map(() => { const o = nodemcu(); o.scale.setScalar(3.1); orbita.add(o); return o; });
  for (const o of placas) o.traverse(q => { if (q.isMesh) noImp.push(q); });
  { // la caseta se esconde justo al dibujar y se restaura al terminar, para no pelear con lo que la escena decide en cada cuadro
    const antes = stage.scene.onBeforeRender, despues = stage.scene.onAfterRender;
    stage.scene.onBeforeRender = function () { antes.apply(this, arguments); const lista = soloImp ? noImp : feoOn ? caseta : null; if (lista) { for (const o of lista) { o.userData.vis = o.visible; o.visible = false; } ocultos = lista; } };
    stage.scene.onAfterRender = function () { if (despues) despues.apply(this, arguments); if (ocultos) { for (const o of ocultos) o.visible = o.userData.vis; ocultos = null; } };
  }
  const listo = CON_BASE ? Promise.resolve() : import('../video/personas.js').then(async m => {
    const p = await m.loadPerson('estudiante', '/pitch-persona/');
    p.visible = false; stage.root.add(p);
    // en la oscuridad se pierde: un poco de luz propia, azulada, para que se distinga sin iluminar la escena
    for (const mt of p.userData.mats) { mt.emissive = new THREE.Color(0x9dbdff); mt.emissiveMap = mt.map; mt.emissiveIntensity = .2; }
    const luz = new THREE.PointLight(0xc4dcff, 0, 20, 2); stage.root.add(luz);
    const tel = new THREE.Mesh(new THREE.BoxGeometry(.44, .82, .06), new THREE.MeshBasicMaterial({ color: 0xdcebff })); tel.visible = false; stage.root.add(tel);
    // la banqueta de la parada queda a la altura de la de la maqueta
    stage.root.updateMatrixWorld(true);
    const ray = new THREE.Raycaster(); ray.set(stage.root.localToWorld(V(12, 60, -6.4)), V(0, -1, 0));
    const ys = ray.intersectObjects(stage.meshes, false).map(h => stage.root.worldToLocal(h.point.clone()).y).filter(y => y < 17.5);
    const gy = ys.length ? Math.max(...ys) : CAD.baseTop + .6;
    girl = { p, luz, tel, y: gy, animar: m.animar };
    fea = paradaFea({ y: gy, calle: CAD.baseTop, banca: [G.x1, G.zBanca] }); stage.root.add(fea.g);
    // mientras se ve la parada de hoy no se dibuja nada de la maqueta: ni la caseta ni su base
    const aparte = new Set([p, fea.g, bus.group, luz, tel]);
    const dentro = o => { for (let q = o; q; q = q.parent) if (aparte.has(q)) return true; return false; };
    stage.root.traverse(o => { if ((o.isMesh || o.isLine) && !dentro(o)) caseta.push(o); });
  }).catch(e => console.warn('persona:', e));
  const busIn = t => t < 0 ? null : BUS.a + (BUS.stop - BUS.a) * (1 - Math.pow(1 - ramp(t, 0, 3.4), 2.2));

  // estado completo en el instante now: la pose de la slide actual, mezclada con lo que había al cambiar
  function compute(now) {
    const tau = now - t0, raw = (POSES[cur] || POSES.portada)(tau), to = { ...BASE, ...raw };
    let g = null;
    if (to.girlT != null) { // la cámara la sigue de cerca mientras camina y luego se abre: ella queda chica, sola frente a la caseta apagada
      g = girlAt(to.girlT);
      to.cam = { tgt: V(g.x - 3.5, (girl ? girl.y : 16.3) + 6.2, G.zCamina), off: V(-9, 4, 40), vo: [-.2 * W0, .02 * H0] };
      to.cam2 = 'espera'; to.camK = sm(to.girlT, G.t1 - .6, G.t1 + 2.2);
      to.velo = 1;   // el lado del texto se funde con la noche: detrás hay una barda rayada y no se leería
    }
    const e = dur ? ease(clamp(tau / dur)) : 1, cam = camOf(to), P = { busX: null, sosT: to.sosT, keysT: to.keysT };
    for (const k of NUM) P[k] = from && e < 1 ? from[k] + (to[k] - from[k]) * e : to[k];
    if (raw.vis != null) { P.vis = raw.vis; P.solo = true; }   // la pose que esconde la maqueta manda: no se mezcla con la slide anterior
    else if (from && e < 1) {
      if (!from.calle && to.out >= 1) P.solo = true;   // de la caseta a una slide de datos (hacia atrás): la calle no se asoma
      if (to.feo > .5) P.vis = from.vis;               // hacia una slide de calle la maqueta no aparece si no se estaba viendo
    }
    if (from && e < 1) {
      cam.pos.lerpVectors(from.pos, cam.pos, e); cam.tgt.lerpVectors(from.tgt, cam.tgt, e);
      cam.vo = [from.vo[0] + (cam.vo[0] - from.vo[0]) * e, from.vo[1] + (cam.vo[1] - from.vo[1]) * e];
    }
    Object.assign(P, cam);
    P.girl = g || (from && e < 1 ? from.girl : null);
    // camión: llega con su slide; al salir de ella no se desvanece, se va rodando hacia la izquierda
    if (to.busT != null) P.busX = to.busOut > 0 ? (to.busOut < 1 ? BUS.stop + (BUS.b - BUS.stop) * Math.pow(to.busOut, 2.2) : null) : busIn(to.busT);   // busOut: se va rodando sin cambiar de slide
    else if (from && from.busX != null) { const b = ramp(tau, 0, 2.6); P.busX = b < 1 ? from.busX + (BUS.b - from.busX) * Math.pow(b, 2.2) : null; }
    // un pulso del SOS que ya salió termina aunque se cambie de slide
    if (P.sosT == null && from && from.sosT != null) P.sosT = from.sosT + tau;
    if (P.keysT == null && from && from.keysT != null && e < 1) P.keysT = from.keysT + tau;
    return P;
  }

  function encuadra() {
    const W = document.documentElement.clientWidth, H = window.innerHeight;
    if (!W || !H) return;
    camKey = W + 'x' + H; W0 = W; H0 = H; stage.resize(); cams = buildCams(W, H);
  }
  // entrada de la portada: cuánto falta por juntarse (1 a 0) y cuánto se ve (0 a 1)
  const entK = now => ent == null ? 1 : 1 - smooth(clamp((now - ent - .8) / EX_DUR));   // aparece separada, se sostiene un momento y se junta
  const entVis = now => ent == null ? 0 : sm(now - ent, .35, 1.05);
  function go(id, now, instant) {
    // el iframe que no se está viendo también calcula de dónde viene: así, al cambiar de look, las dos cámaras coinciden
    if (!cams) encuadra();
    const stop0 = cur !== 'sos' && from ? from.sosStop : null;   // una alerta que ya venía de otra slide conserva su tope
    from = cams && !instant ? compute(now) : null;
    if (from) from.calle = from.feo > .5 && !from.solo;   // ¿se estaba viendo la calle al salir?
    if (from && from.solo) from.feo = from.out = 0;   // la slide que esperaba en blanco ya dejó atrás la calle: no regresa al salir
    if (from && id !== 'portada' && ent !== YA) { from.ex = Math.max(from.ex, EX_0 * entK(now)); from.vis = Math.min(from.vis, entVis(now)); }   // sale de la portada antes de terminar la entrada: sigue desde donde iba
    if (from && from.vis < .05) from.ex = 0;   // lo que no se veía no trae su separación a la slide que sigue
    if (from && from.sosT != null) {
      // solo se deja terminar el pulso en curso: no arrancan pulsos nuevos fuera de su slide
      const n = Math.floor((from.sosT - SOS_0) / SOS_EVERY);
      from.sosStop = stop0 != null ? stop0 : n < 0 ? -1 : n;
      if (from.sosT - (SOS_0 + from.sosStop * SOS_EVERY) > 2.4) from.sosT = null;   // ese pulso ya terminó: no se arrastra más
    }
    cur = id; t0 = now; dur = from ? TRAVEL : 0;
    if (id !== 'portada') ent = YA;   // fuera de la portada la entrada ya no corre (ni se queda esperando)
  }

  /* ---------- un cuadro ---------- */
  const tmp = V(0, 0, 0), sw = V(0, 0, 0);
  const tOk = (CODE.length - 1) * KEY_STEP + .34;
  function render(now, fijo) {
    const W = document.documentElement.clientWidth, H = window.innerHeight;
    if (!W || !H) return null;
    if (camKey !== W + 'x' + H) { encuadra(); from = null; }
    const P = compute(now);

    // todas las piezas en su lugar; lo único que se anima al abrir es la separación de la entrada
    stage.pieces.forEach(p => { p.t0 = p.t0o; });
    stage.asm.t = TOTAL; stage.asm.done = false;
    const exK = Math.max(fijo ? 0 : entK(now), P.ex / EX_0), vis = P.vis * (fijo ? 1 : entVis(now));
    stage.asm.ex = EX_0 * exK;
    // separada ocupa más alto: la cámara la ve de más lejos y más abajo, y se acerca conforme se junta
    if (exK > 0) { P.pos.sub(P.tgt).multiplyScalar(1 + .6 * exK).add(P.tgt); P.vo[1] -= .15 * H * exK; }
    roofG.position.y = ROOF_UP * P.lift; roofG.visible = P.lift < .998;
    details.update(TOTAL, SCALE);

    const s = view.state;
    s.night = Math.min(1, .92 * P.night); s.dark = Math.min(1, P.night); s.lamp = P.lamp;
    s.door = P.door;
    s.bars = P.bars; s.oled = P.oled; s.explode = P.explode; s.xray = P.xray;
    s.roof = 0; s.sos = 0; s.busX = null; s.hl = null; s.led = null; s.plinth = !!CON_BASE;
    const hl = { sos: P.hlSos, door: P.hlDoor, bars: P.hlBars };
    for (const k in HLK) { const a = (hl[k] || 0) * (k === 'door' ? .45 : .8); for (const h of HLK[k]) h.mat.color.copy(h.base).lerp(HI, a); }
    presses.forEach((p, i) => details.setPress(p, P.keysT == null ? -9 : P.keysT - i * KEY_STEP));

    // camión
    bus.setX(P.busX);
    if (P.busX != null) {
      const yF = c.roadY(P.busX - BUS.axf), yR = c.roadY(P.busX - BUS.axr);
      bus.group.position.y = CAD.baseTop + yF + (yR - yF) * (BUS.axf / (BUS.axf - BUS.axr));
      bus.group.rotation.z = -Math.atan2(yF - yR, BUS.axf - BUS.axr);
    }

    // SOS: un pulso cada SOS_EVERY segundos mientras la slide esté abierta
    let padK = 0, sosDt = -9;
    sosFx.forEach((f, j) => {
      let dt = -9;
      if (P.sosT != null) {
        let n = Math.floor((P.sosT - SOS_0 + .12) / SOS_EVERY);
        if (cur !== 'sos' && from && from.sosStop != null) n = Math.min(n, from.sosStop);
        const m = n - (((n - j) % 3) + 3) % 3;
        if (m >= 0) dt = P.sosT - (SOS_0 + m * SOS_EVERY);
      }
      const k = sm(dt, -.12, .04) * (1 - sm(dt, .22, .62));
      if (dt >= 0 && (sosDt < 0 || dt < sosDt)) sosDt = dt;   // la alerta más reciente (las otras ondas son de alertas anteriores)
      padK = Math.max(padK, k);
      f.glow.glow(k * .5, 1.3, .8, .12);
      f.ripples.forEach((w, i) => w.play((dt - .04 - i * .17) / 1.0, { r0: .9, r1: 3.3, w: .085, a: .8 }));
      f.alarm.forEach((w, i) => w.play((dt - .3 - i * .2) / 1.5, { r0: .56, r1: 7.2, w: .13, a: .8, fill: .14 }));
    });
    fsrPad.position.y = SOS_P.y - .09 * padK;
    // la alerta en la tira LED: rojo y azul alternados mientras suena (colores y ritmo de la landing); la puerta de papel los refleja
    const led = sosDt > .06 && sosDt < 2.05 ? (Math.floor(sosDt / .28) % 2 ? 0x1436ff : 0xff2a1f) : null;
    if (led) { s.led = led; s.lamp = led === 0x1436ff ? 2.2 : 1; }
    doorMat.emissive.setHex(led ?? DOOR_GLOW); doorMat.emissiveIntensity = led ? Math.min(1.1, .45 + s.lamp * .3) : P.lamp * P.night * .5;

    // la estudiante: su pose de este cuadro, y el celular con su luz en la mano derecha
    if (girl) {
      const q = fea && P.feo > .5 ? P.girl : null; girl.p.visible = !!q;   // ella solo existe en la parada fea
      if (q) {
        girl.p.position.set(q.x, girl.y, q.z); girl.p.rotation.y = q.rot;
        girl.animar(girl.p, 'libre', q.spec);
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
      fea.quiebra(P.girl ? P.girl.quiebre : 1);
      const k = feoOn && cur === 'situacion' ? farol(now - t0, G.sienta - .2) : 0;   // a oscuras mientras camina; titila cuando se sienta y se apaga
      fea.luzF.intensity = k * 280; fea.foco.material.emissiveIntensity = k * 2.4;
    }
    // en las slides de datos y personas la escena de la calle no se va de lado: se desvanece
    // (la escena de madera no tiene calle: en esas slides no dibuja nada; y la calle no regresa mientras la solución espera en blanco)
    el.gl.style.opacity = (sm(Math.abs(P.feo - .5) * 2, .2, 1) * (feoOn ? (P.solo ? 0 : 1 - clamp(P.out)) : fea ? vis : vis * (1 - sm(P.feo, 0, .5)))).toFixed(3);

    // cámara, con un vaivén muy lento para que la imagen nunca quede congelada
    const cam = view.camera, a = fijo ? 0 : P.sway * Math.sin(now * .42);
    sw.copy(P.pos).sub(P.tgt).applyAxisAngle(UP, a).add(P.tgt);
    cam.aspect = W / H;
    cam.setViewOffset(W, H, P.vo[0] - P.out * W * .66, P.vo[1], W, H);   // out: la maqueta sale de cuadro por la derecha
    cam.position.copy(sw); cam.lookAt(P.tgt); cam.updateMatrixWorld();
    // NodeMCU: una órbita inclinada alrededor de la base; cada placa gira despacio sobre sí misma
    orbita.visible = P.mcu > .01;
    if (orbita.visible) placas.forEach((o, i) => {
      const a = i * Math.PI * .4 + (fijo ? .5 : now * .32), k = smooth(clamp(P.mcu * 1.6 - i * .15));
      o.position.set(Math.sin(a) * 43 * k, 9 + 5 * Math.cos(a) + 1.2 * Math.sin(now * 1.1 + i * 2) + 26 * (1 - k), -7.7 + Math.cos(a) * 35 * k);
      o.rotation.set(.5 + .2 * Math.sin(now * .7 + i), a * 1.5 + i, .25 * Math.cos(now * .5 + i * 1.7)); o.scale.setScalar(3.1 * k + .001);
    });
    // foco: primero solo las piezas impresas, que se copian nítidas a su lienzo; luego la escena completa, que se desenfoca
    const foco = P.foco > .01;
    if (foco) {
      soloImp = true; stage.render(now, 0); soloImp = false;
      if (fc.width !== el.gl.width || fc.height !== el.gl.height) { fc.width = el.gl.width; fc.height = el.gl.height; }
      fg.clearRect(0, 0, fc.width, fc.height); fg.drawImage(el.gl, 0, 0);
    }
    stage.render(now, 0);
    el.gl.style.filter = foco ? `blur(${(W / 1920 * 6.5 * P.foco).toFixed(2)}px) grayscale(${P.foco.toFixed(3)})` : '';
    fc.style.opacity = foco ? P.foco.toFixed(3) : '0';
    fc.style.filter = foco ? `drop-shadow(0 0 ${(W / 1920 * 14).toFixed(1)}px rgba(38, 125, 192, ${(.5 * P.foco).toFixed(3)}))` : '';

    // fondo: de día claro; de noche oscuro, con el resplandor de la caseta
    el.night.style.opacity = P.night.toFixed(3);
    const g = tmp.copy(GLOW).project(cam);
    el.glow.style.setProperty('--cx', ((g.x * .5 + .5) * 100).toFixed(2) + '%');
    el.glow.style.setProperty('--cy', ((-g.y * .5 + .5) * 100).toFixed(2) + '%');
    el.glow.style.opacity = (P.lamp * P.night * vis).toFixed(3);

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

  // puntos [x, y, z] (cm de la maqueta) a fracciones de pantalla: para las cotas
  const proj = pts => pts.map(q => { stage.root.localToWorld(tmp.set(q[0], q[1], q[2])).project(view.camera); return [tmp.x * .5 + .5, -tmp.y * .5 + .5]; });

  window.pitch = { go, render, project, proj, listo, entrada: now => { ent = now; }, armada: () => { ent = YA; }, reset: () => { ent = null; } };
}
