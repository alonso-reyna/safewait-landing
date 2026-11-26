// Presentación final de SafeWait (Etapa 5): pitch de ventas, maqueta y dashboard en un solo deck.
// Las slides viven en index.html; la maqueta 3D corre en dos iframes de /video/?pitch (azul y madera) y aquí se decide
// qué slide va, se mueve el tiempo de ambas escenas y se funde una con otra.
//   →, espacio, clic: siguiente    ←: anterior    F: pantalla completa    T: cronómetro de la parte    R: reinicia el cronómetro
//   /pitch/#7 abre en la slide 7   |   /pitch/?fijo#7 la deja quieta en su cuadro final (así se saca el PDF: pitch/exportar.mjs)
import '@fontsource-variable/inter';
import '@fontsource-variable/inter-tight';
import './pitch.css';
import { CONFIG, TEAM, TEACHERS } from '../src/content.js';

// Los cinco nodos: el beneficio (pitch), sus piezas (distribución) y lo que registran (base de datos).
const NODOS = [
  { name: 'Iluminación', anchor: 'light', title: 'Nunca esperas a oscuras.', parts: 'Sensor de luz y tira LED', event: 'Luces encendidas', side: 'der' },
  { name: 'SOS', anchor: 'sos', title: 'Pides ayuda con una mano.', parts: 'Sensor de fuerza y alarma', event: 'Alerta activada', side: 'izq' },
  { name: 'Acceso', anchor: 'door', title: 'Solo entra quien trae tarjeta.', parts: 'Lector de tarjetas y puerta', event: 'Tarjeta autorizada', side: 'izq' },
  { name: 'Ruta', anchor: 'route', title: 'Sabes qué camión llegó.', parts: 'Sensor de color y pantalla', event: 'Ruta 2 detectada', side: 'izq' },
  { name: 'Barrotes', anchor: 'bars', title: 'La caseta se cierra con una clave.', parts: 'Teclado y motor', event: 'Barrotes arriba', side: 'der' },
];
// tiempo de cada parte calificada (segundos), para el cronómetro
const LIMITE = { pitch: 180, maqueta: 120, dashboard: 180 };

const $ = s => document.querySelector(s);
const deck = $('#deck'), fA = $('#f-azul'), fM = $('#f-madera');
const q = new URLSearchParams(location.search);
const FIJO = q.has('fijo');
const now = () => performance.now() / 1000;
const smooth = t => t * t * (3 - 2 * t);
const mix = (a, b, k) => a.map((v, i) => Math.round(v + (b[i] - v) * k));
document.documentElement.classList.toggle('fijo', FIJO);

/* ---------- contenido que sale de los datos ---------- */
document.querySelectorAll('.slide.nodo').forEach(s => {
  const n = +s.dataset.node, d = NODOS[n - 1];
  s.innerHTML = `<div class="col">
    <h2><span class="ln"><span style="--d:.1s"><b>0${n}</b>${d.name}</span></span></h2>
    <p class="sub" data-a=".5">${d.title}</p>
    <div class="pasos" data-a=".8">${NODOS.map((_, i) => `<i class="${i + 1 < n ? 'hecho' : i + 1 === n ? 'aqui' : ''}"></i>`).join('')}</div>
  </div>`;
});
// tiras de LED del problema: 20 focos, encendidos en la proporción de la cifra
document.querySelectorAll('.tira').forEach(t => {
  t.querySelector('.leds').innerHTML = Array.from({ length: 20 }, (_, i) => `<i class="${i < +t.dataset.n ? 'si' : ''}" style="--i:${i}"></i>`).join('');
});
// base de datos: un registro por nodo; dashboard: miniatura con la forma de las gráficas reales
$('#filas').innerHTML = NODOS.map((d, i) => `<li style="--i:${i}"><span class="n">${i + 1}</span><span><b>${d.name}</b><span>${d.event}</span></span></li>`).join('');
const barras = (id, v) => { const m = Math.max(...v); $(id).innerHTML = v.map((x, i) => `<i style="--h:${(x / m * 100).toFixed(1)}%;--i:${i}"></i>`).join(''); };
barras('#g-sos', [7, 7, 4, 3, 2, 1, 1]);
barras('#g-bar', [11, 7, 4, 2, 2]);
barras('#g-luz', [1, 1, 1, 1, 1, 1, 1, 1, .1, .18, .3, .38, .2, .28, .08, .22, .32, .92, .68, .88, 1, 1, 1, 1]);
$('#puntos').innerHTML = NODOS.map((d, i) => `<span class="punto vidrio-c${d.side === 'izq' ? ' izq' : ''}" style="--d:${(.8 + i * .28).toFixed(2)}s"><span class="n">${i + 1}</span><span><b>${d.name}</b><span>${d.parts}</span></span></span>`).join('');
$('#equipo').innerHTML = TEAM.map(p => `<li><b>${p.name}</b><span>${p.extra}, ${p.area}</span></li>`).join('') + `<li><b>${TEACHERS}</b><span>Profesoras</span></li>`;
const puntos = [...document.querySelectorAll('.punto')];
if (CONFIG.lookerUrl) $('#lookerBtn').href = CONFIG.lookerUrl; else $('#lookerBtn').removeAttribute('href');

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

let lookK = 0, lookTo = 0, lastNight = -1, lastLook = -1, lastMs = 0;
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
function draw(t) {
  const k = smooth(lookK), A = api(fA), M = api(fM);
  fM.style.opacity = k.toFixed(3);
  let info = null;
  if (k < .999 && A) info = A.render(t, FIJO);
  if (k > .001 && M) { const m = M.render(t, FIJO); if (m && (k >= .5 || !info)) info = m; }
  if (info) { tint(info.night, k); deck.style.setProperty('--velo', info.velo.toFixed(3)); }
  // los puntos numerados siguen a la maqueta
  if (slides[idx].dataset.id === 'distribucion' && M) {
    M.project(NODOS.map(d => d.anchor)).forEach(([x, y], i) => { puntos[i].style.left = (x * 100).toFixed(2) + '%'; puntos[i].style.top = (y * 100).toFixed(2) + '%'; });
  }
}
function tick(ms) {
  const dt = Math.min(.1, (ms - lastMs) / 1000); lastMs = ms;
  if (lookK !== lookTo) lookK = lookTo > lookK ? Math.min(lookTo, lookK + dt / 1.7) : Math.max(lookTo, lookK - dt / 1.7);
  draw(ms / 1000);
  crono();
  requestAnimationFrame(tick);
}

/* ---------- navegación ---------- */
const partes = [...document.querySelectorAll('#partes li')], inicio = {};
function show(i, instant = false) {
  i = Math.max(0, Math.min(slides.length - 1, i));
  const s = slides[i], prev = slides[idx];
  if (prev !== s) { prev.classList.remove('on'); prev.classList.add('out'); setTimeout(() => prev.classList.remove('out'), 450); }
  idx = i;
  s.classList.remove('out'); s.classList.add('on');
  lookTo = s.dataset.look === 'madera' ? 1 : 0;
  if (instant) lookK = lookTo;
  const t = FIJO ? 0 : now();
  for (const f of [fA, fM]) { const a = api(f); if (a) a.go(s.dataset.id, t, instant); }
  const part = s.dataset.part;
  if (!(part in inicio) && (part !== 'pitch' || i > 0)) inicio[part] = now();
  partes.forEach(p => p.classList.toggle('aqui', p.dataset.part === part));
  $('#cuenta').textContent = String(i + 1).padStart(2, '0') + ' / ' + slides.length;
  $('#avance').style.transform = `scaleX(${((i + 1) / slides.length).toFixed(4)})`;
  if (location.hash !== '#' + (i + 1)) history.replaceState(null, '', location.pathname + location.search + '#' + (i + 1));
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

addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key;
  if (k === 'ArrowRight' || k === 'ArrowDown' || k === 'PageDown' || k === ' ' || k === 'Enter') { e.preventDefault(); show(idx + 1); }
  else if (k === 'ArrowLeft' || k === 'ArrowUp' || k === 'PageUp' || k === 'Backspace') { e.preventDefault(); show(idx - 1); }
  else if (k === 'Home') show(0);
  else if (k === 'End') show(slides.length - 1);
  else if (k === 'f' || k === 'F') { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(() => null); }
  else if (k === 't' || k === 'T') cronoEl.hidden = !cronoEl.hidden;
  else if (k === 'r' || k === 'R') inicio[slides[idx].dataset.part] = now();
});
deck.addEventListener('click', e => {
  if (e.target.closest('a')) return;
  const r = deck.getBoundingClientRect();
  show(idx + ((e.clientX - r.left) / r.width < .12 ? -1 : 1));
});
addEventListener('hashchange', () => { const n = parseInt(location.hash.slice(1), 10); if (n && n - 1 !== idx) show(n - 1); });

/* ---------- arranque ---------- */
slides[idx].classList.add('on');
show(idx, true);
// cuadro fijo de una slide (para el PDF): todo en su estado final, la maqueta en el instante data-shot
window.foto = async i => {
  show(i, true);
  draw(+slides[i].dataset.shot || 6);
  // dos cuadros para que el navegador pinte (con tope de tiempo: una pestaña oculta no da cuadros)
  await new Promise(r => { requestAnimationFrame(() => requestAnimationFrame(r)); setTimeout(r, 250); });
};
window.total = slides.length;
await ready(fA);
show(idx, true);
if (FIJO) { await ready(fM); await window.foto(idx); }
else { requestAnimationFrame(tick); ready(fM).then(a => a.go(slides[idx].dataset.id, now(), true)); }
window.listo = true;
