// Camión urbano detallado para el video (unidades en cm, escala de la maqueta).
// Avanza hacia +x; las puertas dan al paradero (−z). Blanco con franja azul, igual que la marca.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const BLUE = 0x267dc0;

// mirror: el camión avanza hacia −x (se refleja; las puertas siguen dando al paradero)
export function makeBus({ clipX = 33.5, mirror = false, route = '2   AZUL' } = {}) {
  const L = 21, W = 7.3, LIFT = 1.25, TOP = 9.15;   // largo, ancho, piso de la carrocería, techo
  const R = 1.32, ARCH = 1.78;                       // radio de llanta y del paso de rueda
  const AX = [L / 2 - 5.2, -L / 2 + 4.7];            // ejes: delantero y trasero
  const half = W / 2;

  // el camión entra y sale por los bordes de la maqueta: se dibuja solo lo que queda entre los dos planos
  const planes = [new THREE.Plane(new THREE.Vector3(-1, 0, 0), clipX), new THREE.Plane(new THREE.Vector3(1, 0, 0), clipX)];
  const mat = (o, phys) => {
    const m = phys ? new THREE.MeshPhysicalMaterial(o) : new THREE.MeshStandardMaterial(o);
    m.clippingPlanes = planes; m.clipShadows = true; return m;
  };
  const M = {
    body: mat({ color: 0xf6f7f9, roughness: .42, clearcoat: .5, clearcoatRoughness: .25, side: THREE.DoubleSide }, true),
    roof: mat({ color: 0xd3d9e1, roughness: .6 }),
    ac: mat({ color: 0xbfc7d1, roughness: .55 }),
    slat: mat({ color: 0x8f99a6, roughness: .6 }),
    glass: mat({ color: 0x1d2c4d, roughness: .12, clearcoat: 1, clearcoatRoughness: .05 }, true),
    stripe: mat({ color: BLUE, roughness: .45 }),
    stripe2: mat({ color: 0x162660, roughness: .45 }),
    trim: mat({ color: 0x262b34, roughness: .7 }),
    tire: mat({ color: 0x20242b, roughness: .92 }),
    rim: mat({ color: 0xdfe3e9, roughness: .35, metalness: .25 }),
    hub: mat({ color: 0x9aa3af, roughness: .4, metalness: .3 }),
    head: mat({ color: 0xffffff, emissive: 0xfff3d6, emissiveIntensity: 1.6, roughness: .2 }),
    tail: mat({ color: 0xc8372b, emissive: 0xd9281c, emissiveIntensity: .9, roughness: .3 }),
    amber: mat({ color: 0xf0a23a, emissive: 0xf09a2a, emissiveIntensity: .5, roughness: .3 }),
    plate: mat({ color: 0xf2f3f5, roughness: .6 }),
  };

  const bus = new THREE.Group();
  const add = (geo, m, x, y, z, parent = bus) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); parent.add(o); return o; };
  const box = (w, h, d, m, x, y, z, parent) => add(new THREE.BoxGeometry(w, h, d), m, x, y, z, parent);
  const rbox = (w, h, d, r, m, x, y, z, parent) => add(new RoundedBoxGeometry(w, h, d, 3, r), m, x, y, z, parent);

  /* carrocería: perfil lateral con pasos de rueda, extruido a lo ancho */
  {
    const x1 = -L / 2, x2 = L / 2, y1 = LIFT, y2 = TOP, rb = 0.55, rt = 0.95, rf = 1.5;
    const s = new THREE.Shape();
    s.moveTo(x1 + rb, y1);
    // fondo, de atrás hacia adelante, con los dos arcos
    [...AX].reverse().forEach(ax => { s.lineTo(ax - ARCH, y1); s.absarc(ax, y1 + 0.05, ARCH, Math.PI, 0, true); });
    s.lineTo(x2 - rb, y1); s.quadraticCurveTo(x2, y1, x2, y1 + rb);
    s.lineTo(x2, y2 - rf); s.quadraticCurveTo(x2 - 0.08, y2, x2 - rf, y2);   // frente, apenas tendido
    s.lineTo(x1 + rt, y2); s.quadraticCurveTo(x1, y2, x1, y2 - rt);
    s.lineTo(x1, y1 + rb); s.quadraticCurveTo(x1, y1, x1 + rb, y1);
    const bev = 0.34;
    const geo = new THREE.ExtrudeGeometry(s, { depth: W - bev * 2, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelOffset: -bev, bevelSegments: 5, curveSegments: 20 });
    geo.translate(0, 0, -(W - bev * 2) / 2);
    add(geo, M.body, 0, 0, 0);
  }
  // chasis oscuro: tapa el hueco entre las ruedas
  box(L - 1.6, 2.0, W - 2.5, M.trim, 0, LIFT + 0.75, 0);
  // franja inferior que lee el sensor de color
  box(L - 3, 0.1, W - 2.7, M.stripe, 0, LIFT - 0.3, 0);

  /* costados: ventanas con postes, franjas, puertas del lado del paradero */
  const winY = 6.45, winH = 2.5, wx1 = -L / 2 + 1.3, wx2 = L / 2 - 1.9;
  [1, -1].forEach(side => {
    const z = side * (half + 0.015);
    box(wx2 - wx1, winH, 0.05, M.glass, (wx1 + wx2) / 2, winY, z);
    const n = 6;
    for (let i = 1; i < n; i++) box(0.2, winH + 0.02, 0.07, M.body, wx1 + (wx2 - wx1) * i / n, winY, z);
    // marco fino de la banda de ventanas
    box(wx2 - wx1 + 0.1, 0.07, 0.07, M.trim, (wx1 + wx2) / 2, winY + winH / 2, z);
    box(wx2 - wx1 + 0.1, 0.07, 0.07, M.trim, (wx1 + wx2) / 2, winY - winH / 2, z);
    // franjas de la marca, por encima de los pasos de rueda
    box(L - 0.9, 0.62, 0.04, M.stripe, 0, 3.95, z);
    box(L - 0.9, 0.16, 0.04, M.stripe2, 0, 3.48, z);
    // luces de posición
    box(0.3, 0.14, 0.05, M.amber, L / 2 - 0.9, 4.75, z);
    box(0.3, 0.14, 0.05, M.amber, -L / 2 + 0.9, 4.75, z);
  });
  // puertas (lado −z): delantera, antes del eje, y central
  [[L / 2 - 2.05, 2.5], [-0.9, 2.9]].forEach(([dx, dw]) => {
    const z = -(half + 0.03), y1 = LIFT + 0.42, y2 = 7.75, h = y2 - y1;
    box(dw + 0.22, h + 0.22, 0.05, M.trim, dx, (y1 + y2) / 2, z + 0.008);
    [-1, 1].forEach(k => {
      box(dw / 2 - 0.07, h, 0.06, M.glass, dx + k * dw / 4, (y1 + y2) / 2, z);
      box(dw / 2 - 0.07, 0.85, 0.07, M.body, dx + k * dw / 4, y1 + 0.42, z);       // zócalo de cada hoja
      box(0.06, 1.5, 0.08, M.hub, dx + k * 0.22, 4.6, z - 0.01);                    // agarraderas
    });
  });

  /* frente: parabrisas, letrero de ruta, faros, defensa, espejos */
  const fx = L / 2;
  rbox(0.14, 3.2, W - 1.0, 0.06, M.glass, fx + 0.0, 5.6, 0);
  box(0.16, 3.2, 0.12, M.body, fx + 0.0, 5.6, 0);                                    // poste central del parabrisas
  [-1, 1].forEach(k => {                                                             // limpiaparabrisas
    const wp = box(0.05, 1.5, 0.06, M.trim, fx + 0.09, 4.75, k * 1.5); wp.rotation.x = k * 0.5;
  });
  const sign = document.createElement('canvas'); sign.width = 512; sign.height = 80;
  {
    const g = sign.getContext('2d');
    g.fillStyle = '#05080f'; g.fillRect(0, 0, 512, 80);
    g.fillStyle = '#ffc24a'; g.textBaseline = 'middle'; g.textAlign = 'center';
    g.font = '700 54px "Inter Tight Variable", "Inter Tight", system-ui, sans-serif';
    g.fillText(route, 256, 43, 484);
  }
  const signTex = new THREE.CanvasTexture(sign); signTex.colorSpace = THREE.SRGBColorSpace; signTex.anisotropy = 8;
  if (mirror) { signTex.wrapS = THREE.RepeatWrapping; signTex.repeat.x = -1; signTex.offset.x = 1; }   // al reflejar el camión el letrero se voltea de regreso
  const signMat = mat({ color: 0x05080f, emissive: 0xffffff, emissiveMap: signTex, emissiveIntensity: 1.25, roughness: .3 });
  const sg = add(new THREE.PlaneGeometry(W - 2.0, 0.78), signMat, fx - 0.19, 7.78, 0); sg.rotation.y = Math.PI / 2;
  box(0.1, 0.92, W - 1.8, M.trim, fx - 0.26, 7.78, 0);
  rbox(0.5, 0.95, W - 0.25, 0.2, M.trim, fx - 0.08, LIFT + 0.5, 0);                  // defensa
  box(0.06, 0.42, 1.5, M.plate, fx + 0.19, LIFT + 0.52, 0);                          // placa
  box(0.06, 0.7, W - 3.6, M.trim, fx + 0.03, 3.1, 0);                                // parrilla
  [-1, 1].forEach(k => {
    rbox(0.1, 0.56, 1.25, 0.04, M.head, fx + 0.03, 3.1, k * (half - 1.15));
    box(0.1, 0.16, 0.5, M.amber, fx + 0.03, 2.62, k * (half - 0.8));
    // espejos
    const arm = box(0.9, 0.08, 0.08, M.trim, fx + 0.35, 7.5, k * (half + 0.05)); arm.rotation.y = -k * 0.5;
    rbox(0.16, 1.15, 0.55, 0.05, M.trim, fx + 0.75, 7.0, k * (half + 0.42));
  });

  /* trasera: medallón, calaveras, rejilla del motor */
  const bx = -L / 2;
  rbox(0.14, 2.1, W - 1.6, 0.06, M.glass, bx, 6.5, 0);
  rbox(0.5, 0.9, W - 0.25, 0.2, M.trim, bx + 0.08, LIFT + 0.5, 0);
  for (let i = 0; i < 5; i++) box(0.06, 0.1, W - 2.8, M.trim, bx - 0.02, 3.2 + i * 0.28, 0);
  [-1, 1].forEach(k => {
    rbox(0.1, 1.5, 0.48, 0.04, M.tail, bx - 0.03, 4.2, k * (half - 0.75));
    box(0.1, 0.4, 0.48, M.amber, bx - 0.03, 5.2, k * (half - 0.75));
  });

  /* techo: tapa, clima y escotilla */
  rbox(L - 1.6, 0.16, W - 1.3, 0.07, M.roof, -0.3, TOP + 0.04, 0);
  rbox(5.4, 0.62, W - 2.6, 0.2, M.ac, -3.4, TOP + 0.36, 0);
  for (let i = 0; i < 6; i++) box(0.1, 0.04, W - 3.6, M.slat, -5.4 + i * 0.8, TOP + 0.675, 0);
  rbox(1.9, 0.14, 1.9, 0.06, M.ac, 4.6, TOP + 0.16, 0);

  /* ruedas: llanta redondeada, rin con birlos; giran con el avance */
  const wheels = [];
  const tireG = new THREE.TorusGeometry(R - 0.42, 0.42, 14, 40);
  const wallG = new THREE.CylinderGeometry(R - 0.34, R - 0.34, 0.82, 36);
  const rimG = new THREE.CylinderGeometry(0.74, 0.74, 0.9, 32);
  const dishG = new THREE.CylinderGeometry(0.46, 0.56, 0.98, 24);
  const nutG = new THREE.CylinderGeometry(0.055, 0.055, 1.02, 8);
  AX.forEach(ax => [-1, 1].forEach(k => {
    const w = new THREE.Group(); w.position.set(ax, R, k * (half - 0.62)); bus.add(w);
    add(tireG, M.tire, 0, 0, 0, w);
    const cyl = (g, m) => { const o = add(g, m, 0, 0, 0, w); o.rotation.x = Math.PI / 2; return o; };
    cyl(wallG, M.tire); cyl(rimG, M.rim); cyl(dishG, M.hub);
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2, n = cyl(nutG, M.trim);
      n.position.set(Math.cos(a) * 0.36, Math.sin(a) * 0.36, 0);
    }
    wheels.push(w);
  }));

  bus.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  bus.visible = false;
  if (mirror) bus.scale.x = -1;

  return {
    group: bus, length: L,
    // x: centro del camión sobre la calle; null lo esconde
    setX(x) {
      bus.visible = x != null;
      if (x == null) return;
      bus.position.x = x;
      wheels.forEach(w => { w.rotation.z = (mirror ? x : -x) / R; });
    },
  };
}
