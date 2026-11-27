// Presentación final de SafeWait (Etapa 5): pitch de ventas, maqueta y dashboard en un solo deck.
// Las slides viven en index.html; la maqueta 3D corre en dos iframes de /video/?pitch (azul y madera) y aquí se decide
// qué slide va, se mueve el tiempo de ambas escenas y se pasa de un look al otro.
//   →, espacio, clic: siguiente    ←: anterior    F: pantalla completa (o el botón que sale al acercar el cursor a la esquina
//   de arriba a la derecha)    T: cronómetro de la parte    R: volver a empezar
//   La portada es solo el logo al centro (con sus textos y la maqueta sale nada más en el PDF); el siguiente paso es la slide 2,
//   que abre con su frase (data-antes), y la animación empieza con el siguiente "siguiente".
//   /pitch/#7 abre en la slide 7   |   /pitch/?fijo#7 la deja quieta en su cuadro final (así se saca el PDF: pitch/exportar.mjs)
import '@fontsource-variable/inter';
import '@fontsource-variable/inter-tight';
import './pitch.css';
import { TEAM, TEACHERS } from '../src/content.js';
import fDaniela from './personas/daniela.jpg';
import fEmbarazada from './personas/embarazada.jpg';
import fNino from './personas/nino.jpg';
import fJose from './personas/jose.jpg';
import { flotantes } from './flotan.js';

// Los cinco nodos (en el orden de TEAM): el beneficio para el pitch, y para la maqueta su sensor y su actuador
// con el modelo que da el reporte de la Etapa 4 (piezas: sus modelos 3D en componentes.js, que flotan sobre las tarjetas).
const NODOS = [
  { name: 'Iluminación', anchor: 'light', title: 'La luz se enciende sola cuando oscurece.', sensor: ['Fotorresistencia', 'LDR'], act: ['Tira LED', 'WS2812B'], piezas: ['ldr', 'tira'], event: 'Luces encendidas' },
  { name: 'SOS', anchor: 'sos', title: 'Presionas y suena la alarma.', sensor: ['Sensor de fuerza', 'FSR 402'], act: ['Buzzer', 'Activo de 5 V'], piezas: ['fsr', 'buzzer'], event: 'Alerta activada' },
  { name: 'Acceso', anchor: 'door', title: 'La puerta abre solo con tarjeta autorizada.', sensor: ['Lector NFC', 'MFRC522'], act: ['Servomotor', 'MG90S'], piezas: ['rfid', 'servo'], event: 'Tarjeta autorizada' },
  { name: 'Ruta', anchor: 'route', title: 'La pantalla te dice qué camión llegó.', sensor: ['Sensor de color', 'TCS3200'], act: ['Pantalla OLED', 'SSD1306'], piezas: ['color', 'oled'], bruma: true, event: 'Ruta 2 detectada' },
  { name: 'Barrotes', anchor: 'bars', title: 'Con una clave, los barrotes protegen la caseta.', sensor: ['Teclado 4x4', 'Keypad'], act: ['Motor a pasos', '28BYJ-48'], piezas: ['teclado', 'motor'], event: 'Barrotes arriba' },
];
// quiénes corren más riesgo al esperar solos (reporte de la Etapa 4: mujeres, adultos mayores, niños y estudiantes).
// pos y zoom encuadran la cara de cada foto en su tarjeta
const PERFILES = [
  { tag: 'Estudiantes', name: 'Daniela Torres', quien: '16 años, estudiante de prepa', img: fDaniela, pos: '50% 20%' },
  { tag: 'Mujeres', name: 'Laura Méndez', quien: '29 años, embarazada', img: fEmbarazada, pos: '50% 46%', zoom: 1.06 },
  { tag: 'Niños', name: 'Mateo Garza', quien: '11 años, estudiante de primaria', img: fNino, pos: '92% 26%', zoom: 1.12 },
  { tag: 'Adultos mayores', name: 'José Ramírez', quien: '75 años, mecánico retirado', img: fJose, pos: '50% 20%' },
];
// el dashboard del equipo en Data Studio (la slide del dashboard lo abre en otra pestaña)
const DASHBOARD_URL = 'https://datastudio.google.com/reporting/de247ea6-c190-42d3-8073-96266323158c/page/p_5236cqeh9d';
// las gráficas del dashboard, con la forma que tienen en el real
const DASH = {
  kpis: [['Alertas SOS', 19], ['Registros de luz', 24], ['Accesos NFC', 48], ['Rutas detectadas', 20], ['Aperturas de barrotes', 26]],
  sos: [7, 1, 3, 7, 1, 2, 4],
  luz: [1, 1, 1, 1, 1, 1, 1, 1, .08, .16, .28, .38, .18, .27, .08, .21, .3, .92, .66, .88, 1, 1, 1, 1],
  sol: [.03, .03, .04, .03, .04, .03, .05, .3, .58, .68, .72, .68, .74, .75, .78, .62, .55, .3, .2, .03, .03, .04, .03, .03],
  acc: [8, 2, 4, 3, 2, 12, 6, 7, 4],
  bus: [[2, 0, 0], [1, 2, 1], [2, 1, 0], [0, 1, 0], [3, 4, 2], [1, 0, 0]],
  bar: [7, 2, 4, 11, 2],
};
// medidas de la maqueta (cm, del CAD): cada cota va de a hacia b, separada del modelo por d
const COTAS = [
  { t: '67 cm', a: [-33.5, 15.7, 17.29], b: [33.5, 15.7, 17.29], d: [0, 0, 6] },
  { t: '50 cm', a: [33.5, 15.7, 17.29], b: [33.5, 15.7, -32.71], d: [6, 0, 0] },
  { t: '31 cm', a: [-22.6, 35.6, -10.9], b: [8.4, 35.6, -10.9], d: [0, 4.5, 0] },
  { t: '19 cm', a: [8.4, 16.27, -10.9], b: [8.4, 35.6, -10.9], d: [4.5, 0, 0] },
];
// tiempo de cada parte calificada (segundos), para el cronómetro
const LIMITE = { pitch: 180, maqueta: 120, dashboard: 180 };

const $ = s => document.querySelector(s);
const deck = $('#deck'), fA = $('#f-azul'), fM = $('#f-madera');
const q = new URLSearchParams(location.search);
const FIJO = q.has('fijo');
const now = () => performance.now() / 1000;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smooth = t => t * t * (3 - 2 * t);
const mix = (a, b, k) => a.map((v, i) => Math.round(v + (b[i] - v) * k));
document.documentElement.classList.toggle('fijo', FIJO);

/* ---------- contenido que sale de los datos ---------- */
// plano de rutas de la landing (src/movil.js): tres líneas que pasan por SafeWait; la que llegó, la 2, va resaltada y encima
const LC = { 1: '#ff6a5e', 2: '#4d94ff', 3: '#3fca84' };
const bul = (x, y, n) => `<circle cx="${x}" cy="${y}" r="10" fill="${LC[n]}"/><text class="num" x="${x}" y="${y + 4}">${n}</text>`;
const stn = (x, y, n) => `<circle cx="${x}" cy="${y}" r="5" fill="#0b1433" stroke="${LC[n]}" stroke-width="3"/>`;
const MAPA = `<div class="mapa vidrio" data-a="6.2">
  <p class="mapa-cab"><span class="mapa-n">2</span><span><b>Llegó la Ruta 2</b><i>Línea azul, a Rancho IoT</i></span></p>
  <svg viewBox="0 0 346 168" role="img" aria-label="Plano de rutas que pasan por SafeWait">
    <g class="dim"><path class="ln" stroke="${LC[3]}" stroke-width="7" d="M70 150V118L98 90H250L286 126V156"/>${bul(70, 150, 3)}</g>
    <g class="dim"><path class="ln" stroke="${LC[1]}" stroke-width="7" d="M22 34H104L140 70H206L246 110H326"/>${stn(104, 34, 1)}${stn(246, 110, 1)}${bul(22, 34, 1)}${bul(326, 110, 1)}</g>
    <g><path class="ln" stroke="${LC[2]}" stroke-width="7" d="M22 126H88L134 80H232L266 46H322"/>${stn(88, 126, 2)}${stn(232, 80, 2)}${bul(22, 126, 2)}${bul(322, 46, 2)}</g>
    <rect x="164" y="60" width="18" height="40" rx="9" fill="#fff"/>
    <text class="lbl" x="173" y="52">SafeWait</text><text class="dest" x="322" y="26">Rancho IoT</text>
  </svg>
</div>`;
document.querySelectorAll('.slide.nodo').forEach(s => {
  const n = +s.dataset.node, d = NODOS[n - 1], demo = s.classList.contains('demo');
  const paso = (rol, [a, b], cls = '') => `<li class="${cls}"><i>${rol}</i><b>${a}</b><span>${b}</span></li>`;
  s.innerHTML = `<div class="col">
    ${demo ? `<p class="eyebrow" data-a="0">${TEAM[n - 1].name}</p>` : ''}
    <h2><span class="ln"><span style="--d:.1s"><b>0${n}</b>${d.name}</span></span></h2>
    ${demo ? `<ol class="cadena" data-a=".6">${paso('Sensor', d.sensor)}${paso('Control', ['NodeMCU', 'ESP8266'], 'mcu')}${paso('Actuador', d.act)}</ol>`
      : `<p class="sub" data-a=".5">${d.title}</p>${n === 4 ? MAPA : ''}
    <div class="pasos" data-a=".8">${NODOS.map((_, i) => `<i class="${i + 1 < n ? 'hecho' : i + 1 === n ? 'aqui' : ''}"></i>`).join('')}</div>`}
  </div>`;
});
// los pasos de las 10:00 a las 10:15: cinco huellas de zapato, con la punta hacia abajo
document.querySelectorAll('.huellas').forEach(h => { h.innerHTML = Array.from({ length: 5 }, (_, i) => `<svg style="--i:${i}" viewBox="0 0 10 16"><ellipse cx="5" cy="2.3" rx="2.3" ry="2.1"/><ellipse cx="5" cy="11.2" rx="3.9" ry="4.7"/></svg>`).join(''); });
// tiras de LED del problema: 10 focos y se encienden los de la cifra redondeada
document.querySelectorAll('.tira').forEach(t => {
  t.querySelector('.leds').innerHTML = Array.from({ length: 10 }, (_, i) => `<i class="${i < +t.dataset.n ? 'si' : ''}" style="--i:${i}"></i>`).join('');
});
$('#perfiles').innerHTML = PERFILES.map((p, i) => `<article class="perfil vidrio" data-a="${(.5 + i * .16).toFixed(2)}">
  <div class="foto"><img src="${p.img}" alt="" style="object-position:${p.pos};transform-origin:${p.pos};scale:${p.zoom || 1}"></div><h3>${p.tag}</h3><p class="nombre">${p.name}</p><p class="quien">${p.quien}</p></article>`).join('');
// base de datos: un registro por nodo
$('#filas').innerHTML = NODOS.map((d, i) => `<li style="--i:${i}"><span class="n">${i + 1}</span><span><b>${d.name}</b><span>${d.event}</span></span></li>`).join('');
// dashboard: tarjetas con el total de cada nodo y una gráfica por nodo, que se van dibujando
{
  const barras = (v, cls = '') => { const m = Math.max(...v); return `<div class="barras ${cls}">${v.map((x, i) => `<i style="--h:${(x / m * 100).toFixed(1)}%;--i:${i}"></i>`).join('')}</div>`; };
  const traza = (v, max = Math.max(...v)) => v.map((y, i) => `${i ? 'L' : 'M'}${(i / (v.length - 1) * 100).toFixed(2)} ${(60 - y / max * 54).toFixed(2)}`).join('');
  const curva = (v, cls, max) => `<svg class="${cls}" viewBox="0 0 100 60" preserveAspectRatio="none" aria-hidden="true"><path class="area" d="${traza(v, max)}L100 60L0 60Z"/><path class="traza" d="${traza(v, max)}"/></svg>`;
  const mb = Math.max(...DASH.bus.map(b => b[0] + b[1] + b[2]));
  $('#tablero').innerHTML = `
    <header><img src="/safewait-logo.svg" alt=""><p><b>Dashboard SafeWait</b><span>Monitoreo de seguridad del paradero</span></p></header>
    <div class="kpis">${DASH.kpis.map(([t, n], i) => `<div style="--i:${i}"><span>${t}</span><b data-n="${n}">${n}</b></div>`).join('')}</div>
    <div class="graficas">
      <figure class="g-sos"><figcaption>Alertas SOS por hora</figcaption>${barras(DASH.sos)}</figure>
      <figure class="g-luz"><figcaption>Luces y luz del sol por hora</figcaption><div class="capas">${barras(DASH.luz)}${curva(DASH.sol, 'sol', 1)}</div></figure>
      <figure class="g-acc"><figcaption>Accesos por hora</figcaption>${curva(DASH.acc, 'acc')}</figure>
      <figure class="g-bus"><figcaption>Camiones por hora</figcaption><div class="barras pila">${DASH.bus.map((b, i) => `<i style="--h:${((b[0] + b[1] + b[2]) / mb * 100).toFixed(1)}%;--i:${i}">${b.map((x, j) => x ? `<u class="c${j}" style="flex:${x}"></u>` : '').join('')}</i>`).join('')}</div></figure>
      <figure class="g-bar"><figcaption>Aperturas de barrotes por hora</figcaption>${barras(DASH.bar)}</figure>
    </div>`;
}
const kpis = [...document.querySelectorAll('#tablero [data-n]')];
// tabla de los cinco nodos y sus puntos numerados sobre la maqueta
$('#tabla').innerHTML = `<p class="fila cabeza"><span></span><span>Nodo</span><span>Sensor</span><span>Actuador</span></p>` + NODOS.map((d, i) =>
  `<p class="fila" style="--i:${i}"><span class="n">${i + 1}</span><b>${d.name}</b><span>${d.sensor[0]}<i>${d.sensor[1]}</i></span><span>${d.act[0]}<i>${d.act[1]}</i></span></p>`).join('');
$('#puntos').innerHTML = NODOS.map((_, i) => `<span class="punto solo vidrio-c" style="--d:${(.8 + i * .22).toFixed(2)}s"><span class="n">${i + 1}</span></span>`).join('');
const puntos = [...document.querySelectorAll('#puntos .punto')];
// cotas de la maqueta: línea de medida, sus dos testigos y la cifra
const cotasEl = $('#cotas');
cotasEl.innerHTML = COTAS.map((c, i) => `<g style="--i:${i}"><line class="testigo"/><line class="testigo"/><line class="medida" pathLength="1"/><circle r="3"/><circle r="3"/><text class="halo">${c.t}</text><text>${c.t}</text></g>`).join('');
const cotas = [...cotasEl.children].map(g => ({ l: [...g.querySelectorAll('line')], c: [...g.querySelectorAll('circle')], t: [...g.querySelectorAll('text')] }));
const COTA_PTS = COTAS.flatMap(c => [c.a, c.b, c.a.map((v, i) => v + c.d[i]), c.b.map((v, i) => v + c.d[i])]);
// el equipo se presenta: una marca de color, el nombre y su rol, sin recuadros
$('#quienes').innerHTML = TEAM.map((p, i) => `<li style="--i:${i}"><i></i><b>${p.name}</b><span>${p.extra}</span></li>`).join('');
$('#equipo').innerHTML = TEAM.map(p => `<li><b>${p.name}</b><span>${p.extra}, ${p.area}</span></li>`).join('') + `<li><b>${TEACHERS}</b><span>Profesoras</span></li>`;
$('#dashBtn').href = DASHBOARD_URL;

// títulos por renglones (cada uno sube detrás de su máscara) y retraso de entrada de cada bloque
document.querySelectorAll('[data-lines]').forEach(h => {
  const d0 = +(h.dataset.d || .1);
  h.innerHTML = h.textContent.split('|').map((t, i) => `<span class="ln"><span style="--d:${(d0 + i * .09).toFixed(2)}s">${t}</span></span>`).join('');
});
document.querySelectorAll('[data-a]').forEach(e => e.style.setProperty('--d', (+e.dataset.a || 0) + 's'));

/* ---------- escenas 3D ---------- */
const slides = [...document.querySelectorAll('.slide')];
let idx = Math.max(0, Math.min(slides.length - 1, (parseInt(location.hash.slice(1), 10) || 1) - 1));
fA.src = '/video/?pitch' + (idx > 0 || FIJO ? '&armado' : '');
fM.src = '/video/?pitch&look=madera&armado';
const api = f => f.contentWindow && f.contentWindow.pitch;
const ready = f => new Promise(done => { const t = setInterval(() => { if (api(f)) { clearInterval(t); done(api(f)); } }, 50); });

// los componentes reales de cada nodo, flotando sobre su tarjeta (solo en las slides donde cada quien presenta el suyo)
let flota = null;   // se crea ya con las tipografías cargadas (sus texturas llevan texto)

let lookK = 0, lookTo = 0, lastNight = -1, lastLook = -1, lastMs = 0, tSlide = 0;
const sm = (t, a, b) => smooth(clamp((t - a) / (b - a)));
const pctEl = $('#pct'), pctBar = $('#pctBar'), medidor = document.querySelector('.medidor');
// la tinta del texto sigue a la escena: azul marino de día, blanca de noche
function tint(n, k) {
  if (Math.abs(n - lastNight) < .002 && Math.abs(k - lastLook) < .002) return;
  lastNight = n; lastLook = k;
  const st = deck.style;
  st.setProperty('--bg', `rgb(${mix(mix([247, 249, 252], [250, 247, 242], k), [11, 20, 51], n)})`);
  st.setProperty('--ink', `rgb(${mix([22, 38, 96], [255, 255, 255], n)})`);
  st.setProperty('--soft', `rgb(${mix([91, 101, 115], [198, 210, 234], n)})`);
  st.setProperty('--accent', `rgb(${mix([38, 125, 192], [143, 196, 255], n)})`);
  st.setProperty('--line', `rgba(${mix([22, 38, 96], [255, 255, 255], n)},${(.16 + .08 * n).toFixed(3)})`);
}
const pc = v => (v * 100).toFixed(2) + '%';
function draw(t) {
  const k = smooth(lookK), A = api(fA), M = api(fM), id = slides[idx].dataset.id, u = t - tSlide;
  // de azul a madera: las dos escenas llevan la misma cámara y la de madera entra con un barrido suave, no con un fundido
  fM.style.setProperty('--w', (k * 135).toFixed(2) + '%');
  fM.style.visibility = k > .001 ? 'visible' : 'hidden';
  let info = null;
  if (k < .999 && A) info = A.render(t, FIJO);
  if (k > .001 && M) { const m = M.render(t, FIJO); if (m && (k >= .5 || !info)) info = m; }
  if (info) { tint(info.night, k); deck.style.setProperty('--velo', info.velo.toFixed(3)); }
  if (flota) flota.draw(t, info, FIJO);
  // la situación: la seguridad baja de 100 a 0 en tres escalones, uno por cada cosa que falta (mismos tiempos que index.html)
  if (id === 'situacion') {
    const v = 100 - 33 * sm(u, 9.3, 10.2) - 33 * sm(u, 10.7, 11.6) - 34 * sm(u, 12.1, 13);
    pctEl.textContent = Math.round(v); pctBar.style.transform = `scaleX(${(v / 100).toFixed(4)})`;
    medidor.style.setProperty('--pc', `rgb(${mix([255, 107, 94], [207, 230, 255], v / 100)})`);
  }
  // el dashboard: los totales cuentan hacia arriba cuando aparecen sus tarjetas
  if (id === 'registro') kpis.forEach((b, i) => { b.textContent = Math.round(+b.dataset.n * (1 - Math.pow(1 - clamp((u - 3.5 - i * .12) / 1.2), 3))); });
  // rótulos que siguen a la maqueta de madera: cotas y puntos de los nodos
  if (!M) return;
  if (id === 'escala') {
    const p = M.proj(COTA_PTS);
    cotas.forEach((c, i) => {
      const [a, b, a2, b2] = p.slice(i * 4, i * 4 + 4), set = (l, m, n) => { l.setAttribute('x1', pc(m[0])); l.setAttribute('y1', pc(m[1])); l.setAttribute('x2', pc(n[0])); l.setAttribute('y2', pc(n[1])); };
      set(c.l[0], a, a2); set(c.l[1], b, b2); set(c.l[2], a2, b2);
      [a2, b2].forEach((m, j) => { c.c[j].setAttribute('cx', pc(m[0])); c.c[j].setAttribute('cy', pc(m[1])); });
      for (const t of c.t) { t.setAttribute('x', pc((a2[0] + b2[0]) / 2)); t.setAttribute('y', pc((a2[1] + b2[1]) / 2)); }
    });
  }
  const sigue = (els, pts) => pts.forEach(([x, y], i) => { els[i].style.left = pc(x); els[i].style.top = pc(y); });
  if (id === 'distribucion') sigue(puntos, M.project(NODOS.map(d => d.anchor)));
}
function tick(ms) {
  const dt = Math.min(.1, (ms - lastMs) / 1000); lastMs = ms;
  if (lookK !== lookTo) lookK = lookTo > lookK ? Math.min(lookTo, lookK + dt / 1.5) : Math.max(lookTo, lookK - dt / 1.5);
  draw(ms / 1000);
  crono();
  requestAnimationFrame(tick);
}

/* ---------- navegación ---------- */
const partes = [...document.querySelectorAll('#partes li')], inicio = {};
// en vivo la portada es solo el logo al centro, sin maqueta; abierta (logo a un lado, textos y maqueta) sale nada más en el PDF
const portada = slides[0], logo0 = portada.querySelector('.logo');
let previa = false;   // la slide está en su título previo (data-antes) y espera el siguiente "siguiente" para empezar
const SOLO_LOGO = !FIJO;
const centra = () => portada.style.setProperty('--cx', (deck.clientWidth / 2 - portada.querySelector('.col').offsetLeft - 1.14 * logo0.offsetWidth / 2).toFixed(1) + 'px');   // 1.14: la escala del logo solo (pitch.css)
addEventListener('resize', centra);
function show(i, instant = false) {
  i = Math.max(0, Math.min(slides.length - 1, i));
  const s = slides[i], prev = slides[idx];
  if (prev !== s) { prev.classList.remove('on', 'pre'); prev.classList.add('out'); setTimeout(() => prev.classList.remove('out'), 450); }
  idx = i;
  portada.classList.toggle('abierta', !SOLO_LOGO);
  previa = !FIJO && !!s.dataset.antes;
  s.classList.remove('out'); s.classList.toggle('pre', previa); s.classList.toggle('on', !previa);
  lookTo = s.dataset.look === 'madera' ? 1 : 0;
  if (instant || FIJO) lookK = lookTo;
  const t = FIJO ? 0 : now();
  tSlide = t;
  for (const f of [fA, fM]) { const a = api(f); if (a) a.go(previa ? s.dataset.antes : s.dataset.pose || s.dataset.id, t, instant); }
  if (i === 0 && SOLO_LOGO) { const a = api(fA); if (a) a.reset(); }   // la maqueta no se ve en la portada
  if (flota) flota.show(s.dataset.id, t, instant || FIJO);
  const part = s.dataset.part;
  if (!(part in inicio) && (part !== 'pitch' || i > 0)) inicio[part] = now();
  partes.forEach(p => p.classList.toggle('aqui', p.dataset.part === part));
  const inmersa = 'inmersa' in s.dataset;   // slides sin marca ni pie, para que nada distraiga de la escena
  deck.classList.toggle('sin-marca', inmersa || ['portada', 'solucion', 'creamos', 'gracias'].includes(s.dataset.id));   // donde ya sale el logo grande
  deck.classList.toggle('sin-pie', i === 0 && SOLO_LOGO);
  deck.classList.toggle('inmersa', inmersa);
  $('#cuenta').textContent = String(i + 1).padStart(2, '0') + ' / ' + slides.length;
  $('#avance').style.transform = `scaleX(${((i + 1) / slides.length).toFixed(4)})`;
  if (location.hash !== '#' + (i + 1)) history.replaceState(null, '', location.pathname + location.search + '#' + (i + 1));
  if (FIJO) draw(+s.dataset.shot || 6);   // sin reloj: cada slide se dibuja en su cuadro final
}

// siguiente: una slide con título previo primero lo quita y empieza; las demás pasan a la que sigue
function avanza() {
  if (previa) {   // el título previo se va y la slide empieza de cero
    const s = slides[idx]; previa = false; s.classList.remove('pre'); s.classList.add('on'); tSlide = now();
    for (const f of [fA, fM]) { const a = api(f); if (a) a.go(s.dataset.pose || s.dataset.id, tSlide); }
    return;
  }
  show(idx + 1);
}
// R: todo como al abrir. Primera slide y los cronómetros en cero
function reset() {
  for (const k in inicio) delete inicio[k];
  show(0, true);
}

// cronómetro de la parte en curso (T lo muestra): arranca al entrar a la parte; el del pitch, al dejar la portada
const cronoEl = $('#crono');
function crono() {
  if (cronoEl.hidden) return;
  const part = slides[idx].dataset.part, lim = LIMITE[part], t0 = inicio[part];
  if (!lim) { cronoEl.textContent = ''; return; }
  const s = t0 == null ? 0 : Math.floor(now() - t0), f = x => Math.floor(x / 60) + ':' + String(x % 60).padStart(2, '0');
  cronoEl.textContent = f(s) + ' / ' + f(lim);
  cronoEl.classList.toggle('pasado', s > lim);
}

// pantalla completa (tecla F o el botón de la esquina); Safari viejo solo trae la versión con prefijo
const raiz = document.documentElement, btnCompleta = $('#completa');
const enCompleta = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
function completa() {
  const r = enCompleta() ? (document.exitFullscreen || document.webkitExitFullscreen).call(document) : (raiz.requestFullscreen || raiz.webkitRequestFullscreen).call(raiz);
  if (r && r.catch) r.catch(() => null);
}
btnCompleta.addEventListener('click', () => { completa(); btnCompleta.blur(); });   // sin foco: el espacio sigue avanzando la presentación
for (const ev of ['fullscreenchange', 'webkitfullscreenchange']) document.addEventListener(ev, () => btnCompleta.classList.toggle('puesta', enCompleta()));

addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key;
  if ((k === 'Enter' || k === ' ') && e.target.closest && e.target.closest('.boton')) return;   // sobre el botón del dashboard, lo abren
  if (k === 'ArrowRight' || k === 'ArrowDown' || k === 'PageDown' || k === ' ' || k === 'Enter') { e.preventDefault(); avanza(); }
  else if (k === 'ArrowLeft' || k === 'ArrowUp' || k === 'PageUp' || k === 'Backspace') { e.preventDefault(); show(idx - 1); }
  else if (k === 'Home') show(0);
  else if (k === 'End') show(slides.length - 1);
  else if (k === 'f' || k === 'F') completa();
  else if (k === 't' || k === 'T') cronoEl.hidden = !cronoEl.hidden;
  else if (k === 'r' || k === 'R') reset();
});
deck.addEventListener('click', e => {
  if (e.target.closest('a, .esquina')) return;   // ni las ligas ni la esquina del botón de pantalla completa cambian de slide
  const r = deck.getBoundingClientRect();
  if ((e.clientX - r.left) / r.width < .12) show(idx - 1); else avanza();
});
addEventListener('hashchange', () => { const n = parseInt(location.hash.slice(1), 10); if (n && n - 1 !== idx) show(n - 1); });

/* ---------- arranque ---------- */
await document.fonts.ready;
flota = flotantes(deck, Object.fromEntries([...document.querySelectorAll('.slide.nodo.demo')].map(s => [s.dataset.id, NODOS[s.dataset.node - 1]])));
centra();
slides[idx].classList.add('on');
show(idx, true);
// cuadro fijo de una slide (para el PDF): todo en su estado final, la maqueta en el instante data-shot
window.foto = async i => {
  show(i, true);
  // dos cuadros para que el navegador pinte (con tope de tiempo: una pestaña oculta no da cuadros)
  await new Promise(r => { requestAnimationFrame(() => requestAnimationFrame(r)); setTimeout(r, 250); });
};
window.total = slides.length;
await ready(fA);
if (idx === 0 && SOLO_LOGO) api(fA).reset(); else api(fA).armada();
show(idx, true);
if (FIJO) { await ready(fM); await api(fA).listo; await window.foto(idx); }
else { requestAnimationFrame(tick); ready(fM).then(a => a.go(slides[idx].dataset.pose || slides[idx].dataset.id, now(), true)); }
window.listo = true;
