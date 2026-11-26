// La parada de hoy, para la slide de la situación: una calle cualquiera de noche, con banqueta, barda rayada, una banca vieja,
// el letrero de la parada, un farol que casi no alumbra y basura. Nada de esto es SafeWait: es lo que SafeWait reemplaza.
// Medidas en centímetros a escala 1:15, igual que la maqueta (una persona mide unos 11).
import * as THREE from 'three';

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const sm = (t, a, b) => { const k = clamp((t - a) / (b - a)); return k * k * (3 - 2 * k); };

// el farol titila débil mientras ella camina y se apaga para siempre justo cuando llega
export function farol(t) {
  if (t > 8.7) return 0;
  const n = Math.sin(t * 23.1) * Math.sin(t * 7.3 + 1.3) * Math.sin(t * 41.7 + .4);
  let k = .34 + .2 * Math.sin(t * 3.1) + (n > .22 ? .45 : 0) - (Math.sin(t * 13.7) > .9 ? .5 : 0);
  if (t > 7.5) k *= (Math.sin(t * 39) > -.2 ? 1 : .1) * (1 - sm(t, 7.5, 8.7));
  return clamp(k);
}

// y: altura de la banqueta; calle: altura del asfalto. Devuelve el grupo, la luz del farol y quiebra(k), que rompe el asiento de la banca.
export function paradaFea({ y, calle, banca = [-14.5, -10.3] }) {
  const g = new THREE.Group(); g.visible = false;
  let seed = 11; const rnd = (a = 0, b = 1) => { seed = (seed * 16807) % 2147483647; return a + (b - a) * (seed / 2147483647); };
  const tex = (w, h, draw, rx = 1, ry = 1) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.anisotropy = 8; return t;
  };
  const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: .93, ...o });
  const add = (geo, m, x, yy, z, rx = 0, ry = 0, rz = 0, par = g) => { const o = new THREE.Mesh(geo, m); o.position.set(x, yy, z); o.rotation.set(rx, ry, rz); o.castShadow = o.receiveShadow = true; par.add(o); return o; };
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d), cyl = (r1, r2, h, n = 12, open = false) => new THREE.CylinderGeometry(r1, r2, h, n, 1, open);
  const grano = (c, w, h, n, tonos) => { for (let i = 0; i < n; i++) { c.fillStyle = tonos[Math.floor(rnd(0, tonos.length))]; c.fillRect(rnd(0, w), rnd(0, h), rnd(1, 2.6), rnd(1, 2.6)); } };
  const mancha = (c, x, yy, r, a) => { const gr = c.createRadialGradient(x, yy, 0, x, yy, r); gr.addColorStop(0, `rgba(20,22,26,${a})`); gr.addColorStop(1, 'rgba(20,22,26,0)'); c.fillStyle = gr; c.fillRect(x - r, yy - r, r * 2, r * 2); };

  // luz neutra muy baja: con solo la luz azul de la noche el concreto se vería azul, y la calle es gris
  g.add(new THREE.AmbientLight(0xcfd0d2, .15));

  /* ---------- calle, guarnición, banqueta y barda ---------- */
  const zB = -14.4, zG = -3.5, ANCHO = 420;   // la banqueta va de la barda (zB) a la guarnición (zG)
  const asfalto = tex(256, 256, (c, w, h) => {
    c.fillStyle = '#34363a'; c.fillRect(0, 0, w, h);
    grano(c, w, h, 2600, ['#2b2d31', '#3d4045', '#46494e', '#26282b', '#4d5055']);
    for (let i = 0; i < 4; i++) mancha(c, rnd(0, w), rnd(0, h), rnd(30, 70), .16);
  }, ANCHO / 12, 90 / 12);
  add(new THREE.PlaneGeometry(ANCHO, 90), mat(0xffffff, { map: asfalto }), 0, calle, zG + .7 + 45, -Math.PI / 2);
  // parches, una coladera y la raya del carril, casi borrada
  add(box(11, .03, 6.5), mat(0x25272a), 13, calle + .015, 4.4, 0, .06, 0); add(box(6, .03, 4), mat(0x2b2d30), -27, calle + .015, 7.5, 0, -.1, 0);
  add(cyl(2.1, 2.1, .05, 20), mat(0x2a2c30, { roughness: .6, metalness: .4 }), 3.5, calle + .03, 6.2);
  add(new THREE.TorusGeometry(2.15, .12, 6, 22), mat(0x1c1d20), 3.5, calle + .04, 6.2, Math.PI / 2);
  for (let x = -190; x < 190; x += 19) add(box(8, .02, .42), mat(0x85878a), x + rnd(-.3, .3), calle + .012, 15.5).material.opacity = 1;
  { const o = add(new THREE.CircleGeometry(2.2, 20), new THREE.MeshStandardMaterial({ color: 0x1a2a4a, roughness: .08, metalness: .4, transparent: true, opacity: .55, depthWrite: false }), -6.5, calle + .02, -1.2, -Math.PI / 2); o.scale.x = 2.3; o.castShadow = false; }
  // guarnición, con restos de pintura amarilla frente a la parada
  add(box(ANCHO, y - calle + .02, .72), mat(0x9a9c9f), 0, (y + calle) / 2, zG + .36);
  for (const [x, l] of [[-24, 6.5], [-15, 4], [-8.5, 5.5], [0, 2.2]]) add(box(l, y - calle + .04, .74), mat(0x9c8a42), x, (y + calle) / 2, zG + .36);
  const losa = tex(256, 256, (c, w, h) => {
    c.fillStyle = '#8c8f93'; c.fillRect(0, 0, w, h);
    grano(c, w, h, 1800, ['#7d8085', '#979a9e', '#868a8e', '#a2a5a8', '#74777c']);
    for (let i = 0; i < 5; i++) mancha(c, rnd(0, w), rnd(0, h), rnd(24, 80), .2);
    c.strokeStyle = '#4c4f54'; c.lineWidth = 5; c.strokeRect(0, 0, w, h);
    c.strokeStyle = 'rgba(40,42,46,.7)'; c.lineWidth = 1.6; c.beginPath(); let px = rnd(30, 220), py = 0; c.moveTo(px, py);
    while (py < h) { px += rnd(-16, 16); py += rnd(10, 26); c.lineTo(px, py); } c.stroke();
  }, ANCHO / 6, (zG - zB) / 6);
  add(new THREE.PlaneGeometry(ANCHO, zG - zB), mat(0xffffff, { map: losa }), 0, y, (zG + zB) / 2, -Math.PI / 2);
  // barda de block: un tramo con rayones y carteles rotos detrás de la parada, y block liso hacia los lados
  const ALTO = 15, block = (c, w, h, cm) => {
    c.fillStyle = '#7b7e83'; c.fillRect(0, 0, w, h); grano(c, w, h, w * 4, ['#6f7277', '#85888c', '#8f9296', '#686b70']);
    c.strokeStyle = 'rgba(52,54,58,.75)'; c.lineWidth = 1.4;
    for (let r = 0, yy = 0; yy < h; yy += cm * 1.6, r++) { c.beginPath(); c.moveTo(0, yy); c.lineTo(w, yy); c.stroke(); for (let x = (r % 2) * cm * 1.6; x < w; x += cm * 3.2) { c.beginPath(); c.moveTo(x, yy); c.lineTo(x, yy + cm * 1.6); c.stroke(); } }
    for (let i = 0; i < w / 60; i++) { const x = rnd(0, w), l = rnd(h * .2, h * .8), gr = c.createLinearGradient(0, 0, 0, l); gr.addColorStop(0, 'rgba(30,32,36,.45)'); gr.addColorStop(1, 'rgba(30,32,36,0)'); c.fillStyle = gr; c.fillRect(x, 0, rnd(4, 14), l); }
    const su = c.createLinearGradient(0, h * .7, 0, h); su.addColorStop(0, 'rgba(25,27,30,0)'); su.addColorStop(1, 'rgba(25,27,30,.5)'); c.fillStyle = su; c.fillRect(0, h * .7, w, h * .3);
  };
  const TRAMO = 100, muro = tex(1600, 240, (c, w, h) => {
    block(c, w, h, 16);
    // carteles pegados y arrancados
    for (const [x, yy, ww, hh, col] of [[250, 48, 120, 150, '#b9b4a6'], [384, 62, 104, 132, '#a9a08e'], [1180, 40, 132, 168, '#b4b1a8']]) {
      c.fillStyle = col; c.beginPath(); c.moveTo(x, yy);
      for (let i = 0; i <= 8; i++) c.lineTo(x + ww * i / 8, yy + rnd(-5, 5)); for (let i = 0; i <= 8; i++) c.lineTo(x + ww + rnd(-7, 3), yy + hh * i / 8);
      for (let i = 8; i >= 0; i--) c.lineTo(x + ww * i / 8, yy + hh * rnd(.62, 1)); c.closePath(); c.fill();
      c.fillStyle = 'rgba(60,62,66,.5)'; for (let i = 0; i < 5; i++) c.fillRect(x + 12, yy + 22 + i * 18, ww * rnd(.4, .8), 6);
    }
    // rayones de aerosol sin letras legibles (el segundo se calcula pero no se pinta: en su lugar va el "IoT")
    c.lineCap = c.lineJoin = 'round';
    [[560, 'rgba(58,120,132,.8)', 13], [760, null, 11], [930, 'rgba(206,206,200,.7)', 9], [60, 'rgba(32,34,38,.8)', 8], [1380, 'rgba(58,120,132,.7)', 10]].forEach(([x0, col, lw]) => {
      c.strokeStyle = col || 'transparent'; c.lineWidth = lw; c.beginPath(); let x = x0, yy = rnd(110, 170); c.moveTo(x, yy);
      for (let i = 0; i < 7; i++) { const nx = x + rnd(14, 34), ny = rnd(50, 200); c.bezierCurveTo(x + rnd(-20, 30), ny + rnd(-60, 60), nx + rnd(-30, 20), yy + rnd(-60, 60), nx, ny); x = nx; yy = ny; }
      if (col) c.stroke();
    });
    // "IoT" pintado con aerosol, entre la banca y el farol: trazo grueso con el borde difuso, rocío y escurridos
    const letras = [
      [[786, 40], [788, 78], [785, 120]], [[772, 42], [801, 37]], [[771, 121], [802, 117]],                                       // I
      [[838, 76], [816, 80], [814, 112], [836, 118], [860, 116], [862, 82], [842, 74], [834, 78]],                                 // o
      [[866, 44], [894, 36], [922, 39]], [[895, 38], [892, 80], [894, 122]],                                                       // T
    ];
    const trazo = pts => { c.beginPath(); c.moveTo(...pts[0]); if (pts.length === 2) c.lineTo(...pts[1]); else { for (let i = 1; i < pts.length - 1; i++) { const m = i < pts.length - 2 ? [(pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2] : pts[i + 1]; c.quadraticCurveTo(...pts[i], ...m); } } c.stroke(); };
    c.save(); c.translate(834, 80); c.rotate(-.045); c.translate(-846, -80);
    c.shadowColor = 'rgba(214,66,136,.8)'; c.shadowBlur = 5; c.strokeStyle = 'rgba(214,66,136,.9)'; c.lineWidth = 12; letras.forEach(trazo);
    c.shadowBlur = 0; c.strokeStyle = 'rgba(236,112,168,.3)'; c.lineWidth = 5; letras.forEach(trazo);
    let sd = 7; const r2 = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };   // azar propio: no mueve el de la escena
    c.fillStyle = 'rgba(214,66,136,.5)'; for (let i = 0; i < 260; i++) { const pts = letras[Math.floor(r2() * letras.length)], q = pts[Math.floor(r2() * pts.length)], a = r2() * 6.28, d = 6 + r2() * 12; c.fillRect(q[0] + Math.cos(a) * d, q[1] + Math.sin(a) * d, 1.6, 1.6); }
    for (const [x, y0, l] of [[786, 122, 30], [893, 124, 22], [838, 119, 14], [802, 38, 12]]) { const gr = c.createLinearGradient(0, y0, 0, y0 + l); gr.addColorStop(0, 'rgba(214,66,136,.9)'); gr.addColorStop(1, 'rgba(214,66,136,.25)'); c.strokeStyle = gr; c.lineWidth = 2.6; c.beginPath(); c.moveTo(x, y0); c.lineTo(x + .6, y0 + l); c.stroke(); }
    c.restore();
  });
  add(new THREE.PlaneGeometry(TRAMO, ALTO), mat(0xffffff, { map: muro }), banca[0] + 2, y + ALTO / 2, zB);
  const liso = tex(256, 240, (c, w, h) => block(c, w, h, 16), (ANCHO - TRAMO) / 2 / 16, 1);
  for (const s of [-1, 1]) add(new THREE.PlaneGeometry((ANCHO - TRAMO) / 2, ALTO), mat(0xffffff, { map: liso }), banca[0] + 2 + s * (TRAMO / 2 + (ANCHO - TRAMO) / 4), y + ALTO / 2, zB);
  add(box(ANCHO, .5, 1.1), mat(0x5f6267), 0, y + ALTO + .25, zB);

  /* ---------- banca: herrajes de fierro y tablas; el asiento son dos mitades por tabla, para poder romperlo ---------- */
  const b = new THREE.Group(); b.position.set(banca[0], y, banca[1]); b.rotation.y = .03; g.add(b);
  const fierro = mat(0x3d3733, { roughness: .8, metalness: .3 }), tabla = () => mat(new THREE.Color(0x7c7566).offsetHSL(rnd(-.02, .02), rnd(-.05, .03), rnd(-.06, .05)));
  // cada tabla del asiento son tres tramos: los de las orillas cuelgan de su herraje y el de en medio se va al piso
  const LARGO = 13, MED = LARGO / 2 - .35, ASIENTO = 2.7, ORILLA = 4.3;
  for (const x of [-MED, MED]) {
    add(box(.42, ASIENTO - .2, .42), fierro, x, (ASIENTO - .2) / 2, 1.45, 0, 0, 0, b);        // pata delantera
    add(box(.42, 6.9, .42), fierro, x, 3.4, -1.55, .15, 0, 0, b);                               // pata trasera, que sube como respaldo
    add(box(.42, .42, 3.3), fierro, x, ASIENTO - .32, -.05, 0, 0, 0, b);                        // travesaño del asiento
    add(box(.5, .3, 3.5), fierro, x, 4.75, .1, -.05, 0, 0, b); add(box(.36, 4.6 - ASIENTO, .36), fierro, x, (4.6 + ASIENTO) / 2, 1.5, 0, 0, 0, b);   // descansabrazos
    add(box(.8, .12, 1), fierro, x, .06, 1.45, 0, 0, 0, b); add(box(.8, .12, 1), fierro, x, .06, -1.95, 0, 0, 0, b);         // zapatas
  }
  // dónde queda tirado el tramo de en medio de cada tabla [x, z, giro]: dos detrás de ella, uno bajo sus rodillas y otro a un lado
  const TIRADO = [[.4, -2.6, .25], [-.3, -1.75, -.1], [.1, 1.25, .12], [-3.0, 2.6, .9]];
  const mitades = [], medios = [];
  [-1.12, -.38, .36, 1.1].forEach((z, i) => {
    for (const s of [-1, 1]) {
      const piv = new THREE.Group(); piv.position.set(s * MED, ASIENTO, z); b.add(piv);
      add(box(ORILLA, .3, .62), tabla(), -s * ORILLA / 2, 0, 0, 0, 0, 0, piv);
      mitades.push({ piv, s, ang: Math.asin((ASIENTO - .28) / ORILLA) * rnd(.86, 1), giro: rnd(-.12, .12), tarde: i * .05 + rnd(0, .08) });
    }
    medios.push({ o: add(box(2 * (MED - ORILLA) - .03, .3, .62), tabla(), 0, ASIENTO, z, 0, 0, 0, b), z, fin: TIRADO[i], vuelta: rnd(-.5, .5) });
  });
  // respaldo: una tabla entera, falta la de en medio y la de abajo cuelga de un lado
  add(box(LARGO, .3, .7), tabla(), 0, 6.35, -2.0, .15, 0, 0, b);
  add(box(LARGO - .6, .3, .7), tabla(), -.5, 4.25, -1.9, .15, 0, -.13, b);
  const quiebra = k => {
    for (const m of mitades) { const e = clamp((k - m.tarde) / (1 - m.tarde)), q = e * e; m.piv.rotation.z = m.s * m.ang * Math.min(1, q * 1.06); m.piv.rotation.x = m.giro * q; }
    // los tramos de en medio caen con ella (llegan al piso un poco antes) y quedan tirados
    const e = Math.pow(clamp(k / .8), 1.7);
    for (const m of medios) { m.o.position.set(m.fin[0] * e, ASIENTO + (.16 - ASIENTO) * e, m.z + (m.fin[1] - m.z) * e); m.o.rotation.set(m.vuelta * Math.sin(Math.PI * e), m.fin[2] * e, 0); }
  };

  /* ---------- letrero de parada: lámina azul con el camión, rayada y oxidada ---------- */
  const p = new THREE.Group(); p.position.set(banca[0] - 9, y, -8.6); p.rotation.set(.02, .08, -.07); g.add(p);
  add(cyl(.2, .2, 17.5), mat(0x7b8088, { roughness: .55, metalness: .5 }), 0, 8.75, 0, 0, 0, 0, p);
  add(cyl(.5, .6, .35), mat(0x5a5d62), 0, .18, 0, 0, 0, 0, p);
  const lamina = tex(256, 352, (c, w, h) => {
    const rr = (x, yy, ww, hh, r) => { c.beginPath(); c.roundRect(x, yy, ww, hh, r); };
    c.fillStyle = '#2c5f9e'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#dfe3e8'; c.lineWidth = 9; rr(12, 12, w - 24, h - 24, 22); c.stroke();
    c.fillStyle = '#e6e9ed'; rr(52, 70, 152, 124, 20); c.fill();                       // camión visto de frente
    c.fillStyle = '#2c5f9e'; rr(68, 86, 120, 50, 8); c.fill(); c.fillRect(68, 150, 28, 14); c.fillRect(160, 150, 28, 14);
    c.fillStyle = '#e6e9ed'; c.fillRect(66, 190, 26, 22); c.fillRect(164, 190, 26, 22);
    c.font = '700 44px "Inter Tight Variable", "Inter Tight", system-ui, sans-serif'; c.textAlign = 'center'; c.fillText('PARADA', w / 2, 282);
    // sol, óxido, rayones y una calcomanía a medio arrancar
    c.fillStyle = 'rgba(190,196,204,.2)'; c.fillRect(0, 0, w, h);
    for (const [x, yy, r] of [[20, 330, 80], [246, 20, 60], [230, 340, 46], [8, 150, 30]]) { const gr = c.createRadialGradient(x, yy, 0, x, yy, r); gr.addColorStop(0, 'rgba(112,64,34,.9)'); gr.addColorStop(1, 'rgba(112,64,34,0)'); c.fillStyle = gr; c.fillRect(x - r, yy - r, r * 2, r * 2); }
    c.strokeStyle = 'rgba(225,228,232,.5)'; c.lineWidth = 1.3; for (let i = 0; i < 26; i++) { const x = rnd(0, w), yy = rnd(0, h); c.beginPath(); c.moveTo(x, yy); c.lineTo(x + rnd(-40, 40), yy + rnd(-28, 28)); c.stroke(); }
    c.fillStyle = '#d8d4c8'; c.beginPath(); c.moveTo(150, 214); c.lineTo(226, 206); c.lineTo(232, 250); c.lineTo(196, 262); c.lineTo(168, 244); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(20,20,24,.85)'; c.lineWidth = 6; c.lineCap = 'round'; c.beginPath(); c.moveTo(40, 300); c.bezierCurveTo(90, 250, 120, 340, 170, 296); c.bezierCurveTo(190, 280, 200, 320, 224, 306); c.stroke();
  });
  const placa = add(box(3.5, 4.8, .1), [mat(0x8a8d92), mat(0x8a8d92), mat(0x8a8d92), mat(0x8a8d92), mat(0xffffff, { map: lamina, roughness: .6 }), mat(0x6f7379)], 0, 14.6, .26, 0, 0, .05, p);
  placa.material[4].metalness = .2;
  for (const yy of [13.2, 16]) add(box(.7, .22, .3), mat(0x5a5d62), 0, yy, .12, 0, 0, 0, p);

  /* ---------- farol viejo ---------- */
  const f = new THREE.Group(); f.position.set(banca[0] + 10.5, y, -12.6); f.rotation.z = .03; g.add(f);
  const poste = mat(0x6b7078, { roughness: .6, metalness: .45 });
  add(cyl(.55, .7, 1.3), poste, 0, .65, 0, 0, 0, 0, f); add(cyl(.24, .34, 20.5), poste, 0, 11.4, 0, 0, 0, 0, f);
  add(cyl(.16, .2, 5.4), poste, 0, 21.9, 2.4, Math.PI / 2 - .16, 0, 0, f);
  add(box(1.6, .55, 2.6), poste, 0, 22.1, 5.3, -.1, 0, 0, f);
  const foco = add(box(1.2, .14, 2), new THREE.MeshStandardMaterial({ color: 0x2a2620, emissive: 0xffc27a, emissiveIntensity: 0 }), 0, 21.8, 5.35, -.1, 0, 0, f);
  const luzF = new THREE.PointLight(0xffb866, 0, 75, 1.6); luzF.position.set(0, 20.8, 5.3); f.add(luzF);
  add(box(.9, 1.5, .5), mat(0x55585d), 0, 4.2, .42, 0, 0, 0, f);

  /* ---------- bote de basura lleno, bolsas y basura suelta ---------- */
  const bx = banca[0] + 8.6, bz = -12.4;
  add(cyl(1.55, 1.3, 4.5, 14), mat(0x39473f, { roughness: .75, metalness: .25 }), bx, y + 2.25, bz, 0, 0, .05);
  const bolsa = mat(0x15171b, { roughness: .32 });
  const bol = (x, yy, z, sx, sy, sz, ry) => { const o = add(new THREE.SphereGeometry(1, 12, 9), bolsa, x, yy, z, 0, ry, 0); o.scale.set(sx, sy, sz); add(new THREE.ConeGeometry(.3, .7, 6), bolsa, x, yy + sy + .2, z, .2, 0, .2); };
  bol(bx + .1, y + 4.9, bz, 1.5, 1.0, 1.4, .4); bol(bx + 2.6, y + 1.1, bz + .8, 1.9, 1.25, 1.6, 1.1); bol(bx - 2.3, y + .9, bz + 1.2, 1.5, 1.0, 1.3, 2.3);
  const lata = mat(0x9a4a44, { roughness: .45, metalness: .55 }), pet = new THREE.MeshStandardMaterial({ color: 0xbfd6cf, roughness: .15, transparent: true, opacity: .55 }), papel = mat(0xcfd0cc), carton = mat(0x8f7655);
  const suelta = (x, z) => [x, y, z];
  for (const [x, z, r] of [[bx + 4.4, bz + 2.6, .4], [banca[0] - 4.2, -6.2, 1.7], [banca[0] + 4.6, -5.3, 2.6]]) { const o = add(cyl(.34, .34, 1.15, 10), lata, ...suelta(x, z), Math.PI / 2, r, 0); o.position.y = y + .34; }
  { const o = add(cyl(.34, .34, 1.15, 10), mat(0x4c6f8a, { roughness: .45, metalness: .55 }), banca[0] + 3.7, y + .2, -6.5, Math.PI / 2, .9, 0); o.scale.z = .5; }
  for (const [x, z, r] of [[banca[0] - 6.5, -11.6, .6], [bx + 1.2, bz + 3.4, 2.1]]) { add(cyl(.3, .3, 1.5, 10), pet, x, y + .3, z, Math.PI / 2, r, 0); add(cyl(.12, .28, .5, 8), pet, x + Math.sin(r) * .98, y + .3, z + Math.cos(r) * .98, Math.PI / 2, r, 0); }
  for (const [x, z, r, w] of [[banca[0] - 2.5, -7.0, .5, 1.5], [banca[0] + 6.5, -8.4, 2.2, 1.3], [banca[0] - 8.8, -5.6, 1.2, 1.6], [bx + 3.6, bz + 4.6, .2, 1.2], [banca[0] + 2.6, -4.6, 2.9, 1.4]]) add(new THREE.PlaneGeometry(w, w * 1.35), papel, x, y + .03 + rnd(0, .02), z, -Math.PI / 2 + rnd(-.12, .12), 0, r).material.side = THREE.DoubleSide;
  add(box(3.2, .22, 3), carton, banca[0] - 6.8, y + .12, -12.6, 0, .4, .03); add(box(3.2, .16, 1.4), carton, banca[0] - 6.3, y + .32, -11.5, .5, .4, 0);
  { const o = add(cyl(.42, .3, 1.3, 10), mat(0xd9d6cd), bx + 5.6, y + .36, bz + 1.4, Math.PI / 2, .7, 0); add(cyl(.45, .45, .1, 10), mat(0x9a4a44), o.position.x + .42, y + .36, o.position.z + .5, Math.PI / 2, .7, 0); }
  // manchas en la banqueta y hierba que sale de las juntas y al pie de la barda
  for (let i = 0; i < 7; i++) { const o = add(new THREE.CircleGeometry(rnd(1.4, 3.8), 14), new THREE.MeshBasicMaterial({ color: 0x0d0f13, transparent: true, opacity: rnd(.16, .34), depthWrite: false }), banca[0] + rnd(-16, 16), y + .03 + i * .004, rnd(-13.6, -4.6), -Math.PI / 2); o.scale.x = rnd(.6, 1.6); o.castShadow = false; }
  const verdes = [mat(0x44603f), mat(0x56733f), mat(0x3b5236), mat(0x6a7a48)];
  for (const [x, z] of [[banca[0] - 10.9, -8.9], [banca[0] - 10.1, -8.2], [banca[0] + 10.1, -12.9], [banca[0] + 11.2, -12.2], [banca[0] - 6.6, -14.0], [banca[0] + 3, -14.1], [banca[0] + 16, -14.0], [banca[0] - 19, -13.9], [banca[0] + 7.4, -3.9], [banca[0] - 13.6, -3.9], [banca[0] + 21, -9.2]])
    for (let i = 0; i < 8; i++) add(new THREE.ConeGeometry(.075, rnd(.9, 2.4), 3), verdes[Math.floor(rnd(0, 4))], x + rnd(-.45, .45), y + .6, z + rnd(-.35, .35), rnd(-.4, .4), rnd(0, 3), rnd(-.4, .4));

  return { g, luzF, foco, quiebra };
}
