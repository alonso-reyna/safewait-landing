// Detalles de la maqueta real que el CAD no trae: keypad de membrana, puertas con retícula, banca y pinitos.
// Los usan el video y la versión de celular de la landing. Unidades en cm, mismas coordenadas que scene.js.
import * as THREE from 'three';
import { CAD } from './scene.js';
import { makeWave } from './fx.js';

const SWEEP = new THREE.Vector3(0.45, -1, 0.3).normalize();   // el mismo barrido del armado de scene.js
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smooth = t => t * t * (3 - 2 * t);

function canvasTex(w, h, draw, aniso = 8) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso;
  return t;
}
const rr = (g, x, y, w, h, r) => { g.beginPath(); g.roundRect(x, y, w, h, r); };

/* ---------- keypad de membrana 4x4, en tonos de azul ---------- */
const KEYS = [['1', '2', '3', 'A'], ['4', '5', '6', 'B'], ['7', '8', '9', 'C'], ['*', '0', '#', 'D']];
const KP = { w: 6.9, d: 7.7, cx: 19.2, cz: -16.1, y: 19.3, mx: 0.72, top: 0.78, bottom: 0.98 };
KP.px = (KP.w - 2 * KP.mx) / 4; KP.pz = (KP.d - KP.top - KP.bottom) / 4;
// centro de una tecla en el mundo
export function keyPos(ch) {
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) if (KEYS[r][c] === ch) {
    return new THREE.Vector3(KP.cx - KP.w / 2 + KP.mx + (c + .5) * KP.px, KP.y + 0.07, KP.cz - KP.d / 2 + KP.top + (r + .5) * KP.pz);
  }
  return null;
}
// punto junto al módulo donde flota el indicador de la clave
export const KEYPAD_TOP = new THREE.Vector3(KP.cx + 7.4, 19.3, KP.cz + 0.6);
function keypadTex(real) {
  const s = 96, W = Math.round(KP.w * s), H = Math.round(KP.d * s);
  return canvasTex(W, H, (g) => {
    g.fillStyle = real ? '#15161a' : '#122052'; rr(g, 0, 0, W, H, .42 * s); g.fill();
    g.strokeStyle = real ? '#e9e9e9' : '#cfe4f8'; g.lineWidth = .045 * s; rr(g, .26 * s, .26 * s, W - .52 * s, H - .52 * s, .3 * s); g.stroke();
    const kw = KP.px * .8 * s, kh = KP.pz * .78 * s;
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
      const ch = KEYS[r][c], alt = /[A-D*#]/.test(ch);     // números en azul claro, letras y símbolos en azul medio
      const x = (KP.mx + (c + .5) * KP.px) * s, y = (KP.top + (r + .5) * KP.pz) * s;
      const gr = g.createLinearGradient(0, y - kh / 2, 0, y + kh / 2);
      if (real) { gr.addColorStop(0, alt ? '#ee4a3c' : '#3f8fe6'); gr.addColorStop(1, alt ? '#d93a2e' : '#2f7bd2'); }
      else { gr.addColorStop(0, alt ? '#4f9be0' : '#eaf4fd'); gr.addColorStop(1, alt ? '#3a86cf' : '#d3e6f8'); }
      g.fillStyle = gr; rr(g, x - kw / 2, y - kh / 2, kw, kh, .12 * s); g.fill();
      g.fillStyle = real || alt ? '#fff' : '#162660'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = `700 ${Math.round(.62 * s)}px "Inter Tight Variable", "Inter Tight", system-ui, sans-serif`;
      g.fillText(ch, x, y + (ch === '*' ? .12 * s : .03 * s));
    }
  }, 16);
}

/* ---------- construcción ---------- */
export function buildDetails(stage, { tone = 0x58a5ea, leaf = 0x3d88d2, trunk = 0x2f73bd, real = false } = {}) {
  const root = stage.root;
  const std = o => new THREE.MeshStandardMaterial(o);
  const pieces = [];
  // cada grupo aparece con su propio plano de corte, igual que las piezas del CAD
  function piece(group, t0) {
    root.add(group); group.updateMatrixWorld(true);
    const plane = new THREE.Plane(SWEEP.clone(), 1e6), seen = new Map();
    group.traverse(o => {
      if (!o.isMesh) return;
      const one = m => { if (!seen.has(m)) { const c = m.clone(); c.clippingPlanes = [plane]; c.clipShadows = true; seen.set(m, c); } return seen.get(m); };
      o.material = Array.isArray(o.material) ? o.material.map(one) : one(o.material);
    });
    const box = new THREE.Box3().setFromObject(group), v = new THREE.Vector3();
    let d1 = Infinity, d2 = -Infinity;
    for (let i = 0; i < 8; i++) {
      const d = SWEEP.dot(v.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z));
      d1 = Math.min(d1, d); d2 = Math.max(d2, d);
    }
    pieces.push({ group, t0, plane, d1: d1 - 0.05, d2: d2 + 0.05 });
  }
  const box = (g, x1, x2, y1, y2, z1, z2, mat) => {
    const geo = new THREE.BoxGeometry(x2 - x1, y2 - y1, z2 - z1);
    geo.translate((x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2);
    const m = new THREE.Mesh(geo, mat); m.castShadow = m.receiveShadow = true; g.add(m); return m;
  };

  /* banca dentro de la caseta, del lado derecho (detrás de la ventana derecha) */
  const benchG = new THREE.Group(), bm = std({ color: tone, roughness: .9 });
  const bx1 = 1.9, bx2 = 7.0, by = CAD.floorY, bz = CAD.backInnerZ + 0.08;
  box(benchG, bx1, bx2, by + 2.9, by + 3.25, bz + 0.5, bz + 3.1, bm);                 // asiento
  [bx1 + 0.3, bx2 - 0.65].forEach(x => box(benchG, x, x + 0.35, by, by + 2.9, bz + 0.6, bz + 2.9, bm));   // patas
  [4.3, 5.9].forEach(h => box(benchG, bx1, bx2, by + h, by + h + 1.1, bz + 0.12, bz + 0.45, bm));       // respaldo
  [bx1 + 0.3, bx2 - 0.65].forEach(x => box(benchG, x, x + 0.35, by + 3.25, by + 7.0, bz, bz + 0.14, bm));
  piece(benchG, 1.0);

  /* dos pinitos junto a la cremallera: la tapan a medias, uno un poco más alto que el otro */
  const pines = new THREE.Group(), lm = std({ color: leaf, roughness: .85, flatShading: true }), tm = std({ color: trunk, roughness: .9 });
  const pine = (x, z, h, r) => {
    const add = (geo, mat, y) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, 16.3 + y, z); m.castShadow = m.receiveShadow = true; pines.add(m); return m; };
    const th = h * .2;
    add(new THREE.CylinderGeometry(r * .14, r * .18, th, 10), tm, th / 2);
    const n = 4, body = h - th * .7;
    for (let i = 0; i < n; i++) {   // faldas que se encogen hacia la punta
      const k = i / n, ch = body * .42, cr = r * (1 - k * .62);
      add(new THREE.ConeGeometry(cr, ch, 9), lm, th * .7 + body * k * .86 + ch / 2).rotation.y = i * .7;
    }
  };
  pine(-22.5, -8.3, 11.6, 1.75);
  pine(-20.75, -7.7, 9.0, 1.4);
  piece(pines, 1.5);

  /* keypad de membrana sobre la tapa del módulo, con su cola de conexión */
  const keypad = new THREE.Group();
  const side = std({ color: real ? 0x15161a : 0x122052, roughness: .6 }), face = std({ map: keypadTex(real), roughness: .42 });
  const kgeo = new THREE.BoxGeometry(KP.w, 0.06, KP.d); kgeo.translate(KP.cx, KP.y + 0.03, KP.cz);
  const km = new THREE.Mesh(kgeo, [side, side, face, side, side, side]); km.receiveShadow = true; keypad.add(km);
  const tailTex = canvasTex(128, 32, (g, w, h) => { g.fillStyle = real ? '#15161a' : '#122052'; g.fillRect(0, 0, w, h); g.fillStyle = real ? '#e9e9e9' : '#cfe4f8'; for (let i = 0; i < 8; i++) g.fillRect(10 + i * 14, 0, 6, h); });
  const tgeo = new THREE.BoxGeometry(2.0, 0.035, 0.62); tgeo.translate(KP.cx, KP.y + 0.018, KP.cz + KP.d / 2 + 0.3);
  keypad.add(new THREE.Mesh(tgeo, [side, side, std({ map: tailTex, roughness: .5 }), side, side, side]));
  piece(keypad, 0.78);

  // pulsaciones: la tecla se "hunde" (se tiñe de azul de marca y se encoge apenas) y suelta una onda fina
  const capTex = canvasTex(128, 128, (g) => { g.fillStyle = '#fff'; rr(g, 4, 4, 120, 120, 17); g.fill(); });
  const capGeo = new THREE.PlaneGeometry(KP.px * .8, KP.pz * .78);
  function press(ch) {
    const p = keyPos(ch);
    const cap = new THREE.Mesh(capGeo, new THREE.MeshBasicMaterial({ color: 0x1c5fa8, map: capTex, transparent: true, opacity: 0, depthWrite: false }));
    cap.rotation.x = -Math.PI / 2; cap.position.copy(p); cap.visible = false; root.add(cap);
    const wave = makeWave(root, { color: 0xeaf4ff, size: 2.4 }); wave.mesh.position.copy(p).y += 0.015;
    return { cap, wave };
  }

  return {
    press, piece, pieces,
    // t: segundos desde que se oprime la tecla
    setPress(pr, t) {
      const k = smooth(clamp(t / 0.06)) * (1 - smooth(clamp((t - 0.1) / 0.34)));   // baja rápido, regresa despacio
      pr.cap.visible = t > 0 && k > .004;
      if (pr.cap.visible) { pr.cap.material.opacity = k * .78; pr.cap.scale.setScalar(1 - .07 * k); }
      pr.wave.play((t - 0.03) / 0.7, { r0: .35, r1: 1.75, w: .07, a: .9 });
    },
    // asmT: reloj del armado; scale: el mismo factor que usa la escena
    update(asmT, scale) {
      for (const p of pieces) {
        const k = clamp(asmT - p.t0 * scale), e = k * k * (3 - 2 * k);
        p.group.visible = k > 0;
        p.plane.constant = k >= 1 ? 1e6 : -p.d2 + (p.d2 - p.d1) * e;
      }
    },
  };
}

/* ---------- puertas corredizas con retícula (tipo shoji), como las de la maqueta ---------- */
// Se agregan a las hojas antes de cargar el modelo. Devuelve sync(): copia el plano de corte de cada hoja mientras
// se arma y lo suelta al terminar (si no, al deslizarse la hoja el plano le recortaba una esquina a la retícula).
export function doorGrids(stage, color = 0x3a2e29) {
  const dW = (CAD.door.x2 - CAD.door.x1) / 2, y1 = CAD.door.y1, y2 = CAD.door.y2 - 0.1, zf = -12.36 + 0.12;
  const leaves = [];
  [[stage.doorL, CAD.door.x1, CAD.door.x1 + dW - 0.03], [stage.doorR, CAD.door.x1 + dW + 0.03, CAD.door.x2]].forEach(([leaf, x1, x2]) => {
    const p = stage.pieces.find(q => q.obj === leaf), own = new THREE.Plane(p.plane.normal.clone(), 1e6);
    const mat = new THREE.MeshStandardMaterial({ color, roughness: .7 });
    mat.clippingPlanes = [own]; mat.clipShadows = true;
    const bar = (a1, a2, b1, b2, t = 0.09) => [zf, -12.36 - 0.12 - t].forEach(z => {
      const g = new THREE.BoxGeometry(a2 - a1, b2 - b1, t); g.translate((a1 + a2) / 2, (b1 + b2) / 2, z + t / 2);
      const m = new THREE.Mesh(g, mat); m.castShadow = false; m.receiveShadow = true; leaf.add(m);
    });
    const F = 0.3, T = 0.13;
    bar(x1, x1 + F, y1, y2); bar(x2 - F, x2, y1, y2); bar(x1, x2, y2 - F, y2); bar(x1, x2, y1, y1 + F);   // marco
    bar((x1 + x2) / 2 - T / 2, (x1 + x2) / 2 + T / 2, y1, y2, 0.07);                                    // un larguero
    for (let i = 1; i < 6; i++) { const y = y1 + (y2 - y1) * i / 6; bar(x1, x2, y - T / 2, y + T / 2, 0.07); }   // cinco travesaños
    leaves.push({ p, own, mat });
  });
  const sync = () => { for (const { p, own } of leaves) own.constant = (p.meshes[0].userData.fade ?? 1) >= 1 ? 1e6 : p.plane.constant; };
  sync.mats = leaves.map(l => l.mat);
  return sync;
}
