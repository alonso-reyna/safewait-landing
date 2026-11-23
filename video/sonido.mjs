// Efectos de sonido del video, sintetizados (sin archivos externos) y amarrados al mismo guion que la imagen.
//   node video/sonido.mjs salida.wav
import { writeFileSync } from 'node:fs';
import { DUR, T, CODE, MOVES } from './guion.js';

const SR = 48000, N = Math.round(DUR * SR);
const L = new Float32Array(N), R = new Float32Array(N), SEND = new Float32Array(N);   // SEND: lo que va a la reverberación
let seed = 20261121;
const rnd = () => { seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, k) => a + (b - a) * k, xlerp = (a, b, k) => a * Math.pow(b / a, k);
const TAU = Math.PI * 2;

/* ---------- piezas ---------- */
const buf = dur => new Float32Array(Math.max(1, Math.round(dur * SR)));
// mezcla un sonido mono: t0 en segundos, pan −1 a 1 (número o función del avance 0 a 1), rev = cuánto va a la reverberación
function put(b, t0, gain = 1, pan = 0, rev = .15) {
  const i0 = Math.round(t0 * SR), n = b.length;
  for (let i = 0; i < n; i++) {
    const j = i0 + i; if (j < 0 || j >= N) continue;
    const p = typeof pan === 'function' ? pan(i / n) : pan, a = (p + 1) * Math.PI / 4, v = b[i] * gain;
    L[j] += v * Math.cos(a); R[j] += v * Math.sin(a); SEND[j] += v * rev;
  }
}
// filtro de estado variable: cut(k) en Hz a lo largo del sonido; modo 'lp' | 'bp' | 'hp'
function svf(b, cut, q = .7, mode = 'bp') {
  let lo = 0, bd = 0; const n = b.length, out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const f = 2 * Math.sin(Math.PI * Math.min(typeof cut === 'function' ? cut(i / n) : cut, SR * .22) / SR);
    const hp = b[i] - lo - bd / q; bd += f * hp; lo += f * bd;
    out[i] = mode === 'lp' ? lo : mode === 'hp' ? hp : bd;
  }
  return out;
}
const noise = dur => { const b = buf(dur); for (let i = 0; i < b.length; i++) b[i] = rnd() * 2 - 1; return b; };
const shape = (b, env) => { const n = b.length; for (let i = 0; i < n; i++) b[i] *= env(i / n, i / SR); return b; };
const bell = k => Math.pow(Math.sin(Math.PI * k), 2);
const edge = (dur, a = .008, r = .02) => (k) => Math.min(1, k * dur / a, (1 - k) * dur / r);   // entrada y salida sin chasquido
// oscilador con frecuencia variable f(k) y armónicos [amplitud por armónico]
function osc(dur, f, harm = [1]) {
  const b = buf(dur), n = b.length; let ph = 0;
  for (let i = 0; i < n; i++) {
    ph += TAU * (typeof f === 'function' ? f(i / n) : f) / SR;
    let v = 0; for (let h = 0; h < harm.length; h++) v += harm[h] * Math.sin(ph * (h + 1));
    b[i] = v;
  }
  return b;
}
const SAW = Array.from({ length: 14 }, (_, h) => 1 / (h + 1)), SQUARE = Array.from({ length: 13 }, (_, h) => h % 2 ? 0 : 1 / (h + 1));

/* ---------- sonidos ---------- */
const whoosh = (dur, f0, f1, q = 1.1) => shape(svf(noise(dur), k => xlerp(f0, f1, k), q, 'bp'), bell);
const swell = dur => shape(svf(noise(dur), k => 260 + 520 * bell(k), 1.4, 'bp'), bell);               // paso de cámara
function tick(f = 900, dur = .07) {                                                                    // golpecito de pieza
  const b = osc(dur, k => f * (1 - .25 * k), [1, .3]); shape(b, (k, t) => Math.exp(-t * 70));
  const c = svf(noise(.012), 3200, 1, 'bp'); for (let i = 0; i < c.length; i++) b[i] += c[i] * .5 * (1 - i / c.length);
  return b;
}
function thunk(f = 105, dur = .32) {                                                                   // algo se asienta
  const b = osc(dur, k => f * (1 - .45 * k), [1, .25]); shape(b, (k, t) => Math.exp(-t * 16) * Math.min(1, t / .004));
  const c = svf(noise(.06), 420, .8, 'lp'); for (let i = 0; i < c.length; i++) b[i] += c[i] * .7 * Math.pow(1 - i / c.length, 2);
  return b;
}
const beep = (f, dur, harm = [1, .12]) => shape(osc(dur, f, harm), edge(dur));
function chime(f, dur = .9) {                                                                          // campanita
  const b = buf(dur);
  [[1, 1, 5], [2.76, .35, 9], [5.4, .16, 14]].forEach(([m, a, d]) => { for (let i = 0; i < b.length; i++) { const t = i / SR; b[i] += a * Math.sin(TAU * f * m * t) * Math.exp(-t * d); } });
  return shape(b, (k, t) => Math.min(1, t / .003));
}
function servo(dur, f0, f1) {                                                                          // motor chico con engranes
  const b = osc(dur, k => lerp(f0, f1, Math.sin(k * Math.PI / 2)) * (1 + .012 * Math.sin(k * dur * TAU * 31)), SAW);
  const g = svf(b, 1500, 1.2, 'bp'), n = svf(noise(dur), 2600, 1.5, 'bp');
  for (let i = 0; i < g.length; i++) g[i] = g[i] * (.8 + .2 * Math.sin(i / SR * TAU * 47)) + n[i] * .18;
  return shape(g, edge(dur, .05, .09));
}
function stepper(dur, f0, f1) {                                                                        // motor a pasos: zumbido que acelera
  const b = osc(dur, k => lerp(f0, f1, clamp(k * dur / .55)) * (1 - .25 * clamp((k * dur - (dur - .3)) / .3)), SQUARE);
  const g = svf(b, 1100, .9, 'bp'), low = svf(b, 300, .7, 'lp');
  for (let i = 0; i < g.length; i++) g[i] = g[i] * .8 + low[i] * .35;
  return shape(g, edge(dur, .04, .08));
}
function engine(dur, f, vol) {                                                                         // camión diésel
  const b = osc(dur, k => f(k) * (1 + .02 * Math.sin(k * dur * TAU * 5.3)), SAW);
  const body = svf(b, k => 240 + 5 * f(k), .8, 'lp'), rumble = svf(noise(dur), 130, .9, 'lp'), air = svf(noise(dur), 1700, .8, 'bp');
  let ph = 0;
  for (let i = 0; i < body.length; i++) {
    const k = i / body.length; ph += TAU * f(k) / 2 / SR;
    body[i] = (body[i] * (.7 + .3 * Math.sin(ph)) + rumble[i] * 1.6 + air[i] * .1 * f(k) / 60) * vol(k);
  }
  return body;
}
const hiss = dur => shape(svf(noise(dur), 5200, .7, 'hp'), (k, t) => Math.min(1, t / .012) * Math.exp(-t * 7));   // frenos de aire
function crickets(dur) {
  const b = buf(dur);
  for (let v = 0; v < 3; v++) {
    const f = 4100 + v * 420, every = .62 + v * .17;
    for (let t0 = rnd() * every; t0 < dur; t0 += every * (.9 + rnd() * .25)) for (let p = 0; p < 3; p++) {
      const s = Math.round((t0 + p * .034) * SR), len = Math.round(.02 * SR);
      for (let i = 0; i < len && s + i < b.length; i++) b[s + i] += .5 * Math.sin(TAU * f * i / SR) * Math.sin(Math.PI * i / len);
    }
  }
  return b;
}
function pad(dur, notes) {                                                                             // acorde suave del cierre
  const b = buf(dur);
  // tres voces por nota, las desafinadas más bajas: da cuerpo sin que el volumen suba y baje
  notes.forEach((f, n) => [[0, 1], [4, .32], [-5, .28]].forEach(([cents, amp]) => { const ff = f * Math.pow(2, cents / 1200); for (let i = 0; i < b.length; i++) b[i] += amp * Math.sin(TAU * ff * i / SR + n * 1.7 + cents) / notes.length; }));
  return shape(svf(b, 2400, .7, 'lp'), (k, t) => Math.min(1, t / 1.0) * Math.min(1, (dur - t) / 1.3));
}
const DTMF = { '1': [697, 1209], '2': [697, 1336], '3': [697, 1477], '4': [770, 1209], '#': [941, 1477] };

/* ---------- el guion, en sonido ---------- */
// armado: soplo que sube y golpecitos de las piezas al caer en su sitio
put(whoosh(3.1, 220, 1700), T.asm, .16, k => -.4 + .8 * k, .3);
for (let t = T.asm + .25, i = 0; t < T.asm + 2.9; t += .2 + rnd() * .09, i++) put(tick(620 + i * 46 + rnd() * 60), t, .05 + rnd() * .025, rnd() * 1.2 - .6, .3);
put(servo(T.doorIn[1] - T.doorIn[0], 190, 250), T.doorIn[0], .028, -.15, .2);
put(tick(520, .08), T.doorIn[1] - .03, .09, -.15, .3);
put(whoosh(T.roofIn[1] - T.roofIn[0], 1500, 320), T.roofIn[0], .12, 0, .3);
put(thunk(), T.roofIn[1] - .09, .34, 0, .35);
// pasos de cámara
for (const [t0, d] of MOVES) put(swell(d + .3), t0 - .1, .07, 0, .25);
// techo que se levanta y regresa
for (const [a, b, c, d] of T.roofOff) {
  put(whoosh(b - a, 320, 1900), a, .1, 0, .3);
  put(whoosh(d - c, 1700, 300), c, .1, 0, .3);
  put(thunk(110, .28), d - .09, .28, 0, .35);
}
// 01 Iluminación: anochece (grillos), clic del relevador y la tira LED que sube
{ const d = T.night[3] - T.night[0]; put(shape(crickets(d), k => Math.pow(Math.sin(Math.PI * k), .6)), T.night[0], .05, k => .5 * Math.sin(k * 9), .35); }
put(tick(1500, .04), T.lamp[0], .08, -.1, .2);
{ const d = T.lamp[1] - T.lamp[0] + 1.2;
  put(shape(osc(d, k => lerp(196, 392, clamp(k * 1.6)), [1, .5, .22, .12]), (k, t) => Math.pow(clamp(t / 1.4), 2) * Math.min(1, (d - t) / .9) * (.85 + .15 * Math.sin(t * TAU * 6))), T.lamp[0], .05, -.1, .5);
  put(chime(1568, 1.2), T.lamp[1] - .25, .045, -.1, .6); }
// 02 SOS: se oprime el sensor y el buzzer suena tres veces
for (const t0 of T.sos) {
  put(thunk(240, .12), t0 - .03, .2, -.35, .2);
  for (let i = 0; i < 3; i++) put(beep(2850, .1, [1, .35, .22]), t0 + .3 + i * .2, .1, .45, .3);
}
// 03 Acceso: tarjeta aceptada, servomotor abre y luego cierra
put(beep(1397, .07), T.door[0] - .42, .09, -.1, .3); put(beep(1865, .1), T.door[0] - .33, .09, -.1, .3);
put(servo(T.door[1] - T.door[0], 210, 300), T.door[0], .075, -.1, .2); put(tick(480, .09), T.door[1] - .02, .1, -.1, .3);
put(servo(T.door[3] - T.door[2], 300, 205), T.door[2], .07, -.1, .2); put(thunk(170, .16), T.door[3] - .05, .16, -.1, .3);
// 04 Ruta: el camión llega por la derecha, frena, la pantalla avisa, y se va por la izquierda
{ const dIn = T.busIn[1] - T.busIn[0], dOut = T.busOut[1] - T.busOut[0], idle = T.busOut[0] - T.busIn[1];
  put(engine(dIn, k => lerp(84, 41, Math.pow(k, .7)), k => Math.pow(k, 1.6) * (1 - .45 * clamp((k - .85) / .15))), T.busIn[0], .24, k => lerp(.95, .35, k), .2);
  put(engine(idle + .4, () => 38, k => Math.min(1, k * 12, (1 - k) * 12)), T.busIn[1] - .2, .09, .35, .15);
  put(hiss(.7), T.busIn[1] - .12, .15, .35, .3);
  put(engine(dOut, k => lerp(40, 96, Math.pow(k, .8)), k => Math.min(1, k * 6) * Math.pow(1 - k, 1.25) + .12 * (1 - k)), T.busOut[0], .27, k => lerp(.35, -.95, k), .2);
  put(chime(1568, .8), T.oled[0], .07, -.3, .5); put(chime(2093, .9), T.oled[0] + .13, .07, -.3, .5); }
// 05 Barrotes: se teclea la clave, confirma, y el motor a pasos sube los barrotes
CODE.forEach((ch, i) => {
  const t = T.keys + i * T.keyStep, [a, b] = DTMF[ch] || [770, 1336];
  put(tick(1100, .03), t, .07, .3, .15);
  put(shape(osc(.11, a, [1]), edge(.11)), t, .045, .3, .25); put(shape(osc(.11, b, [1]), edge(.11)), t, .045, .3, .25);
});
{ const tOk = T.keys + (CODE.length - 1) * T.keyStep + .34; put(chime(1319, .7), tOk, .08, .3, .5); put(chime(1976, 1.0), tOk + .11, .08, .3, .5); }
put(stepper(T.bars[1] - T.bars[0], 150, 268), T.bars[0], .075, -.15, .2); put(thunk(150, .2), T.bars[1] - .04, .22, -.15, .3);
put(stepper(T.bars[3] - T.bars[2], 240, 190), T.bars[2], .05, -.15, .2); put(thunk(130, .2), T.bars[3] - .04, .14, -.15, .3);
// cierre: acorde suave con el logo, y el desarmado
put(pad(T.end[3] - T.end[0] + .5, [261.6, 329.6, 392.0, 493.9, 587.3]), T.end[0] - .2, .11, 0, .7);
put(chime(783.99, 1.6), T.end[1] - .35, .06, -.2, .7); put(chime(1174.7, 1.6), T.end[1] - .2, .05, .2, .7);
put(whoosh(T.roofOut[1] - T.roofOut[0], 300, 1800), T.roofOut[0], .09, 0, .3);
put(whoosh(T.dis[1] - T.dis[0], 1500, 200), T.dis[0], .14, k => .4 - .8 * k, .3);

/* ---------- reverberación corta de sala, límite suave y archivo ---------- */
{ const combs = [1557, 1617, 1491, 1422].map(d => ({ d: Math.round(d * SR / 44100), b: null, i: 0 })), aps = [225, 556].map(d => ({ d: Math.round(d * SR / 44100), b: null, i: 0 }));
  for (const c of [...combs, ...aps]) c.b = new Float32Array(c.d);
  let lp = 0;
  for (let i = 0; i < N; i++) {
    let s = 0;
    for (const c of combs) { const y = c.b[c.i]; lp = y * .75 + lp * .25; c.b[c.i] = SEND[i] + lp * .78; c.i = (c.i + 1) % c.d; s += y; }
    s *= .25;
    for (const a of aps) { const y = a.b[a.i]; a.b[a.i] = s + y * .5; a.i = (a.i + 1) % a.d; s = y - s * .5; }
    L[i] += s * .9; R[i] += s * .9;
  }
}
let peak = 0;
for (let i = 0; i < N; i++) {
  const f = Math.min(1, i / (.08 * SR), (N - 1 - i) / (.1 * SR));          // el loop empieza y termina en silencio
  L[i] = Math.tanh(L[i] * 1.6) * f; R[i] = Math.tanh(R[i] * 1.6) * f;
  peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
}
const g = .84 / peak, out = Buffer.alloc(44 + N * 4);
out.write('RIFF', 0); out.writeUInt32LE(36 + N * 4, 4); out.write('WAVEfmt ', 8); out.writeUInt32LE(16, 16); out.writeUInt16LE(1, 20); out.writeUInt16LE(2, 22);
out.writeUInt32LE(SR, 24); out.writeUInt32LE(SR * 4, 28); out.writeUInt16LE(4, 32); out.writeUInt16LE(16, 34); out.write('data', 36); out.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) { out.writeInt16LE(Math.round(clamp(L[i] * g, -1, 1) * 32767), 44 + i * 4); out.writeInt16LE(Math.round(clamp(R[i] * g, -1, 1) * 32767), 46 + i * 4); }
const file = process.argv[2] || 'safewait-sfx.wav';
writeFileSync(file, out);
console.log(`listo: ${file}  (${DUR} s, pico antes de normalizar ${peak.toFixed(3)})`);
