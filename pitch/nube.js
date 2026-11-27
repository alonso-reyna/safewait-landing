// El camino de los datos (slide "Cómo viajan los datos"), como es en el sistema real: cada NodeMCU manda sus datos por WiFi a la
// API Flask, que corre en una laptop, y la API los guarda en la base de datos MySQL, que está en la nube.
// Aquí están la laptop (en su pantalla van saliendo las líneas POST), la nube con el ícono de base de datos SQL, las ondas de
// cada placa y los paquetes que viajan.
import * as THREE from 'three';

const std = o => new THREE.MeshStandardMaterial(o);
const DB = new THREE.Vector3(2.6, 3.6, 9.4);  // dónde queda la base de datos dentro de la nube (vista desde la cámara cae al centro)
const TRAMOS = 24;                            // segmentos del trazo de cada envío
const T_SUBE = 2.7, T_NUBE = 1.5;             // segundos de la placa a la laptop y de la laptop a la nube (misma velocidad: el tramo es más corto)
const PUNTO = .78;                            // radio de cada paquete: todos iguales
const ESCALA = 1.2, LAP = 1.12;              // tamaño de la nube y de la laptop
const RUTAS = ['/iluminacion', '/sos', '/acceso', '/ruta', '/barrotes'];   // una ruta de la API por nodo

function texto(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

// n: cuántas placas mandan datos
export function nube(n) {
  const g = new THREE.Group(), lap = new THREE.Group(), aire = new THREE.Group();
  g.visible = lap.visible = aire.visible = false;

  /* ---------- la nube: una base redondeada y sus copos ---------- */
  // no usa las luces de la escena (ahí el blanco sale gris): su volumen va pintado en cada vértice, blanco donde le da la luz
  // y azul cielo por abajo y del lado contrario, para que se distinga del fondo claro
  const blanco = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }), esf = new THREE.SphereGeometry(1, 48, 32), copos = [];
  { const o = new THREE.Mesh(new THREE.CapsuleGeometry(5.4, 23, 16, 40), blanco); o.rotation.z = Math.PI / 2; o.position.y = 5.4; g.add(o); copos.push(o); }
  for (const [x, y, z, r] of [[-9.5, 10, -.4, 6.6], [-.5, 14.2, -.8, 9.8], [9.5, 11, -.4, 7.4], [-5.2, 7.4, 3, 5.7], [5.4, 7.8, 3.2, 6]]) { const o = new THREE.Mesh(esf, blanco); o.position.set(x, y, z); o.scale.setScalar(r); g.add(o); copos.push(o); }
  { const sombra = new THREE.Color(0x9fcafc), luz = new THREE.Color(0xffffff), col = new THREE.Color(), v = new THREE.Vector3(), nrm = new THREE.Vector3(), L = new THREE.Vector3(-.45, .8, .4).normalize(), giro = new THREE.Matrix3();
    for (const o of copos) {
      o.updateMatrix(); giro.getNormalMatrix(o.matrix); o.geometry = o.geometry.clone();
      const pos = o.geometry.attributes.position, nor = o.geometry.attributes.normal, rgb = new Float32Array(pos.count * 3);
      for (let i = 0; i < pos.count; i++) {
        const alto = Math.min(1, Math.max(0, (v.fromBufferAttribute(pos, i).applyMatrix4(o.matrix).y - 1) / 18));
        const k = Math.min(1, Math.max(0, .12 + .5 * (.5 + .5 * nrm.fromBufferAttribute(nor, i).applyMatrix3(giro).normalize().dot(L)) + .5 * alto));
        col.copy(sombra).lerp(luz, k * k * (3 - 2 * k)).toArray(rgb, i * 3);
      }
      o.geometry.setAttribute('color', new THREE.BufferAttribute(rgb, 3));
    } }
  // la base de datos: tres discos apilados, con "SQL" al frente
  const azul = std({ color: 0x267dc0, roughness: .36 }), cielo = std({ color: 0x9fcbff, roughness: .36 }), cil = new THREE.CylinderGeometry(1, 1, 1, 48);
  const db = new THREE.Group(); db.position.copy(DB); g.add(db);
  for (let i = 0; i < 3; i++) { const o = new THREE.Mesh(cil, [azul, cielo, azul]); o.scale.set(4.5, 2.4, 4.5); o.position.y = (i - 1) * 3.1; db.add(o); }
  { const t = texto(256, 96, x => { x.fillStyle = '#fff'; x.font = '700 78px "Inter Tight Variable", "Inter Tight", system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('SQL', 128, 52); });
    const o = new THREE.Mesh(new THREE.PlaneGeometry(5.8, 2.2), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false })); o.position.set(0, 0, 4.56); db.add(o); }

  /* ---------- la laptop donde corre la API ---------- */
  const caja = new THREE.BoxGeometry(1, 1, 1), alu = std({ color: 0xdde2ea, roughness: .42, metalness: .35 }), oscuro = std({ color: 0x1a1e29, roughness: .6 });
  const pon = (padre, mat, w, h, d, x, y, z) => { const o = new THREE.Mesh(caja, mat); o.scale.set(w, h, d); o.position.set(x, y, z); padre.add(o); return o; };
  pon(lap, alu, 23, .9, 15.5, 0, .45, 0); pon(lap, oscuro, 19.5, .08, 7, 0, .92, -2.2); pon(lap, std({ color: 0xc6ccd6, roughness: .5, metalness: .3 }), 7.2, .06, 4.2, 0, .91, 4.6);
  const tapa = new THREE.Group(); tapa.position.set(0, .9, -7.6); tapa.rotation.x = -.3; lap.add(tapa);
  pon(tapa, alu, 23, 15, .6, 0, 7.5, -.3);
  // la pantalla: el registro de la API, donde va saliendo una línea POST por cada dato que llega (la ruta del nodo y su 200)
  const pc = document.createElement('canvas'); pc.width = 824; pc.height = 536;
  const px = pc.getContext('2d'), pant = new THREE.CanvasTexture(pc); pant.colorSpace = THREE.SRGBColorSpace; pant.anisotropy = 8;
  const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace', log = [1, 2, 3, 4].map(i => RUTAS[i % RUTAS.length]);
  function pinta() {
    px.fillStyle = '#0b1433'; px.fillRect(0, 0, 824, 536);
    px.fillStyle = '#15224f'; px.fillRect(0, 0, 824, 124);
    for (const [i, c] of ['#ff6b5e', '#f2c94c', '#4fcf8a'].entries()) { px.fillStyle = c; px.beginPath(); px.arc(46 + i * 40, 62, 12, 0, 7); px.fill(); }
    px.textBaseline = 'middle'; px.textAlign = 'left';
    px.fillStyle = '#fff'; px.font = '700 72px "Inter Tight Variable", "Inter Tight", system-ui, sans-serif'; px.fillText('API Flask', 190, 66);
    log.forEach((ruta, i) => {
      const y = 186 + i * 94, ult = i === log.length - 1;
      px.globalAlpha = ult ? 1 : .6; px.font = `600 56px ${MONO}`;
      px.fillStyle = '#8fc4ff'; px.fillText('POST', 34, y); px.fillStyle = '#fff'; px.fillText(ruta, 196, y);
      px.fillStyle = '#4fcf8a'; px.textAlign = 'right'; px.fillText('200', 792, y); px.textAlign = 'left';
    });
    px.globalAlpha = 1; pant.needsUpdate = true;
  }
  pinta();
  { const o = new THREE.Mesh(new THREE.PlaneGeometry(21.4, 13.9), new THREE.MeshBasicMaterial({ map: pant })); o.position.set(0, 7.5, .02); tapa.add(o); }
  const antes = [];   // dónde iba el primer paquete de cada placa en el cuadro anterior: cuando vuelve a empezar es que llegó

  /* ---------- lo que viaja: de cada placa salen dos ondas (aros que miran a la cámara) y tres paquetes que suben derecho y
     se curvan hacia la laptop, por debajo de ella (los cinco caminos forman una cúpula sobre la maqueta, sin cruzarla);
     de la laptop sube un solo flujo, recto, a la base de datos. Todos los paquetes miden y corren igual ---------- */
  const aro = new THREE.RingGeometry(.88, 1, 56), punto = new THREE.SphereGeometry(1, 14, 10);
  const dato = () => { const o = new THREE.Mesh(punto, new THREE.MeshBasicMaterial({ color: 0x162660 })); aire.add(o); return o; };
  const via = () => { const o = new THREE.Line(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRAMOS * 3 + 3), 3)), new THREE.LineBasicMaterial({ color: 0x267dc0, transparent: true, opacity: 0, depthWrite: false })); o.frustumCulled = false; aire.add(o); return o; };
  const envios = Array.from({ length: n }, () => ({
    ondas: [0, 1].map(() => { const o = new THREE.Mesh(aro, new THREE.MeshBasicMaterial({ color: 0x267dc0, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide })); aire.add(o); return o; }),
    datos: [0, 1, 2].map(dato), via: via(),
  }));
  const sube = { datos: [0, 1].map(dato), via: via() };
  const tam = (p, e) => PUNTO * e * Math.min(1, p * 16, (1 - p) * 16);   // aparece y se va rápido: en el camino siempre mide lo mismo
  const a = new THREE.Vector3(), b = new THREE.Vector3(), m = new THREE.Vector3(), c = new THREE.Vector3(), api = new THREE.Vector3(), sale = new THREE.Vector3(), base = new THREE.Vector3();
  const curva = (p, o) => { const q = 1 - p; return o.set(q * q * a.x + 2 * q * p * m.x + p * p * b.x, q * q * a.y + 2 * q * p * m.y + p * p * b.y, q * q * a.z + 2 * q * p * m.z + p * p * b.z); };
  const traza = (v, e) => { const xyz = v.geometry.attributes.position; for (let s = 0; s <= TRAMOS; s++) { curva(.05 + .9 * s / TRAMOS, c); xyz.setXYZ(s, c.x, c.y, c.z); } xyz.needsUpdate = true; v.material.opacity = .3 * e; };

  // t: reloj; k: cuánto ha entrado todo (0 a 1); en, enLap: la altura de la nube y dónde va la laptop; placas: los NodeMCU; cam: la cámara
  function update(t, k, en, enLap, placas, cam) {
    g.visible = lap.visible = aire.visible = k > .01;
    if (!g.visible) return;
    const e = k * k * (3 - 2 * k);
    lap.position.set(enLap.x, enLap.y + .9 * Math.sin(t * .9 + 2) - 12 * (1 - e), enLap.z); lap.scale.setScalar(.001 + LAP * e);
    lap.updateMatrixWorld(true);
    api.set(0, -1.2, 1).applyMatrix4(lap.matrix); sale.set(0, 16.2, -12.6).applyMatrix4(lap.matrix);   // llegan por debajo de la laptop y salen de arriba de su pantalla
    // la nube se acomoda para que su base de datos quede justo arriba de ese punto: así el tramo que las une sube derecho
    g.scale.setScalar(.001 + ESCALA * e);
    g.position.set(sale.x - DB.x * ESCALA * e, en.y + 1.1 * Math.sin(t * .8) + 16 * (1 - e), sale.z - DB.z * ESCALA * e);
    base.copy(DB).setY(DB.y - 4.9).multiplyScalar(ESCALA * e).add(g.position);                         // entran por debajo de la base de datos
    // de cada placa a la laptop
    envios.forEach((v, i) => {
      a.copy(placas[i].position); b.copy(api); m.set(a.x, a.y + (b.y - a.y) * .82, a.z);
      traza(v.via, e);
      v.ondas.forEach((o, j) => {
        const p = (t / 1.7 + j * .5 + i * .23) % 1;
        o.position.copy(a); o.quaternion.copy(cam.quaternion); o.scale.setScalar(3 + 6 * p); o.material.opacity = .5 * e * (1 - p) * Math.min(1, p * 8);
      });
      v.datos.forEach((o, j) => {
        const p = (t / T_SUBE + j / 3 + i * .2) % 1;
        curva(p, o.position); o.scale.setScalar(tam(p, e));
        if (!j) { if (p < antes[i]) { log.push(RUTAS[i % RUTAS.length]); log.shift(); pinta(); } antes[i] = p; }   // llegó: sale su línea en la pantalla
      });
    });
    // de la laptop a la base de datos
    a.copy(sale); b.copy(base); m.copy(a).lerp(b, .5);
    traza(sube.via, e * 1.6);
    sube.datos.forEach((o, j) => { const p = (t / T_NUBE + j / 2) % 1; curva(p, o.position); o.scale.setScalar(tam(p, e)); });
  }
  return { g, lap, aire, update };
}
