// Imágenes fijas para el póster: la maqueta del video con personas a escala, desde varios ángulos.
// /video/?poster=general            versión azul          &look=madera   versión de madera
// &gente=azul  personas en tonos de azul    &gente=0  sin personas    &fondo=0  fondo transparente
import * as THREE from 'three';
import { CAD, FSR } from '../src/scene.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { loadPerson, pose, tint } from './personas.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const PI = Math.PI;
// lo plano de la calle va de la banqueta (z1) a la franja del frente (z2); frente: x de la defensa delantera; ang: giro al entrar
const BUS = { z1: -3.7, z2: 11.3, ancho: 13.0, aprieta: 1, rot: Math.PI / 2, frente: 8, ang: .14, dz: -1.0 };

// quién va dónde: [persona, pose, opciones, x, z, hacia dónde mira (rad; 0 = hacia la calle), suelo]
const REPARTO = [
  ['senor', 'sentado', {}, 4.45, -21.25, 0, 'piso'],
  ['senora', 'presiona', {}, FSR.x - 1.15, -16.9, PI, 'piso'],
  ['gorra', 'mira', { giro: .25 }, -18.2, -19.9, -PI / 2 - .15, 'piso'],
  ['estudiante', 'celular', {}, -6.6, -13.6, .2, 'piso'],
  ['camisa', 'espera', { giro: .75 }, 10.6, -6.4, .1],
  ['joven', 'teclea', {}, 20.0, -6.9, PI],
  ['mama', 'camina', { mano: 'L' }, -27.5, -4.6, PI / 2],
  ['nino', 'camina', { mano: 'R', alto: 1 }, -27.9, -7.9, PI / 2],
];

// encuadres: tgt y pos de cámara, y el estado de la maqueta
const TOMAS = {
  'general-derecha': { tgt: [0, 20, -6], pos: [42.6, 57.7, 85.8], door: 1 },
  'general-izquierda': { tgt: [0, 20, -5], pos: [-47.6, 56.1, 87.7], door: 1 },
  'general-alta': { tgt: [0, 18, -6], pos: [3.3, 88.5, 77.6], door: 1 },
  'baja-derecha': { tgt: [1, 22, -8], pos: [46.1, 26.1, 83.8], door: 1 },
  'baja-izquierda': { tgt: [-2, 22, -8], pos: [-49.6, 26.1, 80.6], door: 1 },
  'lateral-derecha': { tgt: [4, 21, -10], pos: [97.5, 36.6, 19.5], door: 1 },
  'lateral-izquierda': { tgt: [-4, 21, -10], pos: [-95.8, 36.6, 22.8], door: 1 },
  frente: { tgt: [-5, 23.5, -10], pos: [-14, 27, 88], door: 1 },
  interior: { tgt: [-4, 18, -15], pos: [-4, 112, 22], roof: 1, lamp: .6, door: 1 },
  cenital: { tgt: [0, 16, -8], pos: [0, 132, 6], roof: 1, door: 1 },
  // desde adentro de la caseta (techo puesto, luz encendida)
  'dentro-izquierda': { tgt: [-16, 22, -18.2], pos: [2.4, 28, -14.6], fov: 64, lamp: .9, door: 1, oled: 1 },
  'dentro-banca': { tgt: [3.6, 22.3, -20.6], pos: [-3.2, 25.5, -13.6], fov: 62, lamp: .9, door: 1 },
  'dentro-calle': { tgt: [-7, 22, 0], pos: [-7.5, 26, -22.2], fov: 66, lamp: .9, door: 1 },
  keypad: { tgt: [13, 22, -13], pos: [50, 34, 26], fov: 28, bars: 1 },
  noche: { tgt: [-5, 23, -11], pos: [-48, 34, 78], night: 1, lamp: 1, door: 1, oled: 1 },
  'noche-derecha': { tgt: [0, 21, -8], pos: [44.3, 44.8, 80.6], night: 1, lamp: 1, door: 1, oled: 1 },
};

export async function setupPoster({ stage, view, frame, bus, roofG, ROOF_UP, roofSet, el, params, MADERA }) {
  const toma = TOMAS[params.get('poster')] || TOMAS['general-derecha'];
  for (const id of ['label', 'code', 'end']) document.getElementById(id).style.display = 'none';
  if (params.get('fondo') === '0') { el.bg.style.display = 'none'; document.documentElement.style.background = document.body.style.background = 'transparent'; }

  frame(4.35);                                   // maqueta ya armada, techo puesto, sin nada en marcha
  stage.root.updateMatrixWorld(true);

  // altura del suelo bajo cada persona (sin contar el techo)
  const ray = new THREE.Raycaster(), solids = stage.meshes.filter(m => { let o = m; while (o) { if (roofSet.has(o) || o === roofG) return false; o = o.parent; } return m.visible; });
  const groundY = (x, z) => {
    ray.set(stage.root.localToWorld(V(x, 60, z)), V(0, -1, 0));
    const hit = ray.intersectObjects(solids, false).map(h => stage.root.worldToLocal(h.point.clone()).y).filter(y => y < 17.5);
    return hit.length ? Math.max(...hit) : CAD.baseTop;
  };

  const gente = params.get('gente') || 'color';
  const people = [];
  if (gente !== '0') {
    await Promise.all(REPARTO.map(async ([key, po, opts, x, z, rot, suelo]) => {
      const p = await loadPerson(key);
      pose(p, po, opts);
      if (gente === 'azul') tint(p, 0x6ab2f2);
      p.position.set(x, suelo === 'piso' ? CAD.floorY : groundY(x, z), z); p.rotation.y = rot;
      stage.root.add(p); people.push(p);
    }));
  }

  // camión realista ("City Bus - rigged | РоАЗ-5236" de Yo.Ri, CC-BY-4.0). Va tan grande como cabe en la calle de la
  // maqueta (z 0.8 a 11.3) sin tocar la banqueta; la calle es más angosta que una real, así que no llega a 1:15.
  let camion = null;
  if (toma.bus) {
    const gltf = await new GLTFLoader().loadAsync('/video/camion/scene.gltf');
    const m = gltf.scene;
    const quitar = []; m.traverse(o => { if (/^ShadowPlane$/.test(o.name)) quitar.push(o); });
    quitar.forEach(o => o.removeFromParent());
    m.traverse(o => {
      if (!o.isMesh) return;
      o.castShadow = o.receiveShadow = true; o.frustumCulled = false;
      for (const mat of [].concat(o.material)) { mat.transmission = 0; mat.transmissionMap = null; mat.metalness = 0; mat.metalnessMap = null; mat.roughnessMap = null; mat.roughness = /Wheel/.test(mat.name) ? .8 : .42; if (mat.emissiveMap) mat.emissiveIntensity = 1.4; if (mat.name === 'RoAZ_5236') { mat.color.set(0xffffff); mat.transparent = false; mat.opacity = 1; mat.depthWrite = true; } }
    });
    const box0 = new THREE.Box3().setFromObject(m), size0 = box0.getSize(V(0, 0, 0));
    const turnY = +(params.get('busrot') ?? BUS.rot);
    const pivot = new THREE.Group(); pivot.add(m); pivot.rotation.y = turnY;
    camion = new THREE.Group(); camion.add(pivot);
    camion.updateMatrixWorld(true);
    const s1 = new THREE.Box3().setFromObject(camion).getSize(V(0, 0, 0));
    // el ancho manda, medido de llanta a llanta (los espejos pueden volar sobre la banqueta)
    const cuerpo = new THREE.Box3(), bb = new THREE.Box3();
    m.traverse(o => { if (o.isMesh && /Wheel/.test(o.name)) { o.geometry.computeBoundingBox(); cuerpo.union(bb.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld)); } });
    const anchoCuerpo = cuerpo.max.z - cuerpo.min.z;
    const k = BUS.ancho / (anchoCuerpo * BUS.aprieta);
    pivot.scale.set(k * BUS.aprieta, k, k);         // con el giro de 90°, el x local del modelo es el ancho
    const box = new THREE.Box3().setFromObject(camion), c = box.getCenter(V(0, 0, 0));
    pivot.position.set(-c.x, -box.min.y, -c.z);    // centrado, con las llantas en y = 0
    const largo = s1.x * k;
    // va entrando por la esquina de la derecha: solo el frente queda sobre la maqueta, el resto viene llegando de fuera
    const ang = +(params.get('busang') ?? BUS.ang), fx = +(params.get('busx') ?? BUS.frente), fz = (BUS.z1 + BUS.z2) / 2 + BUS.dz;
    camion.position.set(fx + Math.cos(ang) * largo / 2, CAD.baseTop, fz + Math.sin(ang) * largo / 2);
    camion.rotation.y = -ang;
    stage.root.add(camion);
    window.info = { size0: size0.toArray().map(v => +v.toFixed(2)), k: +k.toFixed(4), largo: +largo.toFixed(1), alto: +(s1.y * k).toFixed(1), ancho: +(anchoCuerpo * k * BUS.aprieta).toFixed(1), anchoCuerpo: +anchoCuerpo.toFixed(2), mats: [...new Set(quitar.map(o => o.name))] };
  }

  const draw = () => {
    frame(4.35);
    const s = view.state, t = toma;
    s.door = t.door || 0; s.bars = t.bars || 0; s.oled = t.oled || 0;
    s.night = .92 * (t.night || 0); s.dark = t.night || 0; s.lamp = t.lamp || 0;
    roofG.position.y = ROOF_UP * (t.roof || 0); roofG.visible = !t.roof;
    bus.setX(null);                              // el camión del video se queda apagado: aquí va el modelo realista
    if (camion) camion.visible = !!t.bus;
    el.night.style.opacity = t.night && params.get('fondo') !== '0' ? 1 : 0;
    const W = document.documentElement.clientWidth, H = window.innerHeight, c = view.camera;
    c.clearViewOffset(); c.fov = t.fov || 30; c.aspect = W / H;
    c.position.set(...t.pos); c.lookAt(V(...t.tgt)); c.updateProjectionMatrix(); c.updateMatrixWorld();
    stage.render(4.35, 0);
  };
  draw();
  window.addEventListener('resize', draw);
  window.seek = async () => { draw(); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); };
  window.poster = { people, draw, toma, TOMAS };
}
