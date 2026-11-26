// Guion de la estudiante en la slide de la situación: camina a la parada, se sienta, la banca se rompe y cae, se levanta y
// se queda esperando con el celular. girlAt(t) da, para el segundo t de la slide, dónde está y la pose de cada hueso.
// Las poses son direcciones en el marco de la persona (x: su izquierda, y: arriba, z: al frente); personas.js las aplica con 'libre'.
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smooth = t => t * t * (3 - 2 * t);
const ramp = (t, a, b) => clamp((t - a) / (b - a));
const sm = (t, a, b) => smooth(ramp(t, a, b));
const hold = (t, a, b, c, d) => sm(t, a, b) * (1 - sm(t, c, d));

// tiempos (s) y lugares (cm). El texto de la slide (index.html) y el farol (escena.js) siguen estos mismos tiempos.
export const G = {
  x0: 30, x1: -14.5,            // camina de derecha a izquierda hasta quedar frente a la banca
  zCamina: -7.2, zBanca: -10.3, zFinal: -7.0,
  t0: 1.0, t1: 6.4,             // camina
  sienta: 7.2, quiebre: 9.4,    // se sienta; el asiento se rompe
  arriba: 10.9, cel: 13.0,      // se levanta; saca el celular
  ciclo: 7.4,                   // centímetros que avanza en un ciclo de dos pasos
};

const par = (th, ca, fo, up, fr, ha, o = {}) => ({ thL: th, caL: ca, foL: fo, thR: th, caR: ca, foR: fo, upL: up, frL: fr, haL: ha, upR: up, frR: fr, haR: ha, spine: 0, tilt: 0, neck: 0, headX: 0, headY: 0, ...o });
const POSE = {
  pie: par([.04, -1, 0], [0, -1, -.05], [.1, -.45, 1], [.16, -1, .04], [.1, -1, .22], [.05, -1, .25]),
  sentada: par([.14, -.06, 1], [0, -1, .08], [.1, -.5, 1], [.14, -1, .28], [-.12, -.42, 1], [-.1, -.3, 1], { spine: -.06 }),
  // en el piso: cayó sentada entre las tablas, rodillas arriba, el cuerpo echado hacia atrás y las manos apoyadas atrás
  caida: par([.2, .5, 1], [.05, -1, .28], [.1, -.2, 1], [.5, -.75, -.5], [.22, -1, -.25], [.2, -.5, -.8],
    { thR: [.12, .22, 1], caR: [0, -1, .5], upR: [.42, -.6, -.62], spine: .22, tilt: -.44, neck: .2 }),
  // a medio levantarse: en cuclillas, el cuerpo hacia adelante
  cuclillas: par([.12, -.28, 1], [0, -1, -.5], [.1, -.3, 1], [.2, -.9, .42], [0, -.6, .9], [0, -.5, 1], { spine: .55, neck: -.2 }),
};
const CELULAR = { upR: [.12, -1, .22], frR: [-.5, .55, .85], haR: [-.5, .7, .4] };

function mix(a, b, k) {
  if (k <= 0) return a; if (k >= 1) return { ...a, ...b };
  const o = { ...a };
  for (const key in b) { const x = a[key], y = b[key]; o[key] = Array.isArray(y) ? y.map((v, i) => x[i] + (v - x[i]) * k) : x + (y - x) * k; }
  return o;
}
// caminar: la rodilla se dobla mientras la pierna va de atrás hacia adelante, y los brazos van al revés que las piernas
function camina(fase, paso) {
  const s = Math.sin(fase), c = Math.cos(fase), A = .38 * paso, K = .7 * paso, sw = .26 * paso * s, p = POSE.pie;
  return { ...p,
    thL: [.04, -1, A * s], caL: [0, -1, A * s - K * Math.max(0, c) - .05], thR: [.04, -1, -A * s], caR: [0, -1, -A * s - K * Math.max(0, -c) - .05],
    upL: [.16, -1, .04 - sw], frL: [.1, -1, .22 - sw], haL: [.05, -1, .25 - sw], upR: [.16, -1, .04 + sw], frR: [.1, -1, .22 + sw], haR: [.05, -1, .25 + sw],
    spine: .05 * paso };
}

export function girlAt(t) {
  const u = ramp(t, G.t0, G.t1), k = (u + smooth(u)) / 2, x = G.x0 + (G.x1 - G.x0) * k;
  const paso = sm(t, G.t0, G.t0 + .5) * (1 - sm(t, G.t1 - .7, G.t1));
  const kS = sm(t, G.sienta, G.sienta + 1.0);                       // de pie a sentada
  const kF = Math.pow(ramp(t, G.quiebre + .04, G.quiebre + .42), 1.6);   // cae: empieza despacio y acelera
  const kC = sm(t, G.arriba, G.arriba + .9), kP = sm(t, G.arriba + .75, G.arriba + 1.8);   // cuclillas y de pie
  const cel = sm(t, G.cel, G.cel + 1.2);
  // ya de pie, cada tanto levanta la vista y voltea a ver si viene el camión, un lado y luego el otro
  const w = t - (G.cel + 4.5), n = Math.floor(w / 8.5), giro = w > 0 ? (n % 2 ? -.6 : .75) * hold(w - n * 8.5, 0, 1.1, 3.0, 4.2) : 0;

  let s = camina(Math.abs(x - G.x0) / G.ciclo * Math.PI * 2, paso);
  s = mix(s, POSE.sentada, kS); s = mix(s, POSE.caida, kF); s = mix(s, POSE.cuclillas, kC); s = mix(s, POSE.pie, kP);
  s = mix(s, CELULAR, cel);
  const mira = 1 - Math.min(1, Math.abs(giro) * 2);
  s.neck += .3 * cel * mira; s.headX += .25 * cel * mira + .3 * kF * (1 - kC); s.headY = giro;

  return {
    x, z: G.zCamina + (G.zBanca - G.zCamina) * kS + (G.zFinal - G.zBanca) * kP,
    rot: -Math.PI / 2 + (Math.PI / 2 + .05) * sm(t, G.t1 - .35, G.t1 + .8) + .22 * kP,
    spec: s, cel,
    quiebre: ramp(t, G.quiebre, G.quiebre + .5),   // cuánto se ha roto el asiento (0 a 1)
  };
}
