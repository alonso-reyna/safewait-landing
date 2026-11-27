// La nube a la que llegan los datos (slide "Cómo viajan los datos"): una nube de esferas con el ícono de base de datos SQL al
// frente, y lo que cada NodeMCU le manda: ondas que salen de la placa y paquetes que suben hasta la base de datos.
import * as THREE from 'three';

const std = o => new THREE.MeshStandardMaterial(o);
const DB = new THREE.Vector3(.5, 4.2, 9);   // dónde queda la base de datos dentro de la nube
const TRAMOS = 24;                           // segmentos del trazo de cada envío

// n: cuántas placas mandan datos
export function nube(n) {
  const g = new THREE.Group(), aire = new THREE.Group();
  g.visible = aire.visible = false;
  const blanco = std({ color: 0xffffff, roughness: .92 }), esf = new THREE.SphereGeometry(1, 32, 20);
  const bola = (x, y, z, sx, sy = sx, sz = sx) => { const o = new THREE.Mesh(esf, blanco); o.position.set(x, y, z); o.scale.set(sx, sy, sz); g.add(o); };
  bola(0, 3.4, 0, 18, 4.4, 6.5);   // la base, aplanada
  for (const [x, r, z] of [[-12.5, 5.4, 0], [-5.5, 8, -1], [3.5, 9.6, -.5], [11.5, 6.6, 0], [-1, 5.6, 3.6], [7, 5, 3.4]]) bola(x, r + .6, z, r);
  // la base de datos: tres discos apilados, con "SQL" al frente
  const azul = std({ color: 0x267dc0, roughness: .38 }), cielo = std({ color: 0x8fc4ff, roughness: .38 }), cil = new THREE.CylinderGeometry(1, 1, 1, 40);
  const db = new THREE.Group(); db.position.copy(DB); g.add(db);
  for (let i = 0; i < 3; i++) { const o = new THREE.Mesh(cil, [azul, cielo, azul]); o.scale.set(4.3, 2.3, 4.3); o.position.y = (i - 1) * 3; db.add(o); }
  { const c = document.createElement('canvas'); c.width = 256; c.height = 96; const x = c.getContext('2d');
    x.fillStyle = '#fff'; x.font = '700 78px "Inter Tight Variable", "Inter Tight", system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('SQL', 128, 52);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    const o = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 2.1), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false })); o.position.set(0, 0, 4.36); db.add(o); }

  // lo que manda cada placa: dos ondas (aros que miran a la cámara) y cuatro paquetes que suben por una curva, con su trazo tenue
  const aro = new THREE.RingGeometry(.88, 1, 56), punto = new THREE.SphereGeometry(1, 14, 10);
  const envios = Array.from({ length: n }, () => ({
    ondas: [0, 1].map(() => { const o = new THREE.Mesh(aro, new THREE.MeshBasicMaterial({ color: 0x267dc0, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide })); aire.add(o); return o; }),
    datos: [0, 1, 2, 3].map(() => { const o = new THREE.Mesh(punto, new THREE.MeshBasicMaterial({ color: 0x162660 })); aire.add(o); return o; }),
    via: (() => { const o = new THREE.Line(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRAMOS * 3 + 3), 3)), new THREE.LineBasicMaterial({ color: 0x267dc0, transparent: true, opacity: 0, depthWrite: false })); o.frustumCulled = false; aire.add(o); return o; })(),
  }));
  const a = new THREE.Vector3(), b = new THREE.Vector3(), m = new THREE.Vector3(), c = new THREE.Vector3();

  // t: reloj; k: cuánto ha entrado la nube (0 a 1); placas: los NodeMCU; cam: la cámara, para que las ondas la miren
  function update(t, k, pos, placas, cam) {
    g.visible = aire.visible = k > .01;
    if (!g.visible) return;
    const e = k * k * (3 - 2 * k);
    g.position.set(pos.x, pos.y + 1.1 * Math.sin(t * .8) + 16 * (1 - e), pos.z); g.scale.setScalar(.001 + 1.2 * e);
    db.scale.setScalar(1 + .05 * Math.sin(t * 3.5));
    b.copy(DB).multiplyScalar(1.2 * e).add(g.position);
    envios.forEach((v, i) => {
      a.copy(placas[i].position); m.set(a.x * .8 + b.x * .2, a.y + (b.y - a.y) * .8, a.z * .8 + b.z * .2);
      const curva = (p, o) => { const q = 1 - p; return o.set(q * q * a.x + 2 * q * p * m.x + p * p * b.x, q * q * a.y + 2 * q * p * m.y + p * p * b.y, q * q * a.z + 2 * q * p * m.z + p * p * b.z); };
      const xyz = v.via.geometry.attributes.position;
      for (let s = 0; s <= TRAMOS; s++) { curva(.06 + .9 * s / TRAMOS, c); xyz.setXYZ(s, c.x, c.y, c.z); }
      xyz.needsUpdate = true; v.via.material.opacity = .3 * e;
      v.ondas.forEach((o, j) => {
        const p = (t / 1.7 + j * .5 + i * .23) % 1;
        o.position.copy(a); o.quaternion.copy(cam.quaternion); o.scale.setScalar(4 + 9 * p); o.material.opacity = .55 * e * (1 - p) * Math.min(1, p * 8);
      });
      v.datos.forEach((o, j) => {
        const p = (t / 2.4 + j / 4 + i * .17) % 1;
        curva(p, o.position); o.scale.setScalar(.85 * e * Math.min(1, p * 7, (1 - p) * 7));
      });
    });
  }
  return { g, aire, update };
}
