// Una placa NodeMCU ESP8266 hecha con cajas, a su tamaño real en centímetros (4.8 x 2.6): la tarjeta con su serigrafía,
// el módulo ESP-12E con su blindaje y su antena, el puerto micro USB, los dos botones y las dos filas de 15 pines.
import * as THREE from 'three';

let partes = null;
function comunes() {
  if (partes) return partes;
  const c = document.createElement('canvas'); c.width = 384; c.height = 208;
  const g = c.getContext('2d');
  g.fillStyle = '#0d2038'; g.fillRect(0, 0, 384, 208);
  g.fillStyle = 'rgba(214,224,236,.9)'; g.font = '600 15px "Inter Variable", Inter, system-ui, sans-serif'; g.textAlign = 'center';
  g.fillText('NodeMCU', 250, 98); g.font = '500 10px "Inter Variable", Inter, system-ui, sans-serif'; g.fillText('ESP8266', 250, 114);
  g.font = '500 7px "Inter Variable", Inter, system-ui, sans-serif';
  for (let i = 0; i < 15; i++) { const x = 40 + i * 21.7; g.fillText('D' + (i % 9), x, 34); g.fillText(i % 4 ? 'G' + i : '3V', x, 180); }
  g.strokeStyle = 'rgba(214,224,236,.35)'; g.lineWidth = 1;
  for (let i = 0; i < 9; i++) { g.beginPath(); g.moveTo(60 + i * 14, 60); g.lineTo(60 + i * 14, 148 - (i % 3) * 16); g.lineTo(150, 148 - (i % 3) * 16); g.stroke(); }
  const serigrafia = new THREE.CanvasTexture(c); serigrafia.colorSpace = THREE.SRGBColorSpace; serigrafia.anisotropy = 8;
  const std = o => new THREE.MeshStandardMaterial(o);
  partes = {
    tarjeta: std({ color: 0x0d2038, roughness: .55 }), cara: std({ color: 0xffffff, map: serigrafia, roughness: .5 }),
    negro: std({ color: 0x14161b, roughness: .5 }), plata: std({ color: 0xc8ccd2, roughness: .28, metalness: .85 }), oro: std({ color: 0xd9b24a, roughness: .35, metalness: .8 }),
    caja: new THREE.BoxGeometry(1, 1, 1), aro: new THREE.CylinderGeometry(.16, .16, .18, 14),
  };
  return partes;
}

export function nodemcu() {
  const M = comunes(), g = new THREE.Group();
  const caja = (m, w, h, d, x, y, z) => { const o = new THREE.Mesh(M.caja, m); o.scale.set(w, h, d); o.position.set(x, y, z); o.castShadow = true; g.add(o); return o; };
  caja([M.tarjeta, M.tarjeta, M.cara, M.tarjeta, M.tarjeta, M.tarjeta], 4.8, .16, 2.6, 0, 0, 0);
  // módulo ESP-12E: tarjeta negra, blindaje metálico y la antena en zigzag
  caja(M.negro, 2.4, .1, 1.6, -1.2, .13, 0); caja(M.plata, 1.5, .24, 1.2, -.95, .3, 0);
  for (let i = 0; i < 5; i++) caja(M.oro, .06, .03, 1.1, -2.28 + i * .11, .2, 0);
  for (const z of [-.55, .55]) caja(M.oro, .5, .03, .06, -2.06, .2, z);
  // micro USB, sus dos botones, el convertidor USB y el regulador
  caja(M.plata, .58, .28, .76, 2.14, .22, 0);
  for (const z of [-.86, .86]) { caja(M.plata, .34, .16, .34, 2.05, .16, z); caja(M.negro, .16, .1, .16, 2.05, .28, z); }
  caja(M.negro, .52, .1, .52, .95, .13, 0); caja(M.negro, .34, .16, .28, 1.5, .16, -.55);
  // pines: una tira negra por lado y 15 patas doradas en cada una
  const patas = new THREE.InstancedMesh(M.caja, M.oro, 30), m = new THREE.Matrix4();
  [-1.13, 1.13].forEach((z, k) => {
    caja(M.negro, 3.84, .25, .25, 0, -.2, z);
    for (let i = 0; i < 15; i++) patas.setMatrixAt(k * 15 + i, m.makeScale(.07, .86, .07).setPosition(-1.78 + i * .254, -.35, z));
  });
  patas.castShadow = true; g.add(patas);
  for (const x of [-2.18, 2.18]) for (const z of [-1.08, 1.08]) { const o = new THREE.Mesh(M.aro, M.oro); o.position.set(x, 0, z); g.add(o); }
  return g;
}
