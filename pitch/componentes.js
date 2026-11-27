// Los sensores y actuadores de los cinco nodos, hechos con cajas y cilindros a su tamaño real en centímetros (como nodemcu.js).
// Cada función regresa un grupo acostado sobre una mesa (Y hacia arriba), centrado en el origen. Si la pieza hace algo cuando
// su nodo trabaja en la maqueta, lo expone en userData.fx(f, t): f trae el estado de la escena (escena.js lo regresa en render).
// Va al mismo tiempo que la maqueta: el sensor suelta ondas en el instante en que detecta y el actuador se mueve con el suyo.
// El fx de un sensor regresa de 0 a 1 qué tan recién detectó, y con eso parpadea el LED del NodeMCU (flotan.js).
import * as THREE from 'three';

const std = o => new THREE.MeshStandardMaterial(o);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const SANS = '"Inter Variable", Inter, system-ui, sans-serif';
// textura dibujada en un lienzo de w x h
function lienzo(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
const rr = (g, x, y, w, h, r) => { g.beginPath(); g.roundRect(x, y, w, h, r); };
// segundos desde la última vez que una señal subió de su umbral (el momento en que el sensor detecta)
const flanco = (umbral = .02) => { let antes = 0, t0 = -99; return (v, t) => { if (v > umbral && antes <= umbral) t0 = t; antes = v; return t - t0; }; };
const reciente = dt => clamp(1 - dt / .7) * clamp(dt * 20 + .2);

let K = null;
function comunes() {
  if (K) return K;
  // halo de un LED encendido: un disco que se desvanece hacia afuera
  const halo = lienzo(64, 64, g => { const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.25, 'rgba(255,255,255,.55)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); });
  K = {
    negro: std({ color: 0x15171c, roughness: .5 }), mate: std({ color: 0x1b1d22, roughness: .85 }), blanco: std({ color: 0xf1f1ee, roughness: .5 }),
    plata: std({ color: 0xc8ccd2, roughness: .28, metalness: .85 }), oro: std({ color: 0xd9b24a, roughness: .35, metalness: .8 }), cobre: std({ color: 0xc98a4b, roughness: .4, metalness: .7 }),
    azul: std({ color: 0x1759b0, roughness: .5 }), gris: std({ color: 0x8b9099, roughness: .6 }),
    caja: new THREE.BoxGeometry(1, 1, 1), cil: new THREE.CylinderGeometry(1, 1, 1, 40), plano: new THREE.PlaneGeometry(1, 1), halo,
    aro: lienzo(128, 128, c => { c.strokeStyle = '#fff'; c.lineWidth = 7; c.beginPath(); c.arc(64, 64, 56, 0, 7); c.stroke(); }),
  };
  return K;
}
// un grupo con atajos para agregarle cajas, cilindros (eje Y) y discos de luz
function pieza() {
  const M = comunes(), g = new THREE.Group();
  const pon = (o, x, y, z) => { o.position.set(x, y, z); o.castShadow = true; g.add(o); return o; };
  return {
    g, M,
    caja: (m, w, h, d, x, y, z) => { const o = new THREE.Mesh(M.caja, m); o.scale.set(w, h, d); return pon(o, x, y, z); },
    cil: (m, r, h, x, y, z, r2 = r) => { const o = new THREE.Mesh(M.cil, m); o.scale.set(r, h, r2); return pon(o, x, y, z); },
    // luz de un LED: un disco acostado que suma su color (se apaga con opacity 0)
    // ondas: n aros acostados que crecen de r0 a r1 y se desvanecen, uno cada `cada` segundos. Regresa play(dt, opciones),
    // con dt = segundos desde que salió la primera
    ondas: (color, n = 2) => {
      const os = Array.from({ length: n }, () => { const o = new THREE.Mesh(M.plano, new THREE.MeshBasicMaterial({ map: M.aro, color, transparent: true, opacity: 0, depthWrite: false })); o.rotation.x = -Math.PI / 2; g.add(o); return o; });
      return (dt, { x = 0, y = 0, z = 0, r0, r1, dur = 1, cada = .18, a = .95 }) => os.forEach((o, i) => {
        const p = (dt - i * cada) / dur, on = p > 0 && p < 1;
        o.material.opacity = on ? a * Math.min(1, p * 6) * (1 - p) : 0;
        if (on) { o.scale.setScalar(2 * (r0 + (r1 - r0) * (1 - (1 - p) * (1 - p)))); o.position.set(x, y, z); }
      });
    },
    halo: (color, r, x, y, z) => { const o = new THREE.Mesh(M.plano, new THREE.MeshBasicMaterial({ map: M.halo, color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); o.rotation.x = -Math.PI / 2; o.scale.setScalar(r * 2); o.position.set(x, y, z); g.add(o); return o; },
  };
}
// una cara con textura arriba (+Y) y el material liso en las demás
const tapa = (lado, cara) => [lado, lado, cara, lado, lado, lado];

/* ---------- 01 Iluminación ---------- */
// fotorresistencia LDR de 5 mm (GL5528): pastilla de cerámica con la pista de sulfuro de cadmio en zigzag entre dos electrodos, y dos patas
export function ldr() {
  const { g, M, cil, ondas } = pieza();
  const cara = lienzo(256, 256, (c, w) => {
    c.fillStyle = '#e9e1cf'; c.fillRect(0, 0, w, w);
    c.save(); c.beginPath(); c.arc(128, 128, 108, 0, 7); c.clip();
    c.fillStyle = '#cdbf9c'; c.fillRect(0, 0, w, w);
    c.strokeStyle = '#d5482a'; c.lineWidth = 15; c.lineJoin = 'round'; c.lineCap = 'round'; c.beginPath();
    for (let i = 0; i < 7; i++) { const x = 44 + i * 28, a = i % 2 ? 196 : 60, b = i % 2 ? 60 : 196; if (!i) c.moveTo(x, a); c.lineTo(x, a); c.lineTo(x, b); }
    c.stroke(); c.restore();
    c.strokeStyle = '#f4efe2'; c.lineWidth = 12; c.beginPath(); c.arc(128, 128, 114, 0, 7); c.stroke();
  });
  const ceramica = std({ color: 0xe9e1cf, roughness: .6 });
  const cabeza = new THREE.Mesh(M.cil, [ceramica, std({ map: cara, roughness: .3 }), ceramica]);
  cabeza.scale.set(.255, .2, .225); cabeza.position.y = .1; cabeza.castShadow = true; g.add(cabeza);
  cil(std({ color: 0xffffff, roughness: .08, transparent: true, opacity: .22 }), .245, .035, 0, .215, 0, .215);   // la gota de resina que la cubre
  for (const x of [-.17, .17]) cil(M.plata, .022, .95, x, -.475, 0);
  // cuando oscurece en la maqueta, detecta: suelta sus ondas justo antes de que encienda la tira
  const onda = ondas(0x8fc4ff, 2), oscurece = flanco(.5);
  g.userData = { centro: [0, -.2, 0], radio: .6, alto: 62, giro: .4, fx: (f, t) => { const dt = oscurece(f.night, t); onda(dt, { y: .26, r0: .22, r1: .8, dur: 1.1 }); return reciente(dt); } };
  return g;
}

// tramo de tira LED WS2812B (60 LED por metro): cinta flexible negra de 1 cm, un LED 5050 cada 1.67 cm con su capacitor, y los
// tres contactos de cobre (+5V, DIN, GND) en cada línea de corte
export function tira(n = 3) {
  const { g, M, caja, halo } = pieza();
  const P = 5 / 3, L = n * P, S = 96;
  const cinta = lienzo(Math.round(L * S), S, (c, w, h) => {
    c.fillStyle = '#101216'; c.fillRect(0, 0, w, h);
    c.textAlign = 'center'; c.textBaseline = 'middle';
    for (let i = 0; i <= n; i++) {
      const x = i * P * S;
      c.fillStyle = '#c98a4b'; for (const y of [.2, .5, .8]) { rr(c, x - .2 * S, (y - .11) * h, .4 * S, .22 * h, .07 * S); c.fill(); }
      c.fillStyle = '#101216'; c.fillRect(x - 1, 0, 2, h);   // la línea de corte
      if (i < n) {
        c.fillStyle = 'rgba(236,240,246,.9)'; c.font = `600 ${.105 * S}px ${SANS}`;
        c.fillText('+5V', x + .42 * S, .2 * h); c.fillText('DIN', x + .42 * S, .5 * h); c.fillText('GND', x + .42 * S, .8 * h);
        c.font = `600 ${.13 * S}px ${SANS}`; c.fillText('→', x + P * S - .42 * S, .5 * h);
      }
    }
  });
  caja(tapa(M.negro, std({ map: cinta, roughness: .45 })), L, .03, 1, 0, 0, 0);
  // el LED: cuerpo blanco con su ventana redonda; la ventana se enciende
  const led = lienzo(128, 128, c => {
    c.fillStyle = '#f3f3ef'; c.fillRect(0, 0, 128, 128);
    c.fillStyle = '#dcdcd4'; c.beginPath(); c.arc(64, 64, 50, 0, 7); c.fill();
    c.fillStyle = '#fbfbf6'; c.beginPath(); c.arc(64, 64, 44, 0, 7); c.fill();
    c.fillStyle = '#c9c4b0'; c.fillRect(40, 44, 20, 16); c.fillRect(70, 48, 14, 12); c.fillRect(46, 70, 34, 12);
    c.fillStyle = '#f3f3ef'; c.beginPath(); c.moveTo(0, 0); c.lineTo(22, 0); c.lineTo(0, 22); c.fill();
  });
  const luz = std({ map: led, roughness: .35, emissive: 0xdfeaff, emissiveMap: led, emissiveIntensity: 0 }), halos = [];
  for (let i = 0; i < n; i++) {
    const x = -L / 2 + (i + .5) * P;
    caja(tapa(M.blanco, luz), .5, .16, .5, x, .095, 0);
    caja(M.plata, .56, .05, .1, x, .04, -.17); caja(M.plata, .56, .05, .1, x, .04, .17);
    caja(std({ color: 0xa98a5c, roughness: .5 }), .1, .06, .2, x + .44, .045, .28);
    halos.push(halo(0xbfd8ff, .95, x, .2, 0));
  }
  // enciende con la lámpara de la maqueta
  g.userData = { alto: 50, radio: 2.25, giro: .5, fx: f => { const k = clamp(f.lamp); luz.emissiveIntensity = 1.5 * k; for (const o of halos) o.material.opacity = .85 * k; } };
  return g;
}

/* ---------- piezas que se repiten en las tarjetas ---------- */
// tira de pines: la regleta negra bajo la tarjeta y n patas doradas, a lo largo de X (o de Z con giro)
function pines(P, n, x, z, giro = false) {
  const L = n * .254, pata = new THREE.InstancedMesh(P.M.caja, P.M.oro, n), m = new THREE.Matrix4();
  P.caja(P.M.negro, giro ? .25 : L, .25, giro ? L : .25, x, -.2, z);
  for (let i = 0; i < n; i++) { const d = (i - (n - 1) / 2) * .254; pata.setMatrixAt(i, m.makeScale(.07, .9, .07).setPosition(x + (giro ? 0 : d), -.3, z + (giro ? d : 0))); }
  pata.castShadow = true; P.g.add(pata);
}
// barrenos de montaje dibujados en la serigrafía
const barreno = (c, x, y, r) => { c.fillStyle = '#d9b24a'; c.beginPath(); c.arc(x, y, r * 1.5, 0, 7); c.fill(); c.fillStyle = '#0a0d14'; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); };

/* ---------- 02 SOS ---------- */
// sensor de fuerza FSR 402: película redonda de 18 mm con los dos peines de plata entrelazados, y su cola con dos pistas
export function fsr() {
  const { g, M, caja, ondas } = pieza();
  const cara = lienzo(256, 256, c => {
    c.fillStyle = '#24261f'; c.fillRect(0, 0, 256, 256);
    c.strokeStyle = '#3a3d33'; c.lineWidth = 6; c.beginPath(); c.arc(128, 128, 120, 0, 7); c.stroke();
    c.save(); c.beginPath(); c.arc(128, 128, 92, 0, 7); c.clip();
    c.strokeStyle = '#cfd2d6'; c.lineWidth = 6;
    for (let i = 0; i < 15; i++) { const y = 44 + i * 12; c.beginPath(); if (i % 2) { c.moveTo(30, y); c.lineTo(196, y); } else { c.moveTo(60, y); c.lineTo(226, y); } c.stroke(); }
    c.restore();
    // los dos colectores, uno por lado, que bajan hacia la cola (arriba en el lienzo)
    c.strokeStyle = '#cfd2d6'; c.lineWidth = 8;
    c.beginPath(); c.arc(128, 128, 96, Math.PI * .58, Math.PI * 1.44); c.stroke();
    c.beginPath(); c.arc(128, 128, 96, -Math.PI * .44, Math.PI * .42); c.stroke();
    c.fillStyle = '#cfd2d6'; c.fillRect(104, 0, 8, 46); c.fillRect(144, 0, 8, 46);
  });
  const film = std({ color: 0x24261f, roughness: .38 }), top = std({ map: cara, roughness: .32, emissive: 0x9fc8ff, emissiveIntensity: 0 });
  const cabeza = new THREE.Mesh(M.cil, [film, top, film]); cabeza.scale.set(.915, .045, .915); cabeza.castShadow = true; g.add(cabeza);
  caja(film, 3.9, .045, .63, 2.7, 0, 0);
  for (const z of [-.14, .14]) { caja(M.plata, 3.95, .012, .075, 2.72, .028, z); caja(M.plata, .5, .03, .16, 4.86, 0, z); caja(M.plata, .22, .07, .22, 4.55, 0, z); }
  // cuando se presiona el botón de la maqueta se hunde, se ilumina y suelta las mismas ondas blancas que ella
  const onda = ondas(0xffffff, 2);
  g.userData = { alto: 56, radio: 2.45, giro: .75, centro: [1.75, 0, 0], fx: f => {
    top.emissiveIntensity = 1.1 * f.pad; cabeza.position.y = -.16 * f.pad;
    onda(f.sos - .04, { y: .06, r0: .7, r1: 2.3, dur: 1, cada: .17 });
    return f.sos >= 0 ? reciente(f.sos) : 0;
  } };
  return g;
}

// buzzer activo de 5 V: cilindro negro de 12 mm con su orificio arriba y dos patas; mientras suena la alarma vibra y suelta ondas
export function buzzer() {
  const { g, M, cil, ondas } = pieza();
  const cara = lienzo(256, 256, c => {
    c.fillStyle = '#17191e'; c.fillRect(0, 0, 256, 256);
    c.strokeStyle = '#2b2e36'; c.lineWidth = 5; c.beginPath(); c.arc(128, 128, 104, 0, 7); c.stroke();
    c.fillStyle = '#040405'; c.beginPath(); c.arc(128, 128, 23, 0, 7); c.fill();
    c.strokeStyle = '#30333b'; c.lineWidth = 4; c.beginPath(); c.arc(128, 128, 27, 0, 7); c.stroke();
    c.fillStyle = '#c9ccd2'; c.fillRect(190, 122, 30, 7); c.fillRect(201.5, 110.5, 7, 30);   // la marca del polo positivo
  });
  const cuerpo = new THREE.Group(); g.add(cuerpo);
  const m = (geo, mat, r, h, y) => { const o = new THREE.Mesh(geo, mat); o.scale.set(r, h, r); o.position.y = y; o.castShadow = true; cuerpo.add(o); };
  m(M.cil, M.negro, .6, .88, .44); m(M.cil, [M.negro, std({ map: cara, roughness: .45 }), M.negro], .57, .08, .92); m(M.cil, M.mate, .54, .03, -.01);
  cil(M.plata, .03, .62, -.38, -.31, 0); cil(M.plata, .03, .78, .38, -.39, 0);
  // suena con la alarma de la maqueta: las mismas tres ondas rojas, en su mismo instante, y vibra mientras duran
  const onda = ondas(0xff5a4e, 3);
  g.userData = { alto: 34, radio: 1.12, centro: [0, .3, 0], fx: (f, t) => {
    const on = f.sos > .3 && f.sos < 2.15;
    cuerpo.position.x = on ? .02 * Math.sin(t * 95) : 0;
    onda(f.sos - .3, { y: 1.02, r0: .45, r1: 1.75, dur: 1.5, cada: .2 });
  } };
  return g;
}

/* ---------- 03 Acceso ---------- */
// lector NFC MFRC522 (módulo RC522 de 6 x 4 cm): la antena en espiral dibujada en la tarjeta, el chip, su cristal y ocho pines
export function rfid() {
  const P = pieza(), { g, M, caja } = P, S = 100;
  const cara = lienzo(600, 400, c => {
    c.fillStyle = '#1658ae'; c.fillRect(0, 0, 600, 400);
    c.strokeStyle = '#5a9be8'; c.lineWidth = 6;
    for (let i = 0; i < 4; i++) { const d = i * 15; rr(c, 232 + d, 34 + d, 336 - 2 * d, 332 - 2 * d, 26 - i * 4); c.stroke(); }
    c.fillStyle = 'rgba(236,242,250,.92)'; c.font = `700 25px ${SANS}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('RFID-RC522', 430, 200);
    c.font = `600 10.5px ${SANS}`; c.textAlign = 'left';
    ['SDA', 'SCK', 'MOSI', 'MISO', 'IRQ', 'GND', 'RST', '3.3V'].forEach((t, i) => c.fillText(t, 44, 111 + i * 25.4));
    for (const [x, y] of [[26, 30], [26, 370], [205, 30], [205, 370]]) barreno(c, x, y, 11);
    c.strokeStyle = 'rgba(236,242,250,.5)'; c.lineWidth = 2; c.strokeRect(96, 150, 78, 78);
  });
  caja(tapa(M.azul, std({ map: cara, roughness: .5 })), 6, .16, 4, 0, 0, 0);
  caja(M.negro, .52, .1, .52, -1.65, .13, -.11);                       // el MFRC522
  caja(M.plata, .46, .34, 1.1, -.98, .25, .95);                         // cristal de 27.12 MHz
  for (const [x, z] of [[-1.9, -1.2], [-1.5, -1.2], [-1.9, 1.05], [-1.55, 1.05], [-1.2, -.9]]) caja(std({ color: 0xa98a5c, roughness: .5 }), .2, .09, .11, x, .125, z);
  for (const z of [-1.55, 1.5]) caja(M.mate, .3, .16, .26, -1.1, .16, z);
  const led = std({ color: 0x7a1512, roughness: .4, emissive: 0xff2a1f, emissiveIntensity: 0 });
  caja(led, .16, .09, .1, -2.05, .125, 1.6); const luz = P.halo(0xff4a3c, .5, -2.05, .2, 1.6);
  pines(P, 8, -2.68, 0, true);
  // cuando la puerta de la maqueta empieza a abrir es que leyó la tarjeta: salen ondas de su antena y enciende su LED
  const onda = P.ondas(0x162660, 3), lee = flanco();   // marino: se ve sobre la tarjeta azul y sobre el fondo claro
  g.userData = { alto: 52, radio: 3.4, giro: -.4, fx: (f, t) => {
    const k = clamp(f.door * 4), dt = lee(f.door, t); led.emissiveIntensity = 2.2 * k; luz.material.opacity = .9 * k;
    onda(dt, { x: 1, y: .12, r0: .5, r1: 2.6, dur: 1.1 });
    return reciente(dt);
  } };
  return g;
}
// servomotor MG90S: caja de 23 x 12 x 28 mm con sus orejas, la torre del engrane, el eje dorado, su brazo blanco y el cable
// de tres hilos; el brazo gira con la puerta de la maqueta
export function servo() {
  const { g, M, caja, cil } = pieza();
  const cuerpo = std({ color: 0x1f2229, roughness: .36 }), tapaS = std({ color: 0x2a2e37, roughness: .4 });
  const etiqueta = lienzo(228, 225, c => {
    c.fillStyle = '#1f2229'; c.fillRect(0, 0, 228, 225);
    rr(c, 20, 44, 188, 128, 8); c.fillStyle = '#f2f2ee'; c.fill();
    c.fillStyle = '#f08a24'; c.fillRect(20, 132, 188, 22);
    c.fillStyle = '#15171c'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `800 44px ${SANS}`; c.fillText('MG90S', 114, 86);
    c.font = `600 17px ${SANS}`; c.fillText('Micro Servo', 114, 118);
  });
  caja([cuerpo, cuerpo, cuerpo, cuerpo, std({ map: etiqueta, roughness: .42 }), cuerpo], 2.28, 2.25, 1.22, 0, 1.125, 0);
  caja(cuerpo, 3.23, .25, 1.16, 0, 1.78, 0);   // un poco más angostas que el cuerpo: si no, sus caras se pelean con la etiqueta
  for (const x of [-1.39, 1.39]) cil(std({ color: 0x08090b, roughness: .8 }), .11, .27, x, 1.78, 0);
  caja(tapaS, 2.28, .5, 1.22, 0, 2.5, 0);
  cil(tapaS, .59, .42, -.52, 2.96, 0); cil(tapaS, .3, .3, .42, 2.9, 0);
  cil(M.oro, .22, .34, -.52, 3.3, 0);
  // el brazo: su centro, la paleta y los barrenos
  const brazo = new THREE.Group(); brazo.position.set(-.52, 3.5, 0); g.add(brazo);
  const b = (geo, mat, sx, sy, sz, x, y = 0) => { const o = new THREE.Mesh(geo, mat); o.scale.set(sx, sy, sz); o.position.set(x, y, 0); o.castShadow = true; brazo.add(o); };
  b(M.cil, M.blanco, .34, .2, .34, 0); b(M.caja, M.blanco, 1.5, .13, .4, .78); b(M.cil, M.blanco, .2, .13, .2, 1.53);
  for (let i = 0; i < 4; i++) b(M.cil, M.mate, .045, .14, .045, .62 + i * .28);
  b(M.cil, M.plata, .1, .22, .1, 0, .02);
  // cable: café, rojo y naranja, con su conector
  const cable = new THREE.Group(); cable.position.set(-1.14, .3, 0); cable.rotation.z = .2; g.add(cable);
  [0x6b4226, 0xd4332a, 0xf08a24].forEach((col, i) => { const o = new THREE.Mesh(M.caja, std({ color: col, roughness: .6 })); o.scale.set(1.5, .11, .11); o.position.set(-.75, 0, (i - 1) * .12); cable.add(o); });
  { const o = new THREE.Mesh(M.caja, M.negro); o.scale.set(.9, .26, .76); o.position.set(-1.9, 0, 0); cable.add(o); }
  g.userData = { alto: 26, giro: .5, radio: 2.3, centro: [-.1, 1.75, 0], fx: f => { brazo.rotation.y = -1.57 * f.door; } };
  return g;
}

/* ---------- 04 Ruta ---------- */
// sensor de color TCS3200 (módulo GY-31): el chip transparente con su mosaico de fotodiodos al centro, cuatro LED blancos
// que lo alumbran y dos tiras de pines
export function color() {
  const P = pieza(), { g, M, caja, cil } = P;
  const cara = lienzo(330, 330, c => {
    c.fillStyle = '#164f9e'; c.fillRect(0, 0, 330, 330);
    for (const [x, y] of [[24, 24], [306, 24], [24, 306], [306, 306]]) barreno(c, x, y, 10);
    c.strokeStyle = 'rgba(236,242,250,.75)'; c.lineWidth = 2.5; c.beginPath(); c.arc(165, 165, 62, 0, 7); c.stroke();
    c.fillStyle = 'rgba(236,242,250,.92)'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `700 17px ${SANS}`; c.fillText('TCS3200', 165, 276);
    c.font = `600 9px ${SANS}`; c.textAlign = 'left';
    ['S0', 'S1', 'OE', 'GND', 'VCC'].forEach((t, i) => c.fillText(t, 34, 114 + i * 25.4));
    c.textAlign = 'right'; ['S3', 'S2', 'OUT', 'VCC', 'GND'].forEach((t, i) => c.fillText(t, 296, 114 + i * 25.4));
  });
  caja(tapa(M.azul, std({ map: cara, roughness: .5 })), 3.3, .16, 3.3, 0, 0, 0);
  // el chip: cuerpo transparente y, adentro, la cuadrícula de 8 x 8 fotodiodos con filtros rojo, verde, azul y sin filtro
  const chip = lienzo(160, 128, c => {
    c.fillStyle = '#dfe5ec'; c.fillRect(0, 0, 160, 128); c.fillStyle = '#20232b'; c.fillRect(42, 26, 76, 76);
    const col = ['#e2483c', '#42b96a', '#3f7fe8', '#f1f3f6'];
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { c.fillStyle = col[(i % 2) * 2 + (j % 2)]; c.fillRect(46 + i * 8.6, 30 + j * 8.6, 7, 7); }
  });
  caja(tapa(std({ color: 0xdfe5ec, roughness: .2 }), std({ map: chip, roughness: .12 })), .5, .15, .4, 0, .155, 0);
  for (let i = 0; i < 4; i++) for (const z of [-.26, .26]) caja(M.plata, .05, .03, .14, -.19 + i * .127, .1, z);
  const vidrio = std({ color: 0xf6f8fb, roughness: .15, transparent: true, opacity: .9, emissive: 0xeaf2ff, emissiveIntensity: 1 }), domo = new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), halos = [];
  for (const x of [-.95, .95]) for (const z of [-.95, .95]) {
    cil(M.blanco, .29, .09, x, .125, z); cil(vidrio, .25, .5, x, .42, z);
    const d = new THREE.Mesh(domo, vidrio); d.scale.setScalar(.25); d.position.set(x, .67, z); g.add(d);
    halos.push(P.halo(0xdbe8ff, .8, x, .95, z));
    caja(M.mate, .2, .08, .1, x * .52, .12, z * 1.42);
  }
  pines(P, 5, -1.45, 0, true); pines(P, 5, 1.45, 0, true);
  // cuando la pantalla de la maqueta muestra el color es que lo detectó: sus LED dan un destello y salen ondas del chip
  const onda = P.ondas(0x162660, 2), detecta = flanco(.5);
  g.userData = { alto: 50, radio: 2.2, giro: .45, fx: (f, t) => {
    const dt = detecta(f.oled, t), k = reciente(dt);
    for (const o of halos) o.material.opacity = .5 + .5 * k;
    vidrio.emissiveIntensity = .9 + .9 * k;
    onda(dt, { y: .26, r0: .35, r1: 1.9, dur: 1.1 });
    return k;
  } };
  return g;
}

// pantalla OLED SSD1306 de 0.96 in: tarjeta de 27 mm con el vidrio negro, su cinta flexible y cuatro pines (GND, VCC, SCL, SDA).
// Muestra lo mismo que la pantalla de la maqueta, y se enciende cuando ella
export function oled() {
  const P = pieza(), { g, M, caja } = P;
  const cara = lienzo(270, 280, c => {
    c.fillStyle = '#10224d'; c.fillRect(0, 0, 270, 280);
    for (const [x, y] of [[22, 22], [248, 22], [22, 258], [248, 258]]) barreno(c, x, y, 9);
    c.fillStyle = 'rgba(236,242,250,.92)'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `600 9.5px ${SANS}`;
    ['GND', 'VCC', 'SCL', 'SDA'].forEach((t, i) => c.fillText(t, 96.9 + i * 25.4, 40));
  });
  caja(tapa(std({ color: 0x10224d, roughness: .5 }), std({ map: cara, roughness: .5 })), 2.7, .16, 2.8, 0, 0, 0);
  const pant = lienzo(534, 384, c => {
    c.fillStyle = '#000'; c.fillRect(0, 0, 534, 384);
    c.save(); c.translate(50, 86); c.scale(1.7, 1.7);   // el área que enciende: 21.7 x 10.9 mm, con el mismo dibujo de escena.js
    c.textBaseline = 'alphabetic'; c.textAlign = 'left';
    c.fillStyle = '#9fd0f5'; c.font = `500 17px ${SANS}`; c.fillText('Color detectado:', 6, 27);
    c.fillStyle = '#eaf6ff'; c.font = '700 54px "Inter Tight Variable", "Inter Tight", system-ui, sans-serif'; c.fillText('AZUL', 4, 82);
    c.fillStyle = '#9fd0f5'; c.font = `500 17px ${SANS}`; c.fillText('R:24  G:96  B:231', 6, 113);
    c.restore();
  });
  const vidrio = std({ color: 0x05070c, roughness: .12 }), luz = std({ color: 0x05070c, roughness: .12, emissive: 0xffffff, emissiveMap: pant, emissiveIntensity: 0 });
  caja(tapa(vidrio, luz), 2.67, .13, 1.92, 0, .145, .2);
  caja(std({ color: 0xb9772e, roughness: .5 }), 1.25, .04, .34, 0, .1, 1.22);   // la cinta flexible que dobla hacia atrás
  pines(P, 4, 0, -1.0);
  for (let i = 0; i < 4; i++) caja(M.oro, .07, .2, .07, (i - 1.5) * .254, .16, -1.0);
  g.userData = { alto: 56, radio: 1.85, giro: -.35, fx: f => { luz.emissiveIntensity = 1.25 * f.oled; } };
  return g;
}

/* ---------- 05 Barrotes ---------- */
// teclado matricial 4x4 de membrana (69 x 77 mm): números en azul, letras y símbolos en rojo, y su cola de ocho pistas.
// La tecla que se oprime en la maqueta se enciende aquí también
const TECLAS = [['1', '2', '3', 'A'], ['4', '5', '6', 'B'], ['7', '8', '9', 'C'], ['*', '0', '#', 'D']];
export function teclado() {
  const { g, M, caja, ondas } = pieza();
  const w = 6.9, d = 7.7, mx = .72, top = .78, px = (w - 2 * mx) / 4, pz = (d - top - .98) / 4, S = 72;
  const cara = lienzo(Math.round(w * S), Math.round(d * S), (c, W, H) => {
    c.fillStyle = '#15161a'; c.fillRect(0, 0, W, H);
    c.strokeStyle = '#e9e9e9'; c.lineWidth = .045 * S; rr(c, .26 * S, .26 * S, W - .52 * S, H - .52 * S, .3 * S); c.stroke();
    const kw = px * .8 * S, kh = pz * .78 * S;
    for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) {
      const ch = TECLAS[r][k], alt = /[A-D*#]/.test(ch), x = (mx + (k + .5) * px) * S, y = (top + (r + .5) * pz) * S;
      const gr = c.createLinearGradient(0, y - kh / 2, 0, y + kh / 2); gr.addColorStop(0, alt ? '#ee4a3c' : '#3f8fe6'); gr.addColorStop(1, alt ? '#d93a2e' : '#2f7bd2');
      c.fillStyle = gr; rr(c, x - kw / 2, y - kh / 2, kw, kh, .12 * S); c.fill();
      c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `700 ${Math.round(.62 * S)}px "Inter Tight Variable", "Inter Tight", system-ui, sans-serif`;
      c.fillText(ch, x, y + (ch === '*' ? .12 * S : .03 * S));
    }
  });
  caja(tapa(M.negro, std({ map: cara, roughness: .42 })), w, .09, d, 0, 0, 0);
  const cola = lienzo(128, 96, c => { c.fillStyle = '#e4e6ea'; c.fillRect(0, 0, 128, 96); c.fillStyle = '#9aa0aa'; for (let i = 0; i < 8; i++) c.fillRect(11 + i * 14, 0, 7, 96); });
  caja(tapa(std({ color: 0xe4e6ea, roughness: .5 }), std({ map: cola, roughness: .45 })), 2.03, .03, 1.5, 0, -.02, d / 2 + .75);
  caja(M.negro, 2.06, .26, 1.05, 0, -.02, d / 2 + 1.95);
  const luz = new THREE.Mesh(M.plano, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }));
  luz.rotation.x = -Math.PI / 2; luz.scale.set(px * .8, pz * .78, 1); luz.position.y = .05; g.add(luz);
  const onda = ondas(0xffffff, 1), oprime = flanco(.01);
  g.userData = { alto: 58, radio: 5.2, giro: .35, centro: [0, 0, .8], fx: (f, t) => {
    const dt = oprime(f.tecla ? f.tecla[1] : 0, t);
    luz.material.opacity = 0;
    if (f.tecla) for (let r = 0; r < 4; r++) { const k = TECLAS[r].indexOf(f.tecla[0]); if (k >= 0) { luz.position.x = -w / 2 + mx + (k + .5) * px; luz.position.z = -d / 2 + top + (r + .5) * pz; luz.material.opacity = .9 * f.tecla[1]; } }
    onda(dt, { x: luz.position.x, y: .07, z: luz.position.z, r0: .5, r1: 2.1, dur: .6 });
    return f.tecla ? f.tecla[1] : 0;
  } };
  return g;
}

// motor a pasos 28BYJ-48: bote metálico de 28 mm con sus dos orejas, el eje dorado fuera de centro, la tapa azul de los cables
// y sus cinco hilos al conector blanco; el eje gira mientras los barrotes se mueven
export function motor() {
  const { g, M, caja, cil } = pieza();
  const bote = std({ color: 0xc9cdd3, roughness: .3, metalness: .88 });
  cil(bote, 1.4, 1.9, 0, .95, 0); cil(bote, 1.3, .05, 0, 1.92, 0);
  caja(bote, 3.5, .1, .7, 0, 1.85, 0);
  for (const x of [-1.75, 1.75]) { cil(bote, .35, .1, x, 1.85, 0); cil(std({ color: 0x08090b, roughness: .8 }), .21, .12, x, 1.85, 0); }
  cil(bote, .45, .16, 0, 2.0, .8);
  const eje = new THREE.Group(); eje.position.set(0, 2.08, .8); g.add(eje);
  { const a = new THREE.Mesh(M.cil, M.oro); a.scale.set(.25, .4, .25); a.position.y = .2; const b = new THREE.Mesh(M.caja, M.oro); b.scale.set(.3, .6, .5); b.position.y = .7; a.castShadow = b.castShadow = true; eje.add(a, b); }
  const azul = std({ color: 0x2b66cf, roughness: .42 });
  caja(azul, 1.75, 1.35, .62, 0, 1.2, -1.5); caja(azul, 1.46, .5, .3, 0, 1.4, -1.93);
  const cables = new THREE.Group(); cables.position.set(0, 1.4, -2.0); cables.rotation.x = .22; g.add(cables);
  [0x2a63c9, 0xe58fb4, 0xf2cf3b, 0xf08a24, 0xd4332a].forEach((col, i) => { const o = new THREE.Mesh(M.cil, std({ color: col, roughness: .55 })); o.scale.set(.055, 1.7, .055); o.rotation.x = Math.PI / 2; o.position.set((i - 2) * .13, 0, -.85); cables.add(o); });
  { const o = new THREE.Mesh(M.caja, M.blanco); o.scale.set(1.3, .5, .62); o.position.set(0, 0, -1.95); o.castShadow = true; cables.add(o); }
  g.userData = { alto: 40, giro: 2.4, radio: 2.45, centro: [0, 1.1, -.5], fx: f => { eje.rotation.y = f.bars * Math.PI * 5; } };
  return g;
}

// el LED azul del NodeMCU, que parpadea cuando su sensor detecta (flotan.js lo pone sobre la placa de nodemcu.js)
export function ledMcu() {
  const { g, M, caja, halo } = pieza();
  const led = std({ color: 0x16335f, roughness: .4, emissive: 0x3d8bff, emissiveIntensity: 0 });
  caja(led, .12, .07, .08, 0, 0, 0); const luz = halo(0x5aa2ff, .55, 0, .08, 0);
  g.userData.fx = k => { led.emissiveIntensity = 3 * k; luz.material.opacity = k; };
  return g;
}
