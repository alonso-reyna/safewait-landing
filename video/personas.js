// Personas a escala para las imágenes del póster. Modelos de Microsoft Rocketbox (licencia MIT), con esqueleto Biped.
// Las poses se dan en el marco de la persona (x: su izquierda, y: arriba, z: hacia donde mira) apuntando cada hueso
// hacia una dirección, así no dependen de los ejes locales del esqueleto.
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

const DIR = '/video/personas/';
const ESCALA = 1 / 15;                 // la puerta de la maqueta mide 14 cm: 2.1 m a escala 1:15
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const texLoader = new THREE.TextureLoader();
const tex = (f, dir = DIR) => new Promise(r => texLoader.load(dir + f, t => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; r(t); }, undefined, () => r(null)));

// [archivo FBX, prefijo de texturas]
export const ELENCO = {
  estudiante: ['Female_Adult_12', 'f012'], joven: ['Female_Adult_01', 'f001'], camisa: ['Male_Adult_08', 'm014'],
  gorra: ['Male_Adult_17', 'm022'], senora: ['Female_Adult_09', 'f009'], senor: ['Male_Adult_05', 'm009'],
  mama: ['Female_Adult_17', 'f006'], nino: ['Male_Child_01', 'cm001'],
};

export async function loadPerson(key, dir = DIR) {
  const [file, pre] = ELENCO[key];
  const fbx = await new Promise((res, rej) => new FBXLoader().load(dir + file + '.fbx', res, undefined, rej));
  const [body, head, opa] = await Promise.all([tex(pre + '_body_color.jpg', dir), tex(pre + '_head_color.jpg', dir), tex(pre + '_opacity_color.png', dir)]);
  const mats = [];
  fbx.traverse(o => {
    if (!o.isMesh) return;
    o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
    const conv = m => {
      const n = (m.name || '').toLowerCase();
      const map = /opac/.test(n) ? opa : /head/.test(n) ? head : body;
      const s = new THREE.MeshStandardMaterial({ map, roughness: .78, metalness: 0, name: m.name });
      if (/opac/.test(n)) { s.transparent = false; s.alphaTest = .45; s.side = THREE.DoubleSide; }
      mats.push(s); return s;
    };
    o.material = Array.isArray(o.material) ? o.material.map(conv) : conv(o.material);
  });
  const bones = {};
  fbx.traverse(o => { if (o.isBone) bones[o.name.replace(/^Bip0\d/, '').replace(/[\s_]+/g, '')] = o; });
  // marco propio: pies en el origen, mirando a +z
  const inner = new THREE.Group(); inner.add(fbx);
  fbx.scale.setScalar(ESCALA);
  const root = new THREE.Group(); root.add(inner);
  root.userData = { bones, inner, fbx, mats, key };
  ground(root);
  // para animar: la pose neutra de cada hueso y la altura a la que quedan los pies
  root.userData.rest = Object.values(bones).map(o => [o, o.quaternion.clone()]);
  root.userData.y0 = inner.position.y;
  root.userData.pie0 = pieMin(root);
  return root;
}

const q = new THREE.Quaternion(), qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), a = V(0, 0, 0), b = V(0, 0, 0);
// gira un hueso (en el mundo) para que apunte hacia `dir`, dado en el marco de la persona
function aim(p, bone, child, dir) {
  const B = p.userData.bones, o = B[bone], c = B[child];
  if (!o || !c) { console.warn('hueso?', bone, child); return; }
  p.updateMatrixWorld(true);
  o.getWorldPosition(a); c.getWorldPosition(b);
  const cur = b.sub(a).normalize();
  const want = dir.clone().normalize().applyQuaternion(p.getWorldQuaternion(qa));
  q.setFromUnitVectors(cur, want);
  worldRot(o, q);
}
function worldRot(o, qW) {
  o.getWorldQuaternion(qa);
  o.parent.getWorldQuaternion(qb).invert();
  o.quaternion.copy(qb.multiply(qW).multiply(qa));
  o.updateMatrixWorld(true);
}
// gira un hueso alrededor de un eje del marco de la persona
function turn(p, bone, axis, ang) {
  const o = p.userData.bones[bone]; if (!o) { console.warn('hueso?', bone); return; }
  p.updateMatrixWorld(true);
  const ax = axis.clone().normalize().applyQuaternion(p.getWorldQuaternion(qa));
  worldRot(o, q.setFromAxisAngle(ax, ang));
}
// deja el punto más bajo del cuerpo en y = 0 del marco de la persona
function ground(p) {
  const { inner } = p.userData;
  inner.position.set(0, 0, 0); p.updateMatrixWorld(true);
  const box = new THREE.Box3(), bb = new THREE.Box3();
  inner.traverse(o => {
    if (!o.isSkinnedMesh) return;
    o.skeleton.update(); o.computeBoundingBox();
    box.union(bb.copy(o.boundingBox).applyMatrix4(o.matrixWorld));
  });
  const inv = p.matrixWorld.clone().invert();
  box.applyMatrix4(inv);
  inner.position.y = -box.min.y;
  p.userData.alto = box.max.y - box.min.y;
  p.updateMatrixWorld(true);
  return box;
}

const X = V(1, 0, 0), Y = V(0, 1, 0), Z = V(0, 0, 1);
const arm = (p, s, up, fore, hand) => { const k = s === 'L' ? 1 : -1; const f = d => V(d[0] * k, d[1], d[2]); aim(p, s + 'UpperArm', s + 'Forearm', f(up)); aim(p, s + 'Forearm', s + 'Hand', f(fore)); if (hand) aim(p, s + 'Hand', s + 'Finger1', f(hand)); };
const leg = (p, s, thigh, calf, foot) => { const k = s === 'L' ? 1 : -1; const f = d => V(d[0] * k, d[1], d[2]); aim(p, s + 'Thigh', s + 'Calf', f(thigh)); aim(p, s + 'Calf', s + 'Foot', f(calf)); if (foot) aim(p, s + 'Foot', s + 'Toe0', f(foot)); };
const relaxed = (p, s, sw = 0) => arm(p, s, [.16, -1, .04 + sw], [.1, -1, .22 + sw], [.05, -1, .25 + sw]);

// cada pose parte de la pose neutra (brazos abiertos) del modelo
export const POSES = {
  // de pie, esperando: peso en una pierna, brazos sueltos
  espera(p, { giro = 0 } = {}) {
    relaxed(p, 'L'); relaxed(p, 'R');
    leg(p, 'R', [-.06, -1, .1], [0, -1, -.14], [-.3, -.5, 1]);
    turn(p, 'Head', Y, giro);
  },
  // de pie viendo el celular con la mano derecha
  celular(p) {
    relaxed(p, 'L');
    arm(p, 'R', [.12, -1, .22], [-.5, .55, .85], [-.5, .7, .4]);
    turn(p, 'Neck', X, .3); turn(p, 'Head', X, .25);
  },
  // sentado en la banca, manos sobre las piernas
  sentado(p) {
    leg(p, 'L', [.2, -.06, 1], [0, -1, .08], [.15, -.5, 1]); leg(p, 'R', [.2, -.06, 1], [0, -1, .08], [.15, -.5, 1]);
    arm(p, 'L', [.14, -1, .28], [-.12, -.42, 1], [-.1, -.3, 1]); arm(p, 'R', [.14, -1, .28], [-.12, -.42, 1], [-.1, -.3, 1]);
    turn(p, 'Spine', X, -.06);
  },
  // sentada viendo el celular
  sentadaCelular(p) {
    leg(p, 'L', [.14, -.06, 1], [0, -1, .08], [.1, -.5, 1]); leg(p, 'R', [.14, -.06, 1], [0, -1, .08], [.1, -.5, 1]);
    arm(p, 'L', [.14, -1, .28], [-.12, -.42, 1], [-.1, -.3, 1]);
    arm(p, 'R', [.1, -1, .3], [-.45, .35, .9], [-.5, .7, .4]);
    turn(p, 'Neck', X, .3); turn(p, 'Head', X, .25);
  },
  // presiona algo a la altura de la cadera, al frente (botón SOS)
  presiona(p) {
    relaxed(p, 'L');
    arm(p, 'R', [.05, -.9, .45], [-.08, -.3, 1], [0, -.5, .9]);
    turn(p, 'Spine1', X, .12); turn(p, 'Neck', X, .3); turn(p, 'Head', X, .2);
  },
  // se agacha a teclear en el módulo bajo (keypad a la altura de la rodilla)
  teclea(p) {
    turn(p, 'Spine', X, .5); turn(p, 'Spine1', X, .3); turn(p, 'Neck', X, -.1);
    leg(p, 'L', [.1, -1, .28], [0, -1, -.3], [.1, -.5, 1]); leg(p, 'R', [.1, -1, .28], [0, -1, -.3], [.1, -.5, 1]);
    arm(p, 'L', [.2, -.85, -.3], [.1, -1, .1]);
    arm(p, 'R', [0, -.75, .65], [-.15, -.8, .6], [0, -.9, .4]);
  },
  // mira hacia arriba y a un lado (pantalla en el muro)
  mira(p, { giro = 0 } = {}) {
    relaxed(p, 'L'); arm(p, 'R', [.16, -1, .1], [-.5, -.2, .85]);
    turn(p, 'Head', Y, giro); turn(p, 'Head', X, -.08);
  },
  // animada (presentación): camina con la fase `fase` y la amplitud `paso` (0 = de pie); `cel` (0 a 1) levanta el celular
  // con la mano derecha y baja la mirada; `giro` voltea la cabeza
  anda(p, { fase = 0, paso = 1, cel = 0, giro = 0 } = {}) {
    const s = Math.sin(fase), c = Math.cos(fase), A = .38 * paso, K = .7 * paso, sw = .26 * paso * s;
    const m = (a, b) => a.map((v, i) => v + (b[i] - v) * cel);
    // la rodilla se dobla mientras la pierna va de atrás hacia adelante (el pie se despega del piso)
    leg(p, 'L', [.04, -1, A * s], [0, -1, A * s - K * Math.max(0, c) - .05], [.1, -.45, 1]);
    leg(p, 'R', [.04, -1, -A * s], [0, -1, -A * s - K * Math.max(0, -c) - .05], [.1, -.45, 1]);
    relaxed(p, 'L', -sw);
    arm(p, 'R', m([.16, -1, .04 + sw], [.12, -1, .22]), m([.1, -1, .22 + sw], [-.5, .55, .85]), m([.05, -1, .25 + sw], [-.5, .7, .4]));
    turn(p, 'Spine1', X, .05 * paso);
    turn(p, 'Neck', X, .3 * cel * (1 - Math.min(1, Math.abs(giro) * 2))); turn(p, 'Head', X, .25 * cel * (1 - Math.min(1, Math.abs(giro) * 2)));
    turn(p, 'Head', Y, giro);
  },
  // pose dada hueso por hueso (presentación): s trae la dirección de cada segmento y los giros del tronco y la cabeza;
  // tilt inclina el cuerpo entero (negativo = hacia atrás)
  libre(p, s) {
    p.userData.inner.rotation.x = s.tilt || 0;
    leg(p, 'L', s.thL, s.caL, s.foL); leg(p, 'R', s.thR, s.caR, s.foR);
    arm(p, 'L', s.upL, s.frL, s.haL); arm(p, 'R', s.upR, s.frR, s.haR);
    if (s.spine) turn(p, 'Spine', X, s.spine);
    if (s.neck) turn(p, 'Neck', X, s.neck);
    if (s.headX) turn(p, 'Head', X, s.headX);
    if (s.headY) turn(p, 'Head', Y, s.headY);
  },
  // caminando; mano: 'L' | 'R' va tomada de alguien más bajo
  camina(p, { mano = '', alto = 0 } = {}) {
    leg(p, 'L', [.04, -1, .42], [0, -1, .12], [.1, -.4, 1]); leg(p, 'R', [.04, -1, -.3], [0, -.8, -.6], [.1, -.9, .6]);
    for (const s of ['L', 'R']) {
      if (s === mano) arm(p, s, alto ? [.8, -.35, .05] : [.3, -1, .05], alto ? [1, .25, .1] : [.5, -1, .1]);
      else relaxed(p, s, s === 'L' ? -.3 : .3);
    }
  },
};

export function pose(p, name, opts) { POSES[name](p, opts); ground(p); return p; }

// altura (en el marco de la persona) del hueso de pie más bajo
const PIES = ['LFoot', 'RFoot', 'LToe0', 'RToe0'], pv = V(0, 0, 0), CADERA = 1.05;   // CADERA: del hueso de la pelvis al piso cuando está sentada en él
function pieMin(p) {
  p.updateMatrixWorld(true);
  let y = Infinity;
  for (const k of PIES) { const o = p.userData.bones[k]; if (o) y = Math.min(y, p.worldToLocal(o.getWorldPosition(pv)).y); }
  return y;
}
// pose para animación: se llama en cada cuadro. Parte siempre de la pose neutra y apoya los pies por sus huesos
// (sin recorrer la malla, que es lo que hace ground y es caro para repetirlo 60 veces por segundo)
export function animar(p, name, opts) {
  const u = p.userData;
  for (const [o, q0] of u.rest) o.quaternion.copy(q0);
  u.inner.position.y = u.y0; u.inner.rotation.x = 0;
  POSES[name](p, opts);
  // se apoya en lo que quede más abajo: los pies o, si está en el piso, la cadera
  const pies = pieMin(p) - u.pie0, pel = u.bones.Pelvis ? p.worldToLocal(u.bones.Pelvis.getWorldPosition(pv)).y - CADERA : Infinity;
  u.inner.position.y -= Math.min(pies, pel);
  return p;
}
// tinte de un solo tono (versión azul): conserva la luz y la sombra de la textura pero en la gama del color dado
export function tint(p, color, k = 1) {
  for (const m of p.userData.mats) {
    m.onBeforeCompile = sh => {
      sh.uniforms.uTint = { value: new THREE.Color(color) }; sh.uniforms.uK = { value: k };
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uTint; uniform float uK;')
        .replace('#include <map_fragment>', '#include <map_fragment>\n{ float l = dot(diffuseColor.rgb, vec3(.3, .59, .11)); vec3 mono = mix(uTint * .55, vec3(1.), smoothstep(.0, .75, l)) * mix(vec3(1.), uTint, .55); diffuseColor.rgb = mix(diffuseColor.rgb, mono, uK); }');
    };
    m.needsUpdate = true;
  }
}
