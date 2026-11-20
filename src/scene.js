/*
  Escena 3D de SafeWait.
  Un solo renderer dibuja el modelo en varias "vistas" (elementos del DOM): hero, cómo funciona y explóralo.
  Cada vista tiene su cámara y su propio estado (noche, puerta, barrotes, etc.), que se aplica justo antes de dibujarla.
  Unidades: cm, origen al centro de la base, piso en y = 0 (el GLB viene en m con nodos a 0.001 y mesh en mm).
*/
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const BLUE = 0x267dc0;
export const NAVY = 0x162660;

/* ---------- medidas del CAD, en cm ---------- */
export const CAD = {
  baseTop: 15.7,            // superficie de la calle (bastidor_top)
  floorY: 16.27,            // piso de la caseta
  front: { z: -11.61 },     // cara exterior del muro frontal
  door: { x1: -11.12, x2: -3.12, y1: 16.27, y2: 30.27 },
  winL: { x1: -21.12, x2: -13.12, y1: 18.27, y2: 31.27 },
  winR: { x1: -1.12, x2: 6.88, y1: 18.27, y2: 31.27 },
  backInnerZ: -23.0,
  inner: { x1: -21.9, x2: 7.7 },
  wallTop: 34.77,
  barLift: 15.2,            // los barrotes suben hasta cubrir las ventanas
  streetZ: 6.05,            // la calle va de z 0.8 a 11.3; el sensor está al centro
};
// sensor de color TCS34725: asoma por el hueco cuadrado del CAD (girado ~35°, centro en x 25.98, z 6.05)
export const COLOR = { x: 25.98, z: 6.05, rot: -Math.atan2(5.96 - 4.14, 27.97 - 25.37) };
// FSR del nodo SOS: muro del fondo, bajo la ranurita del CAD (x −15.07 a −13.97, y 21.27 a 21.42)
export const FSR = { x: -14.52, y: 19.7, z: -23.74 };
// pantalla OLED del nodo Ruta: muro izquierdo interior, sobre la ranura del CAD (z −21.74 a −19.04, y 28.27)
export const OLED = { x: -21.92, y: 27.4, z: -20.39, size: 2.7 };
// módulo de afuera (tapa mod_up, y 21.27): buzzer en el círculo, fotorresistencia en el cuadrito
export const BUZZER = { x: 17.28, y: 21.27, z: -22.655 };
export const LDR = { x: 21.185, y: 21.27, z: -22.65 };
// la cremallera sale por el hueco cuadrado a la izquierda de los barrotes (x −22.03 a −21.03)
const RACK_X = -21.53;
const hutCx = (CAD.inner.x1 + CAD.inner.x2) / 2, hutCz = (CAD.backInnerZ + CAD.front.z) / 2;
const ledY = CAD.wallTop - 1.4, ledZ = CAD.backInnerZ + 0.07;

// puntos de cada nodo (para hotspots y cámara)
export const ANCHORS = {
  light: new THREE.Vector3(hutCx, ledY, ledZ + 0.4),
  sos: new THREE.Vector3(FSR.x, FSR.y, FSR.z + 0.5),
  door: new THREE.Vector3((CAD.door.x1 + CAD.door.x2) / 2, 23, CAD.front.z + 0.4),
  route: new THREE.Vector3(COLOR.x, 15.9, COLOR.z),
  bars: new THREE.Vector3(19.2, 19.6, -16.3), // keypad
};

export function defaultState() {
  return { night: 0, door: 0, bars: 0, roof: 0, xray: 0, real: false, busX: null, sos: 0, oled: 0, hl: null, plinth: true };
}

/* ---------- texturas generadas ---------- */
function canvasTex(w, h, draw, aniso) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
const rnd = (a, b) => a + Math.random() * (b - a);

export class Stage {
  constructor(canvas, { mobile = false, reduceMotion = false } = {}) {
    this.canvas = canvas;
    this.reduceMotion = reduceMotion;
    this.views = [];
    this.ready = false;
    this.asm = { t: -1, dur: 2.5 };

    const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.75 : 2));
    r.setClearColor(0xffffff, 0);
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap; // r187 cambia PCFSoft por PCF en la primera sombra; fijarlo evita recompilar a media animación
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.0;
    r.autoClear = true;

    this.scene = new THREE.Scene();
    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.meshes = [];      // meshes con material dependiente del estado
    this.pieces = [];      // piezas del armado
    this.bars = []; this.roof = [];
    this.plinth = [];     // pedestal y mecanismo bajo la banqueta: se ocultan en el hero (state.plinth = false)

    this.#lights(mobile);
    this.#materials();
    this.#extras();
    this.#bus();
    this.resize();
  }

  /* ---------- luces y piso ---------- */
  #lights(mobile) {
    const ground = this.ground = new THREE.Mesh(new THREE.PlaneGeometry(800, 800), new THREE.ShadowMaterial({ opacity: 0.11 }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; this.scene.add(ground);

    this.hemi = new THREE.HemisphereLight(0xffffff, 0xdfe4ea, 2.3); this.scene.add(this.hemi);
    const sun = this.sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.position.set(-40, 110, 70); sun.castShadow = true;
    sun.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
    Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 10, far: 300 });
    sun.shadow.radius = 6; sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04;
    this.scene.add(sun);
    this.fill = new THREE.DirectionalLight(0xffffff, 0.6); this.fill.position.set(60, 40, -40); this.scene.add(this.fill);

    this.ledLights = [-6, 6].map(dx => { const l = new THREE.PointLight(0x7fb6ff, 0, 45, 1.2); l.position.set(hutCx + dx, CAD.wallTop - 3, hutCz); this.root.add(l); return l; });
    this.spill = new THREE.PointLight(0x7fb6ff, 0, 40, 1.2); this.spill.position.set(hutCx, CAD.floorY + 6, CAD.front.z + 4); this.root.add(this.spill);
  }

  /* ---------- materiales: maqueta blanca y materiales reales ---------- */
  #materials() {
    const aniso = this.renderer.capabilities.getMaxAnisotropy();
    const plyTex = canvasTex(512, 512, (g, w, h) => {
      g.fillStyle = '#ecdfc4'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 170; i++) {
        const y = Math.random() * h;
        g.strokeStyle = `rgba(150,105,60,${rnd(.03, .13)})`; g.lineWidth = rnd(.6, 2.4);
        g.beginPath(); g.moveTo(0, y);
        for (let x = 0; x <= w; x += 32) g.lineTo(x, y + Math.sin(x * .02 + i) * rnd(.5, 2.5));
        g.stroke();
      }
    }, aniso);
    const mdfTex = canvasTex(512, 512, (g, w, h) => {
      g.fillStyle = '#cfab7f'; g.fillRect(0, 0, w, h);
      const img = g.getImageData(0, 0, w, h), d = img.data;
      for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - .5) * 14; d[i] += n; d[i + 1] += n; d[i + 2] += n * .8; }
      g.putImageData(img, 0, 0);
    }, aniso);
    const grassTex = canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = '#7f9440'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 5000; i++) { g.fillStyle = Math.random() < .5 ? 'rgba(60,80,25,.45)' : 'rgba(170,190,90,.35)'; g.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5); }
    }, aniso);
    this.mdfTex = mdfTex;

    // panel frontal inclinado (67 × 21.8 cm): dos texturas, blanca y grabada en MDF
    this.logoW = canvasTex(2048, 666, () => {}, aniso);
    this.logoR = canvasTex(2048, 666, () => {}, aniso);
    this.logoW.wrapS = this.logoW.wrapT = this.logoR.wrapS = this.logoR.wrapT = THREE.ClampToEdgeWrapping;

    const std = o => new THREE.MeshStandardMaterial(o);
    const xr = o => std({ ...o, transparent: true }); // materiales que se vuelven translúcidos con "Ver mecanismo"
    this.M = {
      white: {
        base: xr({ color: 0xeceef2, roughness: .95 }),
        grass: xr({ color: 0xe2e6eb, roughness: .95 }),
        logo: xr({ map: this.logoW, roughness: .95 }),
        wall: std({ color: 0xf8f9fa, roughness: .9 }),
        frame: std({ color: 0xffffff, roughness: .85 }),
        floor: std({ color: 0xedf0f3, roughness: .92 }),
        corner: std({ color: 0xdfe3e8, roughness: .85 }),
        keypad: std({ color: 0xc9d0d8, roughness: .8 }),
        bars: std({ color: 0xf3f5f7, roughness: .7 }),
        pulley: std({ color: 0xd3d9e0, roughness: .7 }),
        guide: std({ color: 0xd8dde3, roughness: .75 }),
        door: std({ color: 0xe4e8ed, roughness: .8 }),
        pcb: std({ color: 0xd7dce2, roughness: .7 }),
        fsr: std({ color: 0x3a4660, roughness: .55 }),
      },
      real: {
        base: xr({ map: mdfTex, roughness: .92 }),
        grass: xr({ map: grassTex, roughness: 1 }),
        logo: xr({ map: this.logoR, roughness: .9 }),
        wall: std({ map: plyTex, roughness: .82 }),
        frame: std({ color: 0xf4f2ee, roughness: .5 }),
        floor: std({ map: mdfTex, roughness: .92 }),
        corner: std({ color: 0xd6300f, roughness: .55 }),
        keypad: std({ color: 0x2a2a2a, roughness: .7 }),
        bars: std({ color: 0xf2f1ee, roughness: .45 }),
        pulley: std({ color: 0xe08a2c, roughness: .5 }),
        guide: std({ color: 0xc9c9c9, roughness: .6 }),
        door: std({ color: 0xd8380f, roughness: .6 }),
        pcb: std({ color: 0x1b1d22, roughness: .6 }),
        fsr: std({ color: 0x1c1c1c, roughness: .5 }),
      },
      accent: std({ color: BLUE, roughness: .55, emissive: BLUE, emissiveIntensity: .12 }),
      accentSoft: std({ color: 0xbcd6ee, roughness: .6 }),
      glass: std({ color: 0xd6e6f2, roughness: .05, transparent: true, opacity: .28, depthWrite: false, side: THREE.DoubleSide }),
      led: std({ color: 0xdfe8f5, emissive: 0x3d8fe0, emissiveIntensity: 0, roughness: .3 }),
      chip: std({ color: 0x222831, roughness: .4 }),
      ring: new THREE.MeshBasicMaterial({ color: BLUE, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }),
    };
    this.edgeMat = new THREE.LineBasicMaterial({ color: 0xaab3be, transparent: true, opacity: .5 });
    this.drawLogos();
  }

  /* Dibuja el grabado del panel frontal. Se vuelve a llamar cuando cargan las fuentes. */
  drawLogos(logoImg) {
    const W = 2048, H = 666;
    // versión maqueta blanca: logo oficial a color
    {
      const g = this.logoW.image.getContext('2d');
      g.fillStyle = '#eef0f3'; g.fillRect(0, 0, W, H);
      g.globalAlpha = .38;
      if (logoImg) g.drawImage(logoImg, 70, 50, 566, 566);
      g.globalAlpha = 1;
      g.fillStyle = '#a3aec0';
      g.font = '600 270px "Inter Tight Variable", "Inter Tight", system-ui, sans-serif';
      g.textBaseline = 'alphabetic'; g.textAlign = 'left';
      g.fillText('SafeWait', 700, H / 2 + 95);
      g.font = '500 40px "Inter Variable", Inter, system-ui, sans-serif';
      g.fillStyle = '#5b6573'; g.textAlign = 'right';
      g.fillText('Implementación de IoT, grupo 4', 1990, H - 70);
      this.logoW.needsUpdate = true;
    }
    // versión materiales reales: grabado en MDF
    {
      const g = this.logoR.image.getContext('2d');
      g.drawImage(this.mdfTex.image, 0, 0, W, H);
      const ink = 'rgba(105,62,28,.88)';
      g.strokeStyle = ink; g.lineJoin = 'round'; g.lineCap = 'round';
      const cx = 340, cy = H / 2;
      const oct = r => { g.beginPath(); for (let i = 0; i < 8; i++) { const a = Math.PI / 8 + i * Math.PI / 4; const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a); i ? g.lineTo(x, y) : g.moveTo(x, y); } g.closePath(); g.stroke(); };
      g.lineWidth = 6; oct(282); oct(260); g.lineWidth = 5; oct(236);
      [[-80, -64, 41], [0, -90, 45], [80, -64, 41]].forEach(([dx, dy, r]) => {
        g.beginPath(); g.arc(cx + dx, cy + dy, r, 0, Math.PI * 2); g.stroke();
        g.beginPath(); g.arc(cx + dx, cy + dy + r * 2.35, r * 1.45, Math.PI * 1.08, Math.PI * 1.92); g.stroke();
      });
      g.beginPath();
      g.moveTo(cx, cy - 22); g.quadraticCurveTo(cx + 48, cy - 2, cx + 80, cy - 8);
      g.quadraticCurveTo(cx + 82, cy + 112, cx, cy + 154);
      g.quadraticCurveTo(cx - 82, cy + 112, cx - 80, cy - 8);
      g.quadraticCurveTo(cx - 48, cy - 2, cx, cy - 22); g.closePath();
      g.fillStyle = 'rgba(207,171,127,1)'; g.fill(); g.stroke();
      g.lineWidth = 8; g.beginPath(); g.moveTo(cx - 30, cy + 64); g.lineTo(cx - 6, cy + 90); g.lineTo(cx + 38, cy + 38); g.stroke();
      g.fillStyle = ink; g.lineWidth = 6;
      g.font = '600 270px "Inter Tight Variable", "Inter Tight", system-ui, sans-serif';
      g.textBaseline = 'alphabetic'; g.textAlign = 'left';
      g.strokeText('SafeWait', 670, cy + 95);
      g.font = '500 42px "Inter Variable", Inter, system-ui, sans-serif';
      g.textAlign = 'right';
      g.fillText('Implementación de IoT,', 1990, H - 110);
      g.fillText('grupo 4', 1990, H - 60);
      this.logoR.needsUpdate = true;
    }
  }

  /* registra un mesh cuyo material depende del estado */
  #track(mesh, cls, { hl = null, edges = true } = {}) {
    mesh.userData.cls = cls; mesh.userData.hl = hl;
    mesh.castShadow = mesh.receiveShadow = true;
    if (edges && mesh.geometry.attributes.position.count < 4000) {
      const e = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, 25), this.edgeMat);
      e.raycast = () => {}; mesh.add(e); mesh.userData.edges = e;
    }
    this.meshes.push(mesh);
  }
  #piece(obj, t0, unit = 1) {
    const meshes = []; obj.traverse(o => { if (o.isMesh) meshes.push(o); });
    obj.userData.y0 = obj.position.y; obj.userData.unit = unit;
    this.pieces.push({ obj, t0, meshes });
  }
  #box(x1, x2, y1, y2, z1, z2, parent) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(x2 - x1, y2 - y1, z2 - z1));
    m.position.set((x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2);
    (parent || this.root).add(m); return m;
  }

  /* ---------- piezas agregadas: puerta corrediza, vidrios, tira LED, sensor de color, FSR, anillos SOS ---------- */
  #extras() {
    const dW = this.doorHalf = (CAD.door.x2 - CAD.door.x1) / 2, dz = -12.36;
    this.doorL = new THREE.Group(); this.doorR = new THREE.Group(); this.root.add(this.doorL, this.doorR);
    this.#track(this.#box(CAD.door.x1, CAD.door.x1 + dW - 0.03, CAD.door.y1, CAD.door.y2 - 0.1, dz - 0.12, dz + 0.12, this.doorL), 'door', { hl: 'door' });
    this.#track(this.#box(CAD.door.x1 + dW + 0.03, CAD.door.x2, CAD.door.y1, CAD.door.y2 - 0.1, dz - 0.12, dz + 0.12, this.doorR), 'door', { hl: 'door' });
    this.#piece(this.doorL, 1.35); this.#piece(this.doorR, 1.4);

    const glass = new THREE.Group(); this.root.add(glass);
    [CAD.winL, CAD.winR].forEach(w => {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(w.x2 - w.x1, w.y2 - w.y1), this.M.glass);
      p.position.set((w.x1 + w.x2) / 2, (w.y1 + w.y2) / 2, -12.38); glass.add(p);
    });
    this.#piece(glass, 1.45);

    const led = new THREE.Group(); this.root.add(led);
    this.#track(this.#box(CAD.inner.x1 + 0.4, CAD.inner.x2 - 0.4, ledY - 0.5, ledY + 0.5, ledZ - 0.05, ledZ + 0.05, led), 'pcb', { edges: false });
    const N = 26, g = new THREE.BoxGeometry(0.45, 0.45, 0.16);
    for (let i = 0; i < N; i++) {
      const m = new THREE.Mesh(g, this.M.led);
      m.position.set(CAD.inner.x1 + 1 + i * ((CAD.inner.x2 - CAD.inner.x1 - 2) / (N - 1)), ledY, ledZ + 0.1); led.add(m);
    }
    this.#piece(led, 1.2);

    // sensor de color: placa negra con cuatro LED transparentes en las esquinas, chip al centro y pines a los lados
    const sensor = new THREE.Group(); sensor.position.set(COLOR.x, 15.15, COLOR.z); sensor.rotation.y = COLOR.rot; this.root.add(sensor);
    const sm = {
      pcb: new THREE.MeshStandardMaterial({ color: 0x15171b, roughness: .55 }),
      silk: new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: .6 }),
      chip: new THREE.MeshStandardMaterial({ color: 0xc9a24a, roughness: .25, metalness: .2 }),
      pin: new THREE.MeshStandardMaterial({ color: 0xd8d2c4, roughness: .3, metalness: .8 }),
      smd: new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: .5 }),
      cap: new THREE.MeshStandardMaterial({ color: 0x9a6a3a, roughness: .5 }),
      led: new THREE.MeshStandardMaterial({ color: 0xf4f7fb, emissive: 0xfff6e0, emissiveIntensity: .35, roughness: .08, transparent: true, opacity: .78 }),
    };
    const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; sensor.add(m); return m; };
    add(new THREE.BoxGeometry(2.0, 0.16, 1.9), sm.pcb, 0, 0, 0);
    add(new THREE.BoxGeometry(0.42, 0.1, 0.36), sm.chip, 0, 0.13, 0);
    [-1, 1].forEach(sx => [-1, 1].forEach(sz => {
      const x = sx * 0.6, z = sz * 0.56;
      add(new THREE.CylinderGeometry(0.29, 0.29, 0.07, 24), sm.led, x, 0.12, z);
      add(new THREE.CylinderGeometry(0.25, 0.25, 0.42, 24), sm.led, x, 0.36, z);
      add(new THREE.SphereGeometry(0.25, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), sm.led, x, 0.57, z);
    }));
    // pines: cuatro a cada lado con su marco serigrafiado
    [-1, 1].forEach(sx => {
      const x = sx * 0.86;
      [[0.04, 1.02, x - 0.11], [0.04, 1.02, x + 0.11]].forEach(([w, d, xx]) => add(new THREE.BoxGeometry(w, 0.01, d), sm.silk, xx, 0.085, 0));
      for (let i = 0; i < 4; i++) add(new THREE.BoxGeometry(0.12, 0.02, 0.12), sm.pin, x, 0.09, -0.36 + i * 0.24);
    });
    // resistencias y capacitores
    [[-0.38, -0.2], [-0.38, 0.05], [-0.38, 0.3], [0.38, -0.2], [0.38, 0.05], [0.38, 0.3]].forEach(([x, z]) => add(new THREE.BoxGeometry(0.16, 0.05, 0.09), sm.smd, x, 0.105, z));
    add(new THREE.BoxGeometry(0.16, 0.08, 0.1), sm.cap, 0, 0.12, -0.5);
    add(new THREE.BoxGeometry(0.12, 0.06, 0.08), sm.cap, 0, 0.11, -0.34);
    this.#piece(sensor, 0.5);

    // FSR: pastilla redonda en la cara interior del muro del fondo; la cola sube a la ranurita
    const fsr = new THREE.Group(); this.root.add(fsr);
    const wallZ = CAD.backInnerZ + 0.06;
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.06, 32));
    pad.rotation.x = Math.PI / 2; pad.position.set(FSR.x, FSR.y, wallZ + 0.03); fsr.add(pad);
    this.#track(pad, 'fsr', { hl: 'sos', edges: false });
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 21.4 - FSR.y - 0.9, 0.04));
    tail.position.set(FSR.x, (FSR.y + 0.9 + 21.4) / 2, wallZ + 0.02); fsr.add(tail);
    this.#track(tail, 'fsr', { edges: false });
    this.#piece(fsr, 1.3);

    // pantalla OLED: placa negra en el muro izquierdo interior, mirando hacia adentro (+x)
    const oled = new THREE.Group(); oled.position.set(OLED.x + 0.04, OLED.y, OLED.z); oled.rotation.y = Math.PI / 2; this.root.add(oled);
    const board = new THREE.Mesh(new THREE.BoxGeometry(OLED.size, OLED.size, 0.08));
    oled.add(board); this.#track(board, 'fsr', { hl: 'route', edges: false });
    this.oledTex = canvasTex(256, 128, (g, w, h) => {
      g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#8fd0ff'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = '700 52px "Inter Tight Variable", "Inter Tight", system-ui, sans-serif'; g.fillText('RUTA 2', w / 2, h * 0.38);
      g.font = '600 30px "Inter Variable", Inter, system-ui, sans-serif'; g.fillText('AZUL', w / 2, h * 0.76);
    }, 4);
    this.oledMat = new THREE.MeshStandardMaterial({ color: 0x05070a, emissive: 0xffffff, emissiveMap: this.oledTex, emissiveIntensity: 0, roughness: .25 });
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(OLED.size * 0.74, OLED.size * 0.37), this.oledMat);
    screen.position.set(0, OLED.size * 0.08, 0.045); oled.add(screen);
    this.#piece(oled, 1.3);

    // buzzer: cilindro negro que asoma por el círculo de la tapa del módulo
    const buzzer = new THREE.Group(); buzzer.position.set(BUZZER.x, BUZZER.y, BUZZER.z); this.root.add(buzzer);
    const bz = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.56, 0.7, 32)); bz.position.y = -0.1; buzzer.add(bz);
    this.#track(bz, 'fsr', { hl: 'sos', edges: false });
    const bzHole = new THREE.Mesh(new THREE.CircleGeometry(0.12, 16), this.M.chip);
    bzHole.rotation.x = -Math.PI / 2; bzHole.position.y = 0.26; buzzer.add(bzHole);
    this.#piece(buzzer, 0.7);

    // fotorresistencia: cabeza redonda con la pista en zigzag, en el cuadrito de la tapa
    const ldr = new THREE.Group(); ldr.position.set(LDR.x, LDR.y, LDR.z); this.root.add(ldr);
    const ldrTex = canvasTex(64, 64, (g, w, h) => {
      g.fillStyle = '#e9d9b0'; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#b8432a'; g.lineWidth = 5; g.beginPath();
      for (let i = 0; i < 5; i++) { const y = 10 + i * 11; g.moveTo(i % 2 ? 52 : 12, y); g.lineTo(i % 2 ? 12 : 52, y); if (i < 4) g.lineTo(i % 2 ? 12 : 52, y + 11); }
      g.stroke();
    }, 4);
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.2, 24), [
      new THREE.MeshStandardMaterial({ color: 0xe9d9b0, roughness: .4 }),
      new THREE.MeshStandardMaterial({ map: ldrTex, roughness: .3 }),
      new THREE.MeshStandardMaterial({ color: 0xe9d9b0, roughness: .4 }),
    ]);
    head.position.y = 0.06; ldr.add(head);
    this.ldrHead = head;
    this.#piece(ldr, 0.7);

    // ondas del SOS: salen del buzzer (atadas al scroll, no en loop)
    this.rings = [0, 1, 2].map(() => {
      const m = new THREE.Mesh(new THREE.RingGeometry(0.75, 0.9, 48), this.M.ring.clone());
      m.rotation.x = -Math.PI / 2; m.position.set(BUZZER.x, BUZZER.y + 0.45, BUZZER.z); m.visible = false; this.root.add(m); return m;
    });
  }

  /* ---------- camión estilizado: blanco con franja azul abajo (la que lee el sensor) ---------- */
  #bus() {
    const bus = this.busObj = new THREE.Group();
    const mats = this.busMats = {
      body: new THREE.MeshStandardMaterial({ color: 0xf9fafb, roughness: .6, transparent: true }),
      win: new THREE.MeshStandardMaterial({ color: 0xc9d5e2, roughness: .25, transparent: true }),
      stripe: new THREE.MeshStandardMaterial({ color: BLUE, roughness: .5, transparent: true }),
      wheel: new THREE.MeshStandardMaterial({ color: 0x3b4352, roughness: .8, transparent: true }),
    };
    const L = 19, Wd = 7.4, Hb = 7.6, lift = 1.5;
    const body = new THREE.Mesh(new RoundedBoxGeometry(L, Hb, Wd, 4, 1.1), mats.body);
    body.position.y = lift + Hb / 2; bus.add(body);
    const win = new THREE.Mesh(new RoundedBoxGeometry(L - 2.4, 2.3, Wd + 0.08, 2, 0.5), mats.win);
    win.position.set(-0.3, lift + Hb - 2.6, 0); bus.add(win);
    const front = new THREE.Mesh(new RoundedBoxGeometry(0.3, 3.2, Wd - 1.6, 2, 0.12), mats.win);
    front.position.set(L / 2 + 0.02, lift + Hb - 2.9, 0); bus.add(front);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(L - 1.2, 0.9, Wd + 0.1), mats.stripe);
    stripe.position.y = lift + 1.0; bus.add(stripe);
    const under = new THREE.Mesh(new THREE.BoxGeometry(L - 3, 0.1, Wd - 1.5), mats.stripe); // franja inferior que lee el sensor
    under.position.y = lift + 0.02; bus.add(under);
    const wg = new THREE.CylinderGeometry(1.25, 1.25, 0.9, 24);
    [[-L / 2 + 3.6, 1], [L / 2 - 3.6, 1], [-L / 2 + 3.6, -1], [L / 2 - 3.6, -1]].forEach(([x, s]) => {
      const w = new THREE.Mesh(wg, mats.wheel); w.rotation.x = Math.PI / 2; w.position.set(x, 1.25, s * (Wd / 2 - 0.3)); bus.add(w);
    });
    bus.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    bus.position.set(0, CAD.baseTop, CAD.streetZ);
    bus.visible = false;
    this.root.add(bus);
  }

  /* ---------- modelo CAD ---------- */
  async load(url) {
    const gltf = await new GLTFLoader().loadAsync(url);
    const model = this.model = gltf.scene;
    model.scale.setScalar(100);           // metros → centímetros
    model.updateMatrixWorld(true);
    const box = new THREE.Box3(), c = new THREE.Vector3();
    const list = [];
    model.traverse(o => { if (o.isMesh) list.push(o); });
    const ORDER = [ // fase del armado (s): base, caseta muro por muro, techo al final
      [/^(bastidor|under_)/, 0.0], [/^(acera|detalleGrama|logo)/, 0.25], [/^(guia|soporte|polea|bandeja|cremallera|barrote)/, 0.35],
      [/^PisoHut/, 0.55], [/^mod_|^keyboard/, 0.65],
      [/^backOuter|^backInner/, 0.8], [/^leftOuter|^leftInner/, 0.95], [/^frontOuter|^frontInner|^Puertain/, 1.1],
      [/^WindowinSide|^FrWindowinRood/, 1.25], [/^poster/, 1.4],
      [/^esquina/, 1.6], [/^Roofside/, 1.7], [/^Rooffront/, 1.8], [/^techoUp/, 1.9],
    ];
    list.forEach((o, i) => {
      const name = o.name || (o.parent && o.parent.name) || '';
      if (name.startsWith('cremallera')) { // en el CAD quedó a la derecha; va en el hueco cuadrado de la izquierda
        o.updateMatrixWorld(true); box.setFromObject(o).getCenter(c);
        const w = o.getWorldPosition(new THREE.Vector3()); w.x += RACK_X - c.x;
        o.position.copy(o.parent.worldToLocal(w)); o.updateMatrixWorld(true);
      }
      box.setFromObject(o).getCenter(c);
      boxUV(o.geometry, 1 / 300);          // unidades del mesh en mm
      const has = (...k) => k.some(x => name.startsWith(x));
      let cls = 'wall', hl = null;
      if (has('bastidor', 'under_', 'acera')) cls = 'base';
      else if (has('logo')) cls = 'logoBlock';
      else if (has('detalleGrama')) cls = 'grass';
      else if (has('esquina')) cls = 'corner';
      else if (has('keyboard')) { cls = 'keypad'; hl = 'bars'; }
      else if (has('barrote', 'cremallera')) { cls = 'bars'; hl = 'bars'; }
      else if (has('polea')) cls = 'pulley';
      else if (has('guia', 'soporte', 'bandeja')) cls = 'guide';
      else if (has('PisoHut', 'mod_')) cls = 'floor';
      else if (has('WindowinSide', 'FrWindowinRood') && c.x > -2) cls = 'frame';
      this.#track(o, cls, { hl });
      if (cls === 'bars') this.bars.push(o);
      if (/^(Rooffront|Roofside|techoUp|esquina)/.test(name)) this.roof.push(o);
      if (cls === 'logoBlock') this.#logoPlane(o);
      if (/^(bastidor|under_|logo|guia|soporte|polea|bandeja|barrote|cremallera)/.test(name)) this.plinth.push(o);
      const ph = ORDER.find(([re]) => re.test(name));
      this.#piece(o, (ph ? ph[1] : 1.0) + (i % 3) * 0.04, 0.01);
    });
    this.#cleanTop();
    this.root.add(model);
    await this.#prewarm();
    this.ready = true;
  }

  // tapa de la calle sin las ranuras del corte láser (para el hero, sin pedestal); conserva el hueco del sensor de color
  #cleanTop() {
    const x1 = -33.5, x2 = 33.5, z1 = -32.71, z2 = 17.29, r = 1.2; // contorno de bastidor_top
    const sh = new THREE.Shape(); // el shape va en (x, −z): al girarlo queda acostado
    sh.moveTo(x1 + r, -z2); sh.lineTo(x2 - r, -z2); sh.quadraticCurveTo(x2, -z2, x2, -z2 + r);
    sh.lineTo(x2, -z1 - r); sh.quadraticCurveTo(x2, -z1, x2 - r, -z1);
    sh.lineTo(x1 + r, -z1); sh.quadraticCurveTo(x1, -z1, x1, -z1 - r);
    sh.lineTo(x1, -z2 + r); sh.quadraticCurveTo(x1, -z2, x1 + r, -z2);
    const hole = new THREE.Path(), h = 1.15, c = Math.cos(COLOR.rot), sn = Math.sin(COLOR.rot);
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([a, b], i) => {
      const x = COLOR.x + a * h * c + b * h * sn, z = COLOR.z - a * h * sn + b * h * c;
      i ? hole.lineTo(x, -z) : hole.moveTo(x, -z);
    });
    sh.holes.push(hole);
    const geo = new THREE.ExtrudeGeometry(sh, { depth: CAD.baseTop - 15.07, bevelEnabled: false, curveSegments: 6 });
    geo.rotateX(-Math.PI / 2); geo.translate(0, 15.07, 0);
    const top = this.cleanTopMesh = new THREE.Mesh(geo);
    this.root.add(top);
    this.#track(top, 'base');
    this.#piece(top, 0);
  }

  // el grabado va sobre la cara exterior del panel inclinado
  #logoPlane(mesh) {
    const p = mesh.geometry.attributes.position, v = new THREE.Vector3();
    let best = -Infinity, minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(mesh.matrixWorld);
      best = Math.max(best, v.y + v.z); minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x);
      minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y);
    }
    const len = (maxY - minY) * Math.SQRT2, yMid = (minY + maxY) / 2;
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(maxX - minX - 0.1, len - 0.4));
    plane.rotation.x = -Math.PI / 4;
    plane.position.set((minX + maxX) / 2, yMid + 0.02, best - yMid + 0.02);
    this.root.add(plane);
    this.#track(plane, 'logo', { edges: false });
    this.plinth.push(plane);
    plane.castShadow = false;
    this.#piece(plane, 0.3);
  }

  /* Precalentado: antes del armado, con los materiales que de verdad usa cada vista (desvanecidos y asentados),
     compila los shaders, crea los clones de desvanecido, sube buffers y arma las sombras. Si no, los primeros
     cuadros del armado se traban. Se dibuja en el lienzo y se borra en la misma tarea: nunca llega a verse. */
  async #prewarm() {
    const r = this.renderer, cam = new THREE.PerspectiveCamera(30, 1, 1, 1500);
    cam.position.set(0, 120, 200); cam.lookAt(0, 20, 0); cam.updateMatrixWorld();
    const states = [], seen = new Set();
    for (const f of this.reduceMotion ? [1] : [0.5, 1]) for (const v of this.views) {
      const key = f + JSON.stringify(v.state);
      if (!seen.has(key)) { seen.add(key); states.push([f, v.state]); }
    }
    const set = ([f, st]) => { for (const p of this.pieces) p.meshes.forEach(m => { m.userData.fade = f; }); this.#apply(st); };
    for (const st of states) {
      set(st);
      try { await r.compileAsync(this.scene, cam); } catch (err) { console.warn(err); }
    }
    r.setScissorTest(false);
    for (const st of states) { set(st); r.render(this.scene, cam); }
    r.clear();
  }

  /* ---------- armado pieza por pieza ---------- */
  assemble() {
    // reloj propio que avanza con dt (tope 1/30 s): un cuadro lento frena la animación en vez de saltarse un tramo
    this.asm.t = this.reduceMotion ? -1 : 0;
    this.asm.done = this.reduceMotion;
  }
  #updateAssembly(dt) {
    if (this.asm.t >= 0 && !this.asm.done) {
      this.asm.t += Math.min(dt, 1 / 30);
    }
    const t = this.asm.t < 0 ? 99 : this.asm.t;
    const span = 0.9, scale = this.asm.dur / 2.5;
    let all = true;
    for (const p of this.pieces) {
      const k = Math.min(1, Math.max(0, (t - p.t0 * scale) / span));
      if (k < 1) all = false;
      const e = 1 - Math.pow(1 - k, 4);
      p.obj.userData.asmOff = (1 - e) * 3 * p.obj.userData.unit;
      p.meshes.forEach(m => { m.userData.fade = k; });
    }
    this.asm.done = all;
    this.asm.end ??= Math.max(...this.pieces.map(p => p.t0)) * scale + span;
    this.asm.p = Math.min(1, t / this.asm.end); // avance global: llega a 1 cuando termina la última pieza
  }

  /* ---------- aplicar el estado de una vista ---------- */
  #apply(s) {
    const M = this.M, set = s.real ? M.real : M.white;
    const n = s.night;
    this.hemi.intensity = 2.3 * (1 - .88 * n);
    this.sun.intensity = 2.2 * (1 - .97 * n);
    this.fill.intensity = .6 * (1 - .9 * n);
    this.hemi.color.setRGB(1 - .35 * n, 1 - .25 * n, 1);
    M.led.emissiveIntensity = n * 3.2;
    // pantalla OLED: se prende cuando el camión está en el paradero (antes de copiar emisión a los clones del armado)
    this.oledMat.emissiveIntensity = 0.06 + 1.6 * s.oled;
    this.ledLights.forEach(l => { l.intensity = n * 90; });
    this.spill.intensity = n * 45;
    this.edgeMat.color.setHex(s.real ? 0x5b3a1c : 0xaab3be);
    this.edgeMat.opacity = s.real ? .3 : .5;

    const xo = s.xray > 0 ? 1 - .82 * s.xray : 1;
    [set.base, set.grass, set.logo].forEach(m => { m.opacity = xo; m.depthWrite = xo > .99; });
    set.logoBlock = set.base;

    for (const m of this.meshes) {
      const cls = m.userData.cls;
      let mat = (!s.real && s.hl && m.userData.hl === s.hl) ? M.accent : set[cls];
      if (cls === 'bars' && !s.real && s.hl !== 'bars' && s.bars > .5) mat = M.accentSoft;
      const f = m.userData.fade ?? 1;
      if (f < 1) {
        const cache = m.userData.fadeMats || (m.userData.fadeMats = {});
        let fm = cache[mat.uuid];
        if (!fm) { fm = cache[mat.uuid] = mat.clone(); fm.transparent = true; }
        fm.opacity = f; fm.depthWrite = false; mat = fm; // escribir profundidad casi invisible abre huecos en piezas ya visibles
      }
      m.material = mat;
      const e = m.userData.edges;
      if (e) {
        e.visible = f > 0;
        if (f < 1) { const em = e.userData.fadeMat || (e.userData.fadeMat = this.edgeMat.clone()); em.color.copy(this.edgeMat.color); em.opacity = this.edgeMat.opacity * f; e.material = em; }
        else e.material = this.edgeMat;
      }
    }

    // posiciones: armado + estado
    for (const p of this.pieces) {
      p.obj.position.y = p.obj.userData.y0 + (p.obj.userData.asmOff || 0);
      for (const m of p.meshes) {
        const f = m.userData.fade ?? 1, u = m.userData;
        m.visible = f > 0;
        if (u.cast0 === undefined) u.cast0 = m.castShadow;
        m.castShadow = u.cast0 && f > .6; // la sombra entra cuando la pieza ya se ve, no antes
        if (!u.cls) { // vidrio, sensores, LEDs: su material no lo pone el estado
          const base = u.mat0 || (u.mat0 = m.material);
          if (f < 1) {
            const bs = [].concat(base);
            const fs = u.asmMat || (u.asmMat = bs.map(b => Object.assign(b.clone(), { transparent: true, depthWrite: false })));
            fs.forEach((x, i) => { x.opacity = bs[i].opacity * f; if (x.emissive) x.emissiveIntensity = bs[i].emissiveIntensity; });
            m.material = Array.isArray(base) ? fs : fs[0];
          } else m.material = base;
        }
      }
    }
    // hero: sin pedestal; la tapa limpia sustituye a la del CAD y la sombra cae justo debajo de ella
    if (!s.plinth) this.plinth.forEach(m => { m.visible = false; });
    if (this.cleanTopMesh) this.cleanTopMesh.visible = this.cleanTopMesh.visible && !s.plinth;
    this.ground.position.y = s.plinth ? 0 : 15.06;
    this.ground.material.opacity = (s.plinth ? .11 : .14) * (this.asm.p ?? 1);
    this.bars.forEach(o => { o.position.y += s.bars * CAD.barLift / 100; });
    const roofLift = s.roof * 0.4;
    this.roof.forEach(o => { o.position.y += roofLift; if (s.roof >= .98) o.visible = false; });
    this.doorL.position.x = -s.door * this.doorHalf * .95;
    this.doorR.position.x = s.door * this.doorHalf * .95;

    // camión
    const bus = this.busObj;
    if (s.busX == null) bus.visible = false;
    else {
      bus.visible = true; bus.position.x = s.busX;
      const op = Math.min(1, Math.max(0, 1 - (Math.abs(s.busX) - 24) / 16));
      Object.values(this.busMats).forEach(m => { m.opacity = op; m.depthWrite = op > .99; });
      bus.visible = op > 0.01;
    }


    // ondas SOS
    this.rings.forEach((r, i) => {
      const k = Math.min(1, Math.max(0, s.sos * 1.6 - i * 0.3));
      r.visible = k > 0;
      r.scale.setScalar(1 + k * (1.6 + i * 1.5));
      r.material.opacity = k * (.9 - i * .22);
    });
  }

  /* ---------- vistas ---------- */
  addView(el, { fov = 30, near = 1, far = 1500 } = {}) {
    const view = { el, camera: new THREE.PerspectiveCamera(fov, 1, near, far), state: defaultState(), rect: null, onFrame: null, visible: false };
    this.views.push(view);
    return view;
  }
  resize() {
    this.W = document.documentElement.clientWidth; this.H = window.innerHeight;
    this.renderer.setSize(this.W, this.H, false);
    this.canvas.style.width = this.W + 'px'; this.canvas.style.height = this.H + 'px';
  }
  project(view, v, out = {}) {
    const p = v.clone().project(view.camera);
    out.x = (p.x * .5 + .5) * view.rect.width; out.y = (-p.y * .5 + .5) * view.rect.height; out.behind = p.z > 1;
    return out;
  }

  render(now, dt) {
    if (!this.ready) return;
    this.#updateAssembly(dt);
    const r = this.renderer;
    r.setScissorTest(false); r.clear();
    for (const v of this.views) {
      const rect = v.rect = v.el.getBoundingClientRect();
      v.visible = rect.bottom > 0 && rect.top < this.H && rect.width > 0 && rect.height > 0;
      if (!v.visible) continue;
      v.camera.aspect = rect.width / rect.height;
      v.camera.updateProjectionMatrix();
      v.onFrame && v.onFrame(v, now, dt);
      v.camera.updateMatrixWorld();
      this.#apply(v.state);
      const y = this.H - rect.bottom;
      r.setViewport(rect.left, y, rect.width, rect.height);
      r.setScissor(rect.left, y, rect.width, rect.height);
      r.setScissorTest(true);
      r.render(this.scene, v.camera);
    }
  }
}

/* UV por proyección de caja: el GLB no trae coordenadas de textura */
function boxUV(geo, s) {
  if (!geo.attributes.normal) geo.computeVertexNormals();
  const p = geo.attributes.position, n = geo.attributes.normal, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    let u, v;
    if (ax >= ay && ax >= az) { u = p.getZ(i); v = p.getY(i); }
    else if (ay >= az) { u = p.getX(i); v = p.getZ(i); }
    else { u = p.getX(i); v = p.getY(i); }
    uv[i * 2] = u * s; uv[i * 2 + 1] = v * s;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}
