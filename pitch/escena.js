// Escena 3D de la presentación. Corre dentro de /video/?pitch, en un iframe por look (azul y madera).
// La página de afuera (pitch.js) manda: go(id, now) cambia de slide y render(now) dibuja un cuadro.
// Cada slide es una "pose": valores de la maqueta y un encuadre, en función del tiempo que lleva la slide (tau).
import * as THREE from 'three';
import { ANCHORS, CAD } from '../src/scene.js';
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
const NUM = ['night', 'lamp', 'door', 'bars', 'oled', 'lift', 'explode', 'xray', 'hlSos', 'hlDoor', 'hlBars', 'sway', 'velo'];
const BASE = { cam: 'lado', cam2: null, camK: 0, ang: 0, zoom: 1, night: 0, lamp: 0, door: 0, bars: 0, oled: 0, lift: 0, explode: 0, xray: 0, hlSos: 0, hlDoor: 0, hlBars: 0, sway: .05, velo: 0, busT: null, sosT: null, keysT: null };

// una pose por slide (t = segundos desde que entró la slide)
const POSES = {
  portada: () => ({}),
  escena: () => ({ night: 1, ang: -.08, zoom: 1 }),
  problema: () => ({ night: 1, ang: -.15, zoom: 1.05 }),
  personas: () => ({ night: 1, ang: -.22, zoom: 1.09 }),
  // la caseta enciende su luz y, un momento después, amanece
  solucion: t => ({ lamp: sm(t, .5, 2), night: 1 - sm(t, 3.4, 5.6) }),
  luz: t => ({ cam: 'light', lift: 1, night: sm(t, 1.7, 3.2), lamp: sm(t, 2.8, 4.4) }),
  sos: t => ({ cam: 'sos', lift: 1, hlSos: sm(t, .8, 1.8), sosT: t }),
  acceso: t => { const f = t - 1.6, p = ((f % 6.6) + 6.6) % 6.6; return { cam: 'door', hlDoor: sm(t, .6, 1.6), door: f > 0 ? hold(p, 0, 1.5, 3.3, 4.7) : 0 }; },
  // llega el camión, la cámara se acerca a la pantalla y regresa
  ruta: t => { const k = sm(t, 5.2, 6.5) - sm(t, 9.8, 11.1); return { cam: 'route', cam2: 'oled', camK: k, velo: k, lift: 1, busT: t - .9, oled: sm(t, 4.5, 4.9) }; },
  // la cámara se acerca al teclado, se teclea la clave, y de regreso suben los barrotes
  barrotes: t => { const k = hold(t, 1.0, 2.5, 5.3, 6.9); return { cam: 'bars', cam2: 'keypad', camK: k, velo: k, hlBars: sm(t, .6, 1.6), keysT: t - 2.9, bars: sm(t, 6.1, 8.3) }; },
  datos: () => ({ ang: .22, zoom: .96 }),
  cierre: () => ({}),
  maqueta: () => ({ ang: -.12 }),
  distribucion: () => ({ cam: 'alto', lift: 1, sway: .03 }),
  oculto: () => ({ cam: 'abierto', explode: 1, sway: .04 }),
  flujo: () => ({ ang: .2, zoom: .95 }),
  dashboard: () => ({ ang: .08 }),
  gracias: () => ({}),
};

export function setupPitch(c) {
  const { stage, view, bus, roofG, ROOF_UP, details, presses, sosFx, HLK, HI, doorMat, fsrPad, SOS_P, TOTAL, SCALE, el, BUS, GLOW, params } = c;
  for (const id of ['label', 'end']) document.getElementById(id).style.display = 'none';
  const ARMADO = params.has('armado');           // la maqueta arranca ya armada

  /* ---------- encuadres ---------- */
  let cams = null, camKey = '';
  function buildCams(W, H) {
    const L = c.buildCam(W, H);
    // los encuadres del video van centrados: aquí la maqueta se recorre a la derecha para dejarle la izquierda al texto
    const right = (p, dx, k = 1) => ({ tgt: p.tgt, off: p.off.clone().multiplyScalar(k), vo: [p.vo[0] - dx * W, p.vo[1]] });
    return {
      lado: c.fit({ cx: W * .7, cy: H * .5, w: W * .56, h: H * .72 }, W, H),
      alto: c.fit({ cx: W * .7, cy: H * .52, w: W * .54, h: H * .74 }, W, H, .82),
      abierto: c.fit({ cx: W * .7, cy: H * .6, w: W * .44, h: H * .5 }, W, H, .42),
      light: right(L[1][2], .18, 1.22), sos: right(L[2][2], .19, 1.42), door: right(L[3][2], .2, 1.3), route: right(L[4][2], .18, 1.28),
      oled: right(L[5][2], .2, 1.1), keypad: right(L[7][2], .2, 1.2), bars: right(L[8][2], .2, 1.3),
    };
  }
  const pA = V(0, 0, 0), pB = V(0, 0, 0);
  // encuadre de una pose, ya en números: { pos, tgt, vo }
  function camOf(p) {
    const a = cams[p.cam];
    const pos = pA.copy(a.off).applyAxisAngle(UP, p.ang).multiplyScalar(p.zoom).add(a.tgt).clone(), tgt = a.tgt.clone(), vo = [a.vo[0], a.vo[1]];
    if (p.cam2 && p.camK > 0) {
      const b = cams[p.cam2], k = p.camK;
      pos.lerp(pB.copy(b.off).add(b.tgt), k); tgt.lerp(b.tgt, k);
      vo[0] += (b.vo[0] - vo[0]) * k; vo[1] += (b.vo[1] - vo[1]) * k;
    }
    return { pos, tgt, vo };
  }

  /* ---------- de slide a slide ---------- */
  let cur = 'portada', t0 = 0, dur = 0, from = null, last = null, asm0 = null;
  const busIn = t => t < 0 ? null : BUS.a + (BUS.stop - BUS.a) * (1 - Math.pow(1 - ramp(t, 0, 3.4), 2.2));

  // estado completo en el instante now: la pose de la slide actual, mezclada con lo que había al cambiar
  function compute(now) {
    const tau = now - t0, to = { ...BASE, ...(POSES[cur] || POSES.portada)(tau) };
    const e = dur ? ease(clamp(tau / dur)) : 1, cam = camOf(to), P = { busX: null, sosT: to.sosT, keysT: to.keysT };
    for (const k of NUM) P[k] = from && e < 1 ? from[k] + (to[k] - from[k]) * e : to[k];
    if (from && e < 1) {
      cam.pos.lerpVectors(from.pos, cam.pos, e); cam.tgt.lerpVectors(from.tgt, cam.tgt, e);
      cam.vo = [from.vo[0] + (cam.vo[0] - from.vo[0]) * e, from.vo[1] + (cam.vo[1] - from.vo[1]) * e];
    }
    Object.assign(P, cam);
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
    if (camKey !== W + 'x' + H) { camKey = W + 'x' + H; stage.resize(); cams = buildCams(W, H); from = null; }
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
    s.night = .92 * P.night; s.dark = P.night; s.lamp = P.lamp;
    s.door = Math.max(P.door, tA < 5 ? 1 - sm(tA, 3.0, 4.1) : 0);
    s.bars = P.bars; s.oled = P.oled; s.explode = P.explode; s.xray = P.xray;
    s.roof = 0; s.sos = 0; s.busX = null; s.hl = null;
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

    // cámara, con un vaivén muy lento para que la imagen nunca quede congelada
    const cam = view.camera, a = fijo ? 0 : P.sway * Math.sin(now * .42);
    sw.copy(P.pos).sub(P.tgt).applyAxisAngle(UP, a).add(P.tgt);
    cam.aspect = W / H;
    cam.setViewOffset(W, H, P.vo[0], P.vo[1], W, H);
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
    return { night: P.night, velo: P.velo };
  }

  // dónde cae en pantalla el ancla de cada nodo (fracciones del ancho y el alto)
  function project(keys) {
    return keys.map(k => { const p = tmp.copy(ANCHORS[k]).project(view.camera); return [p.x * .5 + .5, -p.y * .5 + .5]; });
  }

  window.pitch = { go, render, project };
}
